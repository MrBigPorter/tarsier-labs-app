/**
 * BookmarksScreen — User's bookmarked articles
 *
 * Features:
 * - Paginated list of bookmarked articles
 * - Pull-to-refresh
 * - Optimistic toggle (bookmark/unbookmark via Redux)
 * - Offline support (cached bookmarks in MMKV)
 * - Empty state when no bookmarks
 * - Login prompt when user is not authenticated
 *
 * Data:
 * - Redux bookmarksSlice (fetchBookmarks, removeBookmark)
 * - MMKV cache for offline access
 *
 * Edge cases:
 * - Not logged in: show login prompt with logo + sign-in button
 * - No bookmarks: friendly empty state
 * - Network error: show cached bookmarks from MMKV
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Text,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, spacing, typography, borderRadius } from '@/lib/theme';
import { useAppSelector, useAppDispatch } from '@/store';
import {
  fetchBookmarks,
  removeBookmark,
} from '@/store/slices/bookmarksSlice';
import { ArticleCard } from '@/components/blog/ArticleCard';
import Header from '@/components/layout/Header';
import { ArticleListSkeleton } from '@/components/core/Skeleton';
import { EmptyState } from '@/components/core/EmptyState';
import { EmptyLogoContent } from '@/components/core/EmptyLogoContent';
import { useTranslation } from 'react-i18next';
import type { BookmarksTabScreenProps } from '@/navigation/types';
import type { FrontendArticle } from '@/types/frontend-blog';

const PAGE_SIZE = 20;

const BookmarksScreen: React.FC<
  BookmarksTabScreenProps<'Bookmarks'>
> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  // ─── Redux state ────────────────────────────────────────────────────
  const {
    articles: bookmarkedArticles,
    isLoading,
    error,
    total,
    page,
    totalPages,
  } = useAppSelector(state => state.bookmarks);

  const isAuthenticated = useAppSelector(state => state.auth.isAuthenticated);
  const user = useAppSelector(state => state.auth.user);

  // ─── Local pagination ───────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);
  const [allArticles, setAllArticles] = useState<FrontendArticle[]>([]);

  // Fetch bookmarks on mount
  useEffect(() => {
    if (isAuthenticated) {
      dispatch(fetchBookmarks({ page: currentPage, pageSize: PAGE_SIZE }));
    }
  }, [dispatch, isAuthenticated, currentPage]);

  // Accumulate articles
  useEffect(() => {
    if (bookmarkedArticles.length > 0) {
      if (currentPage === 1) {
        setAllArticles(bookmarkedArticles as unknown as FrontendArticle[]);
      } else {
        // For pagination, replace on page 1, append on subsequent pages
        setAllArticles(prev => {
          if (currentPage === 1) return bookmarkedArticles as unknown as FrontendArticle[];
          const existingIds = new Set(prev.map(a => a.id));
          const newArticles = (bookmarkedArticles as unknown as FrontendArticle[]).filter(
            a => !existingIds.has(a.id),
          );
          return [...prev, ...newArticles];
        });
      }
    } else if (currentPage === 1) {
      setAllArticles([]);
    }
  }, [bookmarkedArticles, currentPage]);

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

  const handleRefresh = useCallback(() => {
    setCurrentPage(1);
    dispatch(fetchBookmarks({ page: 1, pageSize: PAGE_SIZE }));
  }, [dispatch]);

  const handleLoadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      setCurrentPage(prev => prev + 1);
    }
  }, [isLoading, hasMore]);

  const handleRemoveBookmark = useCallback(
    (articleId: string) => {
      dispatch(removeBookmark(articleId));
    },
    [dispatch],
  );

  const handleSignIn = useCallback(() => {
    navigation.getParent()?.navigate('Auth');
  }, [navigation]);

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
    if (!isLoading || !hasMore) return null;
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
        <Header title="Bookmarks" hideSearch hideSettings />
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

  if (isLoading && currentPage === 1 && allArticles.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bgSecondary }]}>
        <Header title={`Bookmarks (${total})`} hideSearch hideSettings />
        <View style={styles.loadingContainer}>
          <ArticleListSkeleton count={5} />
        </View>
      </View>
    );
  }

  // ─── Main render ────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: colors.bgSecondary }]}>
      <Header title={`Bookmarks${total > 0 ? ` (${total})` : ''}`} hideSearch hideSettings />

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
            refreshing={isLoading && currentPage === 1}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
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
