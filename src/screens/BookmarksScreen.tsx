/**
 * BookmarksScreen — User's bookmarked articles
 *
 * Features:
 * - Paginated list of bookmarked articles fetched via RTK Query (auto auth)
 * - Pull-to-refresh
 * - Optimistic toggle (bookmark/unbookmark via Redux)
 * - Empty state when no bookmarks
 * - Login prompt when user is not authenticated
 *
 * Data:
 * - RTK Query: useGetBookmarksQuery for fetching, useRemoveBookmarkMutation for removing
 * - Redux bookmarksSlice: only for optimistic bookmarkedIds state
 *
 * Edge cases:
 * - Not logged in: show login prompt with logo + sign-in button
 * - No bookmarks: friendly empty state
 * - Network error: show cached bookmarks from RTK Query cache
 */
import React, { useCallback, useState } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Text,
  Image,
} from 'react-native';
import PullToRefreshWrapper from '@/components/core/PullToRefreshWrapper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useModeColors, spacing, typography, borderRadius } from '@/lib/theme';
import { useAppSelector } from '@/store';
import { useGetBookmarksQuery } from '@/api/endpoints/bookmarks';
import { ArticleCard } from '@/components/blog/ArticleCard';
import Header from '@/components/layout/Header';
import { ArticleListSkeleton } from '@/components/core/Skeleton';
import { EmptyLogoContent } from '@/components/core/EmptyLogoContent';
import { useTranslation } from 'react-i18next';
import { useAppLanguage } from '@/lib/i18n';
import { useArticlePrefetch } from '@/lib/hooks/useArticlePrefetch';
import type { BookmarksTabScreenProps } from '@/navigation/types';
import type { FrontendArticle } from '@/types/frontend-blog';

const PAGE_SIZE = 20;

const BookmarksScreen: React.FC<BookmarksTabScreenProps<'Bookmarks'>> = ({
  navigation,
}) => {
  const insets = useSafeAreaInsets();
  const colors = useModeColors();
  const { t } = useTranslation();
  const lang = useAppLanguage();

  // ─── Auth state ─────────────────────────────────────────────────────
  const isAuthenticated = useAppSelector(state => state.auth.isAuthenticated);

  // ─── Pagination ─────────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);

  // ─── RTK Query ──────────────────────────────────────────────────────
  // _refreshKey is a cache-busting parameter: on refresh(), the key increments,
  // forcing RTK Query to create a new cache entry and always fetch from server.
  const { data, isLoading, isFetching } = useGetBookmarksQuery({
    page: currentPage,
    pageSize: PAGE_SIZE,
    locale: lang,
    _refreshKey: refreshKey,
  });

  const bookmarkedArticles = (data?.items ??
    []) as unknown as FrontendArticle[];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 0;
  const hasMore = currentPage < totalPages;

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
  useArticlePrefetch();

  const handleRefresh = useCallback(() => {
    setCurrentPage(1);
    setRefreshKey(k => k + 1);
  }, []);

  const handleLoadMore = useCallback(() => {
    if (!isFetching && hasMore) {
      setCurrentPage(prev => prev + 1);
    }
  }, [isFetching, hasMore]);

  const handleSignIn = useCallback(() => {
    navigation.getParent()?.navigate('Auth');
  }, [navigation]);

  // ─── Render item ────────────────────────────────────────────────────

  const renderItem = useCallback(
    ({ item }: { item: FrontendArticle }) => (
      <View style={styles.articleItem}>
        <ArticleCard article={item} onPress={handleArticlePress} showExcerpt />
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

  // ─── Not authenticated ──────────────────────────────────────────────

  if (!isAuthenticated) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bgSecondary }]}>
        <Header title="Bookmarks" hideSearch hideSettings showBack={false} />
        <View style={styles.centerContainer}>
          {/* Logo */}
          <Image
            source={require('@assets/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />

          {/* Title */}
          <Text style={[styles.title, { color: colors.text }]}>
            {t('bookmarks.signInToView')}
          </Text>

          {/* Description */}
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            {t('bookmarks.saveDescription')}
          </Text>

          {/* Sign In Button */}
          <TouchableOpacity
            style={[styles.signInButton, { backgroundColor: colors.primary }]}
            onPress={handleSignIn}
            activeOpacity={0.8}
          >
            <Text style={styles.signInButtonText}>{t('bookmarks.signIn')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─── Loading state ──────────────────────────────────────────────────

  if (isLoading && currentPage === 1 && bookmarkedArticles.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bgSecondary }]}>
        <Header
          title={`Bookmarks (${total})`}
          hideSearch
          hideSettings
          showBack={false}
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
      <Header
        title={`Bookmarks${total > 0 ? ` (${total})` : ''}`}
        hideSearch
        hideSettings
        showBack={false}
      />

      <PullToRefreshWrapper
        refreshing={isFetching && currentPage === 1}
        onRefresh={handleRefresh}
        backgroundColor={colors.bgSecondary}
        spinnerColor={colors.primary}
      >
        <FlatList
          data={bookmarkedArticles}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + spacing.xl },
            bookmarkedArticles.length === 0 && styles.emptyList,
          ]}
          ListEmptyComponent={
            <EmptyLogoContent
              title={t('bookmarks.emptyTitle')}
              description={t('bookmarks.emptyHint')}
            />
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
  // ─── Not authenticated ──────────────────────────────────────────────
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing['3xl'],
    paddingBottom: spacing['5xl'],
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: spacing.xl,
    borderRadius: borderRadius.xl,
  },
  title: {
    fontSize: typography.h3.fontSize,
    fontWeight: typography.h3.fontWeight as any,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  description: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    textAlign: 'center',
    marginBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  signInButton: {
    width: '100%',
    height: 52,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signInButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  // ─── Authenticated states ────────────────────────────────────────────
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

export default BookmarksScreen;
