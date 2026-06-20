/**
 * AppImage — Unified image component (mobile equivalent of Web's BlurhashImage)
 *
 * Features:
 * - Cloudflare Image Resizing optimization via `getOptimizedImageUrl()`
 * - Multi-size image selection via `getArticleImageUrl()`
 * - Loading state with blurhash placeholder (when available) or skeleton
 * - **Flutter-style cross-fade** — blurhash/skeleton fades out while image fades in
 *   (like Flutter's `FadeInImage.memoryNetwork` with `fadeInDuration: 300ms`)
 * - Error fallback with icon
 * - Built-in prefetch support for priority images
 * - `priority` prop for LCP optimization
 *
 * Cross-fade animation:
 * - Blurhash starts at opacity 1, Image starts at opacity 0
 * - On image load: parallel animation (blurhash 1→0, image 0→1) over 300ms
 * - This eliminates the Android cached-image race condition where onLoad fires
 *   synchronously during commit, which would remove blurhash before it paints
 *
 * Usage:
 * ```tsx
 * // Simple: raw URL
 * <AppImage uri={article.coverImage} style={styles.image} />
 *
 * // Smart: auto-select best size + Cloudflare optimize
 * <AppImage
 *   images={article.meta?.images}
 *   coverImage={article.coverImage}
 *   style={styles.image}
 * />
 *
 * // With blurhash loading placeholder (Flutter-style cross-fade)
 * <AppImage
 *   images={article.meta?.images}
 *   coverImage={article.coverImage}
 *   blurhash={article.meta?.images?.blurhash}
 *   style={styles.image}
 * />
 *
 * // Video poster
 * <AppImage
 *   uri={article.meta?.video?.posterWebp}
 *   style={styles.image}
 * />
 * ```
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Animated,
  AppState,
  Platform,
  StyleSheet,
  type ImageProps,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import {
  useSharedValue,
  withTiming,
  createAnimatedComponent,
} from 'react-native-reanimated';
import { Blurhash } from 'react-native-blurhash';
import SvgIcon from '@/components/core/SvgIcon';
import { getOptimizedImageUrl, getArticleImageUrl } from '@/lib/utils/image';
import {
  recordImageFallback,
  recordImageTotalFailure,
  getTimeSinceAppStartMs,
  type ImageFailureContext,
} from '@/lib/monitoring';
import type { ArticleMeta } from '@/types/frontend-blog';
import type { NetworkQuality } from '@/lib/hooks/useNetworkQuality';

// ─── Animated FastImage wrapper ─────────────────────────────────────────
// Reanimated's createAnimatedComponent is required for FastImage because
// RN's Animated.createAnimatedComponent + useNativeDriver doesn't work
// with third-party native components.
const AnimatedFastImage = createAnimatedComponent(FastImage);

// ─── Constants ────────────────────────────────────────────────────────────

/** Duration for cross-fade animation (matches Flutter's FadeInImage default) */
const CROSS_FADE_DURATION_MS = 300;

/**
 * Stagger interval for sequential image loading (OOM mitigation).
 *
 * Each image waits `staggerLoadIndex * STAGGER_INTERVAL_MS` before starting
 * its HTTP request and decode. This spreads the memory spike of concurrent
 * PNG/WebP decoding across ~1.5s instead of all at once.
 *
 * Root cause (from OOM analysis):
 * On iOS with `format=PNG`, each 960px image decodes to ~2MB in RGBA memory.
 * 10 visible articles loading simultaneously = ~20MB+ peak decode spike.
 * Staggering reduces this to ~2MB sequential.
 *
 * See: plans/oom-image-png-memory-cascade.md
 */
const STAGGER_INTERVAL_MS = 120;

/** Icon size for placeholder/error states */
const FALLBACK_ICON_SIZE = 32;

