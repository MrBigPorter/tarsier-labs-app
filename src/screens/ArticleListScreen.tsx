/**
 * ArticleListScreen — Paginated article listing with filters
 *
 * Features:
 * - Paginated FlatList with infinite scroll (onEndReached)
 * - Pull-to-refresh
 * - Filter by category or tag via route params
 * - Sorting: newest first (default), popular, trending
 * - MMKV cold-start cache: synchronous load on render, save on API response
 * - Skeleton loading state (skipped when cached data available)
 * - Empty state when no articles match
 * - Error state with retry
 *
 * Route params:
 * - categorySlug?: Filter articles by category
 * - tagSlug?: Filter articles by tag
 *
 * Data:
 * - getArticles with pagination params (RTK Query)
 */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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
import { useGetArticlesQuery } from '@/api/endpoints/articles';
import { useAppLanguage } from '@/lib/i18n';
import { useTranslation } from 'react-i18next';
import { ArticleCard } from '@/components/blog/ArticleCard';
import Header from '@/components/layout/Header';
import { ArticleListSkeleton } from '@/components/core/Skeleton';
import { EmptyState } from '@/components/core/EmptyState';
import { EmptyLogoContent } from '@/components/core/EmptyLogoContent';
import { useArticlePrefetch } from '@/lib/hooks/useArticlePrefetch';
import { useImagePrefetch } from '@/lib/hooks/useImagePrefetch';
import { getArticleImageUrl, isVideoUrl } from '@/lib/utils/image';
import { loadArticleList, saveArticleList } from '@/lib/cache/articleListCache';
import type { HomeTabScreenProps } from '@/navigation/types';
import type { FrontendArticle } from '@/types/frontend-blog';

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

const PAGE_SIZE = 15;

/** Number of visible items that should get high-priority image loading */
const PRIORITY_COUNT = 2;

