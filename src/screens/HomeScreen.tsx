/**
 * HomeScreen — Main landing screen
 *
 * Sections:
 * 1. Featured/Hero articles (horizontal FlatList)
 * 2. Popular articles (horizontal, "View All" link)
 * 3. Categories grid (2-column)
 * 4. Recent articles (vertical, paginated)
 *
 * Data sources:
 * - getFeaturedArticles (RTK Query)
 * - getPopularArticles (RTK Query)
 * - getCategories (RTK Query)
 * - getArticles with default params (RTK Query)
 *
 * States:
 * - Loading: Skeleton placeholders per section
 * - Error: Empty state with retry per section
 * - Empty: Friendly empty state messages
 * - Offline: NetworkStatusBar at top
 */
import React, { useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  useWindowDimensions,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../lib/theme/ThemeContext';
import { spacing } from '../lib/theme/spacing';
import { typography } from '../lib/theme/typography';
import {
  useGetFeaturedArticlesQuery,
  useGetPopularArticlesQuery,
  useGetArticlesQuery,
} from '../api/endpoints/articles';
import { useGetCategoriesQuery } from '../api/endpoints/categories';
import ArticleCard from '../components/blog/ArticleCard';
import CategoryCard from '../components/blog/CategoryCard';
import Header from '../components/layout/Header';
import NetworkStatusBar from '../components/core/NetworkStatusBar';
import {
  ArticleCardSkeleton,
  ArticleListSkeleton,
  CategoryCardSkeleton,
} from '../components/core/Skeleton';
import EmptyState from '../components/core/EmptyState';
import type { HomeTabScreenProps } from '../navigation/types';
import type { FrontendArticle } from '../types/frontend-blog';

const HomeScreen: React.FC<HomeTabScreenProps<'Home'>> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const colors = theme.colors;
  const { width: screenWidth } = useWindowDimensions();

  // ─── Data fetching ──────────────────────────────────────────────────────

  const {
    data: featuredData,
    isLoading: featuredLoading,
    isError: featuredError,
    refetch: refetchFeatured,
  } = useGetFeaturedArticlesQuery(undefined);

  const {
    data: popularData,
    isLoading: popularLoading,
    isError: popularError,
    refetch: refetchPopular,
  } = useGetPopularArticlesQuery(10);

  const {
    data: categoriesData,
    isLoading: categoriesLoading,
    isError: categoriesError,
    refetch: refetchCategories,
  } = useGetCategoriesQuery(undefined);

  const {
    data: recentData,
    isLoading: recentLoading,
    isError: recentError,
    refetch: refetchRecent,
  } = useGetArticlesQuery({ page: 1, pageSize: 10 });

  // ─── Pull-to-refresh ────────────────────────────────────────────────────

  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      refetchFeatured(),
      refetchPopular(),
      refetchCategories(),
      refetchRecent(),
    ]);
    setRefreshing(false);
  }, [refetchFeatured, refetchPopular, refetchCategories, refetchRecent]);

  // ─── Navigation ─────────────────────────────────────────────────────────

  const handleArticlePress = useCallback(
    (article: FrontendArticle) => {
      navigation.getParent()?.navigate('ArticleDetail', {
        slug: article.slug,
        articleId: article.id,
      });
    },
    [navigation],
  );

  const handleCategoryPress = useCallback(
    (slug: string) => {
      navigation.getParent()?.navigate('ArticlesTab', {
        screen: 'CategoryArticles',
        params: { categorySlug: slug, categoryName: '' },
      });
    },
    [navigation],
  );

  const handleViewAllArticles = useCallback(() => {
    navigation.getParent()?.navigate('MainTabs', {
      screen: 'ArticlesTab',
      params: { screen: 'ArticleList' },
    });
  }, [navigation]);

  // ─── Section width calculations ─────────────────────────────────────────

  const cardWidth = screenWidth - spacing.md * 2; // full width minus padding
  const horizontalCardWidth = screenWidth * 0.75;
  const numColumns = Math.max(2, Math.floor((screenWidth - spacing.md * 3) / 160));

  // ─── Render sections ────────────────────────────────────────────────────

  const renderFeaturedSection = () => {
    if (featuredLoading) {
      return (
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Featured
          </Text>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
            data={[1, 2, 3]}
            keyExtractor={(item) => String(item)}
            renderItem={() => (
              <View style={{ width: horizontalCardWidth, marginRight: spacing.sm }}>
                <ArticleCardSkeleton />
              </View>
            )}
          />
        </View>
      );
    }

    if (featuredError || !featuredData?.length) {
      return null; // Silently hide section on error
    }

    return (
      <View style={styles.sectionContainer}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Featured
        </Text>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalList}
          data={featuredData}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={{ width: horizontalCardWidth, marginRight: spacing.sm }}>
              <ArticleCard
                article={item}
                onPress={handleArticlePress}
                showExcerpt
              />
            </View>
          )}
        />
      </View>
    );
  };

  const renderPopularSection = () => {
    if (popularLoading) {
      return (
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Popular
            </Text>
          </View>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
            data={[1, 2, 3]}
            keyExtractor={(item) => String(item)}
            renderItem={() => (
              <View style={{ width: horizontalCardWidth * 0.7, marginRight: spacing.sm }}>
                <ArticleCardSkeleton />
              </View>
            )}
          />
        </View>
      );
    }

    if (popularError || !popularData?.length) {
      return null;
    }

    return (
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Popular
          </Text>
          <TouchableOpacity onPress={handleViewAllArticles}>
            <Text style={[styles.viewAllLink, { color: colors.primary }]}>
              View All
            </Text>
          </TouchableOpacity>
        </View>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalList}
          data={popularData}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={{ width: horizontalCardWidth * 0.7, marginRight: spacing.sm }}>
              <ArticleCard
                article={item}
                onPress={handleArticlePress}
                compact
              />
            </View>
          )}
        />
      </View>
    );
  };

  const renderCategoriesSection = () => {
    if (categoriesLoading) {
      return (
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Categories
          </Text>
          <View style={styles.categoriesGrid}>
            {[1, 2, 3, 4].map((i) => (
              <View
                key={i}
                style={{ width: `${100 / numColumns}%` as any, padding: spacing.xs }}
              >
                <CategoryCardSkeleton />
              </View>
            ))}
          </View>
        </View>
      );
    }

    if (categoriesError || !categoriesData?.length) {
      return null;
    }

    return (
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Categories
          </Text>
          <TouchableOpacity
            onPress={() =>
              navigation.getParent()?.navigate('MainTabs', {
                screen: 'CategoriesTab',
                params: { screen: 'CategoryList' },
              })
            }
          >
            <Text style={[styles.viewAllLink, { color: colors.primary }]}>
              View All
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.categoriesGrid}>
          {categoriesData.slice(0, numColumns * 2).map((category) => (
            <View
              key={category.id}
              style={{ width: `${100 / numColumns}%` as any, padding: spacing.xs }}
            >
              <CategoryCard
                category={category}
                onPress={() => {
                  navigation.getParent()?.navigate('ArticlesTab', {
                    screen: 'CategoryArticles',
                    params: { categorySlug: category.slug, categoryName: category.name },
                  });
                }}
              />
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderRecentSection = () => {
    if (recentLoading) {
      return (
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Recent Articles
          </Text>
          <ArticleListSkeleton count={3} />
        </View>
      );
    }

    if (recentError) {
      return (
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Recent Articles
          </Text>
          <EmptyState
            icon="alert-circle"
            title="Unable to load articles"
            description="Pull down to retry"
            primaryAction={{ label: 'Retry', onPress: refetchRecent }}
          />
        </View>
      );
    }

    if (!recentData?.items?.length) {
      return (
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Recent Articles
          </Text>
          <EmptyState
            icon="file-text"
            title="No articles yet"
            description="Check back later for new content"
          />
        </View>
      );
    }

    return (
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Recent Articles
          </Text>
          <TouchableOpacity onPress={handleViewAllArticles}>
            <Text style={[styles.viewAllLink, { color: colors.primary }]}>
              View All
            </Text>
          </TouchableOpacity>
        </View>
        {recentData.items.map((article) => (
          <View key={article.id} style={styles.articleListItem}>
            <ArticleCard
              article={article}
              onPress={handleArticlePress}
              showExcerpt
            />
          </View>
        ))}
      </View>
    );
  };

  // ─── Main render ────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="Tarsier" />

      <NetworkStatusBar />

      <FlatList
        data={[{ key: 'content' }]}
        keyExtractor={(item) => item.key}
        renderItem={() => (
          <View style={{ paddingBottom: insets.bottom + spacing.lg }}>
            {renderFeaturedSection()}
            {renderPopularSection()}
            {renderCategoriesSection()}
            {renderRecentSection()}
          </View>
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  sectionContainer: {
    marginTop: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontFamily: typography.h4.fontFamily,
    fontSize: typography.h4.fontSize,
    fontWeight: typography.h4.fontWeight,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  viewAllLink: {
    fontFamily: typography.base.fontFamily,
    fontSize: typography.base.fontSize,
    fontWeight: '500',
  },
  horizontalList: {
    paddingHorizontal: spacing.md,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.sm,
  },
  articleListItem: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
});

export default HomeScreen;
