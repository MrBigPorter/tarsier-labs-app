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
import {
  createApi,
  fetchBaseQuery,
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
} from '@reduxjs/toolkit/query/react';
import { getApiBaseUrl } from '@/lib/env';
import { storage } from '@/lib/storage';
import { getCurrentLanguage } from '@/lib/i18n';
import { logout } from '@/store/slices/authSlice';
import { navigateToAuth } from '@/lib/navigationRef';
import { recordApiCall } from '@/lib/perf/apiTiming';

/**
 * Performance.now() is available at runtime in React Native (Hermes provides
 * it on globalThis), but TypeScript's React Native config excludes the DOM lib.
 * This local declaration avoids adding a global .d.ts for one API.
 *
 * Note: Wall-clock time measured from JS includes JS thread queueing delay.
 * For true network timing, use DevTools Network tab. This measurement tells
 * you how long the user actually waited (UX perception), not server latency.
 */
declare const performance: { now(): number };

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
  return (
    typeof error.status === 'number' &&
    error.status >= 500 &&
    error.status < 600
  );
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const baseQuery: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  // Start timing for performance monitoring (uses performance.now() for
  // monotonic, sub-millisecond precision).
  //
  // IMPORTANT: Wall-clock time measured from React Native's JS thread
  // includes JS thread queueing delay (e.g. rendering blocks). This is
  // NOT pure network latency — it's the total time the user waited for
  // the UI to update. For true server timing, check DevTools Network tab.
  const tWallStart = performance.now();
  const endpoint = typeof args === 'string' ? args : (args.url as string);
  const method = typeof args === 'string' ? 'GET' : (args.method ?? 'GET');

  // Note: lang parameter is NOT injected here — each endpoint already passes
  // `lang` from getCurrentLanguage() at the component level (e.g. HomeScreen).
  // Injecting it here would cause duplicate ?lang=en&lang=en in the URL.

  // Build the raw base query
  const rawBaseQuery = fetchBaseQuery({
    baseUrl: getApiBaseUrl(),
    prepareHeaders: headers => {
      // Inject auth token if available
      const token = storage.getString(AUTH_TOKEN_KEY);
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }

      // Set locale header for i18n based on current language
      headers.set('Accept-Language', getCurrentLanguage());

      return headers;
    },
    credentials: 'omit',
  });

  // ── Phased timing instrumentation ─────────────────────────────────
  // Measures wall-clock duration of the first attempt and each retry.
  // Uses performance.now() (monotonic, sub-ms) instead of Date.now().
  //
  // Caveat: In React Native's single-threaded architecture, the measured
  // duration includes time the JS thread spent on other work (rendering)
  // before processing the network response. The value accurately reflects
  // user-perceived wait time, not server/network latency.
  let result = await rawBaseQuery(args, api, extraOptions);
  const tWallAfterFirst = performance.now();
  let attempt = 1;
  while (isRetryableError(result.error) && attempt <= RETRY_MAX) {
    const backoffMs = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
    console.warn(
      `[API] ⏱️ Retry ${attempt}/${RETRY_MAX}: first attempt took ${Math.round(tWallAfterFirst - tWallStart)}ms, waiting ${backoffMs}ms for ${method} ${endpoint}`,
    );
    await delay(backoffMs);
    const tRetryStart = performance.now();
    result = await rawBaseQuery(args, api, extraOptions);
    const tRetryEnd = performance.now();
    console.warn(
      `[API] ⏱️ Retry ${attempt} completed in ${Math.round(tRetryEnd - tRetryStart)}ms, status: ${result.error?.status ?? 200}`,
    );
    attempt++;
  }

  // Record API call timing for the perf monitor
  {
    const timestamp = Date.now(); // wall-clock timestamp for record-keeping
    const wallClockMs = performance.now() - tWallStart;
    const status = result.error
      ? typeof result.error.status === 'number'
        ? result.error.status
        : 0
      : 200;
    recordApiCall({
      endpoint,
      method,
      duration: Math.round(wallClockMs),
      status,
      timestamp,
    });

    // ── Slow API warning (threshold: 1000ms wall-clock) ──────────
    // This measures user-perceived wait time (includes JS thread queueing).
    // High values may indicate rendering bottlenecks, not network issues.
    // Compare with DevTools Network tab to distinguish the two.
    if (__DEV__ && wallClockMs > 1000) {
      console.warn(
        `[PerfMonitor] ⚠️ Slow API: ${method} ${endpoint} — ` +
          `${Math.round(wallClockMs)}ms wall ` +
          `(threshold: 1000ms)`,
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
    console.warn(`[API] ❌ ${method} ${endpoint} — ${status}: ${errorMsg}`);
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
          const newRefreshToken =
            tokenData?.refreshToken || response.refreshToken;

          if (newToken) {
            // Store new tokens
            storage.set(AUTH_TOKEN_KEY, newToken);
            if (newRefreshToken) {
              storage.set(REFRESH_TOKEN_KEY, newRefreshToken);
            }

            // Retry the original request with the new token
            const retryQuery = fetchBaseQuery({
              baseUrl: getApiBaseUrl(),
              prepareHeaders: headers => {
                headers.set('Authorization', `Bearer ${newToken}`);
                headers.set('Accept-Language', 'en');
                return headers;
              },
              credentials: 'omit',
            });

            result = await retryQuery(args, api, extraOptions);
          } else {
            // Refresh succeeded but no tokens in response — corrupted/invalid state
            console.warn(
              '[API] Token refresh response missing tokens — clearing stored tokens',
            );
            storage.delete(AUTH_TOKEN_KEY);
            storage.delete(REFRESH_TOKEN_KEY);
            // Sync Redux auth state and redirect to login
            api.dispatch(logout());
            navigateToAuth();
          }
        } else {
          // Refresh returned non-2xx (e.g. 400 INVALID_JWT_TOKEN)
          // Token is corrupted or expired — clear stored tokens to break the cycle
          console.warn('[API] Token refresh failed — clearing stored tokens');
          storage.delete(AUTH_TOKEN_KEY);
          storage.delete(REFRESH_TOKEN_KEY);
          // Sync Redux auth state and redirect to login
          api.dispatch(logout());
          navigateToAuth();
        }
      } catch (error) {
        // Network error during refresh — clear tokens to avoid infinite retry loop
        console.warn(
          '[API] Token refresh network error — clearing stored tokens',
          error,
        );
        storage.delete(AUTH_TOKEN_KEY);
        storage.delete(REFRESH_TOKEN_KEY);
        // Sync Redux auth state and redirect to login
        api.dispatch(logout());
        navigateToAuth();
      }
    } else {
      // No refresh token available — user needs to re-authenticate
      console.warn('[API] 401 but no refresh token — clearing access token');
      storage.delete(AUTH_TOKEN_KEY);
      // Sync Redux auth state and redirect to login
      api.dispatch(logout());
      navigateToAuth();
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
export type BlogTagTypes =
  | 'Article'
  | 'Category'
  | 'Tag'
  | 'Comment'
  | 'Bookmark'
  | 'Like';

export const blogApi = createApi({
  reducerPath: 'blogApi',
  baseQuery,
  tagTypes: [
    'Article',
    'Category',
    'Tag',
    'Comment',
    'Bookmark',
    'Like',
  ] as BlogTagTypes[],
  endpoints: () => ({}),
});
