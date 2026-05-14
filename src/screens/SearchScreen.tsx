/**
 * SearchScreen — Full-screen article search
 *
 * Features:
 * - Debounced search input at top
 * - Search results as article card list
 * - Recent searches section (when query is empty)
 * - Loading state with skeleton cards
 * - Empty state when no results
 * - Error state with retry
 *
 * Data: useSearchArticlesQuery (RTK Query)
 *
 * Edge cases:
 * - Empty query: show recent searches or prompt
 * - No results: friendly message
 * - Network error: retry button
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../lib/theme/ThemeContext';
import { spacing } from '../lib/theme/spacing';
import { typography } from '../lib/theme/typography';
import { useSearchArticlesQuery } from '../api/endpoints/articles';
import { storage } from '../lib/storage';
import ArticleCard from '../components/blog/ArticleCard';
import SearchBar from '../components/layout/SearchBar';
import { ArticleListSkeleton } from '../components/core/Skeleton';
import EmptyState from '../components/core/EmptyState';
import Header from '../components/layout/Header';
import SvgIcon from '../components/core/SvgIcon';
import type { RootStackScreenProps } from '../navigation/types';
import type { FrontendArticle } from '../types/frontend-blog';

const RECENT_SEARCHES_KEY = 'recent_searches';
const MAX_RECENT = 10;

const SearchScreen: React.FC<RootStackScreenProps<'Search'>> = ({
  navigation,
}) => {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const colors = theme.colors;

  // ─── State ──────────────────────────────────────────────────────────
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [page, setPage] = useState(1);

  // Load recent searches on mount
  useEffect(() => {
    try {
      const saved = storage.getString(RECENT_SEARCHES_KEY);
      if (saved) {
        setRecentSearches(JSON.parse(saved));
      }
    } catch {
      // Ignore
    }
  }, []);

  // Debounce search query (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // ─── Data fetching ──────────────────────────────────────────────────
  const {
    data: searchData,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useSearchArticlesQuery(
    { q: debouncedQuery, page, pageSize: 20 },
    { skip: debouncedQuery.length < 2 },
  );

  const results = searchData?.items || [];
  const totalPages = searchData?.totalPages || 1;
  const hasMore = page < totalPages;

  // ─── Recent searches management ─────────────────────────────────────
  const saveRecentSearch = useCallback(
    (searchQuery: string) => {
      if (!searchQuery.trim()) return;
      const updated = [
        searchQuery,
        ...recentSearches.filter(s => s !== searchQuery),
      ].slice(0, MAX_RECENT);
      setRecentSearches(updated);
      storage.set(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    },
    [recentSearches],
  );

  const clearRecentSearches = useCallback(() => {
    setRecentSearches([]);
    storage.delete(RECENT_SEARCHES_KEY);
  }, []);

  const removeRecentSearch = useCallback(
    (search: string) => {
      const updated = recentSearches.filter(s => s !== search);
      setRecentSearches(updated);
      storage.set(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    },
    [recentSearches],
  );

  // ─── Handlers ───────────────────────────────────────────────────────
  const handleChangeText = useCallback((text: string) => {
    setQuery(text);
  }, []);

  const handleSubmit = useCallback(
    (searchQuery: string) => {
      if (searchQuery.trim().length >= 2) {
        saveRecentSearch(searchQuery.trim());
      }
    },
    [saveRecentSearch],
  );

  const handleRecentSearchPress = useCallback((search: string) => {
    setQuery(search);
    setDebouncedQuery(search);
    saveRecentSearch(search);
  }, [saveRecentSearch]);

  const handleArticlePress = useCallback(
    (article: FrontendArticle) => {
      navigation.navigate('ArticleDetail', {
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

  // ─── Render items ───────────────────────────────────────────────────
  const renderArticleItem = useCallback(
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

  // ─── Empty state: no query ──────────────────────────────────────────
  const renderEmptyState = () => {
    // Show recent searches when no query
    if (!debouncedQuery) {
      if (recentSearches.length > 0) {
        return (
          <View style={styles.recentSection}>
            <View style={styles.recentHeader}>
              <Text
                style={[
                  styles.recentTitle,
                  { color: colors.text },
                ]}
              >
                Recent Searches
              </Text>
              <TouchableOpacity onPress={clearRecentSearches}>
                <Text
                  style={[
                    styles.clearText,
                    { color: colors.textSecondary },
                  ]}
                >
                  Clear
                </Text>
              </TouchableOpacity>
            </View>
            {recentSearches.map((search, index) => (
              <TouchableOpacity
                key={`${search}-${index}`}
                onPress={() => handleRecentSearchPress(search)}
                style={styles.recentItem}
              >
                <SvgIcon
                  name="clock"
                  size={16}
                  color={colors.textSecondary}
                />
                <Text
                  style={[
                    styles.recentItemText,
                    { color: colors.text },
                  ]}
                  numberOfLines={1}
                >
                  {search}
                </Text>
                <TouchableOpacity
                  onPress={() => removeRecentSearch(search)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <SvgIcon
                    name="x"
                    size={14}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </View>
        );
      }

      return (
        <EmptyState
          icon="search"
          title="Search articles"
          description="Type at least 2 characters to search across all articles"
        />
      );
    }

    // Loading state
    if (isLoading) {
      return <ArticleListSkeleton count={5} />;
    }

    // Error state
    if (isError) {
      return (
        <EmptyState
          icon="alert-circle"
          title="Search failed"
          description="Please check your connection and try again"
          primaryAction={{ label: 'Retry', onPress: refetch }}
        />
      );
    }

    // No results
    if (results.length === 0 && debouncedQuery.length >= 2) {
      return (
        <EmptyState
          icon="search"
          title="No results found"
          description={`No articles matching "${debouncedQuery}"`}
        />
      );
    }

    return null;
  };

  // ─── Main render ────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header
        title="Search"
        hideSearch
        hideAvatar
        rightAction={
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.cancelText, { color: colors.primary }]}>
              Cancel
            </Text>
          </TouchableOpacity>
        }
      />

      <SearchBar
        value={query}
        onChangeText={handleChangeText}
        onSubmit={handleSubmit}
        placeholder="Search articles..."
        autoFocus
        debounceMs={300}
      />

      <FlatList
        data={results}
        renderItem={renderArticleItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + spacing.xl },
          results.length === 0 && styles.emptyList,
        ]}
        ListEmptyComponent={renderEmptyState}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    flexGrow: 1,
  },
  emptyList: {
    justifyContent: 'center',
  },
  articleItem: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '500',
  },
  recentSection: {
    padding: spacing.lg,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  recentTitle: {
    fontFamily: typography.h5.fontFamily,
    fontSize: typography.h5.fontSize,
    fontWeight: typography.h5.fontWeight,
  },
  clearText: {
    fontSize: 14,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  recentItemText: {
    flex: 1,
    fontSize: 15,
  },
});

export default SearchScreen;
