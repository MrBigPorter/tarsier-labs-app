import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';
import { useModeColors } from '@/lib/theme/ThemeContext';
import { spacing, borderRadius } from '@/lib/theme/spacing';

// ===================== Base Skeleton =====================

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadiusVal?: number;
  /** Whether to show the pulse animation */
  animated?: boolean;
  style?: any;
}

/**
 * Base skeleton component with animated pulse effect.
 * Uses Animated API for smooth cross-fade opacity animation.
 */
export function Skeleton({
  width = '100%',
  height = 20,
  borderRadiusVal = borderRadius.md,
  animated = true,
  style,
}: SkeletonProps) {
  const colors = useModeColors();
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    if (!animated) {
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [animated, opacity]);

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius: borderRadiusVal,
          backgroundColor: colors.bgTertiary,
          opacity,
        },
        style,
      ]}
    />
  );
}

// ===================== Variants =====================

interface TextSkeletonProps {
  lines?: number;
  lineHeight?: number;
  lastLineWidth?: string;
}

/**
 * Multi-line text skeleton
 */
export function TextSkeleton({
  lines = 3,
  lineHeight = 14,
  lastLineWidth = '60%',
}: TextSkeletonProps) {
  return (
    <View style={textSkeletonStyles.container}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          height={lineHeight}
          width={index === lines - 1 ? lastLineWidth : '100%'}
          style={textSkeletonStyles.line}
        />
      ))}
    </View>
  );
}

const textSkeletonStyles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  line: {
    marginBottom: 0,
  },
});

// ===================== Blog Skeletons =====================

/**
 * Article card skeleton (for list views)
 */
export function ArticleCardSkeleton() {
  const colors = useModeColors();
  const screenWidth = Dimensions.get('window').width;
  const cardWidth = screenWidth - spacing.md * 2;

  return (
    <View
      style={[
        articleCardStyles.container,
        {
          backgroundColor: colors.bgPrimary,
          borderColor: colors.border,
          width: cardWidth,
        },
      ]}
    >
      {/* Cover image skeleton */}
      <View>
        <Skeleton
          width="100%"
          height={cardWidth * (9 / 16)}
          borderRadiusVal={borderRadius.lg}
        />
        {/* Category badge */}
        <Skeleton
          width={60}
          height={22}
          borderRadiusVal={borderRadius.sm}
          // eslint-disable-next-line react-native/no-inline-styles
          style={{ position: 'absolute', bottom: spacing.sm, left: spacing.sm }}
        />
      </View>

      {/* Content area */}
      <View style={articleCardStyles.content}>
        {/* Title */}
        <Skeleton width="85%" height={22} style={articleCardStyles.title} />
        <Skeleton width="60%" height={22} style={articleCardStyles.title} />

        {/* Excerpt */}
        <View style={articleCardStyles.excerpt}>
          <Skeleton width="100%" height={12} />
          <Skeleton width="92%" height={12} />
          <Skeleton width="75%" height={12} />
        </View>

        {/* Meta row: views, comments, author (left) + bookmark (right) */}
        <View style={articleCardStyles.meta}>
          <View style={articleCardStyles.metaLeft}>
            <Skeleton width={40} height={12} />
            <Skeleton width={40} height={12} />
            <Skeleton width={60} height={12} />
          </View>
          <Skeleton width={22} height={22} borderRadiusVal={4} />
        </View>
      </View>
    </View>
  );
}

const articleCardStyles = StyleSheet.create({
  container: {
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  content: {
    padding: spacing.lg,
  },
  title: {
    marginBottom: spacing.xs,
  },
  excerpt: {
    marginTop: spacing.md,
    gap: 6,
  },
  meta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  metaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});

/**
 * Article list skeleton (multiple cards)
 */
export function ArticleListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <View style={{ paddingHorizontal: spacing.md }}>
      {Array.from({ length: count }).map((_, index) => (
        <ArticleCardSkeleton key={index} />
      ))}
    </View>
  );
}

/**
 * Article detail page skeleton
 */
export function ArticleDetailSkeleton() {
  const colors = useModeColors();

  return (
    <View
      style={[detailStyles.container, { backgroundColor: colors.background }]}
    >
      {/* Back button skeleton */}
      <Skeleton width={80} height={16} style={detailStyles.backButton} />

      {/* Title area */}
      <View style={detailStyles.titleArea}>
        <Skeleton width="90%" height={32} />
        <Skeleton width="65%" height={32} />
      </View>

      {/* Meta */}
      <View style={detailStyles.metaRow}>
        <Skeleton width={24} height={24} borderRadiusVal={12} />
        <Skeleton width={100} height={14} />
        <Skeleton width={80} height={14} />
      </View>

      {/* Cover image */}
      <Skeleton
        width="100%"
        height={220}
        borderRadiusVal={borderRadius.lg}
        style={detailStyles.cover}
      />

      {/* Tags row */}
      <View style={detailStyles.tagsRow}>
        <Skeleton width={60} height={28} borderRadiusVal={14} />
        <Skeleton width={80} height={28} borderRadiusVal={14} />
        <Skeleton width={50} height={28} borderRadiusVal={14} />
        <Skeleton width={70} height={28} borderRadiusVal={14} />
      </View>

      {/* Content paragraphs */}
      <View style={detailStyles.contentArea}>
        {Array.from({ length: 6 }).map((_, i) => (
          <View key={i} style={detailStyles.paragraph}>
            <Skeleton width="100%" height={14} />
            <Skeleton width="98%" height={14} />
            <Skeleton width="88%" height={14} />
          </View>
        ))}
      </View>
    </View>
  );
}

const detailStyles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.xxl,
  },
  backButton: {
    marginBottom: spacing.lg,
  },
  titleArea: {
    marginBottom: spacing.lg,
    gap: spacing.xs,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xxl,
  },
  cover: {
    marginBottom: spacing.xxl,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  contentArea: {
    gap: spacing.xl,
  },
  paragraph: {
    gap: spacing.xs,
  },
});

/**
 * Category card skeleton
 */
export function CategoryCardSkeleton() {
  const colors = useModeColors();

  return (
    <View
      style={[
        categoryStyles.card,
        { backgroundColor: colors.bgPrimary, borderColor: colors.border },
      ]}
    >
      <View style={categoryStyles.row}>
        <Skeleton width={48} height={48} borderRadiusVal={borderRadius.lg} />
        <View style={categoryStyles.textArea}>
          <Skeleton width="60%" height={20} style={categoryStyles.name} />
          <Skeleton width="90%" height={12} />
          <Skeleton width="40%" height={12} />
        </View>
      </View>
    </View>
  );
}

const categoryStyles = StyleSheet.create({
  card: {
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  textArea: {
    flex: 1,
    gap: 6,
  },
  name: {
    marginBottom: spacing.xs,
  },
});

export default Skeleton;
