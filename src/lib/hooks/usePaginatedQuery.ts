/**
 * usePaginatedQuery — Generic infinite scroll hook for RTK Query
 *
 * Eliminates the manual allArticles + page + accumulation useEffect pattern
 * that's repeated across HomeScreen, ArticleListScreen, TagArticlesScreen,
 * and CategoryArticlesScreen.
 *
 * RTK Query already returns { data, isLoading, isFetching, error } — like
 * ahooks' useRequest. But for infinite scroll (load more), we need to
 * accumulate items across pages. This hook encapsulates that accumulation
 * so components can render directly without local state.
 *
 * Usage:
 * ```tsx
 * const { items, isLoading, isFetching, hasMore, loadMore, refresh } =
 *   usePaginatedQuery(useGetArticlesQuery, { lang, categoryId }, {
 *     pageSize: 10,
 *     selectItems: (data) => data.items,
 *     selectTotalPages: (data) => data.totalPages,
 *   });
 * ```
 */

import { useState, useCallback, useEffect, useRef } from 'react';

export interface UsePaginatedQueryConfig<TData, TItem> {
  /** Page size for each API request */
  pageSize?: number;
  /** Extract the array of items from the query response */
  selectItems: (data: TData) => TItem[];
  /** Extract total pages from the query response */
  selectTotalPages: (data: TData) => number;
  /** Optional: extract total item count from the query response */
  selectTotal?: (data: TData) => number;
  /**
   * Optional initial/cache data to display while the real API call is in flight.
   * Used for cold-start display: show MMKV cached data immediately, then
   * silently replace with fresh API data when it arrives.
   */
  initialCacheData?: TData;
}

export interface UsePaginatedQueryResult<TItem, TData = unknown> {
  /** Accumulated items across all loaded pages */
  items: TItem[];
  /** Total item count from server (if selectTotal provided) */
  total: number;
  /** Total pages from server */
  totalPages: number;
  /** Whether initial load is in progress */
  isLoading: boolean;
  /** Whether any fetch is in progress (including load more) */
  isFetching: boolean;
  /** Whether the last request errored */
  isError: boolean;
  /** Error object if any */
  error?: unknown;
  /** Whether there are more pages to load */
  hasMore: boolean;
  /** Load next page */
  loadMore: () => void;
  /** Refresh from page 1 — resets accumulation */
  refresh: () => void;
  /** Raw API response data (undefined when showing initialCacheData seed) */
  rawData?: TData;
}

/**
 * Generic hook that wraps an RTK Query hook with infinite scroll support.
 *
 * @param useQueryHook - The RTK Query hook (e.g., useGetArticlesQuery)
 * @param params - Base query params (page is injected internally)
 * @param config - Configuration for extracting items and pagination info
 *
 * The hook:
 * 1. Calls the RTK Query hook with incremental page numbers
 * 2. Accumulates items from each page (with dedup by `item.id`)
 * 3. Exposes loadMore/refresh for infinite scroll UX
 * 4. Returns the same shape as ahooks' useRequest — items, isLoading, error
 */
