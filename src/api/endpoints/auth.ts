import { blogApi, ApiResponseWrapper } from '../baseApi';
import { storage } from '../../lib/storage';

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

export const authApi = blogApi.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * Login with email + password
     * POST /api/v1/frontend/auth/login
     */
    login: builder.mutation<AuthTokens, LoginParams>({
      query: (credentials) => ({
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
      query: (userData) => ({
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
     * Refresh authentication tokens
     * POST /api/v1/frontend/auth/refresh
     */
    refreshToken: builder.mutation<AuthTokens, RefreshParams>({
      query: ({ refreshToken }) => ({
        url: '/api/v1/frontend/auth/refresh',
        method: 'POST',
        body: { refreshToken },
      }),
      transformResponse: (response: ApiResponseWrapper<AuthTokens>) =>
        unwrapData(response),
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
     * POST /api/v1/frontend/auth/logout
     */
    logout: builder.mutation<void, void>({
      query: () => ({
        url: '/api/v1/frontend/auth/logout',
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
     * GET /api/v1/frontend/auth/me
     */
    getProfile: builder.query<AuthTokens['user'], void>({
      query: () => '/api/v1/frontend/auth/me',
      transformResponse: (response: ApiResponseWrapper<AuthTokens['user']>) =>
        unwrapData(response),
      providesTags: ['Bookmark'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useLoginMutation,
  useRegisterMutation,
  useRefreshTokenMutation,
  useLogoutMutation,
  useGetProfileQuery,
  useLazyGetProfileQuery,
} = authApi;
