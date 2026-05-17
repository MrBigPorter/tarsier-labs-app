import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '@/lib/theme/ThemeContext';
import { spacing, borderRadius } from '@/lib/theme/spacing';
import { typography } from '@/lib/theme/typography';
import SvgIcon from '@/components/core/SvgIcon';
import type { FrontendCategory } from '@/types/frontend-blog';

interface CategoryCardProps {
  category: FrontendCategory;
  onPress?: (category: FrontendCategory) => void;
}

export function CategoryCard({ category, onPress }: CategoryCardProps) {
  const { colors, isDark } = useTheme();

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
      onPress={() => onPress?.(category)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Category: ${category.name}`}
    >
      <View style={styles.row}>
        {/* Icon / color indicator — larger 60x60 */}
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: (category.color || colors.primary) + '18' },
          ]}
        >
          <Text style={[styles.iconText, { color: category.color || colors.primary }]}>
            {category.icon || category.name.charAt(0).toUpperCase()}
          </Text>
        </View>

        {/* Content — spacious */}
        <View style={styles.content}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {category.name}
          </Text>
          {category.description && (
            <Text
              style={[styles.description, { color: colors.textSecondary }]}
              numberOfLines={2}
            >
              {category.description}
            </Text>
          )}
          {/* Article count inline */}
          {category.articleCount !== undefined && category.articleCount > 0 && (
            <Text style={[styles.articleCount, { color: colors.textTertiary }]}>
              {category.articleCount} {category.articleCount === 1 ? 'article' : 'articles'}
            </Text>
          )}
        </View>

        {/* Chevron indicator */}
        <SvgIcon name="chevron-right" size={20} color={colors.textTertiary} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.lg,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    marginBottom: spacing.md,
    // Subtle shadow for "大气" feel
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.lg,
  },
  iconText: {
    fontSize: 26,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    marginRight: spacing.md,
  },
  name: {
    ...typography.h4,
    marginBottom: 4,
  },
  description: {
    ...typography.body2,
    marginBottom: 4,
  },
  articleCount: {
    ...typography.caption,
  },
});
