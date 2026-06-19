/**
 * CategoryArticlesScreen — Articles filtered by category
 *
 * Shows articles belonging to a specific category.
 * Uses usePaginatedQuery with MMKV cold-start cache for instant display.
 *
 * Route params:
 * - categorySlug: string (required)
 * - categoryName: string (optional, for display)
 *
 * Data: useGetCategoryBySlugQuery (via usePaginatedQuery)
 * Cache: MMKV cold-start cache via categorySlug key
 */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Text,
} from 'react-native';
import PullToRefreshWrapper from '@/components/core/PullToRefreshWrapper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useModeColors, spacing, typography } from '@/lib/theme';
import { useGetCategoryBySlugQuery } from '@/api/endpoints/categories';
import { useAppLanguage } from '@/lib/i18n';
import { ArticleCard } from '@/components/blog/ArticleCard';
import Header from '@/components/layout/Header';
import { ArticleListSkeleton } from '@/components/core/Skeleton';
import { EmptyState } from '@/components/core/EmptyState';
import { EmptyLogoContent } from '@/components/core/EmptyLogoContent';
import { useArticlePrefetch } from '@/lib/hooks/useArticlePrefetch';
import { useImagePrefetch } from '@/lib/hooks/useImagePrefetch';
import { getArticleImageUrl, isVideoUrl } from '@/lib/utils/image';
import { usePaginatedQuery } from '@/lib/hooks/usePaginatedQuery';
import {
  loadArticleList,
  saveArticleList,
  clearLanguageCache,
} from '@/lib/cache/articleListCache';
import type { CategoriesTabScreenProps } from '@/navigation/types';
import type {
  FrontendArticle,
  FrontendCategoryWithArticles,
} from '@/types/frontend-blog';

/** Number of visible items that should get high-priority image loading */
const PRIORITY_COUNT = 2;

/**
 * Resolve the best image URL for prefetching from an article.
 * Matches the logic in AppImage's getArticleImageUrl.
 */
function getPrefetchUrl(article: FrontendArticle): string | null {
  if (article.coverImage && isVideoUrl(article.coverImage)) {
    return null;
  }
  return getArticleImageUrl({
    images: article.meta?.images,
    coverImage: article.coverImage,
    size: 'medium',
  });
}

const CategoryArticlesScreen: React.FC<
  CategoriesTabScreenProps<'CategoryArticles'>
