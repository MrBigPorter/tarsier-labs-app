/**
 * EmptyLogoContent — Empty state with app logo + copy
 *
 * Designed per the BookmarksScreen unauthenticated state pattern:
 * - App logo (120×120, rounded)
 * - Title + optional description
 * - Optional action button (full-width, 52px)
 *
 * Use for "no data" empty states across the app:
 *   <EmptyLogoContent
 *     title="No articles yet"
 *     description="Check back later for new content"
 *     actionLabel="Retry"
 *     onAction={refetch}
 *   />
 */

import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { useTheme, spacing, typography, borderRadius } from '@/lib/theme';

interface EmptyLogoContentProps {
  /** Main title text */
  title: string;
  /** Optional description */
  description?: string;
  /** Optional action button label */
  actionLabel?: string;
  /** Optional action callback */
  onAction?: () => void;
}

export const EmptyLogoContent = React.memo(function EmptyLogoContent({
  title,
  description,
  actionLabel,
  onAction,
}: EmptyLogoContentProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      {/* Logo */}
      <Image
        source={require('@assets/logo.png')}
        style={styles.logo}
        resizeMode="contain"
      />

      {/* Title */}
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>

      {/* Description */}
      {description && (
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          {description}
        </Text>
      )}

      {/* Action Button */}
      {actionLabel && onAction && (
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.primary }]}
          onPress={onAction}
          activeOpacity={0.8}
        >
          <Text style={styles.actionButtonText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
});

EmptyLogoContent.whyDidYouRender = true;

// ─── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing['3xl'],
    paddingBottom: spacing['5xl'],
    paddingTop: spacing['4xl'],
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: spacing.xl,
    borderRadius: borderRadius.xl,
  },
  title: {
    fontSize: typography.h3.fontSize,
    fontWeight: typography.h3.fontWeight as any,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  description: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    textAlign: 'center',
    marginBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  actionButton: {
    width: '100%',
    height: 52,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
});
