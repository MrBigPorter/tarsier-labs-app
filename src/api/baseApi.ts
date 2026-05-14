/**
 * RTK Query base API definition
 *
 * This is the foundation for all API endpoints. Endpoint definitions are split
 * across separate files using blogApi.injectEndpoints() for code organization.
 *
 * Architecture:
 *   baseApi.ts (createApi - this file)
 *     → endpoints/articles.ts  (blogApi.injectEndpoints)
 *     → endpoints/categories.ts
 *     → endpoints/tags.ts
 *     → endpoints/comments.ts
 *     → endpoints/auth.ts
 *
 * Store middleware registration is in store/index.ts via blogApi.middleware.
 */
import { createApi, fetchBaseQuery, BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query/react';
import { getApiBaseUrl } from '../lib/env';
import { storage } from '../lib/storage';
import { getCurrentLanguage } from '../lib/i18n';

/** Token storage keys (must match authSlice.ts) */
const AUTH_TOKEN_KEY = 'auth_access_token';
const REFRESH_TOKEN_KEY = 'auth_refresh_token';

/**
 * Base query with automatic auth token injection and locale header.
 *
 * - Injects Authorization header from MMKV-stored access token
 * - Adds Accept-Language header for i18n
 * - Handles 401 → token refresh → retry
 */
const baseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions,
) => {
  // Build the raw base query
  const rawBaseQuery = fetchBaseQuery({
    baseUrl: getApiBaseUrl(),
    prepareHeaders: (headers) => {
      // Inject auth token if available
      const token = storage.getString(AUTH_TOKEN_KEY);
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }

      // Set locale header for i18n based on current language
      headers.set('Accept-Language', getCurrentLanguage());

      return headers;
    },
    credentials: 'include',
  });

  let result = await rawBaseQuery(args, api, extraOptions);

  // Handle 401 Unauthorized — attempt token refresh
  if (result.error && result.error.status === 401) {
    const refreshToken = storage.getString(REFRESH_TOKEN_KEY);
    if (refreshToken) {
      try {
        // Attempt to refresh the token
        const refreshResult = await rawBaseQuery(
          {
            url: '/api/v1/frontend/auth/refresh',
            method: 'POST',
            body: { refreshToken },
          },
          api,
          extraOptions,
        );

        if (refreshResult.data) {
          // Extract new tokens from refresh response
          const response = refreshResult.data as any;
          const newToken = response.data?.accessToken || response.accessToken;
          const newRefreshToken = response.data?.refreshToken || response.refreshToken;

          if (newToken) {
            // Store new tokens
            storage.set(AUTH_TOKEN_KEY, newToken);
            if (newRefreshToken) {
              storage.set(REFRESH_TOKEN_KEY, newRefreshToken);
            }

            // Retry the original request with the new token
            const retryQuery = fetchBaseQuery({
              baseUrl: getApiBaseUrl(),
              prepareHeaders: (headers) => {
                headers.set('Authorization', `Bearer ${newToken}`);
                headers.set('Accept-Language', 'en');
                return headers;
              },
              credentials: 'include',
            });

            result = await retryQuery(args, api, extraOptions);
          }
        }
      } catch {
        // Token refresh failed — don't retry
      }
    }
  }

  return result;
};

/**
 * Type definitions for paginated API responses
 */
export interface ApiPaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Standard API response wrapper from the backend
 */
export interface ApiResponseWrapper<T> {
  code: number;
  message: string;
  data: T;
  timestamp?: number;
}

/**
 * Blog API tag types for cache invalidation
 */
export type BlogTagTypes = 'Article' | 'Category' | 'Tag' | 'Comment' | 'Bookmark';

export const blogApi = createApi({
  reducerPath: 'blogApi',
  baseQuery,
  tagTypes: ['Article', 'Category', 'Tag', 'Comment', 'Bookmark'] as BlogTagTypes[],
  endpoints: () => ({}),
});
