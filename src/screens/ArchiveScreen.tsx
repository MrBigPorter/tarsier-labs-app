/**
 * ArchiveScreen — Article archive grouped by year/month
 *
 * Displays articles organized by year → month groups.
 * Each month group shows article titles that navigate to detail.
 *
 * Data: Uses existing articles endpoints grouped by date
 * Note: If the API doesn't have a dedicated archive endpoint,
 * this screen groups fetched articles by year/month locally.
 *
 * States:
 * - Loading: skeleton sections
 * - Error: retry
 * - Empty: "No archived articles"
 */
import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  SectionList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../lib/theme/ThemeContext';
import { spacing } from '../lib/theme/spacing';
import { typography } from '../lib/theme/typography';
import { useGetArticlesQuery } from '../api/endpoints/articles';
import Header from '../components/layout/Header';
import { ArticleListSkeleton } from '../components/core/Skeleton';
import EmptyState from '../components/core/EmptyState';
import SvgIcon from '../components/core/SvgIcon';
import type { ProfileTabScreenProps } from '../navigation/types';
import type { FrontendArticle } from '../types/frontend-blog';

interface ArchiveSection {
  title: string; // "2024"
  data: Array<{
    month: string; // "January"
    monthIndex: number; // 0-11
    articles: FrontendArticle[];
  }>;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const ArchiveScreen: React.FC<ProfileTabScreenProps<'Archive'>> = ({
  navigation,
}) => {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const colors = theme.colors;

  const PAGE_SIZE = 200; // Fetch a large batch for archive grouping

  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useGetArticlesQuery({ page: 1, pageSize: PAGE_SIZE });

  // Group articles by year → month
  const sections = useMemo(() => {
    if (!data?.items?.length) return [];

    const grouped: Record<number, Record<number, FrontendArticle[]>> = {};

    data.items.forEach(article => {
      const date = new Date(article.publishedAt || article.updatedAt);
      const year = date.getFullYear();
      const month = date.getMonth();

      if (!grouped[year]) grouped[year] = {};
      if (!grouped[year][month]) grouped[year][month] = [];
      grouped[year][month].push(article);
    });

    return Object.entries(grouped)
      .sort(([a], [b]) => Number(b) - Number(a)) // Descending years
      .map(([yearStr, months]) => {
        const year = Number(yearStr);
        const monthEntries = Object.entries(months)
          .sort(([a], [b]) => Number(b) - Number(a)) // Descending months
          .map(([monthStr, articles]) => ({
            month: MONTH_NAMES[Number(monthStr)],
            monthIndex: Number(monthStr),
            articles,
          }));

        return {
          title: String(year),
          data: monthEntries,
        };
      });
  }, [data]);

  const handleArticlePress = useCallback(
    (article: FrontendArticle) => {
      navigation.getParent()?.navigate('ArticleDetail', {
        slug: article.slug,
        articleId: article.id,
      });
    },
    [navigation],
  );

  // ─── Render functions ───────────────────────────────────────────────

  const renderSectionHeader = useCallback(
    ({ section }: { section: ArchiveSection }) => (
      <View style={[styles.yearHeader, { borderBottomColor: colors.border }]}>
        <Text
          style={[
            styles.yearText,
            {
              color: colors.text,
              fontFamily: typography.h3.fontFamily,
              fontSize: typography.h3.fontSize,
              fontWeight: typography.h3.fontWeight,
            },
          ]}
        >
          {section.title}
        </Text>
      </View>
    ),
    [colors],
  );

  const renderMonthSection = useCallback(
    ({ item }: { item: ArchiveSection['data'][0] }) => (
      <View style={styles.monthSection}>
        <View style={styles.monthHeader}>
          <Text
            style={[
              styles.monthText,
              { color: colors.textSecondary },
            ]}
          >
            {item.month}
          </Text>
          <Text
            style={[
              styles.countText,
              { color: colors.textSecondary },
            ]}
          >
            {item.articles.length} article{item.articles.length !== 1 ? 's' : ''}
          </Text>
        </View>
        {item.articles.map(article => (
          <TouchableOpacity
            key={article.id}
            onPress={() => handleArticlePress(article)}
            style={[styles.articleRow, { borderBottomColor: colors.border }]}
          >
            <Text
              style={[
                styles.articleTitle,
                { color: colors.text },
              ]}
              numberOfLines={1}
            >
              {article.title}
            </Text>
            <SvgIcon
              name="chevron-right"
              size={16}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        ))}
      </View>
    ),
    [colors, handleArticlePress],
  );

  // ─── Loading state ──────────────────────────────────────────────────

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Header title="Archive" showBack />
        <View style={styles.loadingContainer}>
          <ArticleListSkeleton count={8} />
        </View>
      </View>
    );
  }

  // ─── Main render ────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="Archive" showBack />

      <SectionList
        sections={sections}
        renderSectionHeader={renderSectionHeader}
        renderItem={renderMonthSection}
        keyExtractor={(item, index) => `${item.monthIndex}-${index}`}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + spacing.xl },
          sections.length === 0 && styles.emptyList,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={refetch}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={
          isError ? (
            <EmptyState
              icon="alert-circle"
              title="Failed to load archive"
              primaryAction={{ label: 'Retry', onPress: refetch }}
            />
          ) : (
            <EmptyState
              icon="clock"
              title="No archived articles"
              description="Articles will appear here once published"
            />
          )
        }
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
    paddingHorizontal: spacing.lg,
  },
  emptyList: {
    justifyContent: 'center',
  },
  yearHeader: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.md,
  },
  yearText: {
    lineHeight: 32,
  },
  monthSection: {
    marginBottom: spacing.lg,
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  monthText: {
    fontSize: 15,
    fontWeight: '600',
  },
  countText: {
    fontSize: 12,
  },
  articleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  articleTitle: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});

export default ArchiveScreen;
