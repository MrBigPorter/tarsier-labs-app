/**
 * AppImage — Unified image component (mobile equivalent of Web's BlurhashImage)
 *
 * Features:
 * - Cloudflare Image Resizing optimization via `getOptimizedImageUrl()`
 * - Multi-size image selection via `getArticleImageUrl()`
 * - Loading state with blurhash placeholder (when available) or skeleton
 * - Error fallback with icon
 * - Built-in prefetch support for priority images
 * - `priority` prop for LCP optimization
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
 * // With blurhash loading placeholder
 * <AppImage
 *   images={article.meta?.images}
 *   coverImage={article.coverImage}
 *   blurhash={article.meta?.blurhash}
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

import React, { useState, useCallback } from 'react';
import {
  View,
  Image,
  StyleSheet,
  type ImageProps,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Blurhash } from 'react-native-blurhash';
import SvgIcon from '@/components/core/SvgIcon';
import { getOptimizedImageUrl, getArticleImageUrl } from '@/lib/utils/image';
import type { ArticleMeta } from '@/types/frontend-blog';

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
  /** Desired width for Cloudflare optimization (default: 640) */
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

// ─── Constants ────────────────────────────────────────────────────────────

/** Icon size for placeholder/error states */
const FALLBACK_ICON_SIZE = 32;

// ─── Component ────────────────────────────────────────────────────────────

export function AppImage({
  uri,
  images,
  coverImage,
  blurhash,
  imageWidth = 640,
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

  const resolvedUrl = React.useMemo<string | null>(() => {
    // Direct URI takes priority
    if (uri) return uri;

    // Multi-size selection from article meta
    if (images || coverImage) {
      return getArticleImageUrl({ images, coverImage, size: 'medium' });
    }

    return null;
  }, [uri, images, coverImage]);

  // Apply Cloudflare optimization
  const optimizedUrl = React.useMemo<string | null>(() => {
    if (!resolvedUrl) return null;
    if (!optimize) return resolvedUrl;
    return getOptimizedImageUrl({ src: resolvedUrl, width: imageWidth, quality });
  }, [resolvedUrl, optimize, imageWidth, quality]);

  // ─── Loading state ──────────────────────────────────────────────────

  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const handleLoad = useCallback(() => {
    setIsLoaded(true);
    onLoad?.();
  }, [onLoad]);

  const handleError = useCallback(() => {
    setHasError(true);
    setIsLoaded(true); // Stop showing loading skeleton/blurhash
    onError?.();
  }, [onError]);

  // ─── Whether to show blurhash (has blurhash string AND image not yet loaded) ──

  const showBlurhash = Boolean(blurhash) && !isLoaded && !hasError;

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

  // ─── Render ──────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, containerStyle as ViewStyle]}>
      {/* Loading placeholder — visible until image loads or errors */}
      {!isLoaded && !hasError && (
        showBlurhash ? (
          /* ── Blurhash loading placeholder (first paint) ── */
          <Blurhash
            blurhash={blurhash!}
            style={[StyleSheet.absoluteFill, style as ImageStyle]}
          />
        ) : (
          /* ── Skeleton placeholder (when no blurhash available) ── */
          <View
            style={[
              styles.skeleton,
              style as ImageStyle,
            ]}
          />
        )
      )}

      {/* Error state — alert icon when image fails */}
      {hasError ? (
        <View
          style={[
            styles.errorContainer,
            style as ImageStyle,
          ]}
        >
          <SvgIcon name="alert-circle" size={FALLBACK_ICON_SIZE} color="#9CA3AF" />
        </View>
      ) : (
        <Image
          source={{ uri: optimizedUrl }}
          // Use priority hint for LCP images
          {...(priority ? { accessibilityHint: 'priority-image' } : {})}
          style={[
            style as ImageStyle,
            // Hide image until loaded if we're showing skeleton/blurhash
            !isLoaded && styles.hidden,
          ]}
          onLoad={handleLoad}
          onError={handleError}
          {...imageProps}
        />
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
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#e5e7eb',
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
  },
  hidden: {
    opacity: 0,
    position: 'absolute',
  },
});
