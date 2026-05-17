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
import { getApiBaseUrl } from '@/lib/env';
import { storage } from '@/lib/storage';
import { getCurrentLanguage } from '@/lib/i18n';
import { recordApiCall } from '@/lib/perf/apiTiming';

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
/**
 * Retry configuration for 5xx server errors.
 *
 * Matches Web's retry strategy:
 * - 3 retries max
 * - Exponential backoff: 1s → 2s → 4s
 * - Only retry on 5xx (server errors), never on 4xx (client errors)
 */
const RETRY_MAX = 3;
const RETRY_BASE_DELAY_MS = 1000;

function isRetryableError(error: FetchBaseQueryError | undefined): boolean {
  if (!error) return false;
  // Only retry on 5xx HTTP status codes (server errors)
  return typeof error.status === 'number' && error.status >= 500 && error.status < 600;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const baseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions,
) => {
  // Start timing for performance monitoring
  const startTime = Date.now();
  const endpoint = typeof args === 'string' ? args : (args.url as string);
  const method = typeof args === 'string' ? 'GET' : (args.method ?? 'GET');

  // Note: lang parameter is NOT injected here — each endpoint already passes
  // `lang` from getCurrentLanguage() at the component level (e.g. HomeScreen).
  // Injecting it here would cause duplicate ?lang=en&lang=en in the URL.

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

  // Execute request with retry logic for 5xx server errors
  let result = await rawBaseQuery(args, api, extraOptions);
  let attempt = 1;
  while (isRetryableError(result.error) && attempt <= RETRY_MAX) {
    const backoffMs = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
    console.warn(
      `[API] 🔁 Retry ${attempt}/${RETRY_MAX} for ${method} ${endpoint} after ${backoffMs}ms (status: ${result.error?.status})`,
    );
    await delay(backoffMs);
    result = await rawBaseQuery(args, api, extraOptions);
    attempt++;
  }

  // Record API call timing for the perf monitor
  {
    const duration = Date.now() - startTime;
    const status = result.error
      ? typeof result.error.status === 'number'
        ? result.error.status
        : 0
      : 200;
    recordApiCall({
      endpoint,
      method,
      duration,
      status,
      timestamp: startTime,
    });

    // ── Slow API warning (threshold: 1000ms) ─────────────────────
    if (__DEV__ && duration > 1000) {
      console.warn(
        `[PerfMonitor] ⚠️ Slow API: ${method} ${endpoint} — ${duration}ms (threshold: 1000ms)`,
      );
    }
  }

  // ── Error logging ────────────────────────────────────────────────
  if (result.error) {
    const status = result.error.status ?? 'unknown';
    const errorMsg =
      typeof result.error.data === 'object' && result.error.data !== null
        ? JSON.stringify(result.error.data)
        : String(result.error.data ?? 'No error details');
    console.warn(
      `[API] ❌ ${method} ${endpoint} — ${status}: ${errorMsg}`,
    );
  }

  // Handle 401 Unauthorized — attempt token refresh
  if (result.error && result.error.status === 401) {
    const refreshToken = storage.getString(REFRESH_TOKEN_KEY);
    if (refreshToken) {
      try {
        // Attempt to refresh the token
        const refreshResult = await rawBaseQuery(
          {
            url: '/api/v1/auth/refresh',
            method: 'POST',
            body: { refreshToken },
          },
          api,
          extraOptions,
        );

        if (refreshResult.data) {
          // Extract new tokens from refresh response
          // Server returns: { data: { tokens: { accessToken, refreshToken } } }
          const response = refreshResult.data as any;
          const tokenData = response.data?.tokens || response.data;
          const newToken = tokenData?.accessToken || response.accessToken;
          const newRefreshToken = tokenData?.refreshToken || response.refreshToken;

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
          } else {
            // Refresh succeeded but no tokens in response — corrupted/invalid state
            console.warn('[API] Token refresh response missing tokens — clearing stored tokens');
            storage.delete(AUTH_TOKEN_KEY);
            storage.delete(REFRESH_TOKEN_KEY);
          }
        } else {
          // Refresh returned non-2xx (e.g. 400 INVALID_JWT_TOKEN)
          // Token is corrupted or expired — clear stored tokens to break the cycle
          console.warn('[API] Token refresh failed — clearing stored tokens');
          storage.delete(AUTH_TOKEN_KEY);
          storage.delete(REFRESH_TOKEN_KEY);
        }
      } catch (error) {
        // Network error during refresh — clear tokens to avoid infinite retry loop
        console.warn('[API] Token refresh network error — clearing stored tokens', error);
        storage.delete(AUTH_TOKEN_KEY);
        storage.delete(REFRESH_TOKEN_KEY);
      }
    } else {
      // No refresh token available — user needs to re-authenticate
      console.warn('[API] 401 but no refresh token — clearing access token');
      storage.delete(AUTH_TOKEN_KEY);
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
export type BlogTagTypes = 'Article' | 'Category' | 'Tag' | 'Comment' | 'Bookmark' | 'Like';

export const blogApi = createApi({
  reducerPath: 'blogApi',
  baseQuery,
  tagTypes: ['Article', 'Category', 'Tag', 'Comment', 'Bookmark', 'Like'] as BlogTagTypes[],
  endpoints: () => ({}),
});
