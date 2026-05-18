/**
 * TagListScreen — Browse all tags / popular tags
 *
 * Displays tags as a flow of pill-shaped chips.
 * Tapping a tag navigates to TagArticles screen.
 *
 * Data: useGetTagsQuery + useGetPopularTagsQuery (RTK Query)
 *
 * States: Loading → skeleton pills | Error → retry | Empty → message
 */
import React, { useCallback, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Text,
  Dimensions,
} from 'react-native';
import PullToRefreshWrapper from '@/components/core/PullToRefreshWrapper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useModeColors, spacing, typography } from '@/lib/theme';
import { useGetTagsQuery } from '@/api/endpoints/tags';
import { useAppLanguage } from '@/lib/i18n';
import { useTranslation } from 'react-i18next';
import Header from '@/components/layout/Header';
import { EmptyContent } from '@/components/core/EmptyContent';
import { EmptyLogoContent } from '@/components/core/EmptyLogoContent';
import type { TagsTabScreenProps } from '@/navigation/types';
import type { FrontendTag } from '@/types/frontend-blog';

const TAG_COLORS = [
  '#3B82F6',
  '#EF4444',
  '#10B981',
  '#F59E0B',
  '#8B5CF6',
  '#EC4899',
  '#06B6D4',
  '#84CC16',
  '#F97316',
  '#6366F1',
];

const TagListScreen: React.FC<TagsTabScreenProps<'TagList'>> = ({
  navigation,
}) => {
  const insets = useSafeAreaInsets();
  const colors = useModeColors();
  const { t } = useTranslation();
  const lang = useAppLanguage();
  const prevLangRef = React.useRef(lang);

  const { data: tags, isLoading, isError, refetch } = useGetTagsQuery(lang);

  // Re-fetch when language changes
  React.useEffect(() => {
    if (prevLangRef.current !== lang) {
      prevLangRef.current = lang;
      refetch();
    }
  }, [lang, refetch]);

  // ─── Identity guard & pull-to-refresh ──────────────────────────────
  //
  // On tab switch: useFocusEffect triggers refetch() in the background.
  // The identity guard (prevTagIdsRef + stableTags useEffect) only updates
  // state when IDs actually change — keeping old data visible and preventing
  // UI flash when identical data returns.
  // Pull-to-refresh: uses requestAnimationFrame to guarantee the spinner
  // is painted BEFORE the async fetch starts. refetch().finally() stops
  // the spinner when the network request completes.
  // No useEffect(isFetching) — that pattern fails when isFetching is
  // already true from an auto-refetch (race condition).

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // rAF fires AFTER React commits refreshing=true and RN paints the spinner
    requestAnimationFrame(() => {
      refetch().finally(() => {
        setRefreshing(false);
      });
    });
  }, [refetch]);

  const handleTagPress = useCallback(
    (tag: FrontendTag) => {
      navigation.getParent()?.navigate('TagsTab', {
        screen: 'TagArticles',
        params: { tagSlug: tag.slug, tagName: tag.name },
      });
    },
    [navigation],
  );

  const getTagColor = (index: number) => TAG_COLORS[index % TAG_COLORS.length];

  // ─── Loading state ──────────────────────────────────────────────────
  //
  // Fill the full screen with skeleton pills so the UI doesn't look empty
  // while tags are loading (production has many tags).
  // Calculate dynamic count based on screen height:
  //   screenHeight - header(≈50) - containerPadding(24) = available height
  //   each row = pillHeight(36) + gap(6) = 42px → rows × ~4 pills/row
  const { height: screenHeight } = Dimensions.get('window');
  const HEADER_ESTIMATE = 50;
  const PADDING_ESTIMATE = spacing.lg * 2;
  const PILL_HEIGHT = 36;
  const GAP = spacing.sm;
  const availableHeight = screenHeight - HEADER_ESTIMATE - PADDING_ESTIMATE;
  const rowsNeeded = Math.max(
    6,
    Math.ceil(availableHeight / (PILL_HEIGHT + GAP)),
  );
  const pillsPerRow = 4;
  const LOADING_PILL_COUNT = rowsNeeded * pillsPerRow;

  if (isLoading && !tags) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bgSecondary }]}>
        <Header title="Tags" hideSearch hideSettings showBack={false} />
        <View style={styles.loadingContainer}>
          <View style={styles.tagFlow}>
            {Array.from({ length: LOADING_PILL_COUNT }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.loadingPill,
                  {
                    backgroundColor: colors.bgTertiary,
                    borderColor: colors.border,
                    width: 60 + (i % 5) * 20,
                  },
                ]}
              />
            ))}
          </View>
        </View>
      </View>
    );
  }

  // ─── Main render ────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: colors.bgSecondary }]}>
      <Header title="Tags" hideSearch hideSettings showBack={false} />

      <PullToRefreshWrapper
        refreshing={refreshing}
        onRefresh={onRefresh}
        backgroundColor={colors.bgSecondary}
        spinnerColor={colors.primary}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + spacing.xl },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Section: All Tags */}
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            All Tags
          </Text>

          {tags && tags.length > 0 ? (
            <View style={styles.tagFlow}>
              {tags.map((tag, index) => {
                const tagColor = getTagColor(index);
                return (
                  <TouchableOpacity
                    key={tag.id}
                    onPress={() => handleTagPress(tag)}
                    style={[
                      styles.tagPill,
                      {
                        backgroundColor: tagColor + '12',
                        borderColor: tagColor + '30',
                      },
                    ]}
                    activeOpacity={0.7}
                    accessibilityLabel={`Tag: ${tag.name}`}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.tagName, { color: tagColor }]}>
                      #{tag.name}
                    </Text>
                    {tag.articleCount > 0 && (
                      <View
                        style={[
                          styles.countBadge,
                          { backgroundColor: tagColor + '20' },
                        ]}
                      >
                        <Text style={[styles.countText, { color: tagColor }]}>
                          {tag.articleCount}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : isError && !tags ? (
            <EmptyContent
              icon="⚠️"
              title={t('tags.error.loadFailed')}
              actionLabel={t('common.retry')}
              onAction={refetch}
            />
          ) : !tags || tags.length === 0 ? (
            <EmptyLogoContent
              title={t('tags.empty')}
              description={t('tags.emptyState.description')}
            />
          ) : null}
        </ScrollView>
      </PullToRefreshWrapper>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    padding: spacing.lg,
  },
  scrollContent: {
    padding: spacing.lg,
    flexGrow: 1,
  },
  sectionTitle: {
    fontFamily: typography.h4.fontFamily,
    fontSize: typography.h4.fontSize,
    fontWeight: typography.h4.fontWeight,
    marginBottom: spacing.md,
  },
  tagFlow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    borderWidth: 1,
  },
  tagName: {
    fontSize: 14,
    fontWeight: '500',
  },
  countBadge: {
    marginLeft: spacing.xs,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  countText: {
    fontSize: 11,
    fontWeight: '600',
  },
  loadingPill: {
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
  },
});

export default TagListScreen;