/**
 * Retry delay when both image URLs fail due to transient network issues.
 *
 * Root cause (from Sentry Logs analysis):
 * When the app returns to foreground, NetInfo reports "online" before the
 * underlying NSURLSession connection pool is fully established. All HTTP
 * requests in this window return response_body_size: 0. After ~2-3 seconds
 * the network stabilises and images load normally.
 *
 * This retry mechanism waits RETRY_DELAY_MS before trying both URLs again,
 * giving the network stack time to stabilise.
 */
const RETRY_DELAY_MS = 3000;

/** Maximum number of full retry cycles (optimized + fallback) before giving up */
const MAX_RETRIES = 2;

// ─── Types ────────────────────────────────────────────────────────────────

export interface AppImageProps extends Omit<ImageProps, 'source'> {
  /** Direct image URL (highest priority) */
  uri?: string | null;
  /** Multi-size images from article meta */
  images?: ArticleMeta['images'] | null;
  /** Fallback cover image URL */
  coverImage?: string | null;
  /** Blurhash string for loading placeholder */
  blurhash?: string | null;
  /** Network quality from parent for adaptive image sizing */
  networkQuality?: NetworkQuality;
  /** Desired width for Cloudflare optimization (default: 480, or adaptive from networkQuality) */
  imageWidth?: number;
  /** Image quality for Cloudflare optimization (default: 75) */
  quality?: number;
  /** Whether to apply Cloudflare optimization (default: true) */
  optimize?: boolean;
  /** Whether this is a priority image (LCP optimization) */
  priority?: boolean;
  /**
   * Stagger load index for sequential image loading (OOM mitigation).
   *
   * When set, the image HTTP request is delayed by
   * `staggerLoadIndex * STAGGER_INTERVAL_MS` milliseconds. This spreads
   * concurrent image decode memory across time instead of all at once.
   *
   * - 0: Load immediately (no delay)
   * - 1: Delay 120ms
   * - 2: Delay 240ms
   * - ...
   *
   * Priority images (first 2 items) should use index 0 for LCP.
   * Off-screen images get higher indices for progressive loading.
   *
   * See: plans/oom-image-png-memory-cascade.md
   */
  staggerLoadIndex?: number;
  /** Called when image loads successfully */
  onLoad?: () => void;
  /** Called when image fails to load */
  onError?: () => void;
  /** Container style */
  containerStyle?: StyleProp<ViewStyle>;
  /** Show debug info overlay when image fails (for on-device debugging) */
  debugMode?: boolean;
}

/**
 * Debug info captured at the moment of image failure.
 * Displayed on-screen when debugMode is enabled.
 */
interface ImageDebugInfo {
  /** The URL that was being loaded when the error occurred */
  failedUrl: string;
  /** Which phase of the error-recovery flow we're in */
  errorPhase: 'fallback' | 'retrying' | 'total_failure';
  /** Current retry attempt (0 = first failure, MAX_RETRIES = exhausted) */
  retryCount: number;
  /** Network connection type at time of failure */
  connectionType?: string | null;
  /** Whether NetInfo reports the device as connected */
  isConnected?: boolean;
  /** Image size tier requested */
  imageSizeTier?: string;
  /** Milliseconds since app process started */
  timeSinceAppStartMs?: number;
}

// ─── Component ────────────────────────────────────────────────────────────

