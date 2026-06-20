/**
 * Image Monitoring — Sentry instrumentation for image loading lifecycle.
 *
 * Integrates all 5 Sentry dimensions for image operations:
 *   - Metrics: app.image.fallback (count), app.image.load_time_ms (distribution)
 *   - Tracing: ui.image.load (inactive span, 20% sampling)
 *   - Errors: captureException on total failure
 *   - Logs: logger.warn for fallback events
 *
 * Usage in AppImage.tsx:
 *   import { startImageLoad, recordImageFallback, recordImageTotalFailure } from '@/lib/monitoring/imageMonitoring';
 *
 *   const loadTrackerRef = useRef<ReturnType<typeof startImageLoad> | null>(null);
 *   loadTrackerRef.current = startImageLoad(activeUrl, { platform, hasBlurhash });
 *   loadTrackerRef.current?.success(duration);
 */
import * as Sentry from '@sentry/react-native';
import { IMAGE_FALLBACK, IMAGE_LOAD_TIME_MS } from './types';
import { logger } from '@/lib/logger';

// ── Types ─────────────────────────────────────────────────────────────────

export interface ImageLoadAttrs {
  platform: string;
  hasBlurhash: boolean;
  imageSizeTier?: string;
}

export interface ImageLoadTracker {
  /** End span + record duration distribution (success) */
  success(durationMs: number): void;
  /** End span with error status */
  error(): void;
  /** Discard span (component unmount, no data recorded) */
  cancel(): void;
}

/**
 * Diagnostic context for image failure events.
 *
 * All fields are captured as Sentry `extra` data and key fields are
 * also indexed as `tags` for filtering in the Sentry dashboard.
 */
export interface ImageFailureContext {
  /** The resolved (original/non-optimized) URL that ultimately failed */
  resolvedUrl: string;
  /** The Cloudflare-optimized URL that failed first (may be same as resolvedUrl) */
  optimizedUrl?: string;
  /** Platform where the failure occurred */
  platform: string;
  /** Image size tier that was requested ("thumbnail" | "medium" | "large" | "original") */
  imageSizeTier?: string;
  /** Whether blurhash was available for this image */
  hasBlurhash?: boolean;
  /** Whether Cloudflare optimization was enabled */
  optimizeEnabled?: boolean;
  /** Whether NetInfo reports the device as connected at time of failure */
  isConnected?: boolean;
  /** Network connection type at time of failure (wifi, cellular, etc.) */
  connectionType?: string | null;
  /** App state at time of failure ("active" | "background" | "inactive") */
  appState?: string;
  /** Milliseconds elapsed since app process started */
  timeSinceAppStartMs?: number;
}

// ── App start timestamp ──────────────────────────────────────────────────

/** Timestamp (ms) when the JS module first loaded — used to calculate
 *  timeSinceAppStartMs for image failure diagnostics. */
const APP_START_TIME = Date.now();

/** Returns milliseconds elapsed since the app process started. */
export function getTimeSinceAppStartMs(): number {
  return Date.now() - APP_START_TIME;
}

// ── Sampling ──────────────────────────────────────────────────────────────

/** 20% sampling rate, matching tracesSampleRate in sentry.ts */
const SPAN_SAMPLE_RATE = 0.2;

function shouldSampleSpan(): boolean {
  return Math.random() < SPAN_SAMPLE_RATE;
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Start tracking an image load.
 *
 * Creates a Sentry tracing span (20% sampled) and returns a tracker object.
 * The caller must call .success(), .error(), or .cancel() when the image
 * resolves.
 */
export function startImageLoad(
  url: string,
  attrs: ImageLoadAttrs,
): ImageLoadTracker {
  // Short name for the span (last 40 chars of URL path)
  const spanName = url.split('/').pop()?.slice(0, 40) ?? 'AppImage';

  let span: Sentry.Span | undefined;

  if (shouldSampleSpan()) {
    span = Sentry.startInactiveSpan({
      op: 'ui.image.load',
      name: spanName,
      attributes: {
        platform: attrs.platform,
        hasBlurhash: String(attrs.hasBlurhash),
        imageSizeTier: attrs.imageSizeTier ?? 'unknown',
      },
    });
  }

  return {
    success: (durationMs: number) => {
      // Record duration distribution (100% sampling — negligible overhead)
      Sentry.metrics.distribution(IMAGE_LOAD_TIME_MS, durationMs, {
        unit: 'millisecond',
        attributes: {
          platform: attrs.platform,
          hasBlurhash: String(attrs.hasBlurhash),
        },
      });

      span?.end();
    },

    error: () => {
      // Set span status to error with 'internal_error' message (Sentry v8 SpanStatus format)
      span?.setStatus({ code: 2, message: 'internal_error' });
      span?.end();
    },

    cancel: () => {
      span?.end();
    },
  };
}

/**
 * Record that the Cloudflare-optimized URL failed and we fell back to the
 * original URL. This is a recoverable error — the image still displays.
 *
 * 100% sampling (counter overhead is ~0.001ms).
 *
 * Captures diagnostic context to help identify which images/CDN configurations
 * trigger fallback, so we can proactively fix Cloudflare transformation issues
 * or adjust the optimization strategy.
 */
export function recordImageFallback(ctx: ImageFailureContext): void {
  Sentry.metrics.count(IMAGE_FALLBACK, 1, {
    attributes: { platform: ctx.platform },
  });

  logger.warn(
    '[AppImage] Cloudflare-optimized URL failed, falling back to original URL',
    {
      optimizedUrl: ctx.optimizedUrl,
      resolvedUrl: ctx.resolvedUrl,
      imageSizeTier: ctx.imageSizeTier,
    },
  );

  // Add breadcrumb for traceability in Sentry issue details
  Sentry.addBreadcrumb({
    category: 'image',
    level: 'warning',
    message: 'Image fallback: optimized URL failed',
    data: {
      optimizedUrl: ctx.optimizedUrl,
      resolvedUrl: ctx.resolvedUrl,
      imageSizeTier: ctx.imageSizeTier,
    },
  });
}

/**
 * Record that both the optimized URL and the original URL failed to load.
 * This is a critical error — the image cannot be displayed.
 *
 * Always captured via captureException with full diagnostic context.
 */
export function recordImageTotalFailure(ctx: ImageFailureContext): void {
  Sentry.captureException(
    new Error('AppImage: Both optimized and original URLs failed'),
    {
      tags: {
        domain: 'image',
        image_error_type: 'total_failure',
        image_size_tier: ctx.imageSizeTier ?? 'unknown',
      },
      extra: {
        resolvedUrl: ctx.resolvedUrl,
        optimizedUrl: ctx.optimizedUrl,
        platform: ctx.platform,
        imageSizeTier: ctx.imageSizeTier,
        hasBlurhash: ctx.hasBlurhash,
        optimizeEnabled: ctx.optimizeEnabled,
      },
    },
  );

  logger.error('[AppImage] Both optimized and original URLs failed', {
    resolvedUrl: ctx.resolvedUrl,
    optimizedUrl: ctx.optimizedUrl,
    imageSizeTier: ctx.imageSizeTier,
    hasBlurhash: ctx.hasBlurhash,
  });
}
