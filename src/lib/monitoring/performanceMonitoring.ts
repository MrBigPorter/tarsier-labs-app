/**
 * Performance Monitoring — Sentry Tracing child spans + screen render timing.
 *
 * Augments the auto-created navigation transactions (from reactNavigationIntegration)
 * with child spans so the Sentry Performance waterfall shows meaningful breakdowns:
 *
 *   ArticleDetail (2.3s)
 *   ├── screen.initial_render (0.1s)
 *   ├── api:GET /articles/{slug} (0.8s)
 *   ├── api:GET /articles/{slug}/comments (0.6s)
 *   └── image:load hero.jpg (0.4s)
 *
 * Usage:
 *   import { startApiSpan, useScreenRenderSpan } from '@/lib/monitoring';
 *
 *   // In baseApi baseQuery (non-React context):
 *   const span = startApiSpan(endpoint, method);
 *   // ... do work ...
 *   span?.end();
 *
 *   // In screen component (React context):
 *   useScreenRenderSpan('HomeScreen');
 */
import * as Sentry from '@sentry/react-native';
import { useEffect } from 'react';
import { getPlatformAttr } from './types';

// ── Recursion Guard ─────────────────────────────────────────────────────────
//
// Sentry SDK v8.11.1 has a known issue where concurrent startInactiveSpan calls
// on HomeScreen (useScreenRenderSpan + startApiSpan × N + reactNavigationIntegration)
// can trigger an infinite loop: withScope → withSetScope → create_tSpan → emit → ...
//
// This module-level depth counter prevents nested span creation beyond a safe
// threshold, acting as a circuit breaker regardless of the sampling rate.

let spanCreationDepth = 0;
const MAX_SPAN_DEPTH = 3;

// ── API Child Spans ─────────────────────────────────────────────────────────

/**
 * Start a child span under the currently active Sentry transaction for an API call.
 *
 * In Sentry v8 SDK, `startInactiveSpan()` automatically attaches to the
 * currently active transaction (set by reactNavigationIntegration during
 * route transitions). If no active transaction exists (e.g. cold start
 * before first navigation), returns null.
 *
 * The span's lifetime is managed by the caller:
 *   1. Call startApiSpan() before the fetch
 *   2. Call span.end() after the response is received
 *   3. On error, optionally call span.setStatus() before span.end()
 *
 * @param endpoint — API endpoint path (e.g. '/api/v1/articles')
 * @param method — HTTP method (e.g. 'GET', 'POST')
 * @returns A Sentry span, or undefined if no active transaction
 */
export function startApiSpan(
  endpoint: string,
  method: string,
): Sentry.Span | undefined {
  // ── Recursion guard ────────────────────────────────────────────────
  // Prevent Sentry SDK internal scope propagation from creating nested
  // spans in an infinite loop (observed in Sentry flame graphs on HomeScreen).
  if (spanCreationDepth >= MAX_SPAN_DEPTH) {
    return undefined;
  }

  // Check if there's an active transaction before creating a span.
  // getActiveSpan() returns the currently active span (or transaction).
  const activeSpan = Sentry.getActiveSpan();
  if (!activeSpan) {
    return undefined;
  }

  spanCreationDepth++;
  try {
    // startInactiveSpan auto-links to the active transaction (if any) in v8.
    return Sentry.startInactiveSpan({
      op: 'http.client',
      name: `${method} ${endpoint}`,
      attributes: {
        platform: getPlatformAttr(),
      },
    });
  } finally {
    spanCreationDepth--;
  }
}

// ── Screen TTID (Time To Initial Display) ──────────────────────────────────

/**
 * React hook: create a child span under the active navigation transaction
 * measuring time-to-initial-display for the current screen.
 *
 * Call this at the top level of a screen component. The span:
 * - Starts immediately (component mount)
 * - Ends on the next animation frame (first paint)
 *
 * This gives a rough measure of "how long did this screen take to show content"
 * minus the network data fetch time (which is tracked by startApiSpan separately).
 *
 * If no active transaction exists (e.g. app cold start, not a navigation),
 * this is a no-op.
 *
 * @param screenName — Display name for the span (e.g. 'HomeScreen', 'ArticleDetail')
 */
export function useScreenRenderSpan(screenName: string): void {
  useEffect(() => {
    // ── Recursion guard ──────────────────────────────────────────────
    if (spanCreationDepth >= MAX_SPAN_DEPTH) {
      return;
    }

    const activeSpan = Sentry.getActiveSpan();
    if (!activeSpan) {
      return;
    }

    spanCreationDepth++;
    const span = Sentry.startInactiveSpan({
      op: 'ui.screen.initial_render',
      name: screenName,
      attributes: {
        platform: getPlatformAttr(),
      },
    });

    // End the span after the next animation frame, which signals the first
    // React commit has been painted to screen.
    requestAnimationFrame(() => {
      span?.end();
      spanCreationDepth--;
    });
  }, [screenName]);
}
