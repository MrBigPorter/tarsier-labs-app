/**
 * CategoryListScreen — Browse all categories
 *
 * Displays categories in a 2-column grid layout.
 * Each card shows the category icon, name, description, and article count.
 *
 * Data: useGetCategoriesQuery (RTK Query)
 *
 * States: Loading → skeleton grid | Error → retry
 */
import React, { useCallback } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../lib/theme/ThemeContext';
import { spacing } from '../lib/theme/spacing';
import { useGetCategoriesQuery } from '../api/endpoints/categories';
import CategoryCard from '../components/blog/CategoryCard';
import Header from '../components/layout/Header';
import { CategoryCardSkeleton } from '../components/core/Skeleton';
import EmptyState from '../components/core/EmptyState';
import type { CategoriesTabScreenProps } from '../navigation/types';
import type { FrontendCategory } from '../types/frontend-blog';

const CategoryListScreen: React.FC<
  CategoriesTabScreenProps<'CategoryList'>
> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const colors = theme.colors;
  const { width: screenWidth } = useWindowDimensions();

  const {
    data: categories,
    isLoading,
    isError,
    refetch,
  } = useGetCategoriesQuery(undefined);

  const numColumns = Math.max(2, Math.floor((screenWidth - spacing.md * 3) / 180));

  const handleCategoryPress = useCallback(
    (categorySlug: string) => {
      navigation.getParent()?.navigate('ArticlesTab', {
        screen: 'CategoryArticles',
        params: { categorySlug, categoryName: '' },
      });
    },
    [navigation],
  );

  const renderItem = useCallback(
    ({ item }: { item: FrontendCategory }) => (
      <View
        style={{ width: `${100 / numColumns}%` as any, padding: spacing.xs }}
      >
        <CategoryCard
          category={item}
          onPress={() => handleCategoryPress(item.slug)}
        />
      </View>
    ),
    [numColumns, handleCategoryPress],
  );

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Header title="Categories" />
        <View style={styles.gridContainer}>
          <View style={styles.grid}>
            {Array.from({ length: numColumns * 2 }).map((_, i) => (
              <View
                key={i}
                style={{
                  width: `${100 / numColumns}%` as any,
                  padding: spacing.xs,
                }}
              >
                <CategoryCardSkeleton />
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="Categories" />

      <FlatList
        data={categories || []}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={numColumns}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + spacing.xl },
        ]}
        columnWrapperStyle={styles.columnWrapper}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={refetch}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={
          isError ? (
            <EmptyState
              icon="grid"
              title="Failed to load categories"
              primaryAction={{ label: 'Retry', onPress: refetch }}
            />
          ) : (
            <EmptyState
              icon="grid"
              title="No categories yet"
            />
          )
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gridContainer: {
    flex: 1,
    paddingTop: spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.sm,
  },
  listContent: {
    padding: spacing.sm,
    flexGrow: 1,
  },
  columnWrapper: {
    gap: spacing.xs,
  },
});

export default CategoryListScreen;
