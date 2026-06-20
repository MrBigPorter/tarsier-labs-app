/**
 * API Monitoring — Sentry instrumentation for all API calls.
 *
 * Tracks latency, errors, retries, and token refresh events.
 * Integrated into baseApi.ts so a single file covers ALL endpoints.
 *
 * Usage in baseApi.ts:
 *   import { recordApiLatency, recordApiError, recordApiRetry, ... } from '@/lib/monitoring/apiMonitoring';
 *
 *   1. After each successful/wall-clock measurement:
 *      recordApiLatency({ endpoint, method, statusCode, durationMs });
 *
 *   2. On error (4xx/5xx):
 *      recordApiError({ endpoint, method, statusCode, durationMs });
 *
 *   3. Inside retry loop:
 *      recordApiRetry(endpoint, method);
 *      recordApiRetrySuccess(endpoint, method);  // if retry succeeded
 *      recordApiRetryExhausted(endpoint, method); // if all retries failed
 *
 *   4. In 401 token refresh handler:
 *      recordTokenRefresh();
 *      recordTokenRefreshSuccess();  // if refresh succeeded
 *      recordTokenRefreshFailure();  // if refresh failed
 */
import * as Sentry from '@sentry/react-native';
import {
  getPlatformAttr,
  API_LATENCY_MS,
  API_ERROR,
  API_RETRY,
  API_RETRY_SUCCESS,
  API_RETRY_EXHAUSTED,
  API_TOKEN_REFRESH,
  API_TOKEN_REFRESH_SUCCESS,
  API_TOKEN_REFRESH_FAILURE,
} from './types';

// ── Types ─────────────────────────────────────────────────────────────────

export interface ApiCallAttrs {
  endpoint: string;
  method: string;
  statusCode: number;
  durationMs: number;
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Record API call latency as a distribution metric.
 * 100% sampling — negligible overhead.
 */
export function recordApiLatency(attrs: ApiCallAttrs): void {
  Sentry.metrics.distribution(API_LATENCY_MS, attrs.durationMs, {
    unit: 'millisecond',
    attributes: {
      endpoint: attrs.endpoint,
      method: attrs.method,
      status: String(attrs.statusCode),
      platform: getPlatformAttr(),
    },
  });
}

/**
 * Record an API error (4xx or 5xx).
 * 100% sampling — critical signal.
 */
export function recordApiError(attrs: ApiCallAttrs): void {
  Sentry.addBreadcrumb({
    category: 'api',
    message: `API error: ${attrs.method} ${attrs.endpoint} → ${attrs.statusCode} (${attrs.durationMs}ms)`,
    level: 'error',
  });
  Sentry.metrics.count(API_ERROR, 1, {
    attributes: {
      endpoint: attrs.endpoint,
      method: attrs.method,
      status: String(attrs.statusCode),
      platform: getPlatformAttr(),
    },
  });
}

/**
 * Record that a retry was triggered for a 5xx error.
 */
export function recordApiRetry(endpoint: string, method: string): void {
  Sentry.addBreadcrumb({
    category: 'api',
    message: `Retry triggered: ${method} ${endpoint}`,
    level: 'warning',
  });
  Sentry.metrics.count(API_RETRY, 1, {
    attributes: {
      endpoint,
      method,
      platform: getPlatformAttr(),
    },
  });
}

/**
 * Record that a retry succeeded (subsequent attempt returned 2xx).
 */
export function recordApiRetrySuccess(endpoint: string, method: string): void {
  Sentry.metrics.count(API_RETRY_SUCCESS, 1, {
    attributes: {
      endpoint,
      method,
      platform: getPlatformAttr(),
    },
  });
}

/**
 * Record that all retry attempts were exhausted and the endpoint still
 * returns 5xx.
 */
export function recordApiRetryExhausted(
  endpoint: string,
  method: string,
): void {
  Sentry.addBreadcrumb({
    category: 'api',
    message: `Retry exhausted: ${method} ${endpoint}`,
    level: 'error',
  });
  Sentry.metrics.count(API_RETRY_EXHAUSTED, 1, {
    attributes: {
      endpoint,
      method,
      platform: getPlatformAttr(),
    },
  });
}

/**
 * Record that a token refresh was attempted after a 401 response.
 */
export function recordTokenRefresh(): void {
  Sentry.addBreadcrumb({
    category: 'auth',
    message: 'Token refresh attempted',
    level: 'info',
  });
  Sentry.metrics.count(API_TOKEN_REFRESH, 1, {
    attributes: { platform: getPlatformAttr() },
  });
}

/**
 * Record that token refresh succeeded (new tokens obtained).
 */
export function recordTokenRefreshSuccess(): void {
  Sentry.addBreadcrumb({
    category: 'auth',
    message: 'Token refresh succeeded',
    level: 'info',
  });
  Sentry.metrics.count(API_TOKEN_REFRESH_SUCCESS, 1, {
    attributes: { platform: getPlatformAttr() },
  });
}

/**
 * Record that token refresh failed (tokens cleared, user redirected to auth).
 * This is a critical event — the user is unexpectedly logged out.
 */
export function recordTokenRefreshFailure(): void {
  Sentry.addBreadcrumb({
    category: 'auth',
    message: 'Token refresh failed — user logged out',
    level: 'fatal',
  });
  Sentry.metrics.count(API_TOKEN_REFRESH_FAILURE, 1, {
    attributes: { platform: getPlatformAttr() },
  });

  Sentry.captureException(new Error('Token refresh failed — user logged out'), {
    tags: { domain: 'auth' },
    extra: { platform: getPlatformAttr() },
  });
}