> = ({ navigation, route }) => {
  const { categorySlug, categoryName } = route.params;
  const insets = useSafeAreaInsets();
  const colors = useModeColors();
  const { t } = useTranslation();
  const lang = useAppLanguage();
  const prevLangRef = React.useRef(lang);

  // Cache key: use categorySlug as the MMKV cache identifier
  const cacheKey = categorySlug;

  // ─── MMKV cold-start cache ──────────────────────────────────────────
  // Synchronous read from MMKV during render — no useEffect delay.
  // Shape cached data as a partial FrontendCategoryWithArticles so
  // usePaginatedQuery can extract articles via selectItems.
  const cachedData = useMemo((): FrontendCategoryWithArticles | null => {
    const entry = loadArticleList(lang, cacheKey);
    if (entry && entry.items.length > 0) {
      return {
        id: '',
        slug: categorySlug,
        name: categoryName || categorySlug,
        articleCount: entry.total,
        articles: {
          items: entry.items,
          total: entry.total,
          page: 1,
          pageSize: entry.pageSize,
          totalPages: entry.totalPages,
        },
      } as FrontendCategoryWithArticles;
    }
    return null;
  }, [lang, cacheKey, categorySlug, categoryName]);

  // ─── Infinite-scroll pagination with cache integration ──────────────
  const {
    items: displayArticles,
    isLoading,
    isFetching,
    isError,
    hasMore,
    loadMore,
    refresh,
    rawData,
  } = usePaginatedQuery(
    useGetCategoryBySlugQuery,
    { slug: categorySlug, lang },
    {
      pageSize: 15,
      selectItems: data => data.articles?.items ?? [],
      selectTotalPages: data => data.articles?.totalPages ?? 1,
      initialCacheData: cachedData ?? undefined,
    },
  );

  // ─── Save page 1 to MMKV cache when fresh API data arrives ──────────
  const prevRawDataRef = useRef(rawData);
  React.useEffect(() => {
    if (
      rawData?.articles?.items &&
      rawData.articles.page === 1 &&
      rawData !== prevRawDataRef.current
    ) {
      saveArticleList(lang, cacheKey, rawData.articles);
      prevRawDataRef.current = rawData;
    }
  }, [rawData, lang, cacheKey]);

  // ─── Language change: clear old cache and re-fetch ──────────────────
  React.useEffect(() => {
    if (prevLangRef.current !== lang) {
      clearLanguageCache(prevLangRef.current);
      prevLangRef.current = lang;
      refresh();
    }
  }, [lang, refresh]);

  // ─── Pull-to-refresh state ──────────────────────────────────────────
  // Separate flag so the RefreshControl spinner only shows during a manual
  // pull-to-refresh gesture, not during initial load or load-more.
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  const prevIsFetchingRef = useRef(isFetching);
  React.useEffect(() => {
    if (prevIsFetchingRef.current && !isFetching) {
      // isFetching just transitioned true → false: fetch completed
      setIsManualRefreshing(false);
    }
    prevIsFetchingRef.current = isFetching;
  }, [isFetching]);

  const onRefresh = useCallback(() => {
    setIsManualRefreshing(true);
    refresh();
  }, [refresh]);

  // ─── Category metadata from API (or fallback from route params) ────
  const category = rawData
    ? {
        name: rawData.name || categoryName || categorySlug,
        description: rawData.description,
        articleCount: rawData.articleCount ?? displayArticles.length,
        icon: rawData.icon,
        color: rawData.color,
      }
    : {
        name: categoryName || categorySlug,
        description: undefined as string | undefined,
        articleCount: 0,
        icon: undefined as string | undefined,
        color: undefined as string | undefined,
      };

  const handleArticlePress = useCallback(
    (article: FrontendArticle) => {
      navigation.getParent()?.navigate('ArticleDetail', {
        slug: article.slug,
        articleId: article.id,
      });
    },
    [navigation],
  );

  const prefetchArticle = useArticlePrefetch();

  // ─── Image prefetch ────────────────────────────────────────────────
  const { prefetchMany } = useImagePrefetch();

  // Predictive prefetch: when new articles arrive, prefetch cover images
  // for all non-priority items. Priority items (first PRIORITY_COUNT)
  // get FastImage.priority.high via the AppImage priority prop.
  useEffect(() => {
    if (displayArticles.length === 0) {
      return;
    }

    const urlsToPrefetch = displayArticles
      .slice(PRIORITY_COUNT)
      .map(getPrefetchUrl)
      .filter(Boolean) as string[];

    if (urlsToPrefetch.length > 0) {
      prefetchMany(urlsToPrefetch).catch(() => {});
    }
  }, [displayArticles, prefetchMany]);

  // Viewability-based prefetch: prefetch images as items become visible
  const viewabilityConfig = React.useRef({
    itemVisiblePercentThreshold: 50,
    minimumViewTime: 200,
  }).current;

  const onViewableItemsChanged = React.useRef(
    ({
      changed,
    }: {
      changed: Array<{ item: FrontendArticle; isViewable: boolean }>;
    }) => {
      const toPrefetch: string[] = [];
      changed.forEach(({ item, isViewable }) => {
        if (isViewable) {
          const url = getPrefetchUrl(item);
          if (url) {
            toPrefetch.push(url);
          }
        }
      });
      if (toPrefetch.length > 0) {
        prefetchMany(toPrefetch).catch(() => {});
      }
    },
  ).current;

  const renderItem = useCallback(
    ({ item, index }: { item: FrontendArticle; index: number }) => (
      <View style={styles.articleItem}>
        <ArticleCard
          article={item}
          onPress={handleArticlePress}
          onPrefetch={prefetchArticle}
          priority={index < PRIORITY_COUNT}
          showExcerpt
        />
      </View>
    ),
    [handleArticlePress, prefetchArticle],
  );

  const renderFooter = () => {
    if (!isFetching || !hasMore) {
      return null;
    }
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  };

  const renderListHeader = () => (
    <View style={styles.categoryHeader}>
      {/* Icon / emoji row */}
      {category.icon ? (
        <View style={styles.iconRow}>
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: (category.color || colors.primary) + '20' },
            ]}
          >
            <Text
              style={[
                styles.iconText,
                { color: category.color || colors.primary },
              ]}
            >
              {category.icon}
            </Text>
          </View>
        </View>
      ) : null}

      {/* Category name */}
      <Text style={[styles.categoryName, { color: colors.text }]}>
        {category.name}
      </Text>

      {/* Description */}
      {category.description ? (
        <Text
          style={[styles.categoryDescription, { color: colors.textSecondary }]}
        >
          {category.description}
        </Text>
      ) : null}

      {/* Article count */}
      <View style={styles.metaRow}>
        <Text
          style={[
            styles.articleCount,
            { color: colors.textTertiary || colors.textSecondary },
          ]}
        >
          {category.articleCount}{' '}
          {category.articleCount === 1 ? 'article' : 'articles'}
        </Text>
      </View>

      {/* Divider */}
      <View
        style={[
          styles.headerDivider,
          { backgroundColor: colors.borderSecondary },
        ]}
      />
    </View>
  );

  // ─── Loading state (skip if cached data available) ────────────────

  if (isLoading && displayArticles.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bgSecondary }]}>
        <Header
          title={categoryName || categorySlug}
          showBack
          hideSearch
          hideSettings
        />
        <View style={styles.loadingContainer}>
          <ArticleListSkeleton count={5} />
        </View>
      </View>
    );
  }

  // ─── Main render ────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: colors.bgSecondary }]}>
      <Header title={category.name} showBack hideSearch hideSettings />

      <PullToRefreshWrapper
        refreshing={isManualRefreshing}
        onRefresh={onRefresh}
        backgroundColor={colors.bgSecondary}
        spinnerColor={colors.primary}
      >
        <FlatList
          data={displayArticles}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + spacing.xl },
            displayArticles.length === 0 && styles.emptyList,
          ]}
          ListHeaderComponent={
            displayArticles.length > 0 ? renderListHeader : null
          }
          ListEmptyComponent={
            isError ? (
              <EmptyState
                icon="alert-circle"
                title={t('article.error.loadFailed')}
                description={t('common.pullDownToRetry')}
                primaryAction={{
                  label: t('common.retry'),
                  onPress: onRefresh,
                }}
              />
            ) : (
              <EmptyLogoContent
                title={t('categories.emptyArticles')}
                description={t('common.checkBackLater')}
              />
            )
          }
          ListFooterComponent={renderFooter}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          viewabilityConfig={viewabilityConfig}
          onViewableItemsChanged={onViewableItemsChanged}
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
  loadingContainer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  listContent: {
    flexGrow: 1,
  },
  emptyList: {
    // justifyContent: 'center' removed — keep top-aligned
  },
  articleItem: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  footer: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  // ── Category header ─────────────────────────────────────────────
  categoryHeader: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  iconRow: {
    marginBottom: spacing.sm,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    fontSize: 24,
    fontWeight: '700',
  },
  categoryName: {
    fontFamily: typography.h3.fontFamily,
    fontSize: typography.h3.fontSize,
    fontWeight: typography.h3.fontWeight,
    marginBottom: spacing.xs,
  },
  categoryDescription: {
    fontFamily: typography.base.fontFamily,
    fontSize: typography.base.fontSize,
    fontWeight: '400',
    lineHeight: typography.base.lineHeight,
    marginBottom: spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  articleCount: {
    fontFamily: typography.caption.fontFamily,
    fontSize: typography.caption.fontSize,
    fontWeight: '500',
  },
  headerDivider: {
    height: 1,
    marginTop: spacing.md,
  },
});

export default CategoryArticlesScreen;
