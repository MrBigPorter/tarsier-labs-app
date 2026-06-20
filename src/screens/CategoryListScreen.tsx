/**
 * CategoryListScreen — Browse all categories
 *
 * Displays categories as a single-column list.
 * Each card shows the category icon, name, description, and article count.
 *
 * Data: useGetCategoriesQuery (RTK Query)
 *
 * States: Loading → skeleton grid | Error → retry
 *
 * Cache: MMKV-backed SWR pattern — cached categories display instantly on
 * cold start and tab switch, while a silent background refresh fetches the
 * latest data. Cached data is shown during the 1-frame loading gap.
 */
import React, { useCallback, useState, useMemo, useEffect } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import PullToRefreshWrapper from '@/components/core/PullToRefreshWrapper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useModeColors, spacing } from '@/lib/theme';
import { useGetCategoriesQuery } from '@/api/endpoints/categories';
import { useAppLanguage } from '@/lib/i18n';
import { useTranslation } from 'react-i18next';
import { CategoryCard } from '@/components/blog/CategoryCard';
import Header from '@/components/layout/Header';
import { CategoryCardSkeleton } from '@/components/core/Skeleton';
import { EmptyContent } from '@/components/core/EmptyContent';
import { EmptyLogoContent } from '@/components/core/EmptyLogoContent';
import {
  loadCategoryCache,
  saveCategoryCache,
} from '@/lib/cache/categoryCache';
import type { CategoriesTabScreenProps } from '@/navigation/types';
import type { FrontendCategory } from '@/types/frontend-blog';

const LOADING_COUNT = 6;

const CategoryListScreen: React.FC<
  CategoriesTabScreenProps<'CategoryList'>
> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const colors = useModeColors();
  const { t } = useTranslation();
  const lang = useAppLanguage();
  const prevLangRef = React.useRef(lang);

  const {
    data: categories,
    isLoading,
    isError,
    refetch,
  } = useGetCategoriesQuery(lang);

  // ─── MMKV Cache for cold start & tab switch ──────────────────────────
  // Synchronous MMKV read (~0.01ms) via useMemo — no 1-frame skeleton flash.
  const cachedCategoriesEntry = useMemo(() => loadCategoryCache(lang), [lang]);
  const cachedCategories = cachedCategoriesEntry?.categories ?? null;

  // Use cached data as fallback while API is loading (SWR pattern)
  const displayCategories = categories ?? cachedCategories;

  // Save API response to MMKV cache when fresh data arrives
  const prevCategoriesRef = React.useRef(categories);
  useEffect(() => {
    if (categories && categories !== prevCategoriesRef.current) {
      saveCategoryCache(lang, categories);
    }
    prevCategoriesRef.current = categories;
  }, [categories, lang]);

  // Re-fetch when language changes
  React.useEffect(() => {
    if (prevLangRef.current !== lang) {
      prevLangRef.current = lang;
      refetch();
    }
  }, [lang, refetch]);

  // ─── Pull-to-refresh ───────────────────────────────────────────────
  //
  // Uses requestAnimationFrame to guarantee the spinner is painted BEFORE
  // the async fetch starts. refetch().finally() stops the spinner when
  // the network request completes.

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    requestAnimationFrame(() => {
      refetch().finally(() => {
        setRefreshing(false);
      });
    });
  }, [refetch]);

  const handleCategoryPress = useCallback(
    (categorySlug: string) => {
      navigation.getParent()?.navigate('CategoriesTab', {
        screen: 'CategoryArticles',
        params: { categorySlug, categoryName: '' },
      });
    },
    [navigation],
  );

  const renderItem = useCallback(
    ({ item }: { item: FrontendCategory }) => (
      <CategoryCard
        category={item}
        onPress={() => handleCategoryPress(item.slug)}
      />
    ),
    [handleCategoryPress],
  );

  if (isLoading && !displayCategories) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bgSecondary }]}>
        <Header title="Categories" hideSearch hideSettings showBack={false} />
        <View style={styles.skeletonContainer}>
          {Array.from({ length: LOADING_COUNT }).map((_, i) => (
            <CategoryCardSkeleton key={i} />
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bgSecondary }]}>
      <Header title="Categories" hideSearch hideSettings showBack={false} />

      <PullToRefreshWrapper
        refreshing={refreshing}
        onRefresh={onRefresh}
        backgroundColor={colors.bgSecondary}
        spinnerColor={colors.primary}
      >
        <FlatList
          data={displayCategories || []}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + spacing.xl },
          ]}
          ListEmptyComponent={
            isError && !displayCategories ? (
              <EmptyContent
                icon="⚠️"
                title={t('categories.error.loadFailed')}
                actionLabel={t('common.retry')}
                onAction={refetch}
              />
            ) : !displayCategories || displayCategories.length === 0 ? (
              <EmptyLogoContent
                title={t('categories.empty')}
                description={t('categories.emptyState.description')}
              />
            ) : null
          }
          showsVerticalScrollIndicator={false}
        />
      </PullToRefreshWrapper>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  skeletonContainer: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  listContent: {
    padding: spacing.lg,
    flexGrow: 1,
  },
});

export default CategoryListScreen;