export function usePaginatedQuery<TData, TItem>(
  useQueryHook: (params: any) => {
    data?: TData;
    isLoading: boolean;
    isFetching: boolean;
    isError: boolean;
    error?: unknown;
    refetch: () => void;
  },
  params: Record<string, unknown>,
  config: UsePaginatedQueryConfig<TData, TItem>,
): UsePaginatedQueryResult<TItem, TData> {
  const {
    selectItems,
    selectTotalPages,
    selectTotal,
    pageSize = 10,
    initialCacheData,
  } = config;

  // ─── State ───────────────────────────────────────────────────────────
  const [page, setPage] = useState(1);
  const [allItems, setAllItems] = useState<TItem[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  // Track previous params to detect changes that should reset pagination
  const prevParamsRef = useRef(params);

  // ─── Detect base-param changes DURING render (not in useEffect) ────
  // When lang/categoryId/slug etc. change, the old allItems would still
  // be used for one frame if we waited for the effect (effect runs after
  // paint). By detecting and resetting synchronously during render, we
  // prevent stale accumulated data from flashing (e.g., Japanese articles
  // visible when switching to Chinese).
  //
  // IMPORTANT — render-phase update restart behaviour:
  //   React sees these setState calls during render and RESTARTS the render
  //   with the new state applied. However, prevParamsRef (a ref) is mutated
  //   immediately and is NOT rolled back on restart. So in the restarted
  //   render, paramsChanged = false and effectivePage falls back to `page`.
  //   If we only reset allItems and rely on `effectivePage = paramsChanged ? 1 : page`,
  //   the restarted render fires the query for the OLD page number (e.g. page 3)
  //   of the new category — returning empty results and leaving the list blank.
  //
  //   Fix: also call setPage(1) here so that both allItems AND page are reset
  //   together in the restarted render. effectivePage then correctly uses page=1.
  const paramsChanged = Object.keys(params).some(
    key => params[key] !== prevParamsRef.current[key],
  );
  if (paramsChanged) {
    prevParamsRef.current = { ...params };
    setAllItems([]);
    setPage(1);
  }

  // ─── Compute effective page ────────────────────────────────────────
  // After the render-phase restart, paramsChanged=false and page=1 (both
  // applied). effectivePage correctly resolves to 1 via the page state.
  const effectivePage = paramsChanged ? 1 : page;

  // ─── RTK Query call ─────────────────────────────────────────────────
  // _refreshKey is a cache-busting parameter: on refresh(), the key increments,
  // forcing RTK Query to create a new cache entry and always fetch from server.
  // This fixes the stuck-spinner bug where refetch() was called on the wrong page.
  const { data, isLoading, isFetching, isError, error } = useQueryHook({
    ...params,
    page: effectivePage,
    pageSize,
    _refreshKey: refreshKey,
  });

  // ─── Derive pagination info from data ───────────────────────────────
  const totalPages = data ? selectTotalPages(data) : 1;
  const total = data && selectTotal ? selectTotal(data) : 0;

  const hasMore = effectivePage < totalPages;

  // ─── Accumulate items across pages ─────────────────────────────────
  useEffect(() => {
    if (!data) {
      return;
    }

    const items = selectItems(data);

    if (effectivePage === 1) {
      setAllItems(items);
    } else {
      setAllItems(prev => {
        const existingIds = new Set(
          (prev as any[]).map((item: any) => item.id),
        );
        const newItems = items.filter((item: any) => !existingIds.has(item.id));
        if (newItems.length === 0) {
          return prev;
        }
        return [...prev, ...newItems];
      });
    }
  }, [data, effectivePage, selectItems]);

  // ─── Load next page ────────────────────────────────────────────────
  const loadMore = useCallback(() => {
    if (!isFetching && hasMore) {
      setPage(p => p + 1);
    }
  }, [isFetching, hasMore]);

  // ─── Refresh from page 1 ──────────────────────────────────────────
  // Uses refreshKey to force a new RTK Query cache entry, guaranteeing
  // a fresh server fetch with proper isFetching lifecycle (false→true→false).
  // This replaces the broken refetch() pattern which fetched the wrong page.
  const refresh = useCallback(() => {
    setPage(1);
    setAllItems([]);
    setRefreshKey(k => k + 1);
  }, []);

  // ─── Display items ────────────────────────────────────────────────
  // Page 1: use direct RTK Query data (cache-first, synchronous).
  //   When data is undefined (new params, fetching), show [] — NOT old allItems.
  // Page > 1: use accumulated allItems. Guard with paramsChanged to prevent
  //   stale allItems from flashing when params change mid-pagination.
  const displayItems =
    effectivePage === 1
      ? data
        ? selectItems(data)
        : initialCacheData
          ? selectItems(initialCacheData)
          : []
      : paramsChanged
        ? []
        : allItems;

  return {
    items: displayItems,
    total,
    totalPages,
    isLoading,
    isFetching,
    isError,
    error,
    hasMore,
    loadMore,
    refresh,
    rawData: data,
  };
}
