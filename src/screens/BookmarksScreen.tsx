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
 * - Not logged in: show login prompt
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../lib/theme/ThemeContext';
import { spacing } from '../lib/theme/spacing';
import { typography } from '../lib/theme/typography';
import { useAppSelector, useAppDispatch } from '../store';
import {
  fetchBookmarks,
  removeBookmark,
} from '../store/slices/bookmarksSlice';
import ArticleCard from '../components/blog/ArticleCard';
import Header from '../components/layout/Header';
import { ArticleListSkeleton } from '../components/core/Skeleton';
import EmptyState from '../components/core/EmptyState';
import type { ProfileTabScreenProps } from '../navigation/types';
import type { FrontendArticle } from '../types/frontend-blog';

const PAGE_SIZE = 20;

const BookmarksScreen: React.FC<
  ProfileTabScreenProps<'Bookmarks'>
> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const colors = theme.colors;
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
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Header title="Bookmarks" />
        <EmptyState
          icon="bookmark"
          title="Sign in to view bookmarks"
          description="Save articles to read later by tapping the bookmark icon"
          primaryAction={{
            label: 'Sign In',
            onPress: handleSignIn,
          }}
        />
      </View>
    );
  }

  // ─── Loading state ──────────────────────────────────────────────────

  if (isLoading && currentPage === 1 && allArticles.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Header title={`Bookmarks (${total})`} />
        <View style={styles.loadingContainer}>
          <ArticleListSkeleton count={5} />
        </View>
      </View>
    );
  }

  // ─── Main render ────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title={`Bookmarks${total > 0 ? ` (${total})` : ''}`} />

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
          <EmptyState
            icon="bookmark"
            title="No bookmarks yet"
            description="Tap the bookmark icon on any article to save it here"
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
