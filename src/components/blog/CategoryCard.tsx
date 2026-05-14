import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../lib/theme/ThemeContext';
import { spacing, borderRadius } from '../../lib/theme/spacing';
import { typography } from '../../lib/theme/typography';
import type { FrontendCategory } from '../../types/frontend-blog';

interface CategoryCardProps {
  category: FrontendCategory;
  onPress: (category: FrontendCategory) => void;
}

/**
 * Category card component.
 *
 * Displays category icon (emoji-based fallback), name, description,
 * and article count. Uses the category's color as accent.
 */
export function CategoryCard({ category, onPress }: CategoryCardProps) {
  const { colors } = useTheme();
  const accentColor = category.color || colors.primary;

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
      ]}
      onPress={() => onPress(category)}
      activeOpacity={0.7}
    >
      <View style={styles.row}>
        {/* Icon circle with category color */}
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: accentColor + '15' },
          ]}
        >
          <Text style={[styles.icon, { color: accentColor }]}>
            {category.icon || '📁'}
          </Text>
        </View>

        {/* Content */}
        <View style={styles.content}>
          <Text
            style={[styles.name, { color: colors.text }]}
            numberOfLines={1}
          >
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

          <Text style={[styles.articleCount, { color: colors.textTertiary }]}>
            {category.articleCount ?? 0} articles
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    marginBottom: spacing[3],
  },
  row: {
    flexDirection: 'row',
    gap: spacing[3],
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    fontSize: 22,
  },
  content: {
    flex: 1,
  },
  name: {
    fontSize: typography.h4.fontSize,
    fontWeight: typography.h4.fontWeight as any,
    marginBottom: spacing[1],
  },
  description: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    marginBottom: spacing[1],
  },
  articleCount: {
    fontSize: typography.small.fontSize,
    fontWeight: '500',
  },
});
