/**
 * StatsScreen — Blog statistics overview
 *
 * Displays aggregate blog statistics:
 * - Total articles
 * - Total categories
 * - Total tags
 * - Total comments
 * - Total views
 * - Total likes
 *
 * Data: uses individual queries and sums up where possible
 * Note: If the API doesn't have a dedicated stats endpoint,
 * this screen aggregates data from existing queries.
 *
 * States:
 * - Loading: skeleton stat cards
 * - Error: retry
 */
import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../lib/theme/ThemeContext';
import { spacing } from '../lib/theme/spacing';
import { typography } from '../lib/theme/typography';
import { useGetArticlesQuery } from '../api/endpoints/articles';
import { useGetCategoriesQuery } from '../api/endpoints/categories';
import { useGetTagsQuery } from '../api/endpoints/tags';
import Header from '../components/layout/Header';
import EmptyState from '../components/core/EmptyState';
import SvgIcon from '../components/core/SvgIcon';
import type { ProfileTabScreenProps } from '../navigation/types';

interface StatCard {
  icon: string;
  label: string;
  value: string | number;
  color: string;
}

const STAT_CARD_COLORS = [
  '#3B82F6', // blue - articles
  '#10B981', // green - categories
  '#8B5CF6', // purple - tags
  '#F59E0B', // amber - comments
  '#EF4444', // red - views
  '#EC4899', // pink - likes
];

const StatsScreen: React.FC<ProfileTabScreenProps<'Stats'>> = ({
  navigation,
}) => {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const colors = theme.colors;

  // Fetch all data in parallel
  const { data: articlesData, isLoading: articlesLoading } =
    useGetArticlesQuery({ page: 1, pageSize: 100 });
  const { data: categories, isLoading: categoriesLoading } =
    useGetCategoriesQuery(undefined);
  const { data: tags, isLoading: tagsLoading } = useGetTagsQuery(undefined);

  const isLoading = articlesLoading || categoriesLoading || tagsLoading;

  // Compute derived stats
  const stats = useMemo((): StatCard[] => {
    const totalArticles = articlesData?.total || 0;
    const totalCategories = categories?.length || 0;
    const totalTags = tags?.length || 0;

    return [
      {
        icon: 'file-text',
        label: 'Total Articles',
        value: totalArticles.toLocaleString(),
        color: STAT_CARD_COLORS[0],
      },
      {
        icon: 'grid',
        label: 'Categories',
        value: totalCategories.toLocaleString(),
        color: STAT_CARD_COLORS[1],
      },
      {
        icon: 'file-text',
        label: 'Tags',
        value: totalTags.toLocaleString(),
        color: STAT_CARD_COLORS[2],
      },
      {
        icon: 'message-circle',
        label: 'Comments',
        value: articlesData?.items?.reduce(
          (sum, a) => sum + (a.commentsCount || 0),
          0,
        ).toLocaleString() || '0',
        color: STAT_CARD_COLORS[3],
      },
      {
        icon: 'eye',
        label: 'Total Views',
        value: articlesData?.items?.reduce(
          (sum, a) => sum + (a.views || 0),
          0,
        ).toLocaleString() || '0',
        color: STAT_CARD_COLORS[4],
      },
      {
        icon: 'heart',
        label: 'Total Likes',
        value: articlesData?.items?.reduce(
          (sum, a) => sum + (a.likes || 0),
          0,
        ).toLocaleString() || '0',
        color: STAT_CARD_COLORS[5],
      },
    ];
  }, [articlesData, categories, tags]);

  // ─── Loading state ──────────────────────────────────────────────────

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Header title="Statistics" showBack />
        <View style={styles.loadingContainer}>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <View
              key={i}
              style={[
                styles.skeletonCard,
                { backgroundColor: colors.surface },
              ]}
            />
          ))}
        </View>
      </View>
    );
  }

  // ─── Main render ────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="Statistics" showBack />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          {stats.map((stat, index) => (
            <View
              key={stat.label}
              style={[
                styles.statCard,
                { backgroundColor: colors.surface },
              ]}
            >
              <View
                style={[
                  styles.iconCircle,
                  { backgroundColor: stat.color + '15' },
                ]}
              >
                <SvgIcon
                  name={stat.icon as any}
                  size={24}
                  color={stat.color}
                />
              </View>
              <Text
                style={[
                  styles.statValue,
                  { color: colors.text },
                ]}
              >
                {stat.value}
              </Text>
              <Text
                style={[
                  styles.statLabel,
                  { color: colors.textSecondary },
                ]}
              >
                {stat.label}
              </Text>
            </View>
          ))}
        </View>

        {/* Last updated info */}
        <Text
          style={[
            styles.footerText,
            { color: colors.textSecondary },
          ]}
        >
          Statistics are updated in real-time as you browse
        </Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: spacing.md,
    gap: spacing.md,
  },
  skeletonCard: {
    width: '46%',
    height: 120,
    borderRadius: 12,
  },
  scrollContent: {
    padding: spacing.lg,
    flexGrow: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  statCard: {
    width: '46%',
    flexGrow: 1,
    borderRadius: 12,
    padding: spacing.lg,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  statValue: {
    fontFamily: typography.h2.fontFamily,
    fontSize: typography.h2.fontSize,
    fontWeight: typography.h2.fontWeight,
    marginBottom: spacing.xs,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  footerText: {
    textAlign: 'center',
    fontSize: 12,
    marginTop: spacing.xl,
  },
});

export default StatsScreen;
