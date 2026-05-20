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
import React, { useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  LayoutChangeEvent,
} from 'react-native';
import { useTheme } from '@/lib/theme/ThemeContext';
import { spacing, borderRadius } from '@/lib/theme/spacing';
import { typography } from '@/lib/theme/typography';
import { useGetCategoriesQuery } from '@/api/endpoints/categories';
import { useAppLanguage } from '@/lib/i18n';
import type { FrontendCategory } from '@/types/frontend-blog';

interface CategoryFilterProps {
  selectedCategoryId: string | null;
  onSelect: (categoryId: string | null) => void;
}

/**
 * Loading skeleton: renders 6 pulse placeholders
 */
function CategoryFilterSkeleton() {
  const { isDark } = useTheme();
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
  const lang = useAppLanguage();
  const prevLangRef = React.useRef(lang);
  const { data: categories, isLoading, refetch } = useGetCategoriesQuery(lang);
  const scrollRef = useRef<ScrollView>(null);
  const { width: screenWidth } = useWindowDimensions();
  const chipLayouts = useRef<Map<string, { x: number; width: number }>>(
    new Map(),
  );

  // Store chip layout position for scroll-to-center
  const handleChipLayout = useCallback(
    (id: string, event: LayoutChangeEvent) => {
      const { x, width } = event.nativeEvent.layout;
      chipLayouts.current.set(id, { x, width });
    },
    [],
  );

  // Scroll the selected chip to the horizontal center of the screen
  const scrollToCenter = useCallback(
    (id: string) => {
      const layout = chipLayouts.current.get(id);
      if (!layout) return;
      const targetX = layout.x - screenWidth / 2 + layout.width / 2;
      scrollRef.current?.scrollTo({ x: Math.max(0, targetX), animated: true });
    },
    [screenWidth],
  );

  // Wrap onSelect to also scroll the chip into center view
  const handleChipPress = useCallback(
    (categoryId: string | null) => {
      onSelect(categoryId);
      requestAnimationFrame(() => {
        scrollToCenter(categoryId ?? 'all');
      });
    },
    [onSelect, scrollToCenter],
  );

  // Re-fetch when language changes
  React.useEffect(() => {
    if (prevLangRef.current !== lang) {
      prevLangRef.current = lang;
      refetch();
    }
  }, [lang, refetch]);

  // Loading state: skeleton
  if (isLoading) {
    return <CategoryFilterSkeleton />;
  }

  // Empty state: render nothing
  if (!categories || categories.length === 0) return null;

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
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
          onPress={() => handleChipPress(null)}
          onLayout={(e: LayoutChangeEvent) => handleChipLayout('all', e)}
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
              onPress={() => handleChipPress(category.id)}
              onLayout={(e: LayoutChangeEvent) =>
                handleChipLayout(category.id, e)
              }
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
                    color: isSelected ? '#ffffff' : colors.textSecondary,
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
                  {' '}
                  {category.articleCount}
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
    paddingHorizontal: 20, // matches Web's px-5
    paddingVertical: 10, // matches Web's py-2.5
    borderRadius: borderRadius.md, // 8px matches Web's rounded-lg
    borderWidth: 1,
    marginRight: 8, // matches Web's gap-2
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
    fontSize: 12, // matches Web's text-xs
    fontWeight: '500',
  },
  skeletonChip: {
    height: 38, // matches chip height (10px padding top/bottom + 18px text)
    width: 80,
    borderRadius: borderRadius.md,
    marginRight: 8,
  },
});