const ArticleListScreen: React.FC<HomeTabScreenProps<'ArticleList'>> = ({
  navigation,
  route,
}) => {
  const insets = useSafeAreaInsets();
  const colors = useModeColors();
  const { t } = useTranslation();
  const lang = useAppLanguage();

  // Extract route params
  const categorySlug = route.params?.categorySlug;
  const tagSlug = route.params?.tagSlug;

  // Cache key: use categorySlug or tagSlug as the MMKV cache key
  // This mirrors the HomeScreen pattern where categoryId identifies the cache entry
  const cacheKey = categorySlug ?? tagSlug ?? null;

  // State
  const [page, setPage] = useState(1);
  const [allArticles, setAllArticles] = useState<FrontendArticle[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  // ─── MMKV cold-start cache ──────────────────────────────────────────
  // Synchronous read from MMKV during render — no useEffect delay
  const cachedData = useMemo(() => {
    const entry = loadArticleList(lang, cacheKey);
    if (entry && entry.items.length > 0) {
      return entry;
    }
    return null;
  }, [lang, cacheKey]);

  // FlatList data source: accumulated articles from pagination, or cache fallback
  // Memoized to prevent the useEffect dependencies from changing on every render.
  const dataSource = useMemo(
    () => (allArticles.length > 0 ? allArticles : (cachedData?.items ?? [])),
    [allArticles, cachedData],
  );

  // Data fetching
  // _refreshKey is a cache-busting parameter: on refresh(), the key increments,
  // forcing RTK Query to create a new cache entry and always fetch from server.
  const { data, isLoading, isFetching, isError, refetch } = useGetArticlesQuery(
    {
      page,
      pageSize: PAGE_SIZE,
      categoryId: categorySlug,
      tagId: tagSlug,
      lang,
      _refreshKey: refreshKey,
    },
  );

  // Accumulate articles across pages for infinite scroll
  React.useEffect(() => {
    if (data?.items) {
      if (page === 1) {
        setAllArticles(data.items);
      } else {
        setAllArticles(prev => [...prev, ...data.items]);
      }
    }
  }, [data, page]);

  // Save page 1 to MMKV cache when fresh data arrives from API
  const prevDataRef = useRef(data);
  React.useEffect(() => {
    if (data?.items && page === 1 && data !== prevDataRef.current) {
      saveArticleList(lang, cacheKey, data);
      prevDataRef.current = data;
    }
  }, [data, lang, cacheKey, page]);

  // Reset when params or language change
  React.useEffect(() => {
    setPage(1);
    setAllArticles([]);
    refetch();
  }, [categorySlug, tagSlug, lang, refetch]);

  // Determine if there are more pages
  const totalPages = data?.totalPages || 1;
  const hasMore = page < totalPages;

  // ─── Handlers ───────────────────────────────────────────────────────

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

  // Predictive prefetch: when displayed articles change (initial load or pagination),
  // prefetch cover images for all non-priority items.
  useEffect(() => {
    if (dataSource.length === 0) {
      return;
    }

    const urlsToPrefetch = dataSource
      .slice(PRIORITY_COUNT)
      .map(getPrefetchUrl)
      .filter(Boolean) as string[];

    if (urlsToPrefetch.length > 0) {
      prefetchMany(urlsToPrefetch).catch(() => {});
    }
  }, [dataSource, prefetchMany]);

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

  const handleLoadMore = useCallback(() => {
    if (!isFetching && hasMore) {
      setPage(prev => prev + 1);
    }
  }, [isFetching, hasMore]);

  const handleRefresh = useCallback(() => {
    setPage(1);
    setAllArticles([]);
    setRefreshKey(k => k + 1);
  }, []);

  // ─── Dynamic title ──────────────────────────────────────────────────

  const title = categorySlug
    ? `Category: ${categorySlug}`
    : tagSlug
      ? `Tag: ${tagSlug}`
      : 'Articles';

  // ─── Render item ────────────────────────────────────────────────────

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
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={[styles.footerText, { color: colors.textSecondary }]}>
          Loading more...
        </Text>
      </View>
    );
  };

  const renderEmpty = () => {
    if (isLoading) {
      return null;
    }

    if (isError) {
      return (
        <EmptyState
          icon="alert-circle"
          title={t('article.error.loadFailed')}
          description={t('article.error.pullDownToRetry')}
          primaryAction={{ label: t('common.retry'), onPress: handleRefresh }}
        />
      );
    }

    if (categorySlug) {
      return (
        <EmptyLogoContent
          title={t('categories.emptyArticles')}
          description={t('common.checkBackLater')}
        />
      );
    }

    if (tagSlug) {
      return (
        <EmptyLogoContent
          title={t('tags.emptyArticles')}
          description={t('common.checkBackLater')}
        />
      );
    }

    return (
      <EmptyLogoContent
        title={t('home.empty')}
        description={t('common.checkBackLater')}
      />
    );
  };

  // ─── Loading state (skip if cached data available) ────────────────

  if (isLoading && page === 1 && dataSource.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bgSecondary }]}>
        <Header title={title} hideSearch hideSettings />
        <View style={styles.loadingContainer}>
          <ArticleListSkeleton count={6} />
        </View>
      </View>
    );
  }

  // ─── Main render ────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: colors.bgSecondary }]}>
      <Header title={title} hideSearch hideSettings />

      <PullToRefreshWrapper
        refreshing={isFetching && page === 1}
        onRefresh={handleRefresh}
        backgroundColor={colors.bgSecondary}
        spinnerColor={colors.primary}
      >
        <FlatList
          data={dataSource}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + spacing.xl },
            allArticles.length === 0 && styles.emptyList,
          ]}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          viewabilityConfig={viewabilityConfig}
          onViewableItemsChanged={onViewableItemsChanged}
          showsVerticalScrollIndicator={false}
          initialNumToRender={8}
          maxToRenderPerBatch={10}
          windowSize={5}
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
    paddingTop: spacing.sm,
  },
  emptyList: {
    justifyContent: 'center',
  },
  articleItem: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  footerLoader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  footerText: {
    fontFamily: typography.small.fontFamily,
    fontSize: typography.small.fontSize,
  },
});

export default ArticleListScreen;
