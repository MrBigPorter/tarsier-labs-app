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
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  SectionList,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import PullToRefreshWrapper from '@/components/core/PullToRefreshWrapper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useModeColors, spacing, typography } from '@/lib/theme';
import { useGetArticlesQuery } from '@/api/endpoints/articles';
import { useAppLanguage } from '@/lib/i18n';
import { groupArticlesByYearMonth } from '@/lib/utils/date';
import Header from '@/components/layout/Header';
import { ArticleListSkeleton } from '@/components/core/Skeleton';
import { EmptyState } from '@/components/core/EmptyState';
import { EmptyLogoContent } from '@/components/core/EmptyLogoContent';
import SvgIcon from '@/components/core/SvgIcon';
import type { RootStackScreenProps } from '@/navigation/types';
import type { FrontendArticle } from '@/types/frontend-blog';

interface ArchiveSection {
  title: string; // "2024"
  data: Array<{
    month: string; // "January"
    monthIndex: number; // 0-11
    articles: FrontendArticle[];
  }>;
}

const ArchiveScreen: React.FC<RootStackScreenProps<'Archive'>> = ({
  navigation,
}) => {
  const insets = useSafeAreaInsets();
  const colors = useModeColors();
  const { t } = useTranslation();
  const lang = useAppLanguage();
  const prevLangRef = React.useRef(lang);

  const PAGE_SIZE = 200; // Fetch a large batch for archive grouping

  const { data, isLoading, isError, refetch } = useGetArticlesQuery({
    page: 1,
    pageSize: PAGE_SIZE,
    lang,
  });

  // Re-fetch when language changes
  React.useEffect(() => {
    if (prevLangRef.current !== lang) {
      prevLangRef.current = lang;
      refetch();
    }
  }, [lang, refetch]);

  // Group articles by year → month using shared utility
  const sections = groupArticlesByYearMonth(data?.items || []);

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
          <Text style={[styles.monthText, { color: colors.textSecondary }]}>
            {item.month}
          </Text>
          <Text style={[styles.countText, { color: colors.textSecondary }]}>
            {item.articles.length} article
            {item.articles.length !== 1 ? 's' : ''}
          </Text>
        </View>
        {item.articles.map(article => (
          <TouchableOpacity
            key={article.id}
            onPress={() => handleArticlePress(article)}
            style={[styles.articleRow, { borderBottomColor: colors.border }]}
          >
            <Text
              style={[styles.articleTitle, { color: colors.text }]}
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
      <View style={[styles.container, { backgroundColor: colors.bgSecondary }]}>
        <Header title="Archive" showBack hideSearch hideSettings />
        <View style={styles.loadingContainer}>
          <ArticleListSkeleton count={8} />
        </View>
      </View>
    );
  }

  // ─── Main render ────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: colors.bgSecondary }]}>
      <Header title="Archive" showBack hideSearch hideSettings />

      <PullToRefreshWrapper
        refreshing={false}
        onRefresh={refetch}
        backgroundColor={colors.bgSecondary}
        spinnerColor={colors.primary}
      >
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
          ListEmptyComponent={
            isError ? (
              <EmptyState
                icon="alert-circle"
                title={t('archive.error.loadFailed')}
                primaryAction={{ label: t('common.retry'), onPress: refetch }}
              />
            ) : (
              <EmptyLogoContent
                title={t('archive.empty.noArchived')}
                description={t('archive.empty.description')}
              />
            )
          }
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
