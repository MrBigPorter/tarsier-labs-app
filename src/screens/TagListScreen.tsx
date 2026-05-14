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
import React, { useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Text,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../lib/theme/ThemeContext';
import { spacing } from '../lib/theme/spacing';
import { typography } from '../lib/theme/typography';
import { useGetTagsQuery } from '../api/endpoints/tags';
import Header from '../components/layout/Header';
import EmptyState from '../components/core/EmptyState';
import SvgIcon from '../components/core/SvgIcon';
import type { CategoriesTabScreenProps } from '../navigation/types';
import type { FrontendTag } from '../types/frontend-blog';

const TAG_COLORS = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B',
  '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16',
  '#F97316', '#6366F1',
];

const TagListScreen: React.FC<
  CategoriesTabScreenProps<'TagList'>
> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const colors = theme.colors;

  const {
    data: tags,
    isLoading,
    isError,
    refetch,
  } = useGetTagsQuery(undefined);

  const handleTagPress = useCallback(
    (tag: FrontendTag) => {
      navigation.getParent()?.navigate('ArticlesTab', {
        screen: 'TagArticles',
        params: { tagSlug: tag.slug, tagName: tag.name },
      });
    },
    [navigation],
  );

  const getTagColor = (index: number) =>
    TAG_COLORS[index % TAG_COLORS.length];

  // ─── Loading state ──────────────────────────────────────────────────

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Header title="Tags" />
        <View style={styles.loadingContainer}>
          <View style={styles.tagFlow}>
            {Array.from({ length: 20 }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.loadingPill,
                  {
                    backgroundColor: colors.surface,
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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="Tags" />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing.xl },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={refetch}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Section: All Tags */}
        <Text
          style={[
            styles.sectionTitle,
            { color: colors.text },
          ]}
        >
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
                  <Text
                    style={[
                      styles.tagName,
                      { color: tagColor },
                    ]}
                  >
                    #{tag.name}
                  </Text>
                  {tag.articleCount > 0 && (
                    <View
                      style={[
                        styles.countBadge,
                        { backgroundColor: tagColor + '20' },
                      ]}
                    >
                      <Text
                        style={[styles.countText, { color: tagColor }]}
                      >
                        {tag.articleCount}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ) : isError ? (
          <EmptyState
            icon="alert-circle"
            title="Failed to load tags"
            primaryAction={{ label: 'Retry', onPress: refetch }}
          />
        ) : (
          <EmptyState
            icon="file-text"
            title="No tags yet"
            description="Tags will appear here once articles are categorized"
          />
        )}
      </ScrollView>
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
  },
});

export default TagListScreen;
