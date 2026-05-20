/**
 * ArticleCard — Reusable article card (vertical layout, web-aligned)
 *
 * Displays a vertically laid out card with:
 * - Full-width cover image (16:9 aspect ratio) via AppImage (blurhash + Cloudflare)
 * - Category badge (brand color)
 * - Article title, excerpt
 * - Meta row: views, comments, time ago, bookmark
 * - Inline video playback via useVideoPlayback hook
 *
 * Layout variants:
 * - **Default**: Full vertical card with image on top, content below
 * - **Compact**: Smaller variant for horizontal scroll lists
 * - **Featured**: Hero-style with larger image and gradient overlay
 *
 * Props:
 * - `networkQuality`: optional, pass from parent (HomeScreen) for centralized
 *   control. Falls back to internal useNetworkQuality() if omitted.
 * - `priority`: true for first 2 items (LCP optimization — triggers prefetch
 *   and Cloudflare optimization priority hint).
 *
 * Design aligned with web app's ArticleCard (Tailwind classes → token system).
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useModeColors } from '@/lib/theme/ThemeContext';
import type { FrontendArticle } from '@/types/frontend-blog';
import type { NetworkQuality } from '@/lib/hooks/useNetworkQuality';
import { AppImage } from '@/components/core/AppImage';
import { VideoPlayer } from '@/components/features/VideoPlayer';
import { isVideoUrl } from '@/lib/utils/image';

interface ArticleCardProps {
  article: FrontendArticle;
  onPress?: (article: FrontendArticle) => void;
  onBookmark?: (article: FrontendArticle) => void;
  isBookmarked?: boolean;
  showExcerpt?: boolean;
  compact?: boolean;
  /** Featured hero variant — larger image, gradient overlay on title */
  featured?: boolean;
  /** Network quality from parent (centralized). Falls back to internal hook. */
  networkQuality?: NetworkQuality;
  /** Priority image (first 2 items for LCP) */
  priority?: boolean;
  /**
   * Called on finger-down (`onPressIn`) — use to prefetch article data
   * before the tap gesture completes and navigation begins.
   */
  onPrefetch?: (article: FrontendArticle) => void;
}

/** Format a number for display (e.g., 1234 → "1.2k") */
function formatCount(num: number): string {
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  }
  return String(num);
}