export function AppImage({
  uri,
  images,
  coverImage,
  blurhash,
  networkQuality,
  imageWidth,
  quality = 75,
  optimize = true,
  priority = false,
  staggerLoadIndex,
  style,
  containerStyle,
  debugMode = false,
  onLoad,
  onError,
  ...imageProps
}: AppImageProps) {
  // ─── Resolve final image URL ────────────────────────────────────────

  // ─── Image size from network quality ────────────────────────────────
  //
  // Map network quality tiers to pixel widths for Cloudflare optimization.
  // Falls back to 480 if not on cellular (WiFi/ethernet gets 'original' size
  // which defaults to 480 via useContext/imageWidth).

  const imageSizeTier = networkQuality?.imageSize ?? 'medium';

  const adaptiveWidth = React.useMemo<number>(() => {
    if (imageWidth !== undefined) {
      return imageWidth;
    }
    switch (imageSizeTier) {
      case 'thumbnail':
        return 320;
      case 'medium':
        return 480;
      case 'large':
        return 640;
      case 'original':
        // Cap at 960px (OOM mitigation). The previous 1280px produced ~3.7MB
        // decoded RGBA buffers on iOS (format=PNG). 960px reduces this to ~2MB
        // per image — a 45% reduction — with negligible visual impact on mobile
        // (326-458ppi: 960px content fills a 390px viewport at 2.5x scale).
        // See: plans/oom-image-png-memory-cascade.md
        return 960;
      default:
        return 480;
    }
  }, [imageWidth, imageSizeTier]);

  const resolvedUrl = React.useMemo<string | null>(() => {
    // Direct URI takes priority
    if (uri) {
      return uri;
    }

    // Multi-size selection from article meta — use network-aware size tier
    if (images || coverImage) {
      return getArticleImageUrl({ images, coverImage, size: imageSizeTier });
    }

    return null;
  }, [uri, images, coverImage, imageSizeTier]);

  // Apply Cloudflare optimization
  const optimizedUrl = React.useMemo<string | null>(() => {
    if (!resolvedUrl) {
      return null;
    }
    if (!optimize) {
      return resolvedUrl;
    }
    return getOptimizedImageUrl({
      src: resolvedUrl,
      width: adaptiveWidth,
      quality,
    });
  }, [resolvedUrl, optimize, adaptiveWidth, quality]);

  /**
   * Active URL — use fallback (original/raw) URL when the Cloudflare-optimized
   * URL fails to load. This provides resilience against CDN format negotiation
   * issues (e.g., AVIF cached on disk fails to decode on cold start).
   *
   * When useFallbackUrl is true and resolvedUrl differs from optimizedUrl,
   * we load the original URL directly (no Cloudflare transformation).
   */
  // ─── Cross-fade animation values ───────────────────────────────────
  //
  // Flutter-style FadeInImage:
  // - imageOpacity:      0 → 1  (image fades IN)
  // - placeholderOpacity: 1 → 0  (blurhash/skeleton fades OUT)
  //
  // These are refs (not state) to avoid re-renders — Animated drives
  // the native animation thread directly via useNativeDriver.

  // imageOpacity uses Reanimated shared value so it works with FastImage
  // on the UI thread. placeholderOpacity keeps RN Animated.Value for the
  // placeholder layers (Animated.View) — no third-party component needed.
  const imageOpacity = useSharedValue(blurhash ? 0 : 1);
  const placeholderOpacity = useRef(new Animated.Value(1)).current;

  // ─── Retry state for transient network failures ─────────────────────
  //
  // When the network isn't fully ready at app start/foreground, FastImage
  // may get empty responses (response_body_size: 0) for both optimized and
  // original URLs. This ref tracks retry attempts and schedules a delayed
  // retry — giving the network stack time to stabilise.
  //
  // See RETRY_DELAY_MS / MAX_RETRIES constants above.
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Clean up retry timeout on unmount to prevent setState on unmounted component.
   */
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current !== null) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, []);

  /**
   * Reset animation when blurhash prop changes (e.g., FlatList recycles
   * an ArticleCard with new article data).
   *
   * Without this, a new blurhash would start at opacity 0 (from previous
   * article's fade-out), making it invisible.
   */
  useEffect(() => {
    // Clear any pending retry timeout from the previous image
    if (retryTimeoutRef.current !== null) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    retryCountRef.current = 0;

    if (blurhash) {
      // New blurhash available — show placeholder, hide image
      imageOpacity.value = 0;
      placeholderOpacity.setValue(1);
    } else {
      // No blurhash — image visible immediately, no placeholder needed
      imageOpacity.value = 1;
      placeholderOpacity.setValue(0);
    }
    // Reset error state for new image
    setHasError(false);
    // Reset fallback URL state — new image should try optimized URL first
    setUseFallbackUrl(false);
  }, [blurhash, imageOpacity, placeholderOpacity]);

  // ─── Staggered loading (OOM mitigation) ───────────────────────────
  //
  // When staggerLoadIndex is provided, the image HTTP request is delayed
  // by `staggerLoadIndex * STAGGER_INTERVAL_MS` to spread concurrent
  // decode memory across time. During the delay, blurhash/skeleton remains
  // visible as a placeholder — no visual flash.
  //
  // Priority images (index 0) and non-list usages (undefined) load
  // immediately with no delay.
  //
  // See: plans/oom-image-png-memory-cascade.md

  const [isStaggerReady, setStaggerReady] = useState(
    staggerLoadIndex === undefined || staggerLoadIndex === 0,
  );

  useEffect(() => {
    if (staggerLoadIndex === undefined || staggerLoadIndex <= 0) {
      setStaggerReady(true);
      return;
    }

    const delay = staggerLoadIndex * STAGGER_INTERVAL_MS;
    const timer = setTimeout(() => {
      setStaggerReady(true);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [staggerLoadIndex]);

  // ─── Error state ───────────────────────────────────────────────────

  const [hasError, setHasError] = useState(false);

  /**
   * Fallback URL state — when FastImage fails with Cloudflare-optimized URL,
   * we retry with the original (non-optimized) URL before showing the error icon.
   * This provides resilience against CDN format/cache issues on cold start.
   * See: plans/sdd-fastimage-cold-start-broken-images.md
   */
  const [useFallbackUrl, setUseFallbackUrl] = useState(false);

  /**
   * Debug info — diagnostic context captured at the moment of failure.
   * Only populated when debugMode={true}. Displayed as text overlay on
   * the error icon for on-device debugging.
   */
  const [debugInfo, setDebugInfo] = useState<ImageDebugInfo | null>(null);

  /**
   * Active URL — use fallback (original/raw) URL when the Cloudflare-optimized
   * URL fails to load. This provides resilience against CDN format negotiation
   * issues (e.g., AVIF cached on disk fails to decode on cold start).
   *
   * When useFallbackUrl is true and resolvedUrl differs from optimizedUrl,
   * we load the original URL directly (no Cloudflare transformation).
   */
  const activeUrl = useFallbackUrl && resolvedUrl ? resolvedUrl : optimizedUrl;

  /**
   * Active cache control — use 'web' (validate with server) for Cloudflare-
   * optimized URLs, 'immutable' (cache aggressively) for original URLs.
   *
   * Root cause: Cloudflare's /cdn-cgi/image/ endpoint may occasionally return
   * a non-image response (e.g., HTML error page) during cold cache processing.
   * With 'immutable', SDWebImage caches this non-image response and serves it
   * on subsequent requests — causing persistent decode failures. 'web' adds
   * SDWebImageRefreshCached which validates with the server on each access,
   * ensuring transient Cloudflare errors don't get permanently cached.
   *
   * See: plans/revised-cloudflare-image-fallback-analysis-v2.md
   */
  const activeCacheControl =
    useFallbackUrl && resolvedUrl && resolvedUrl !== optimizedUrl
      ? FastImage.cacheControl.immutable
      : FastImage.cacheControl.web;

  /**
   * Cross-fade handler — triggered when image finishes loading.
   *
   * Behaves like Flutter's FadeInImage: once the target image is decoded,
   * run a parallel opacity animation:
   *   - blurhash/skeleton: 1 → 0 (fade out)
   *   - image: 0 → 1 (fade in)
   *
   * This inherently solves the Android cached-image race condition:
   * because the placeholder is NEVER removed from the component tree
   * (it stays at opacity 0), the synchronous onLoad commit doesn't
   * cause a "both hidden" frame.
   */
  const handleLoad = useCallback(() => {
    // Cross-fade: image fades in (Reanimated, UI thread) while
    // placeholder fades out (RN Animated, native driver).
    // These run concurrently — no need for Animated.parallel since
    // both are non-blocking.
    imageOpacity.value = withTiming(1, { duration: CROSS_FADE_DURATION_MS });
    Animated.timing(placeholderOpacity, {
      toValue: 0,
      duration: CROSS_FADE_DURATION_MS,
      useNativeDriver: true,
    }).start();
    onLoad?.();
  }, [imageOpacity, placeholderOpacity, onLoad]);

  const handleError = useCallback(() => {
    // Build diagnostic context shared by both fallback and total failure events
    const failureCtx: ImageFailureContext = {
      resolvedUrl: resolvedUrl ?? '',
      optimizedUrl: optimizedUrl ?? undefined,
      platform: Platform.OS,
      imageSizeTier: imageSizeTier,
      hasBlurhash: typeof blurhash === 'string' && blurhash.length > 0,
      optimizeEnabled: optimize,
      // Network context — helps distinguish transient network issues
      // (NetInfo online but NSURLSession not ready) from real connectivity loss.
      isConnected: networkQuality?.isConnected,
      connectionType: networkQuality?.connectionType,
      appState: AppState.currentState,
      timeSinceAppStartMs: getTimeSinceAppStartMs(),
    };

    // Shared debug info builder — captures snapshot of current state for
    // on-device display when debugMode is enabled.
    const buildDebugInfo = (
      phase: ImageDebugInfo['errorPhase'],
    ): ImageDebugInfo => ({
      failedUrl: activeUrl ?? resolvedUrl ?? optimizedUrl ?? '(no url)',
      errorPhase: phase,
      retryCount: retryCountRef.current,
      connectionType: networkQuality?.connectionType,
      isConnected: networkQuality?.isConnected,
      imageSizeTier: imageSizeTier,
      timeSinceAppStartMs: getTimeSinceAppStartMs(),
    });

    // If Cloudflare-optimized URL failed and we have a non-optimized fallback
    // available, try the original URL before showing the error icon.
    // This provides resilience against CDN format/cache issues (e.g., AVIF
    // decode failures on cold start — see sdd-fastimage-cold-start-broken-images.md).
    if (!useFallbackUrl && resolvedUrl && resolvedUrl !== optimizedUrl) {
      // Record fallback via monitoring service layer — logs warning + Sentry breadcrumb
      recordImageFallback(failureCtx);
      if (debugMode) {
        setDebugInfo(buildDebugInfo('fallback'));
      }
      setUseFallbackUrl(true);
      // Reset image opacity for the fallback attempt
      imageOpacity.value = 0;
      return;
    }

    // ── Both optimized and original URLs failed ─────────────────────────
    //
    // Root cause (from Sentry Logs breadcrumb analysis):
    // When the app returns to foreground, NetInfo reports "online" before
    // the underlying network stack is ready. FastImage gets HTTP responses
    // with response_body_size: 0 for ALL images in this window. After
    // ~2-3 seconds the connection pool stabilises and images load normally.
    //
    // Retry strategy: Instead of immediately showing the error state, we
    // schedule a delayed retry (up to MAX_RETRIES times). This gives the
    // network stack time to stabilise without user-visible errors.

    if (retryCountRef.current < MAX_RETRIES) {
      retryCountRef.current += 1;

      console.warn(
        '[AppImage] Both URLs failed, scheduling retry',
        `attempt ${retryCountRef.current}/${MAX_RETRIES}`,
        resolvedUrl,
      );

      if (debugMode) {
        setDebugInfo(buildDebugInfo('retrying'));
      }

      // Keep showing placeholder during the retry wait
      // Don't set hasError yet — placeholder stays visible
      // Don't clear fallback state yet — resolvedUrl remains as active

      // Schedule retry after delay
      retryTimeoutRef.current = setTimeout(() => {
        // Reset to initial state so FastImage re-mounts with optimized URL
        setHasError(false);
        setUseFallbackUrl(false);
        // Reset opacity for cross-fade on new attempt
        imageOpacity.value = blurhash ? 0 : 1;
        placeholderOpacity.setValue(blurhash ? 1 : 0);

        retryTimeoutRef.current = null;
      }, RETRY_DELAY_MS);

      return;
    }

    // ── Exhausted all retries — permanent error ──────────────────────────
    // Record total failure via monitoring service layer — logs error + captureException
    recordImageTotalFailure(failureCtx);
    if (debugMode) {
      setDebugInfo(buildDebugInfo('total_failure'));
    }

    // If blurhash is available, keep it visible instead of showing ❌.
    // The blurhash provides a meaningful visual placeholder — far better than
    // an error icon. The image may load on a subsequent mount cycle (e.g.,
    // FlatList recycle, pull-to-refresh) when the network is more stable.
    //
    // Only show ❌ when there's NO blurhash (no graceful fallback available).
    // NOTE: Inline blurhash check instead of referencing `showBlurhash` (which is
    // defined later in the component body after this useCallback). Since `blurhash`
    // is already in the dependency array, the closure always captures the correct
    // value without needing `showBlurhash` as a separate dependency.
    if (typeof blurhash === 'string' && blurhash.length > 0) {
      // Record the failure but don't display ❌ — keep blurhash visible.
      // The image may load on a subsequent mount cycle (e.g., FlatList recycle,
      // pull-to-refresh) when the network is more stable.
      onError?.();
      return;
    }

    setHasError(true);
    // Hide placeholder on error, show error icon instead
    placeholderOpacity.setValue(0);
    onError?.();
  }, [
    resolvedUrl,
    optimizedUrl,
    useFallbackUrl,
    imageSizeTier,
    blurhash,
    optimize,
    imageOpacity,
    placeholderOpacity,
    onError,
    networkQuality,
    activeUrl,
    debugMode,
  ]);

  // ─── No image available — show gradient placeholder ─────────────────

  if (!optimizedUrl) {
    return (
      <View
        style={[
          styles.container,
          styles.placeholder,
          containerStyle as ViewStyle,
          style as ImageStyle,
        ]}
      >
        <SvgIcon name="file-text" size={FALLBACK_ICON_SIZE} color="#9CA3AF" />
      </View>
    );
  }

  // ─── Determine placeholder type ────────────────────────────────────
  //
  // Layer order (bottom to top):
  //   1. Image (Animated.Image) — opacity animated 0→1 on load
  //   2. Blurhash overlay — opacity animated 1→0 on load (when blurhash available)
  //   3. Skeleton overlay — opacity animated 1→0 on load (when NO blurhash)
  //   4. Error overlay — shown when image fails (replaces placeholders)

  const showBlurhash = typeof blurhash === 'string' && blurhash.length > 0;

  // ─── Render ──────────────────────────────────────────────────────────

  // ─── Stagger guard ──────────────────────────────────────────────────
  //
  // When staggerLoadIndex > 0, the FastImage is NOT rendered until the
  // stagger delay elapses. The blurhash or skeleton placeholder remains
  // visible during the delay — no visual flash or layout shift.
  //
  // This works correctly with the existing retry logic: retryTimeoutRef
  // and retryCountRef are unaffected since they only activate AFTER the
  // image mount (onError callback), which can't fire before isStaggerReady.
  //
  // Non-staggered images (staggerLoadIndex === undefined or 0) always
  // render the FastImage immediately — no behavior change.

  const shouldRenderImage = !hasError && isStaggerReady;

  return (
    <View style={[styles.container, containerStyle as ViewStyle]}>
      {/* ── Layer 1: Image ──────────────────────────────────────────────
           Always rendered (when staggerReady). Opacity animated 0→1
           during cross-fade. Hidden behind blurhash/skeleton until
           animation completes. */}
      {shouldRenderImage && (
        <AnimatedFastImage
          // Use activeUrl (supports fallback: optimized → original if CDN fails).
          // Use activeCacheControl: 'web' for Cloudflare URLs (validate with server
          // to avoid caching transient error responses), 'immutable' for original
          // URLs (maximize disk cache hit rate for stable content).
          source={{
            uri: activeUrl,
            cache: activeCacheControl,
          }}
          // FastImage native priority support (replaces RN accessibilityHint hack)
          priority={
            priority ? FastImage.priority.high : FastImage.priority.normal
          }
          // FastImage.resizeMode.cover is the enum value
          resizeMode={'cover'}
          // style uses Reanimated shared value for opacity; cast needed because
          // Reanimated's AnimatedStyle<ImageStyle> differs from RN ImageStyle
          style={[{ opacity: imageOpacity }, style]}
          onLoad={handleLoad}
          onError={handleError}
          {...(imageProps as any)}
        />
      )}

      {/* ── Layer 2a: Blurhash overlay (when available) ─────────────────
           Fades out during cross-fade. Stays in tree at opacity 0
           to prevent layout shift on re-mount (like Flutter's approach).

           IMPORTANT: Animated.Value (placeholderOpacity) is applied to
           Animated.View, NOT to Blurhash directly. This avoids a Fabric
           crash where Animated.Value objects can't be serialized to
           native Blurhash props (ReadableNativeMap cannot be cast to
           java.lang.Double). The Animated.View wrapper handles the
           opacity animation on the native thread. */}
      {showBlurhash && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            style as ImageStyle,
            { opacity: placeholderOpacity },
          ]}
          pointerEvents="none"
        >
          <Blurhash
            blurhash={blurhash!}
            decodeWidth={32}
            decodeHeight={32}
            decodePunch={1.0}
            resizeMode="cover"
            style={{ ...StyleSheet.absoluteFill, ...(style as object) }}
          />
        </Animated.View>
      )}

      {/* ── Layer 2b: Skeleton overlay (when NO blurhash) ───────────────
           Shown while image loads, fades out during cross-fade.
           pointerEvents="none" so touch events pass through. */}
      {!showBlurhash && !hasError && (
        <Animated.View
          style={[
            styles.skeleton,
            StyleSheet.absoluteFill,
            style as ImageStyle,
            { opacity: placeholderOpacity },
          ]}
          pointerEvents="none"
        />
      )}

      {/* ── Layer 3: Error overlay ──────────────────────────────────────
           Replaces all other layers when image fails to load.
           When debugMode is enabled, shows diagnostic text below the
           error icon for on-device debugging. */}
      {hasError && (
        <View style={[styles.errorContainer, style as ImageStyle]}>
          <SvgIcon
            name="alert-circle"
            size={FALLBACK_ICON_SIZE}
            color="#9CA3AF"
          />
          {debugMode && debugInfo && (
            <View style={styles.debugOverlay}>
              <Text
                style={styles.debugText}
                numberOfLines={1}
                ellipsizeMode="middle"
              >
                {debugInfo.failedUrl}
              </Text>
              <Text style={styles.debugText}>
                Phase: {debugInfo.errorPhase} | Retry: {debugInfo.retryCount}/
                {MAX_RETRIES}
              </Text>
              <Text style={styles.debugText}>
                Net: {debugInfo.connectionType ?? '?'} | Online:{' '}
                {debugInfo.isConnected === true
                  ? 'Y'
                  : debugInfo.isConnected === false
                    ? 'N'
                    : '?'}
                {' | '}Size: {debugInfo.imageSizeTier ?? '?'}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

AppImage.whyDidYouRender = true;

// ─── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  skeleton: {
    backgroundColor: '#e5e7eb',
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
  },
  debugOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  debugText: {
    color: '#ff6b6b',
    fontSize: 8,
    fontFamily: 'monospace',
    lineHeight: 10,
  },
});
