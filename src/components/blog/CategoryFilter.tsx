/**
 * CategoryFilter — Horizontal scrollable category filter chips
 *
 * Fetches categories internally via useGetCategoriesQuery.
 * Matches Web UI: rounded chips (8px), px-5 py-2.5 padding, articleCount badges.
 *
 * Features:
 * - "All" chip at the start to clear any category filter
 * - Category chips rendered from FrontendCategory[]
 * - Selected chip highlighted with primary color
 * - Smooth horizontal scrolling via ScrollView
 * - Loading skeleton while categories load
 *
 * Props:
 * - selectedCategoryId: string | null (null = "All" selected)
 * - onSelect: (categoryId: string | null) => void
 *
 * States:
 * - Loading: skeleton placeholders
 * - Empty: renders nothing
 * - Normal: renders chips
 */
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '@/lib/theme/ThemeContext';
import { spacing, borderRadius } from '@/lib/theme/spacing';
import { typography } from '@/lib/theme/typography';
import { useGetCategoriesQuery } from '@/api/endpoints/categories';
import { useCurrentLanguage } from '@/lib/i18n';
import type { FrontendCategory } from '@/types/frontend-blog';

interface CategoryFilterProps {
  selectedCategoryId: string | null;
  onSelect: (categoryId: string | null) => void;
}

/**
 * Loading skeleton: renders 6 pulse placeholders
 */
function CategoryFilterSkeleton() {
  const { colors, isDark } = useTheme();
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        bounces={false}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.skeletonChip,
              {
                backgroundColor: isDark ? '#22262f' : '#f0f0f1',
              },
            ]}
          />
        ))}
      </ScrollView>
    </View>
  );
}

export function CategoryFilter({
  selectedCategoryId,
  onSelect,
}: CategoryFilterProps) {
  const { colors } = useTheme();
  const lang = useCurrentLanguage();
  const { data: categories, isLoading } = useGetCategoriesQuery(lang);

  // Loading state: skeleton
  if (isLoading) {
    return <CategoryFilterSkeleton />;
  }

  // Empty state: render nothing
  if (!categories || categories.length === 0) return null;

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        bounces={false}
        accessibilityRole="tablist"
        accessibilityLabel="Category filter"
      >
        {/* "All" chip */}
        <TouchableOpacity
          style={[
            styles.chip,
            {
              backgroundColor:
                selectedCategoryId === null
                  ? colors.primary
                  : colors.bgSecondary,
              borderColor:
                selectedCategoryId === null
                  ? colors.primary
                  : colors.borderSecondary,
            },
          ]}
          onPress={() => onSelect(null)}
          activeOpacity={0.7}
          accessibilityRole="tab"
          accessibilityState={{ selected: selectedCategoryId === null }}
          accessibilityLabel="Show all categories"
        >
          <Text
            style={[
              styles.chipText,
              {
                color:
                  selectedCategoryId === null
                    ? '#ffffff'
                    : colors.textSecondary,
              },
            ]}
          >
            All
          </Text>
        </TouchableOpacity>

        {/* Category chips */}
        {categories.map((category: FrontendCategory) => {
          const isSelected = selectedCategoryId === category.id;
          return (
            <TouchableOpacity
              key={category.id}
              style={[
                styles.chip,
                {
                  backgroundColor: isSelected
                    ? colors.primary
                    : colors.bgSecondary,
                  borderColor: isSelected
                    ? colors.primary
                    : colors.borderSecondary,
                },
              ]}
              onPress={() => onSelect(category.id)}
              activeOpacity={0.7}
              accessibilityRole="tab"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`Filter by category: ${category.name}`}
            >
              {category.icon ? (
                <Text style={styles.chipIcon}>{category.icon}</Text>
              ) : null}
              <Text
                style={[
                  styles.chipText,
                  {
                    color: isSelected
                      ? '#ffffff'
                      : colors.textSecondary,
                  },
                ]}
              >
                {category.name}
              </Text>
              {category.articleCount !== undefined && (
                <Text
                  style={[
                    styles.countText,
                    {
                      color: isSelected
                        ? 'rgba(255,255,255,0.6)'
                        : colors.textTertiary || colors.textSecondary,
                    },
                  ]}
                >
                  {' '}{category.articleCount}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.sm,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,     // matches Web's px-5
    paddingVertical: 10,       // matches Web's py-2.5
    borderRadius: borderRadius.md, // 8px matches Web's rounded-lg
    borderWidth: 1,
    marginRight: 8,            // matches Web's gap-2
  },
  chipText: {
    fontFamily: typography.base.fontFamily,
    fontSize: typography.base.fontSize,
    fontWeight: '600',
  },
  chipIcon: {
    fontSize: 16,
    marginRight: spacing.xs,
  },
  countText: {
    fontFamily: typography.base.fontFamily,
    fontSize: 12,              // matches Web's text-xs
    fontWeight: '500',
  },
  skeletonChip: {
    height: 38,                // matches chip height (10px padding top/bottom + 18px text)
    width: 80,
    borderRadius: borderRadius.md,
    marginRight: 8,
  },
});
