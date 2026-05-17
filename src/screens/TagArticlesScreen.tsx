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
import { useTranslation } from 'react-i18next';
import {
  View,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Text,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, spacing, typography } from '@/lib/theme';
import { useGetTagBySlugQuery } from '@/api/endpoints/tags';
import { useCurrentLanguage } from '@/lib/i18n';
import { ArticleCard } from '@/components/blog/ArticleCard';
import Header from '@/components/layout/Header';
import { ArticleListSkeleton } from '@/components/core/Skeleton';
import { EmptyState } from '@/components/core/EmptyState';
import { EmptyLogoContent } from '@/components/core/EmptyLogoContent';
import type { TagsTabScreenProps } from '@/navigation/types';
import type { FrontendArticle } from '@/types/frontend-blog';

const TagArticlesScreen: React.FC<
  TagsTabScreenProps<'TagArticles'>
> = ({ navigation, route }) => {
  const { tagSlug, tagName } = route.params;
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const lang = useCurrentLanguage();

  const [page, setPage] = useState(1);
  const [allArticles, setAllArticles] = useState<FrontendArticle[]>([]);

  const {
    data: tagData,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useGetTagBySlugQuery({ slug: tagSlug, page, pageSize: 15, lang });

  const totalPages = tagData?.articles?.totalPages || 1;
  const hasMore = page < totalPages;

  // Accumulate articles across pages
  React.useEffect(() => {
    if (tagData?.articles?.items) {
      if (page === 1) {
        setAllArticles(tagData.articles.items);
      } else {
        setAllArticles(prev => {
          const existingIds = new Set(prev.map(a => a.id));
          const newItems = tagData.articles.items.filter(a => !existingIds.has(a.id));
          if (newItems.length === 0) return prev;
          return [...prev, ...newItems];
        });
      }
    }
  }, [tagData, page]);

  const tag = tagData
    ? {
        name: tagData.name || tagName || tagSlug,
        articleCount: tagData.articleCount ?? allArticles.length,
        color: tagData.color,
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

  const renderListHeader = () => (
    <View style={styles.tagHeader}>
      {/* Tag name with # prefix */}
      <View style={styles.titleRow}>
        <View style={[styles.hashBadge, { backgroundColor: (tag.color || colors.primary) + '20' }]}>
          <Text style={[styles.hashText, { color: tag.color || colors.primary }]}>
            #
          </Text>
        </View>
        <Text style={[styles.tagName, { color: colors.text }]}>
          {tag.name}
        </Text>
      </View>

      {/* Article count */}
      <View style={styles.metaRow}>
        <Text style={[styles.articleCount, { color: colors.textTertiary || colors.textSecondary }]}>
          {tag.articleCount} {tag.articleCount === 1 ? 'article' : 'articles'}
        </Text>
      </View>

      {/* Divider */}
      <View style={[styles.headerDivider, { backgroundColor: colors.borderSecondary }]} />
    </View>
  );

  // ─── Loading state ──────────────────────────────────────────────────

  if (isLoading && page === 1) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bgSecondary }]}>
        <Header title={tagName ? `#${tagName}` : tagSlug} showBack hideSearch hideSettings />
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

      <FlatList
        data={allArticles}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + spacing.xl },
          allArticles.length === 0 && styles.emptyList,
        ]}
        ListHeaderComponent={allArticles.length > 0 ? renderListHeader : null}
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
              title={t('article.error.loadFailed')}
              description={t('common.pullDownToRetry')}
              primaryAction={{ label: t('common.retry'), onPress: handleRefresh }}
            />
          ) : (
            <EmptyLogoContent
              title={t('tags.emptyArticles')}
              description={t('common.checkBackLater')}
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
