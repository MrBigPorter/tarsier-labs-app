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
import type { CategoriesTabScreenProps } from '@/navigation/types';
import type { FrontendArticle } from '@/types/frontend-blog';

const CategoryArticlesScreen: React.FC<
  CategoriesTabScreenProps<'CategoryArticles'>
> = ({ navigation, route }) => {
  const { categorySlug, categoryName } = route.params;
  const insets = useSafeAreaInsets();
  const colors = useModeColors();
  const { t } = useTranslation();
  const lang = useAppLanguage();

  const [page, setPage] = useState(1);
  const [allArticles, setAllArticles] = useState<FrontendArticle[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

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
    lang,
    _refreshKey: refreshKey,
  });

  const totalPages = categoryData?.articles?.totalPages || 1;
  const hasMore = page < totalPages;

  const prevLangRef = React.useRef(lang);

  // Re-fetch when language changes
  React.useEffect(() => {
    if (prevLangRef.current !== lang) {
      prevLangRef.current = lang;
      setPage(1);
      refetch();
    }
  }, [lang, refetch]);

  // Accumulate articles across pages
  React.useEffect(() => {
    if (categoryData?.articles?.items) {
      if (page === 1) {
        setAllArticles(categoryData.articles.items);
      } else {
        setAllArticles(prev => {
          const existingIds = new Set(prev.map(a => a.id));
          const newItems = categoryData.articles.items.filter(
            a => !existingIds.has(a.id),
          );
          if (newItems.length === 0) {
            return prev;
          }
          return [...prev, ...newItems];
        });
      }
    }
  }, [categoryData, page]);

  const category = categoryData
    ? {
        name: categoryData.name || categoryName || categorySlug,
        description: categoryData.description,
        articleCount: categoryData.articleCount ?? allArticles.length,
        icon: categoryData.icon,
        color: categoryData.color,
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

  const renderItem = useCallback(
    ({ item }: { item: FrontendArticle }) => (
      <View style={styles.articleItem}>
        <ArticleCard
          article={item}
          onPress={handleArticlePress}
          onPrefetch={prefetchArticle}
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

  // ─── Loading state ──────────────────────────────────────────────────

  if (isLoading && page === 1) {
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
        refreshing={isFetching && page === 1}
        onRefresh={handleRefresh}
        backgroundColor={colors.bgSecondary}
        spinnerColor={colors.primary}
      >
        <FlatList
          data={allArticles}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + spacing.xl },
            allArticles.length === 0 && styles.emptyList,
          ]}
          ListHeaderComponent={allArticles.length > 0 ? renderListHeader : null}
          ListEmptyComponent={
            isError ? (
              <EmptyState
                icon="alert-circle"
                title={t('article.error.loadFailed')}
                description={t('common.pullDownToRetry')}
                primaryAction={{
                  label: t('common.retry'),
                  onPress: handleRefresh,
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
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
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
