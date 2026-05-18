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
import { useModeColors, spacing, typography } from '@/lib/theme';
import { useSearchArticlesQuery } from '@/api/endpoints/articles';
import { useAppLanguage } from '@/lib/i18n';
import { useTranslation } from 'react-i18next';
import { useRecentSearches } from '@/lib/hooks/useRecentSearches';
import { ArticleCard } from '@/components/blog/ArticleCard';
import SearchBar from '@/components/layout/SearchBar';
import { ArticleListSkeleton } from '@/components/core/Skeleton';
import { EmptyState } from '@/components/core/EmptyState';
import { EmptyLogoContent } from '@/components/core/EmptyLogoContent';
import SvgIcon from '@/components/core/SvgIcon';
import type { RootStackScreenProps } from '@/navigation/types';
import type { FrontendArticle } from '@/types/frontend-blog';

const SearchScreen: React.FC<RootStackScreenProps<'Search'>> = ({
  navigation,
}) => {
  const insets = useSafeAreaInsets();
  const colors = useModeColors();
  const { t } = useTranslation();
  const lang = useAppLanguage();

  // ─── State ──────────────────────────────────────────────────────────
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [page, setPage] = useState(1);

  const {
    recentSearches,
    saveRecentSearch,
    clearRecentSearches,
    removeRecentSearch,
  } = useRecentSearches();

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
    { q: debouncedQuery, page, pageSize: 20, lang },
    { skip: debouncedQuery.length < 2 },
  );

  // Re-fetch when language changes
  const prevLangRef = React.useRef(lang);
  React.useEffect(() => {
    if (prevLangRef.current !== lang) {
      prevLangRef.current = lang;
      refetch();
    }
  }, [lang, refetch]);

  const results = searchData?.items || [];
  const totalPages = searchData?.totalPages || 1;
  const hasMore = page < totalPages;

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

  const handleRecentSearchPress = useCallback(
    (search: string) => {
      setQuery(search);
      setDebouncedQuery(search);
      saveRecentSearch(search);
    },
    [saveRecentSearch],
  );

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
        <ArticleCard article={item} onPress={handleArticlePress} showExcerpt />
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
          <View
            style={[
              styles.recentSection,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border + '40',
              },
            ]}
          >
            <View style={styles.recentHeader}>
              <Text style={[styles.recentTitle, { color: colors.text }]}>
                {t('search.recent')}
              </Text>
              <TouchableOpacity onPress={clearRecentSearches}>
                <Text
                  style={[styles.clearText, { color: colors.textSecondary }]}
                >
                  {t('search.clear')}
                </Text>
              </TouchableOpacity>
            </View>
            {recentSearches.map((search, index) => (
              <TouchableOpacity
                key={`${search}-${index}`}
                onPress={() => handleRecentSearchPress(search)}
                style={styles.recentItem}
              >
                <SvgIcon name="clock" size={16} color={colors.textSecondary} />
                <Text
                  style={[styles.recentItemText, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {search}
                </Text>
                <TouchableOpacity
                  onPress={() => removeRecentSearch(search)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <SvgIcon name="x" size={14} color={colors.textSecondary} />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </View>
        );
      }

      return (
        <View style={styles.emptyPromptContainer}>
          <SvgIcon
            name="search"
            size={48}
            color={colors.textSecondary + '60'}
          />
          <Text style={[styles.emptyPromptTitle, { color: colors.text }]}>
            {t('search.title')}
          </Text>
          <Text
            style={[
              styles.emptyPromptSubtitle,
              { color: colors.textSecondary },
            ]}
          >
            {t('search.empty.hint')}
          </Text>
          <View
            style={[
              styles.popularTagsSection,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border + '40',
              },
            ]}
          >
            <Text style={[styles.popularTagsTitle, { color: colors.text }]}>
              {t('search.popularTags')}
            </Text>
            <View style={styles.tagChipsRow}>
              {[
                'TypeScript',
                'React',
                'Node.js',
                'Animation',
                'iOS',
                'Design',
              ].map(tag => (
                <TouchableOpacity
                  key={tag}
                  style={[
                    styles.tagChip,
                    { backgroundColor: colors.primary + '15' },
                  ]}
                  onPress={() => {
                    setQuery(tag);
                    setDebouncedQuery(tag);
                    saveRecentSearch(tag);
                  }}
                >
                  <Text style={[styles.tagChipText, { color: colors.primary }]}>
                    #{tag}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
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
          title={t('search.loadFailed')}
          description={t('search.error.connection')}
          primaryAction={{ label: t('common.retry'), onPress: refetch }}
        />
      );
    }

    // No results
    if (results.length === 0 && debouncedQuery.length >= 2) {
      return (
        <EmptyLogoContent
          title={t('common.noResults')}
          description={t('search.empty.noResultsFor', {
            query: debouncedQuery,
          })}
        />
      );
    }

    return null;
  };

  // ─── Main render ────────────────────────────────────────────────────

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingTop: insets.top },
      ]}
    >
      <SearchBar
        value={query}
        onChangeText={handleChangeText}
        onSubmit={handleSubmit}
        placeholder={t('search.placeholder')}
        autoFocus
        debounceMs={300}
        showCancel
        onCancel={() => {
          if (navigation.canGoBack()) {
            navigation.goBack();
          }
        }}
      />

      {debouncedQuery.length >= 2 && results.length > 0 && (
        <Text style={[styles.resultCount, { color: colors.textSecondary }]}>
          {t('search.resultCount', { count: results.length })}
        </Text>
      )}

      <FlatList
        data={results}
        renderItem={renderArticleItem}
        keyExtractor={item => item.id}
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
  resultCount: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    fontSize: 13,
  },
  recentSection: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: 12,
    borderWidth: 1,
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
  emptyPromptContainer: {
    alignItems: 'center',
    paddingTop: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  emptyPromptTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: spacing.md,
  },
  emptyPromptSubtitle: {
    fontSize: 14,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  popularTagsSection: {
    marginTop: spacing.xl,
    borderRadius: 12,
    borderWidth: 1,
    padding: spacing.md,
    width: '100%',
  },
  popularTagsTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  tagChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tagChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tagChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
});

export default SearchScreen;
