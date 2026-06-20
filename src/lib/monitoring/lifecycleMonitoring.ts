/**
 * Lifecycle Monitoring — Sentry instrumentation for app lifecycle events.
 *
 * Tracks cold start performance (via Tracing span), background/foreground
 * transitions, and article list cache hit/miss rates.
 *
 * Usage:
 *   import { startColdStartSpan, endColdStartSpan, recordAppBackground, recordAppForeground, recordCacheHit, recordCacheMiss } from '@/lib/monitoring/lifecycleMonitoring';
 *
 *   const span = startColdStartSpan();
 *   // ... app initializes ...
 *   endColdStartSpan(span);
 *
 *   recordCacheHit('HomeScreen');
 */
import * as Sentry from '@sentry/react-native';
import {
  getPlatformAttr,
  LIFECYCLE_BACKGROUND,
  LIFECYCLE_FOREGROUND,
  CACHE_HIT,
  CACHE_MISS,
} from './types';

// ── Sampling ──────────────────────────────────────────────────────────────

/** 20% sampling rate for cold start span */
const SPAN_SAMPLE_RATE = 0.2;

function shouldSampleSpan(): boolean {
  return Math.random() < SPAN_SAMPLE_RATE;
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Start a cold start tracing span.
 *
 * Call this at the beginning of App.tsx's init useEffect. The span measures
 * the total time from JS bundle load to first screen rendered.
 *
 * Returns null if not sampled (80% of the time).
 */
export function startColdStartSpan(): Sentry.Span | null {
  if (!shouldSampleSpan()) {
    return null;
  }

  const span = Sentry.startInactiveSpan({
    op: 'app.lifecycle.cold_start',
    name: 'Cold Start',
    attributes: {
      platform: getPlatformAttr(),
    },
  });

  return span;
}

/**
 * End the cold start span.
 *
 * Call this after the first screen has rendered and data has loaded.
 *
 * @param span — The span returned by startColdStartSpan(), or null
 */
export function endColdStartSpan(span: Sentry.Span | null): void {
  span?.end();
}

/**
 * Record that the app moved to the background.
 */
export function recordAppBackground(): void {
  Sentry.addBreadcrumb({
    category: 'app.lifecycle',
    message: 'App moved to background',
    level: 'info',
  });
  Sentry.metrics.count(LIFECYCLE_BACKGROUND, 1, {
    attributes: { platform: getPlatformAttr() },
  });
}

/**
 * Record that the app returned to the foreground.
 */
export function recordAppForeground(): void {
  Sentry.addBreadcrumb({
    category: 'app.lifecycle',
    message: 'App returned to foreground',
    level: 'info',
  });
  Sentry.metrics.count(LIFECYCLE_FOREGROUND, 1, {
    attributes: { platform: getPlatformAttr() },
  });
}

/**
 * Record an article list cache hit — data was loaded from MMKV cache
 * instead of fetching from the API.
 *
 * @param source — The screen or component that used the cached data
 */
export function recordCacheHit(source: string): void {
  Sentry.addBreadcrumb({
    category: 'cache',
    message: `Cache hit: ${source}`,
    level: 'info',
  });
  Sentry.metrics.count(CACHE_HIT, 1, {
    attributes: {
      source,
      platform: getPlatformAttr(),
    },
  });
}

/**
 * Record an article list cache miss — no valid cache was found, so data
 * was fetched from the API.
 *
 * @param source — The screen or component that missed the cache
 */
export function recordCacheMiss(source: string): void {
  Sentry.addBreadcrumb({
    category: 'cache',
    message: `Cache miss: ${source}`,
    level: 'info',
  });
  Sentry.metrics.count(CACHE_MISS, 1, {
    attributes: {
      source,
      platform: getPlatformAttr(),
    },
  });
}