function ArticleCardComponent({
  article,
  onPress,
  onBookmark,
  isBookmarked = false,
  showExcerpt = true,
  compact = false,
  featured = false,
  networkQuality,
  priority = false,
  onPrefetch,
}: ArticleCardProps) {
  const colors = useModeColors();

  // ─── Video detection ───────────────────────────────────────────────

  const hasVideo = Boolean(
    article.meta?.video?.hlsUrl ||
    (typeof article.coverImage === 'string' &&
      article.coverImage.endsWith('.mp4')),
  );

  // ─── Image detection ───────────────────────────────────────────────

  // Whether the article has a static (non-video) cover image
  const hasCoverImage = Boolean(
    article.meta?.images ||
    (article.coverImage && !isVideoUrl(article.coverImage)),
  );

  const showImageContainer = hasCoverImage || hasVideo;

  // ── Render ──

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: colors.bgPrimary ?? colors.surface,
          borderColor: colors.borderSecondary ?? colors.border,
        },
        compact && styles.compactCard,
        featured && styles.featuredCard,
      ]}
      onPress={() => onPress?.(article)}
      onPressIn={onPrefetch ? () => onPrefetch(article) : undefined}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Article: ${article.title}`}
    >
      {/* ── Cover Image / Video ── */}
      {showImageContainer && (
        <View
          style={[
            styles.imageContainer,
            compact && styles.compactImageContainer,
            featured && styles.featuredImageContainer,
          ]}
        >
          {hasVideo ? (
            <VideoPlayer article={article} priority={priority} />
          ) : (
            /* Static image (no video) — AppImage handles blurhash + Cloudflare */
            <AppImage
              images={article.meta?.images}
              coverImage={article.coverImage}
              blurhash={
                article.meta?.images?.blurhash ?? article.meta?.blurhash
              }
              networkQuality={networkQuality}
              style={[
                styles.image,
                compact && styles.compactImage,
                featured && styles.featuredImage,
              ]}
              priority={priority}
            />
          )}

          {/* Category badge overlay on image (web style) */}
          {article.category && (
            <View
              style={[
                styles.imageCategoryBadge,
                {
                  backgroundColor:
                    colors.utilityBrand50 ?? colors.primary + '20',
                },
              ]}
            >
              <Text
                style={[
                  styles.imageCategoryText,
                  { color: colors.fgBrandSecondary ?? colors.primary },
                ]}
              >
                {article.category.name}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* ── Content Area ── */}
      <View
        style={[
          styles.content,
          compact && styles.compactContent,
          featured && styles.featuredContent,
        ]}
      >
        {/* Category Badge (no image fallback) */}
        {!showImageContainer && article.category && (
          <View
            style={[
              styles.categoryBadge,
              {
                backgroundColor: colors.utilityBrand50 ?? colors.primary + '20',
              },
            ]}
          >
            <Text
              style={[
                styles.categoryText,
                { color: colors.fgBrandSecondary ?? colors.primary },
              ]}
            >
              {article.category.name}
            </Text>
          </View>
        )}

        {/* Title */}
        <Text
          accessibilityRole="header"
          style={[
            styles.title,
            { color: colors.textPrimary ?? colors.text },
            compact && styles.compactTitle,
            featured && styles.featuredTitle,
          ]}
          numberOfLines={compact ? 2 : featured ? 3 : 3}
        >
          {article.title}
        </Text>

        {/* Excerpt */}
        {showExcerpt && !compact && !featured && (
          <Text
            style={[
              styles.excerpt,
              { color: colors.fgTertiary ?? colors.textTertiary },
            ]}
            numberOfLines={2}
          >
            {article.excerpt}
          </Text>
        )}

        {/* ── Meta Row (views, comments, bookmark) ── */}
        <View style={styles.metaRow}>
          <View style={styles.metaLeft}>
            {/* Views count */}
            <View style={styles.metaItem}>
              <Text style={[styles.metaIcon, { color: colors.fgQuaternary }]}>
                👁
              </Text>
              <Text
                style={[
                  styles.metaText,
                  { color: colors.fgTertiary ?? colors.textTertiary },
                ]}
              >
                {formatCount(article.views)}
              </Text>
            </View>

            {/* Comments count */}
            <View style={styles.metaItem}>
              <Text style={[styles.metaIcon, { color: colors.fgQuaternary }]}>
                💬
              </Text>
              <Text
                style={[
                  styles.metaText,
                  { color: colors.fgTertiary ?? colors.textTertiary },
                ]}
              >
                {formatCount(article.commentsCount)}
              </Text>
            </View>

            {/* Author name */}
            {article.author?.name && !compact && (
              <Text
                style={[
                  styles.metaText,
                  { color: colors.fgTertiary ?? colors.textTertiary },
                ]}
              >
                {article.author.name}
              </Text>
            )}
          </View>

          <View style={styles.metaRight}>
            {/* Bookmark button */}
            {onBookmark && (
              <TouchableOpacity
                onPress={() => onBookmark(article)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text
                  style={[
                    styles.bookmarkIcon,
                    { color: colors.fgBrandSecondary ?? colors.primary },
                  ]}
                >
                  {isBookmarked ? '★' : '☆'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export const ArticleCard = React.memo(ArticleCardComponent);

// whyDidYouRender dev-only tracking
(ArticleCard as unknown as Record<string, unknown>).whyDidYouRender = true;

const styles = StyleSheet.create({
  // ── Card Container ──
  card: {
    flexDirection: 'column',
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 16,
    // Shadow (matches web shadow-md)
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  compactCard: {
    marginBottom: 0,
    borderRadius: 10,
  },
  featuredCard: {
    borderRadius: 14,
    marginBottom: 0,
  },

  // ── Image / Video Container ──
  imageContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    overflow: 'hidden',
  },
  compactImageContainer: {
    aspectRatio: 16 / 10,
  },
  featuredImageContainer: {
    aspectRatio: 16 / 9,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  compactImage: {
    width: '100%',
    height: '100%',
  },
  featuredImage: {
    width: '100%',
    height: '100%',
  },
  videoContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  videoPlaceholder: {
    backgroundColor: '#000',
  },

  // ── Video Play Button Overlay ──
  playButtonOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButtonCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButtonIcon: {
    fontSize: 22,
    color: '#FFFFFF',
    marginLeft: 4,
  },

  // ── Image Category Badge ──
  imageCategoryBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  imageCategoryText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // ── Content ──
  content: {
    padding: 16,
  },
  compactContent: {
    padding: 12,
  },
  featuredContent: {
    padding: 20,
  },

  // ── Category Badge (no image) ──
  categoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 8,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // ── Title ──
  title: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24,
    marginBottom: 6,
  },
  compactTitle: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  featuredTitle: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
  },

  // ── Excerpt ──
  excerpt: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
  },

  // ── Meta Row ──
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
  },
  metaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  metaRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metaIcon: {
    fontSize: 12,
  },
  metaText: {
    fontSize: 12,
    lineHeight: 16,
  },
  bookmarkIcon: {
    fontSize: 16,
  },
});
