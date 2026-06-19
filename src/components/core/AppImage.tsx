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
  Animated,
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

/** Icon size for placeholder/error states */
const FALLBACK_ICON_SIZE = 32;

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
  /** Called when image loads successfully */
  onLoad?: () => void;
  /** Called when image fails to load */
  onError?: () => void;
  /** Container style */
  containerStyle?: StyleProp<ViewStyle>;
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
  style,
  containerStyle,
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
        return 1280;
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

  /**
   * Reset animation when blurhash prop changes (e.g., FlatList recycles
   * an ArticleCard with new article data).
   *
   * Without this, a new blurhash would start at opacity 0 (from previous
   * article's fade-out), making it invisible.
   */
  useEffect(() => {
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
  }, [blurhash, imageOpacity, placeholderOpacity]);

  // ─── Error state ───────────────────────────────────────────────────

  const [hasError, setHasError] = useState(false);

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
    setHasError(true);
    // Hide placeholder on error, show error icon instead
    placeholderOpacity.setValue(0);
    onError?.();
  }, [placeholderOpacity, onError]);

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

  return (
    <View style={[styles.container, containerStyle as ViewStyle]}>
      {/* ── Layer 1: Image ──────────────────────────────────────────────
           Always rendered. Opacity animated 0→1 during cross-fade.
           Hidden behind blurhash/skeleton until animation completes. */}
      {!hasError && (
        <AnimatedFastImage
          source={{ uri: optimizedUrl }}
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
           Replaces all other layers when image fails to load. */}
      {hasError && (
        <View style={[styles.errorContainer, style as ImageStyle]}>
          <SvgIcon
            name="alert-circle"
            size={FALLBACK_ICON_SIZE}
            color="#9CA3AF"
          />
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
});
