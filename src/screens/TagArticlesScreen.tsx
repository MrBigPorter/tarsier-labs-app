/**
 * TagArticlesScreen — Articles filtered by tag
 *
 * Shows articles belonging to a specific tag.
 * Uses usePaginatedQuery with MMKV cold-start cache for instant display.
 *
 * Route params:
 * - tagSlug: string (required)
 * - tagName: string (optional, for display)
 *
 * Data: useGetTagBySlugQuery (via usePaginatedQuery)
 * Cache: MMKV cold-start cache via tagSlug key
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
import { useGetTagBySlugQuery } from '@/api/endpoints/tags';
import { useAppLanguage } from '@/lib/i18n';
import { ArticleCard } from '@/components/blog/ArticleCard';
import Header from '@/components/layout/Header';
import { ArticleListSkeleton } from '@/components/core/Skeleton';
import { EmptyState } from '@/components/core/EmptyState';
import { useArticlePrefetch } from '@/lib/hooks/useArticlePrefetch';
import { useImagePrefetch } from '@/lib/hooks/useImagePrefetch';
import { getArticleImageUrl, isVideoUrl } from '@/lib/utils/image';
import { EmptyLogoContent } from '@/components/core/EmptyLogoContent';
import { usePaginatedQuery } from '@/lib/hooks/usePaginatedQuery';
import {
  loadArticleList,
  saveArticleList,
  clearLanguageCache,
} from '@/lib/cache/articleListCache';
import type { TagsTabScreenProps } from '@/navigation/types';
import type {
  FrontendArticle,
  FrontendTagWithArticles,
} from '@/types/frontend-blog';

/** Number of visible items that should get high-priority image loading */
const PRIORITY_COUNT = 2;

/**
 * Resolve the best image URL for prefetching from an article.
 * Matches the logic in AppImage's getArticleImageUrl (without Cloudflare optimization
 * since FastImage.preload caches the raw URL and Cloudflare serves transforms on edge).
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

const TagArticlesScreen: React.FC<TagsTabScreenProps<'TagArticles'>> = ({
  navigation,
  route,
}) => {
  const { tagSlug, tagName } = route.params;
  const insets = useSafeAreaInsets();
  const colors = useModeColors();
  const { t } = useTranslation();
  const lang = useAppLanguage();
  const prevLangRef = React.useRef(lang);

  // Cache key: use tagSlug as the MMKV cache identifier
  const cacheKey = tagSlug;

  // ─── MMKV cold-start cache ──────────────────────────────────────────
  // Synchronous read from MMKV during render — no useEffect delay.
  // Shape cached data as a partial FrontendTagWithArticles so usePaginatedQuery
  // can extract articles via selectItems (data => data.articles?.items ?? []).
  const cachedData = useMemo((): FrontendTagWithArticles | null => {
    const entry = loadArticleList(lang, cacheKey);
    if (entry && entry.items.length > 0) {
      return {
        id: '',
        slug: tagSlug,
        name: tagName || tagSlug,
        articleCount: entry.total,
        articles: {
          items: entry.items,
          total: entry.total,
          page: 1,
          pageSize: entry.pageSize,
          totalPages: entry.totalPages,
        },
      };
    }
    return null;
  }, [lang, cacheKey, tagSlug, tagName]);

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
    useGetTagBySlugQuery,
    { slug: tagSlug, lang },
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

  // ─── Tag metadata from API (or fallback from route params) ─────────
  const tag = rawData
    ? {
        name: rawData.name || tagName || tagSlug,
        articleCount: rawData.articleCount ?? displayArticles.length,
        color: rawData.color,
      }
    : {
        name: tagName || tagSlug,
        articleCount: 0,
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
    <View style={styles.tagHeader}>
      {/* Tag name with # prefix */}
      <View style={styles.titleRow}>
        <View
          style={[
            styles.hashBadge,
            { backgroundColor: (tag.color || colors.primary) + '20' },
          ]}
        >
          <Text
            style={[styles.hashText, { color: tag.color || colors.primary }]}
          >
            #
          </Text>
        </View>
        <Text style={[styles.tagName, { color: colors.text }]}>{tag.name}</Text>
      </View>

      {/* Article count */}
      <View style={styles.metaRow}>
        <Text
          style={[
            styles.articleCount,
            { color: colors.textTertiary || colors.textSecondary },
          ]}
        >
          {tag.articleCount} {tag.articleCount === 1 ? 'article' : 'articles'}
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
          title={tagName ? `#${tagName}` : tagSlug}
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
      <Header title={`#${tag.name}`} showBack hideSearch hideSettings />

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
                title={t('tags.emptyArticles')}
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
  // ── Tag header ────────────────────────────────────────────────────
  tagHeader: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  hashBadge: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  hashText: {
    fontSize: 20,
    fontWeight: '800',
  },
  tagName: {
    fontFamily: typography.h3.fontFamily,
    fontSize: typography.h3.fontSize,
    fontWeight: typography.h3.fontWeight,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 40 + spacing.sm, // Align with tag name after badge
  },
  articleCount: {
    fontFamily: typography.caption.fontFamily,
    fontSize: typography.caption.fontSize,
    fontWeight: '500',
  },
  headerDivider: {
    height: 1,
    marginTop: spacing.md,
    marginLeft: 40 + spacing.sm, // Align with tag name after badge
  },
});

export default TagArticlesScreen;
