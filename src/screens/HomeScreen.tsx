/**
 * HomeScreen — Main landing screen
 *
 * Layout:
 * - Header (static absolute overlay, always visible)
 * - CategoryFilter (absolute, hides on scroll down via translateY, shows on scroll up)
 * - TabBar (absolute via RootNavigator, hides on scroll down via translateY)
 * - FlatList fills entire screen with static paddingTop = insets.top + CONTENT_TOP
 *
 * Key design:
 * - Header is always visible (no animation). CategoryFilter has its OWN independent
 *   catFilterTranslateY (0 ↔ -CAT_FILTER_HEIGHT), separate from TabBar.
 * - FlatList paddingTop is STATIC (insets.top + CONTENT_TOP) — no animated padding.
 *   Content behind overlays is naturally revealed when they hide.
 * - Scroll handler runs on UI thread via useAnimatedScrollHandler — zero JS bridge overhead.
 *
 * Features:
 * - Pagination: allArticles state accumulates data across pages with dedup
 * - Category filter: server-side via categoryId param, resets pagination
 * - Language: lang param passed to API for i18n re-fetch
 * - Scroll: absolute positioned overlays + static padding for standard RN scroll-hide
 * - Empty states: loading skeleton, error with retry, empty message
 * - Image prefetch: onViewableItemsChanged pre-warms native image cache
 * - Priority: first 2 items get priority prop for LCP optimization
 * - Network quality: useNetworkQuality at screen level, passes down to ArticleCard
 */
import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useAppSelector, useAppDispatch } from '@/store';
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, spacing } from '@/lib/theme';
import {
  useGetArticlesQuery,
} from '@/api/endpoints/articles';
import { ArticleCard } from '@/components/blog/ArticleCard';
import { CategoryFilter } from '@/components/blog/CategoryFilter';
import Header from '@/components/layout/Header';
import { NetworkStatusBar } from '@/components/core/NetworkStatusBar';
import { ArticleListSkeleton } from '@/components/core/Skeleton';
import { EmptyContent } from '@/components/core/EmptyContent';
import { EmptyLogoContent } from '@/components/core/EmptyLogoContent';
import { useScrollContext } from '@/lib/ScrollContext';
import { getCurrentLanguage, useCurrentLanguage } from '@/lib/i18n';
import { useTranslation } from 'react-i18next';
import { toggleBookmarkOptimistic } from '@/store/slices/bookmarksSlice';
import {
  useAddBookmarkMutation,
  useRemoveBookmarkMutation,
} from '@/api/endpoints/bookmarks';
import { useNetworkQuality } from '@/lib/hooks/useNetworkQuality';
import { useImagePrefetch } from '@/lib/hooks/useImagePrefetch';
import { getArticleImageUrl, isVideoUrl } from '@/lib/utils/image';
import type { HomeTabScreenProps } from '@/navigation/types';
import type { FrontendArticle } from '@/types/frontend-blog';

const PAGE_SIZE = 10;
const DEBOUNCE_MS = 300;
const SCROLL_THRESHOLD = 50;

/** Height of the Header component alone (used for static positioning) */
const HEADER_HEIGHT = 50;
/** Height of the CategoryFilter component alone */
const CAT_FILTER_HEIGHT = 50;
/** Combined height of Header + CategoryFilter for static content paddingTop */
const CONTENT_TOP = HEADER_HEIGHT + CAT_FILTER_HEIGHT; // 100px
/** Height of the bottom TabBar content (for scroll hide animation) */
const TAB_BAR_HEIGHT = 60;

/** Number of initial items that should get priority image loading (LCP) */
const PRIORITY_COUNT = 2;

/**
 * Bundled context hook to prevent hooks order shift.
 * useSafeAreaInsets can have varying internal hook counts under Fabric/New Architecture,
 * which would shift component-level hook positions. Bundling isolates the instability.
 */
function useHomeScreenContext() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { tabBarTranslateY, lastScrollY } = useScrollContext();
  return { insets, colors, tabBarTranslateY, lastScrollY };
}

/**
 * Resolve the best image URL for prefetching from an article.
 * Matches the logic in AppImage's getArticleImageUrl.
 */
function getPrefetchUrl(article: FrontendArticle): string | null {
  // Skip video files (no need to prefetch video in image cache)
  if (article.coverImage && isVideoUrl(article.coverImage)) return null;

  return getArticleImageUrl({
    images: article.meta?.images,
    coverImage: article.coverImage,
    size: 'medium',
  });
}

