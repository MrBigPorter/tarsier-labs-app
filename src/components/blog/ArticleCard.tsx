import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useTheme } from '../../lib/theme/ThemeContext';
import { spacing, borderRadius } from '../../lib/theme/spacing';
import { typography } from '../../lib/theme/typography';
import type { FrontendArticle } from '../../types/frontend-blog';
import { useNetworkQuality } from '../../lib/hooks/useNetworkQuality';

interface ArticleCardProps {
  article: FrontendArticle;
  onPress: (article: FrontendArticle) => void;
  onBookmark?: (articleId: string) => void;
  isBookmarked?: boolean;
  showExcerpt?: boolean;
  /** Compact mode for related articles sidebar */
  compact?: boolean;
}

/**
 * Article card for list views.
 *
 * Features:
 * - Adaptive image loading based on network quality (WebP/JPG, size tier)
 * - Author avatar + name
 * - Category badge
 * - Relative publish date
 * - Bookmark button (optional)
 * - Compact mode for related articles
 */
export function ArticleCard({
  article,
  onPress,
  onBookmark,
  isBookmarked,
  showExcerpt = true,
  compact = false,
}: ArticleCardProps) {
  const { colors } = useTheme();
  const network = useNetworkQuality();
  const screenWidth = Dimensions.get('window').width;

  // Determine image URL based on network quality
  const imageUrl = React.useMemo(() => {
    if (!article.meta?.images) {
      return article.coverImage;
    }
    const { images } = article.meta;
    if (network.quality >= 75) {
      return network.preferWebp ? images.large.webp : images.large.jpg;
    }
    if (network.quality >= 45) {
      return network.preferWebp ? images.medium.webp : images.medium.jpg;
    }
    return network.preferWebp ? images.thumbnail.webp : images.thumbnail.jpg;
  }, [article, network]);

  // Relative time formatter
  const timeAgo = React.useMemo(() => {
    const now = Date.now();
    const published = new Date(article.publishedAt).getTime();
    const diffMs = now - published;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(article.publishedAt).toLocaleDateString();
  }, [article.publishedAt]);

  const cardWidth = compact
    ? screenWidth - spacing[6] * 2
    : screenWidth - spacing[6] * 2;
  const imageHeight = compact ? 100 : cardWidth * (9 / 16);

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
        compact && styles.compactContainer,
      ]}
      onPress={() => onPress(article)}
      activeOpacity={0.7}
    >
      {/* Cover image */}
      <Image
        source={{ uri: imageUrl }}
        style={[
          styles.coverImage,
          { height: imageHeight },
          compact && styles.compactImage,
        ]}
        resizeMode="cover"
      />

      {/* Content */}
      <View style={[styles.content, compact && styles.compactContent]}>
        {/* Category badge */}
        {article.category && (
          <View
            style={[
              styles.categoryBadge,
              { backgroundColor: colors.primary + '15' },
            ]}
          >
            <Text style={[styles.categoryText, { color: colors.primary }]}>
              {article.category.name}
            </Text>
          </View>
        )}

        {/* Title */}
        <Text
          style={[
            styles.title,
            { color: colors.text },
            compact && styles.compactTitle,
          ]}
          numberOfLines={compact ? 2 : 2}
        >
          {article.title}
        </Text>

        {/* Excerpt */}
        {showExcerpt && !compact && (
          <Text
            style={[styles.excerpt, { color: colors.textSecondary }]}
            numberOfLines={3}
          >
            {article.excerpt}
          </Text>
        )}

        {/* Meta row */}
        <View style={styles.metaRow}>
          <View style={styles.metaLeft}>
            {/* Author avatar */}
            {article.author?.avatar && (
              <Image
                source={{ uri: article.author.avatar }}
                style={[
                  styles.avatar,
                  { borderColor: colors.border },
                ]}
              />
            )}
            <Text
              style={[styles.metaText, { color: colors.textTertiary }]}
              numberOfLines={1}
            >
              {article.author?.name ?? 'Anonymous'} · {timeAgo}
            </Text>
          </View>

          {/* Stats */}
          <View style={styles.metaRight}>
            <Text style={[styles.metaText, { color: colors.textTertiary }]}>
              {article.views ?? 0} views
            </Text>

            {/* Bookmark button */}
            {onBookmark && (
              <TouchableOpacity
                onPress={() => onBookmark(article.id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.bookmarkButton}
              >
                <Text style={{ fontSize: 16 }}>
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

const styles = StyleSheet.create({
  container: {
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: spacing[4],
  },
  compactContainer: {
    flexDirection: 'row',
    marginBottom: spacing[3],
  },
  coverImage: {
    width: '100%',
  },
  compactImage: {
    width: 120,
    borderTopLeftRadius: borderRadius.xl,
    borderBottomLeftRadius: borderRadius.xl,
  },
  content: {
    padding: spacing[4],
  },
  compactContent: {
    flex: 1,
    padding: spacing[3],
    justifyContent: 'center',
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[0.5],
    borderRadius: borderRadius.sm,
    marginBottom: spacing[2],
  },
  categoryText: {
    fontSize: typography.xs.fontSize,
    fontWeight: '600',
  },
  title: {
    fontSize: typography.h4.fontSize,
    fontWeight: typography.h4.fontWeight as any,
    marginBottom: spacing[1],
    lineHeight: typography.h4.lineHeight,
  },
  compactTitle: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    marginBottom: 0,
  },
  excerpt: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    marginBottom: spacing[3],
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing[2],
  },
  metaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.5],
    flex: 1,
  },
  metaRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  avatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
  },
  metaText: {
    fontSize: typography.small.fontSize,
    lineHeight: typography.small.lineHeight,
  },
  bookmarkButton: {
    padding: spacing[1],
  },
});
