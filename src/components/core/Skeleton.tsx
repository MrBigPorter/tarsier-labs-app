import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';
import { useTheme } from '../../lib/theme/ThemeContext';
import { spacing, borderRadius } from '../../lib/theme/spacing';

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
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    if (!animated) return;

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
          backgroundColor: colors.skeleton,
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
    gap: spacing[2],
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
  const { colors } = useTheme();
  const screenWidth = Dimensions.get('window').width;
  const cardWidth = screenWidth - spacing[6] * 2;

  return (
    <View
      style={[
        articleCardStyles.container,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          width: cardWidth,
        },
      ]}
    >
      {/* Cover image skeleton */}
      <Skeleton
        width="100%"
        height={cardWidth * (9 / 16)}
        borderRadiusVal={borderRadius.lg}
      />

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

        {/* Meta info */}
        <View style={articleCardStyles.meta}>
          <View style={articleCardStyles.authorRow}>
            <Skeleton width={28} height={28} borderRadiusVal={14} />
            <Skeleton width={80} height={12} />
          </View>
          <Skeleton width={60} height={12} />
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
    marginBottom: spacing[4],
  },
  content: {
    padding: spacing[4],
  },
  title: {
    marginBottom: spacing[1],
  },
  excerpt: {
    marginTop: spacing[3],
    gap: spacing[1.5],
  },
  meta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing[3],
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
});

/**
 * Article list skeleton (multiple cards)
 */
export function ArticleListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <View style={{ paddingHorizontal: spacing[6] }}>
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
  const { colors } = useTheme();

  return (
    <View style={[detailStyles.container, { backgroundColor: colors.background }]}>
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
    padding: spacing[6],
  },
  backButton: {
    marginBottom: spacing[4],
  },
  titleArea: {
    marginBottom: spacing[4],
    gap: spacing[1],
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[6],
  },
  cover: {
    marginBottom: spacing[6],
  },
  contentArea: {
    gap: spacing[5],
  },
  paragraph: {
    gap: spacing[1],
  },
});

/**
 * Category card skeleton
 */
export function CategoryCardSkeleton() {
  const { colors } = useTheme();

  return (
    <View
      style={[
        categoryStyles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
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
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    marginBottom: spacing[3],
  },
  row: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  textArea: {
    flex: 1,
    gap: spacing[1.5],
  },
  name: {
    marginBottom: spacing[1],
  },
});

export default Skeleton;
