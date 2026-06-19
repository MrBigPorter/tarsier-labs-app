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
 * - Pagination: usePaginatedQuery hook accumulates pages with dedup by ID
 * - Category filter: server-side via categoryId param, hook auto-resets on param change
 * - Language: lang param passed to API for i18n re-fetch
 * - Scroll: absolute positioned overlays + static padding for standard RN scroll-hide
 * - Empty states: loading skeleton, error with retry, empty message
 * - Image prefetch: onViewableItemsChanged pre-warms native image cache
 * - Priority: first 2 items get priority prop for LCP optimization
 * - Network quality: useNetworkQuality at screen level, passes down to ArticleCard
 */
import React, {
  useCallback,
  useMemo,
  useRef,
  useState,
  useEffect,
} from 'react';
import { usePaginatedQuery } from '@/lib/hooks/usePaginatedQuery';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Platform,
  AppState,
  AppStateStatus,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import {
  loadArticleList,
  saveArticleList,
  clearLanguageCache,
} from '@/lib/cache/articleListCache';
import PullToRefreshWrapper from '@/components/core/PullToRefreshWrapper';
import { useAppSelector, useAppDispatch } from '@/store';
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useModeColors, spacing } from '@/lib/theme';
import { useGetArticlesQuery } from '@/api/endpoints/articles';
import { ArticleCard } from '@/components/blog/ArticleCard';
import { CategoryFilter } from '@/components/blog/CategoryFilter';
import Header from '@/components/layout/Header';
import { NetworkStatusBar } from '@/components/core/NetworkStatusBar';
import { ArticleListSkeleton } from '@/components/core/Skeleton';
import { EmptyContent } from '@/components/core/EmptyContent';
import { EmptyLogoContent } from '@/components/core/EmptyLogoContent';
import { useScrollContext } from '@/lib/ScrollContext';
import { useAppLanguage } from '@/lib/i18n';
import { useTranslation } from 'react-i18next';
import { toggleBookmarkOptimistic } from '@/store/slices/bookmarksSlice';
import {
  useAddBookmarkMutation,
  useRemoveBookmarkMutation,
} from '@/api/endpoints/bookmarks';
import { useNetworkQuality } from '@/lib/hooks/useNetworkQuality';
import { useImagePrefetch } from '@/lib/hooks/useImagePrefetch';
import { useArticlePrefetch } from '@/lib/hooks/useArticlePrefetch';
import { getArticleImageUrl, isVideoUrl } from '@/lib/utils/image';
import type { HomeTabScreenProps } from '@/navigation/types';
import type {
  FrontendArticle,
  FrontendPaginatedResponse,
} from '@/types/frontend-blog';

const PAGE_SIZE = 10;
const DEBOUNCE_MS = 300;
const SCROLL_THRESHOLD = 50;

/** Height of the Header component alone (used for static positioning) */
const HEADER_HEIGHT = Platform.OS === 'ios' ? 44 : 56;
/** Height of the CategoryFilter component alone */
const CAT_FILTER_HEIGHT = 50;
/** Gap between Header bottom and CategoryFilter top */
const HEADER_CAT_GAP = spacing.sm; // 6px
/** Gap between CategoryFilter bottom and first article card */
const LIST_TOP_GAP = spacing.xl; // 16px
/** Combined height of Header + gaps + CategoryFilter + list gap for static content paddingTop */
const CONTENT_TOP =
  HEADER_HEIGHT + HEADER_CAT_GAP + CAT_FILTER_HEIGHT + LIST_TOP_GAP; // 116px
/** Height of the bottom TabBar content (for scroll hide animation) */
const TAB_BAR_HEIGHT = 80;

/** Number of initial items that should get priority image loading (LCP) */
const PRIORITY_COUNT = 2;

/**
 * Bundled context hook to prevent hooks order shift.
 * useSafeAreaInsets can have varying internal hook counts under Fabric/New Architecture,
 * which would shift component-level hook positions. Bundling isolates the instability.
 */
function useHomeScreenContext() {
  const insets = useSafeAreaInsets();
  const colors = useModeColors();
  const { tabBarTranslateY, lastScrollY } = useScrollContext();
  return { insets, colors, tabBarTranslateY, lastScrollY };
}

