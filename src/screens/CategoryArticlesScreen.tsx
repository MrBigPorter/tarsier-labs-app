/**
 * CategoryArticlesScreen — Articles filtered by category
 *
 * Reuses ArticleListScreen pattern with categorySlug pre-set.
 * Shows the category name as the header title.
 *
 * Route params:
 * - categorySlug: string (required)
 * - categoryName: string (optional, for display)
 *
 * Data: useGetCategoryBySlugQuery + articles filtered via route param
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
import { useGetCategoryBySlugQuery } from '../api/endpoints/categories';
import ArticleCard from '../components/blog/ArticleCard';
import Header from '../components/layout/Header';
import { ArticleListSkeleton, ArticleCardSkeleton } from '../components/core/Skeleton';
import EmptyState from '../components/core/EmptyState';
import type { ArticlesTabScreenProps } from '../navigation/types';
import type { FrontendArticle } from '../types/frontend-blog';

const CategoryArticlesScreen: React.FC<
  ArticlesTabScreenProps<'CategoryArticles'>
> = ({ navigation, route }) => {
  const { categorySlug, categoryName } = route.params;
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const colors = theme.colors;

  const [page, setPage] = useState(1);

  const {
    data: categoryData,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useGetCategoryBySlugQuery({
    slug: categorySlug,
    page,
    pageSize: 15,
  });

  const articles = categoryData?.articles?.items || [];
  const totalPages = categoryData?.articles?.totalPages || 1;
  const hasMore = page < totalPages;

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
    refetch();
  }, [refetch]);

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
      <View style={styles.footer}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  };

  // ─── Loading state ──────────────────────────────────────────────────

  if (isLoading && page === 1) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Header title={categoryName || categorySlug} showBack />
        <View style={styles.loadingContainer}>
          <ArticleListSkeleton count={5} />
        </View>
      </View>
    );
  }

  // ─── Main render ────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title={categoryName || categorySlug} showBack />

      <FlatList
        data={articles}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + spacing.xl },
          articles.length === 0 && styles.emptyList,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && page === 1}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={
          isError ? (
            <EmptyState
              icon="alert-circle"
              title="Failed to load articles"
              description="Pull down to retry"
              primaryAction={{ label: 'Retry', onPress: handleRefresh }}
            />
          ) : (
            <EmptyState
              icon="file-text"
              title="No articles in this category"
              description="Check back later for new content"
            />
          )
        }
        ListFooterComponent={renderFooter}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        showsVerticalScrollIndicator={false}
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
  footer: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
});

export default CategoryArticlesScreen;
