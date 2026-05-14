/**
 * TagArticlesScreen — Articles filtered by tag
 *
 * Shows articles belonging to a specific tag.
 * Reuses ArticleListScreen pattern with tagSlug pre-set.
 *
 * Route params:
 * - tagSlug: string (required)
 * - tagName: string (optional, for display)
 *
 * Data: useGetTagBySlugQuery
 */
import React, { useCallback, useState } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../lib/theme/ThemeContext';
import { spacing } from '../lib/theme/spacing';
import { useGetTagBySlugQuery } from '../api/endpoints/tags';
import ArticleCard from '../components/blog/ArticleCard';
import Header from '../components/layout/Header';
import { ArticleListSkeleton } from '../components/core/Skeleton';
import EmptyState from '../components/core/EmptyState';
import type { ArticlesTabScreenProps } from '../navigation/types';
import type { FrontendArticle } from '../types/frontend-blog';

const TagArticlesScreen: React.FC<
  ArticlesTabScreenProps<'TagArticles'>
> = ({ navigation, route }) => {
  const { tagSlug, tagName } = route.params;
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const colors = theme.colors;

  const [page, setPage] = useState(1);

  const {
    data: tagData,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useGetTagBySlugQuery({ slug: tagSlug, page, pageSize: 15 });

  const articles = tagData?.articles?.items || [];
  const totalPages = tagData?.articles?.totalPages || 1;
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
        <Header title={tagName ? `#${tagName}` : tagSlug} showBack />
        <View style={styles.loadingContainer}>
          <ArticleListSkeleton count={5} />
        </View>
      </View>
    );
  }

  // ─── Main render ────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title={tagName ? `#${tagName}` : tagSlug} showBack />

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
              title="No articles with this tag"
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

export default TagArticlesScreen;
