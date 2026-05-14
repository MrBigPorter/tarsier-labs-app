/**
 * ArticleListScreen — Paginated article listing with filters
 *
 * Features:
 * - Paginated FlatList with infinite scroll (onEndReached)
 * - Pull-to-refresh
 * - Filter by category or tag via route params
 * - Sorting: newest first (default), popular, trending
 * - Skeleton loading state
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
import React, { useCallback, useState } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Text,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../lib/theme/ThemeContext';
import { spacing } from '../lib/theme/spacing';
import { typography } from '../lib/theme/typography';
import { useGetArticlesQuery } from '../api/endpoints/articles';
import ArticleCard from '../components/blog/ArticleCard';
import Header from '../components/layout/Header';
import { ArticleListSkeleton } from '../components/core/Skeleton';
import EmptyState from '../components/core/EmptyState';
import type { ArticlesTabScreenProps } from '../navigation/types';
import type { FrontendArticle } from '../types/frontend-blog';

type SortOption = 'newest' | 'popular' | 'trending';

const PAGE_SIZE = 15;

const ArticleListScreen: React.FC<
  ArticlesTabScreenProps<'ArticleList'>
> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const colors = theme.colors;

  // Extract route params
  const categorySlug = route.params?.categorySlug;
  const tagSlug = route.params?.tagSlug;

  // State
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [allArticles, setAllArticles] = useState<FrontendArticle[]>([]);

  // Data fetching
  const {
    data,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useGetArticlesQuery({
    page,
    pageSize: PAGE_SIZE,
    categoryId: categorySlug,
    tagId: tagSlug,
  });

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

  // Reset when params change
  React.useEffect(() => {
    setPage(1);
    setAllArticles([]);
  }, [categorySlug, tagSlug]);

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

  const handleLoadMore = useCallback(() => {
    if (!isFetching && hasMore) {
      setPage(prev => prev + 1);
    }
  }, [isFetching, hasMore]);

  const handleRefresh = useCallback(() => {
    setPage(1);
    setAllArticles([]);
    refetch();
  }, [refetch]);

  // ─── Dynamic title ──────────────────────────────────────────────────

  const title = categorySlug
    ? `Category: ${categorySlug}`
    : tagSlug
      ? `Tag: ${tagSlug}`
      : 'Articles';

  // ─── Render item ────────────────────────────────────────────────────

  const renderItem = useCallback(
    ({ item }: { item: FrontendArticle }) => (
      <View style={styles.articleItem}>
        <ArticleCard
          article={item}
          onPress={handleArticlePress}
          showExcerpt
        />
      </View>
    ),
    [handleArticlePress],
  );

  const renderFooter = () => {
    if (!isFetching || !hasMore) return null;

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
    if (isLoading) return null;

    if (isError) {
      return (
        <EmptyState
          icon="alert-circle"
          title="Failed to load articles"
          description="Pull down to retry loading"
          primaryAction={{ label: 'Retry', onPress: handleRefresh }}
        />
      );
    }

    if (categorySlug) {
      return (
        <EmptyState
          icon="file-text"
          title="No articles in this category"
          description="Check back later for new content"
        />
      );
    }

    if (tagSlug) {
      return (
        <EmptyState
          icon="file-text"
          title="No articles with this tag"
          description="Check back later for new content"
        />
      );
    }

    return (
      <EmptyState
        icon="file-text"
        title="No articles yet"
        description="Check back later for new content"
      />
    );
  };

  // ─── Loading state ──────────────────────────────────────────────────

  if (isLoading && page === 1) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Header title={title} />
        <View style={styles.loadingContainer}>
          <ArticleListSkeleton count={6} />
        </View>
      </View>
    );
  }

  // ─── Main render ────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title={title} />

      <FlatList
        data={allArticles}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + spacing.xl },
          allArticles.length === 0 && styles.emptyList,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && page === 1}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        showsVerticalScrollIndicator={false}
        initialNumToRender={8}
        maxToRenderPerBatch={10}
        windowSize={5}
      />
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
