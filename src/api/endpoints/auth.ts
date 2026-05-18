import { blogApi, ApiResponseWrapper } from '@/api/baseApi';
import { storage } from '@/lib/storage';

function unwrapData<T>(response: ApiResponseWrapper<T>): T {
  return response.data;
}

interface LoginParams {
  email: string;
  password: string;
}

interface RegisterParams {
  email: string;
  password: string;
  nickname: string;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    nickname: string;
    avatar?: string;
  };
}

interface RefreshParams {
  refreshToken: string;
}

/** Params for sending email verification code (passwordless) */
interface SendEmailCodeParams {
  email: string;
}

/**
 * Login response from backend when logging in with email code.
 *
 * Matches the Web backend response format:
 * ```json
 * {
 *   "tokens": { "accessToken": "...", "refreshToken": "..." },
 *   "id": "...",
 *   "email": "...",
 *   "nickname": "...",
 *   "username": "...",
 *   "avatar": "..."
 * }
 * ```
 */
interface EmailCodeLoginResponse {
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
  id: string;
  email: string;
  nickname: string;
  username?: string;
  avatar?: string | null;
}

/** Response from clearing all user activity data on the server */
interface ClearUserDataResponse {
  accountDeleted: boolean;
  anonymizedComments: number;
  deletedBookmarks: number;
}

export const authApi = blogApi.injectEndpoints({
  endpoints: builder => ({
    /**
     * Login with email + password
     * POST /api/v1/frontend/auth/login
     */
    login: builder.mutation<AuthTokens, LoginParams>({
      query: credentials => ({
        url: '/api/v1/frontend/auth/login',
        method: 'POST',
        body: credentials,
      }),
      transformResponse: (response: ApiResponseWrapper<AuthTokens>) =>
        unwrapData(response),
      // On success, persist tokens to MMKV
      onQueryStarted: async (_arg, { queryFulfilled }) => {
        try {
          const { data } = await queryFulfilled;
          storage.set('auth_access_token', data.accessToken);
          storage.set('auth_refresh_token', data.refreshToken);
          storage.set('auth_user', JSON.stringify(data.user));
        } catch {
          // Login failed — don't persist
        }
      },
      invalidatesTags: ['Bookmark'],
    }),

    /**
     * Register a new user
     * POST /api/v1/frontend/auth/register
     */
    register: builder.mutation<AuthTokens, RegisterParams>({
      query: userData => ({
        url: '/api/v1/frontend/auth/register',
        method: 'POST',
        body: userData,
      }),
      transformResponse: (response: ApiResponseWrapper<AuthTokens>) =>
        unwrapData(response),
      onQueryStarted: async (_arg, { queryFulfilled }) => {
        try {
          const { data } = await queryFulfilled;
          storage.set('auth_access_token', data.accessToken);
          storage.set('auth_refresh_token', data.refreshToken);
          storage.set('auth_user', JSON.stringify(data.user));
        } catch {
          // Registration failed
        }
      },
    }),

    /**
     * Send email verification code (passwordless)
     * POST /v1/auth/email/send-code
     */
    sendEmailCode: builder.mutation<void, SendEmailCodeParams>({
      query: params => ({
        url: '/api/v1/auth/email/send-code',
        method: 'POST',
        body: params,
      }),
    }),

    /**
     * Login with email verification code (passwordless)
     * POST /v1/auth/email/login
     */
    loginWithEmailCode: builder.mutation<
      EmailCodeLoginResponse,
      { email: string; code: string }
    >({
      query: ({ email, code }) => ({
        url: '/api/v1/auth/email/login',
        method: 'POST',
        body: { email, code },
      }),
      transformResponse: (
        response: ApiResponseWrapper<EmailCodeLoginResponse>,
      ) => unwrapData(response),
      onQueryStarted: async (_arg, { queryFulfilled }) => {
        try {
          const { data } = await queryFulfilled;
          // Tokens are nested under `tokens.*` matching Web backend format
          storage.set('auth_access_token', data.tokens.accessToken);
          storage.set('auth_refresh_token', data.tokens.refreshToken);
          storage.set(
            'auth_user',
            JSON.stringify({
              id: data.id,
              email: data.email,
              nickname: data.nickname,
              avatar: data.avatar ?? undefined,
            }),
          );
        } catch {
          // Login failed — don't persist
        }
      },
      invalidatesTags: ['Bookmark'],
    }),

    /**
     * Refresh authentication tokens
     * POST /api/v1/auth/refresh
     *
     * Server returns tokens nested under `data.tokens.*` matching
     * the email code login response format:
     *   { data: { tokens: { accessToken, refreshToken } } }
     */
    refreshToken: builder.mutation<AuthTokens, RefreshParams>({
      query: ({ refreshToken }) => ({
        url: '/api/v1/auth/refresh',
        method: 'POST',
        body: { refreshToken },
      }),
      transformResponse: (response: ApiResponseWrapper<any>) => {
        const raw = unwrapData(response);
        // Flatten { tokens: { accessToken, refreshToken } } → AuthTokens
        return {
          accessToken: raw.tokens?.accessToken,
          refreshToken: raw.tokens?.refreshToken,
          user: raw.user ?? {},
        } as AuthTokens;
      },
      onQueryStarted: async (_arg, { queryFulfilled }) => {
        try {
          const { data } = await queryFulfilled;
          storage.set('auth_access_token', data.accessToken);
          storage.set('auth_refresh_token', data.refreshToken);
        } catch {
          // Refresh failed
        }
      },
    }),

    /**
     * Logout — clear stored tokens
     * POST /api/v1/auth/logout
     */
    logout: builder.mutation<void, void>({
      query: () => ({
        url: '/api/v1/auth/logout',
        method: 'POST',
      }),
      onQueryStarted: async (_arg, { queryFulfilled }) => {
        try {
          await queryFulfilled;
        } finally {
          // Always clear tokens regardless of server response
          storage.delete('auth_access_token');
          storage.delete('auth_refresh_token');
          storage.delete('auth_user');
        }
      },
      invalidatesTags: ['Bookmark'],
    }),

    /**
     * Get current user profile
     * GET /api/v1/auth/profile
     */
    getProfile: builder.query<AuthTokens['user'], void>({
      query: () => '/api/v1/auth/profile',
      transformResponse: (response: ApiResponseWrapper<AuthTokens['user']>) =>
        unwrapData(response),
      providesTags: ['Bookmark'],
    }),

    /**
     * Clear all user activity data on the server
     * DELETE /api/v1/auth/account/data
     *
     * Deletes user's comments (anonymized), bookmarks, and likes.
     * The account itself is NOT deleted — only activity data.
     * Invalidates Comment, Like, and Bookmark tags so RTK Query refetches.
     */
    clearUserData: builder.mutation<ClearUserDataResponse, void>({
      query: () => ({
        url: '/api/v1/auth/account/data',
        method: 'DELETE',
      }),
      transformResponse: (
        response: ApiResponseWrapper<ClearUserDataResponse>,
      ) => unwrapData(response),
      invalidatesTags: ['Comment', 'Like', 'Bookmark'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useLoginMutation,
  useRegisterMutation,
  useSendEmailCodeMutation,
  useLoginWithEmailCodeMutation,
  useRefreshTokenMutation,
  useLogoutMutation,
  useGetProfileQuery,
  useLazyGetProfileQuery,
  useClearUserDataMutation,
} = authApi;