const HomeScreen: React.FC<HomeTabScreenProps<'Home'>> = ({ navigation }) => {
  const { t } = useTranslation();
  const { insets, colors, tabBarTranslateY, lastScrollY } = useHomeScreenContext();

  // ─── Redux ────────────────────────────────────────────────────────────
  const dispatch = useAppDispatch();
  const bookmarkedIds = useAppSelector(state => state.bookmarks.bookmarkedIds);

  // ─── Bookmark mutations ───────────────────────────────────────────────
  const [addBookmark] = useAddBookmarkMutation();
  const [removeBookmark] = useRemoveBookmarkMutation();

  // ─── Network quality (screen-level, passes down to ArticleCard) ────
  const networkQuality = useNetworkQuality();

  // ─── Image prefetch hook ───────────────────────────────────────────
  const { prefetchMany } = useImagePrefetch();

  // ─── State ────────────────────────────────────────────────────────────

  const [page, setPage] = useState(1);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [allArticles, setAllArticles] = useState<FrontendArticle[]>(() => {
    // Initialize from RTK Query cache IMMEDIATELY, not after first render.
    // This prevents "no data" flash on tab switch when data is cached.
    return articlesData?.items ?? [];
  });

  // ─── Reanimated shared values ─────────────────────────────────────────

  /** Independent translateY for CategoryFilter: 0 ↔ -CAT_FILTER_HEIGHT */
  const catFilterTranslateY = useSharedValue(0);

  // ─── Animated styles (UI thread) ──────────────────────────────────────

  const catFilterAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: catFilterTranslateY.value }],
  }));

  // ─── Data fetching (server-side filtering) ───────────────────────────

  const lang = useCurrentLanguage();
  const queryParams = selectedCategoryId
    ? { page, pageSize: PAGE_SIZE, categoryId: selectedCategoryId, lang }
    : { page, pageSize: PAGE_SIZE, lang };

  const {
    data: articlesData,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useGetArticlesQuery(queryParams);

  const totalPages = articlesData?.totalPages || 1;
  const hasMore = page < totalPages;

  // ─── Derived display data ────────────────────────────────────────────
  //
  // For page 1: use articlesData.items directly (synchronous from RTK Query cache).
  // For page > 1: use accumulated allArticles (state managed by useEffect below).
  // This avoids the empty-state flash on first render because articlesData
  // from cache is available synchronously.
  //
  // IMPORTANT: Must check `.length > 0` — empty array `[]` is truthy!
  // Without this check, RTK Query refetch returns a new `[]` reference on
  // every poll, causing FlatList's `data` prop to change and forcing the
  // empty state (EmptyLogoContent) to re-render/flash.

  const displayArticles = React.useMemo<FrontendArticle[]>(() => {
    if (page === 1 && articlesData?.items && articlesData.items.length > 0) {
      return articlesData.items;
    }
    return allArticles;
  }, [articlesData, page, allArticles]);

  // ─── Pagination accumulation ─────────────────────────────────────────
  //
  // Accumulates articles across pages with dedup by ID.
  // Only active when page > 1 — page 1 data comes directly from articlesData.
  // Tab switching does NOT trigger refetch — displayArticles derives from cache.

  useEffect(() => {
    if (articlesData?.items) {
      if (page === 1) {
        // Only update state if the data actually changed (identity check)
        setAllArticles(prev => {
          if (prev.length === articlesData.items.length &&
              prev[0]?.id === articlesData.items[0]?.id) {
            return prev; // Same data, keep reference to avoid re-render
          }
          return articlesData.items;
        });
      } else {
        setAllArticles(prev => {
          const existingIds = new Set(prev.map(a => a.id));
          const newItems = articlesData.items.filter(a => !existingIds.has(a.id));
          if (newItems.length === 0) return prev;
          return [...prev, ...newItems];
        });
      }
    }
  }, [articlesData, page]);

  // ─── Predictive prefetch: when new articles arrive (page load),
  //      prefetch cover images for upcoming items ─────────────────────
  //
  // This is the mobile equivalent of IntersectionObserver with 200px rootMargin.
  // When new data is added (either initial load or pagination), we prefetch
  // the cover images for ALL items that aren't in the priority group.
  // Priority items (first PRIORITY_COUNT) get Image.prefetch individually
  // via the AppImage priority prop — the rest are batched here.

  useEffect(() => {
    if (displayArticles.length === 0) return;

    const urlsToPrefetch = displayArticles
      .slice(PRIORITY_COUNT) // Skip priority items (handled by AppImage)
      .map(getPrefetchUrl)
      .filter(Boolean) as string[];

    if (urlsToPrefetch.length > 0) {
      // Fire and forget — prefetch in background
      prefetchMany(urlsToPrefetch).catch(() => {});
    }
  }, [displayArticles, prefetchMany]);

  // ─── Scroll handler — UI thread (worklet) ──────────────────────────
  //
  // Runs entirely on the UI thread via react-native-reanimated.
  // No JS bridge crossing on scroll events.
  //
  // CategoryFilter has its own catFilterTranslateY (independent from Header).
  // TabBar uses tabBarTranslateY from ScrollContext.
  //
  // Header is static (always visible) — no animation needed.
  //
  // Overscroll guard: When the user overscrolls past the bottom boundary,
  // iOS rubber-band bounce causes contentOffset.y to oscillate, producing
  // alternating diff values that trigger conflicting withTiming calls.
  // This manifests as visible jitter/shaking. We detect overscroll by
  // comparing contentOffset.y against contentSize - layoutMeasurement,
  // and skip all animation updates during the bounce phase.

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      const currentY = event.contentOffset.y;
      const contentHeight = event.contentSize.height;
      const viewportHeight = event.layoutMeasurement.height;

      // ── Overscroll boundary detection ──────────────────────────────
      // Detect bottom overscroll: currentY >= max scrollable position
      // Detect top overscroll: currentY < 0 (pull-to-refresh zone)
      // Skip all withTiming calls during overscroll to prevent jitter.
      // Still track lastScrollY for direction continuity when scrolling resumes.
      const maxScrollY = Math.max(0, contentHeight - viewportHeight);
      const isBottomOverscroll = maxScrollY > 0 && currentY >= maxScrollY - 1;
      const isTopOverscroll = currentY < 0;

      if (isBottomOverscroll || isTopOverscroll) {
        lastScrollY.value = currentY;
        return;
      }

      // ── Normal scroll-driven animations ───────────────────────────
      const diff = currentY - lastScrollY.value;

      if (diff > 5 && currentY > SCROLL_THRESHOLD) {
        // Scrolling down → hide CategoryFilter and TabBar
        catFilterTranslateY.value = withTiming(-CAT_FILTER_HEIGHT, { duration: 200 });
        tabBarTranslateY.value = withTiming(TAB_BAR_HEIGHT, { duration: 200 });
      } else if (diff < -5) {
        // Scrolling up → show CategoryFilter and TabBar
        catFilterTranslateY.value = withTiming(0, { duration: 200 });
        tabBarTranslateY.value = withTiming(0, { duration: 200 });
      }

      lastScrollY.value = currentY;
    },
  });

  // ─── Viewability config + handler for on-view image prefetch ──────

  const viewabilityConfig = React.useRef({
    itemVisiblePercentThreshold: 50,
    minimumViewTime: 200,
  }).current;

  const onViewableItemsChanged = React.useRef(
    ({ changed }: { changed: Array<{ item: FrontendArticle; isViewable: boolean }> }) => {
      const toPrefetch: string[] = [];
      changed.forEach(({ item, isViewable }) => {
        if (isViewable) {
          const url = getPrefetchUrl(item);
          if (url) toPrefetch.push(url);
        }
      });
      if (toPrefetch.length > 0) {
        prefetchMany(toPrefetch).catch(() => {});
      }
    },
  ).current;

  // ─── Navigation ─────────────────────────────────────────────────────

  const handleArticlePress = useCallback(
    (article: FrontendArticle) => {
      navigation.getParent()?.navigate('ArticleDetail', {
        slug: article.slug,
        articleId: article.id,
      });
    },
    [navigation],
  );

  // ─── Bookmark handler ───────────────────────────────────────────────

  const handleBookmark = useCallback(
    (article: FrontendArticle) => {
      const newIsBookmarked = !bookmarkedIds[article.id];
      // Optimistic local update
      dispatch(toggleBookmarkOptimistic(article.id));
      // Persist to server
      if (newIsBookmarked) {
        addBookmark({ articleId: article.id }).catch(() => {
          dispatch(toggleBookmarkOptimistic(article.id));
        });
      } else {
        removeBookmark({ articleId: article.id }).catch(() => {
          dispatch(toggleBookmarkOptimistic(article.id));
        });
      }
    },
    [dispatch, bookmarkedIds, addBookmark, removeBookmark],
  );

  // ─── Category change: debounce 300ms + reset page ──────────────────

  const handleCategoryChange = useCallback((categoryId: string | null) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      setSelectedCategoryId(categoryId);
      setPage(1);
      setAllArticles([]);
    }, DEBOUNCE_MS);
  }, []);

  // ─── Load more (pagination) ───────────────────────────────────────

  const handleLoadMore = useCallback(() => {
    if (!isFetching && hasMore) {
      setPage(p => p + 1);
    }
  }, [isFetching, hasMore]);

  // ─── Pull-to-refresh ──────────────────────────────────────────────
  //
  // Uses requestAnimationFrame to guarantee the RefreshControl spinner
  // is painted BEFORE the async fetch starts. refetch() forces a real
  // network request. .finally() stops the spinner when done.
  // No useEffect(isFetching) — that pattern fails when isFetching is
  // already true from an auto-refetch (race condition).

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setPage(1);
    // rAF fires AFTER React commits refreshing=true and RN paints the spinner.
    // Without rAF, the refetch might start before the spinner renders,
    // causing isFetching to toggle too fast for the UI to catch up.
    requestAnimationFrame(() => {
      refetch().finally(() => {
        setRefreshing(false);
      });
    });
  }, [refetch, refreshing]);

  // ─── Render article item ──────────────────────────────────────────
  //
  // Passes networkQuality and priority down to ArticleCard.
  // First PRIORITY_COUNT items get priority=true for LCP optimization.

  const renderArticleItem = useCallback(
    ({ item, index }: { item: FrontendArticle; index: number }) => (
      <View style={styles.articleItem}>
        <ArticleCard
          article={item}
          onPress={handleArticlePress}
          onBookmark={handleBookmark}
          isBookmarked={!!bookmarkedIds[item.id]}
          showExcerpt
          networkQuality={networkQuality}
          priority={index < PRIORITY_COUNT}
        />
      </View>
    ),
    [handleArticlePress, handleBookmark, bookmarkedIds, networkQuality],
  );

  // ─── Footer: loading spinner during Load More ─────────────────────

  const renderFooter = () => {
    if (!isFetching || page <= 1) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  };

  // ─── Empty / error states ─────────────────────────────────────────

  const renderEmpty = useCallback(() => {
    // Loading state: skeleton
    if (isLoading && page === 1) {
      return (
        <View style={styles.sectionContainer}>
          <ArticleListSkeleton count={5} />
        </View>
      );
    }

    // Error state
    if (isError && !allArticles.length) {
      return (
        <View style={styles.sectionContainer}>
          <EmptyContent
            icon="⚠️"
            title={t('home.error.unableToLoad')}
            description={t('common.pullDownToRetry')}
            actionLabel={t('common.retry')}
            onAction={refetch}
          />
        </View>
      );
    }

    // Empty state — stays top-aligned (use displayArticles to match visible data)
    if (!displayArticles.length) {
      return (
        <View style={styles.sectionContainer}>
          <EmptyLogoContent
            title={selectedCategoryId ? t('categories.emptyArticles') : t('home.empty')}
            description={selectedCategoryId ? t('article.empty.inCategory') : t('common.checkBackLater')}
          />
        </View>
      );
    }

    return null;
  }, [
    isLoading,
    page,
    isError,
    allArticles.length,
    displayArticles.length,
    selectedCategoryId,
    refetch,
  ]);

  // ─── Main render ─────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: colors.bgSecondary }]}>
      {/*
       * FlatList fills the entire screen.
       * paddingTop is STATIC (insets.top + CONTENT_TOP) — no animated padding.
       * Content behind the CategoryFilter overlay is naturally revealed when
       * it slides up (catFilterTranslateY = -CAT_FILTER_HEIGHT).
       */}
      <Animated.FlatList
        data={displayArticles}
        keyExtractor={(item) => item.id}
        renderItem={renderArticleItem}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + CONTENT_TOP,
            paddingBottom: insets.bottom + spacing.xl,
          },
          displayArticles.length === 0 && styles.emptyList,
        ]}
      />

      {/*
       * Header overlay — absolutely positioned at the top.
       * STATIC — never hides (no translateY animation).
       * Always visible above the CategoryFilter.
       * No paddingTop needed — Header component handles safe area internally.
       */}
      <View style={styles.headerOverlay}>
        <Header title="Tarsier" hideSettings />
      </View>

      {/*
       * CategoryFilter overlay — absolutely positioned below Header.
       * Slides up to hide (catFilterTranslateY: 0 → -CAT_FILTER_HEIGHT)
       * and down to show, independent from Header.
       */}
      <Animated.View
        style={[
          styles.categoryFilterOverlay,
          {
            top: HEADER_HEIGHT + insets.top,
          },
          catFilterAnimatedStyle,
        ]}
      >
        <CategoryFilter
          selectedCategoryId={selectedCategoryId}
          onSelect={handleCategoryChange}
        />
      </Animated.View>
{/* Network status bar */}
<NetworkStatusBar />
</View>
);
};

HomeScreen.whyDidYouRender = true;


const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    // Header is static (always visible). No zIndex needed since CategoryFilter
    // renders after Header in DOM order and is at top: HEADER_HEIGHT + insets.top,
    // so at rest there is zero overlap between them.
  },
  categoryFilterOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 10,
  },
  scrollContent: {
    flexGrow: 1,
  },
  emptyList: {
    // Intentionally no justifyContent: 'center' — stays top-aligned
  },
  sectionContainer: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
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

export default HomeScreen;