/**
 * Resolve the best image URL for prefetching from an article.
 * Matches the logic in AppImage's getArticleImageUrl.
 */
function getPrefetchUrl(article: FrontendArticle): string | null {
  // Skip video files (no need to prefetch video in image cache)
  if (article.coverImage && isVideoUrl(article.coverImage)) {
    return null;
  }

  return getArticleImageUrl({
    images: article.meta?.images,
    coverImage: article.coverImage,
    size: 'medium',
  });
}

const HomeScreen: React.FC<HomeTabScreenProps<'Home'>> = ({ navigation }) => {
  const { t } = useTranslation();
  const { insets, colors, tabBarTranslateY, lastScrollY } =
    useHomeScreenContext();

  // ─── Redux ────────────────────────────────────────────────────────────
  const dispatch = useAppDispatch();
  const bookmarkedIds = useAppSelector(state => state.bookmarks.bookmarkedIds);

  // ─── Bookmark mutations ───────────────────────────────────────────────
  const [addBookmark] = useAddBookmarkMutation();
  const [removeBookmark] = useRemoveBookmarkMutation();

  // ─── Network quality (screen-level, passes down to ArticleCard) ────
  const networkQuality = useNetworkQuality();
  // Ref to prevent networkQuality changes from recreating renderArticleItem,
  // which would cascade all visible ArticleCards to re-render.
  // The ref always has the latest value, consumed during render via React.memo.
  const networkQualityRef = useRef(networkQuality);
  networkQualityRef.current = networkQuality;

  // ─── Image prefetch hook ───────────────────────────────────────────
  const { prefetchMany } = useImagePrefetch();

  // ─── Article data prefetch (fires on finger-down, before navigation) ──
  const prefetchArticle = useArticlePrefetch();

  // ─── State ────────────────────────────────────────────────────────────

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null,
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tracks user-initiated pull-to-refresh so we can show the RefreshControl
  // spinner only during manual refresh, not during initial load or load-more.
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  const lang = useAppLanguage();

  // ─── MMKV Cache for cold start display ──────────────────────────────
  // Synchronous initialization: loadArticleList() is a sync MMKV read (~0.01ms),
  // so useMemo reads the cache directly during render — no 1-frame skeleton flash.
  const cachedData = useMemo(() => {
    const entry = loadArticleList(lang, selectedCategoryId);
    if (entry && entry.items.length > 0) {
      return {
        items: entry.items,
        total: entry.total,
        totalPages: entry.totalPages,
        page: 1,
        pageSize: entry.pageSize,
      };
    }
    return null;
  }, [lang, selectedCategoryId]);

  // ─── Paginated data fetching (replaces manual allArticles + page) ────
  const queryParams = selectedCategoryId
    ? { categoryId: selectedCategoryId, lang }
    : { lang };

  const {
    items: displayArticles,
    isLoading,
    isFetching,
    isError,
    hasMore,
    loadMore,
    refresh,
    rawData,
  } = usePaginatedQuery(useGetArticlesQuery, queryParams, {
    pageSize: PAGE_SIZE,
    selectItems: data => data.items,
    selectTotalPages: data => data.totalPages,
    initialCacheData: cachedData ?? undefined,
  });

  // ─── Save API response to MMKV cache ────────────────────────────────
  // Only saves when real API data arrives (not the cache seed).
  // This keeps the cache fresh after every successful fetch.
  const prevRawDataRef = useRef(rawData);
  useEffect(() => {
    if (rawData && rawData !== prevRawDataRef.current) {
      saveArticleList(
        lang,
        selectedCategoryId,
        rawData as FrontendPaginatedResponse<FrontendArticle>,
      );
    }
    prevRawDataRef.current = rawData;
  }, [rawData, lang, selectedCategoryId]);

  // ─── Track language changes — reset to page 1 ────────────────────────
  const prevLangRef = useRef(lang);

  useEffect(() => {
    if (prevLangRef.current !== lang) {
      // Clear cached data for the previous language
      clearLanguageCache(prevLangRef.current);
      prevLangRef.current = lang;
      setSelectedCategoryId(null);
      refresh();
    }
  }, [lang, refresh]);

  // ─── AppState listener: refresh on foreground ──────────────────────
  // When user switches back to the app, immediately refresh to get latest data.
  // This minimizes the window where cached data could be stale.
  const appStateRef = useRef(AppState.currentState);
  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        if (
          appStateRef.current.match(/inactive|background/) &&
          nextState === 'active'
        ) {
          refresh();
        }
        appStateRef.current = nextState;
      },
    );
    return () => {
      subscription.remove();
    };
  }, [refresh]);

  // ─── NetInfo listener: refresh on connectivity restore ────────────
  // When the device regains network access, refresh to update stale cache.
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected && state.isInternetReachable !== false) {
        refresh();
      }
    });
    return () => {
      unsubscribe();
    };
  }, [refresh]);

  // ─── Auto-clear manual refreshing flag when fetch completes ────────
  // Only clear when isFetching transitions to false — not on initial mount.
  // This ensures the RefreshControl spinner stays visible for the full fetch.
  const prevIsFetchingRef = useRef(isFetching);
  useEffect(() => {
    if (prevIsFetchingRef.current && !isFetching) {
      // isFetching just went true → false: fetch completed
      setIsManualRefreshing(false);
    }
    prevIsFetchingRef.current = isFetching;
  }, [isFetching]);

  // ─── Reanimated shared values ─────────────────────────────────────────

  /** Independent translateY for CategoryFilter: 0 ↔ -CAT_FILTER_HEIGHT */
  const catFilterTranslateY = useSharedValue(0);

  // ─── Animated styles (UI thread) ──────────────────────────────────────

  const catFilterAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: catFilterTranslateY.value }],
  }));

  // ─── Predictive prefetch: when new articles arrive (page load),
  //      prefetch cover images for upcoming items ─────────────────────
  //
  // This is the mobile equivalent of IntersectionObserver with 200px rootMargin.
  // When new data is added (either initial load or pagination), we prefetch
  // the cover images for ALL items that aren't in the priority group.
  // Priority items (first PRIORITY_COUNT) get Image.prefetch individually
  // via the AppImage priority prop — the rest are batched here.

  useEffect(() => {
    if (displayArticles.length === 0) {
      return;
    }

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
    onScroll: event => {
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

      if (isBottomOverscroll) {
        lastScrollY.value = currentY;
        return;
      }

      // ── Normal scroll-driven animations ───────────────────────────
      const diff = currentY - lastScrollY.value;

      if (diff > 5 && currentY > SCROLL_THRESHOLD) {
        // Scrolling down → hide CategoryFilter and TabBar
        catFilterTranslateY.value = withTiming(-CAT_FILTER_HEIGHT, {
          duration: 200,
        });
        tabBarTranslateY.value = withTiming(-TAB_BAR_HEIGHT, { duration: 200 });
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
    ({
      changed,
    }: {
      changed: Array<{ item: FrontendArticle; isViewable: boolean }>;
    }) => {
      const toPrefetch: string[] = [];
      changed.forEach(({ item, isViewable }) => {
        if (isViewable) {
          const url = getPrefetchUrl(item);
          if (url) {
            toPrefetch.push(url);
          }
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

  // ─── Category change: debounce 300ms — hook auto-resets on params change

  const handleCategoryChange = useCallback((categoryId: string | null) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      setSelectedCategoryId(categoryId);
    }, DEBOUNCE_MS);
  }, []);

  // ─── Load more (pagination) ───────────────────────────────────────

  const handleLoadMore = useCallback(() => {
    if (!isFetching && hasMore) {
      loadMore();
    }
  }, [isFetching, hasMore, loadMore]);

  // ─── Pull-to-refresh ──────────────────────────────────────────────
  //
  // Sets isManualRefreshing to show the RefreshControl spinner, then
  // calls refresh() which resets the hook to page 1 and clears accumulated
  // items. When the fetch completes, the isFetching effect auto-clears
  // isManualRefreshing, hiding the spinner.

  const onRefresh = useCallback(() => {
    setIsManualRefreshing(true);
    refresh();
  }, [refresh]);

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
          onPrefetch={prefetchArticle}
          isBookmarked={bookmarkedIds[item.id]}
          showExcerpt
          // Use ref to avoid recreating this callback when networkQuality
          // initializes (defaults → real values). The ref always has the
          // latest quality without causing dependency changes.
          networkQuality={networkQualityRef.current}
          priority={index < PRIORITY_COUNT}
        />
      </View>
    ),
    // networkQuality intentionally excluded — using ref to prevent
    // cascade re-renders of all visible ArticleCards when network
    // quality initializes from defaults to real values.
    [handleArticlePress, handleBookmark, bookmarkedIds, prefetchArticle],
  );

  // ─── Footer: loading spinner during Load More ─────────────────────
  // Shows only when fetching BEYOND the first page (i.e., we already
  // have items and are requesting more).

  const renderFooter = () => {
    if (!isFetching || displayArticles.length === 0) {
      return null;
    }
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  };

  // ─── Empty / error states ─────────────────────────────────────────

  const renderEmpty = useCallback(() => {
    // Loading state: skeleton only when there's NO cached data to display.
    // If cachedData exists, we skip the skeleton entirely — the FlatList
    // renders the cached items immediately (via initialCacheData), giving
    // the user instant content instead of a loading placeholder.
    if (isLoading && displayArticles.length === 0 && !cachedData) {
      return (
        <View style={styles.sectionContainer}>
          <ArticleListSkeleton count={5} />
        </View>
      );
    }

    // Error state (no items loaded yet)
    if (isError && displayArticles.length === 0) {
      return (
        <View style={styles.sectionContainer}>
          <EmptyContent
            icon="⚠️"
            title={t('home.error.unableToLoad')}
            description={t('common.pullDownToRetry')}
            actionLabel={t('common.retry')}
            onAction={refresh}
          />
        </View>
      );
    }

    // Empty state — stays top-aligned
    if (!displayArticles.length) {
      return (
        <View style={styles.sectionContainer}>
          <EmptyLogoContent
            title={
              selectedCategoryId
                ? t('categories.emptyArticles')
                : t('home.empty')
            }
            description={
              selectedCategoryId
                ? t('article.empty.inCategory')
                : t('common.checkBackLater')
            }
          />
        </View>
      );
    }

    return null;
  }, [
    isLoading,
    displayArticles.length,
    isError,
    t,
    refresh,
    selectedCategoryId,
    cachedData,
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
      <PullToRefreshWrapper
        refreshing={isManualRefreshing}
        onRefresh={onRefresh}
        backgroundColor={colors.bgSecondary}
        spinnerColor={colors.primary}
        scrollOffset={lastScrollY}
        spinnerOffset={insets.top + CONTENT_TOP}
      >
        <Animated.FlatList
          data={displayArticles}
          keyExtractor={item => `${item.id}-${lang}`}
          renderItem={renderArticleItem}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          onEndReached={handleLoadMore}
          // Trigger load-more when user is 2 full screen-heights from the end.
          // This gives the network request time to complete before the user
          // actually hits the bottom, making pagination feel instantaneous.
          onEndReachedThreshold={2}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          showsVerticalScrollIndicator={false}
          overScrollMode="always"
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: insets.top + CONTENT_TOP,
              paddingBottom: insets.bottom + spacing.xl,
            },
            displayArticles.length === 0 && styles.emptyList,
          ]}
        />
      </PullToRefreshWrapper>

      {/*
       * Header overlay — absolutely positioned at the top.
       * STATIC — never hides (no translateY animation).
       * Always visible above the CategoryFilter.
       * No paddingTop needed — Header component handles safe area internally.
       */}
      <View style={styles.headerOverlay}>
        <Header title="Tarsier" hideSettings showBack={false} />
      </View>

      {/*
       * CategoryFilter overlay — absolutely positioned below Header.
       * HEADER_CAT_GAP creates visible spacing from the Header.
       * Slides up to hide (catFilterTranslateY: 0 → -CAT_FILTER_HEIGHT)
       * and down to show, independent from Header.
       */}
      <Animated.View
        style={[
          styles.categoryFilterOverlay,
          {
            top: HEADER_HEIGHT + insets.top + HEADER_CAT_GAP,
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
    gap: spacing.sm,
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
  },
  footer: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
});

export default HomeScreen;
