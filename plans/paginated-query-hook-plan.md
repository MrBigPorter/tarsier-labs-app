# Generic `usePaginatedQuery` Hook Plan

## Problem

4 screens manually manage `allArticles` + `page` + accumulation `useEffect`, duplicating logic that RTK Query already handles:

| Screen                                                                    | Query                       | Data Path             | Lines                                         |
| ------------------------------------------------------------------------- | --------------------------- | --------------------- | --------------------------------------------- |
| [`HomeScreen.tsx`](src/screens/HomeScreen.tsx:139)                        | `useGetArticlesQuery`       | `data.items`          | `allArticles`, `page`, accumulation useEffect |
| [`ArticleListScreen.tsx`](src/screens/ArticleListScreen.tsx:62)           | `useGetArticlesQuery`       | `data.items`          | `allArticles`, `page`, accumulation useEffect |
| [`TagArticlesScreen.tsx`](src/screens/TagArticlesScreen.tsx:46)           | `useGetTagBySlugQuery`      | `data.articles.items` | `allArticles`, `page`, accumulation useEffect |
| [`CategoryArticlesScreen.tsx`](src/screens/CategoryArticlesScreen.tsx:56) | `useGetCategoryBySlugQuery` | `data.articles.items` | `allArticles`, `page`, accumulation useEffect |

## Target Hook API

```typescript
interface UsePaginatedQueryResult<T> {
  /** Accumulated items across all loaded pages */
  items: T[];
  /** Total items count from server */
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
  /** Refresh from page 1 */
  refresh: () => void;
}

function usePaginatedQuery<TItem, TData>(
  useQueryHook: (params: any) => {
    data?: TData;
    isLoading: boolean;
    isFetching: boolean;
    isError: boolean;
    error?: unknown;
    refetch: () => void;
  },
  params: Record<string, unknown>,
  options?: {
    pageSize?: number;
    /** Extract paginated items from query response (handles different data shapes) */
    selectItems: (data: TData) => TItem[];
    /** Extract total pages from query response */
    selectTotalPages: (data: TData) => number;
    /** Extract total count from query response */
    selectTotal?: (data: TData) => number;
  },
): UsePaginatedQueryResult<TItem>;
```

## New File

### `src/lib/hooks/usePaginatedQuery.ts`

```typescript
import { useState, useCallback, useRef, useEffect } from 'react';

interface PaginatedQueryConfig<TData, TItem> {
  /** Function to extract items array from query response */
  selectItems: (data: TData) => TItem[];
  /** Function to extract totalPages from query response */
  selectTotalPages: (data: TData) => number;
  /** Optional: extract total count from query response */
  selectTotal?: (data: TData) => number;
}

interface UsePaginatedQueryResult<TItem> {
  items: TItem[];
  total: number;
  totalPages: number;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error?: unknown;
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => void;
}

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
  config: PaginatedQueryConfig<TData, TItem> & { pageSize?: number },
): UsePaginatedQueryResult<TItem> {
  const { selectItems, selectTotalPages, selectTotal, pageSize = 10 } = config;

  const [page, setPage] = useState(1);
  const [allItems, setAllItems] = useState<TItem[]>([]);
  const accumulatedRef = useRef(false);

  const { data, isLoading, isFetching, isError, error, refetch } = useQueryHook(
    { ...params, page, pageSize },
  );

  const currentItems = data ? selectItems(data) : [];
  const totalPages = data ? selectTotalPages(data) : 1;
  const total = data && selectTotal ? selectTotal(data) : 0;

  // Accumulate items across pages
  useEffect(() => {
    if (!data) return;

    if (page === 1) {
      // Fresh load — replace accumulation
      setAllItems(currentItems);
      accumulatedRef.current = false;
    } else {
      // Load more — dedup by ID
      setAllItems(prev => {
        const existingIds = new Set(prev.map((item: any) => item.id));
        const newItems = currentItems.filter(
          (item: any) => !existingIds.has(item.id),
        );
        if (newItems.length === 0) return prev;
        return [...prev, ...newItems];
      });
    }
  }, [data, page]);

  const hasMore = page < totalPages;

  const loadMore = useCallback(() => {
    if (!isFetching && hasMore) {
      setPage(p => p + 1);
    }
  }, [isFetching, hasMore]);

  const refresh = useCallback(() => {
    setPage(1);
    setAllItems([]);
    // RTK Query's refetch will re-fetch page 1
    refetch();
  }, [refetch]);

  // Use accumulated items when page > 1, direct items when page === 1
  const displayItems =
    page === 1 && currentItems.length > 0 ? currentItems : allItems;

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
  };
}
```

## Files to Modify

### 1. `src/screens/HomeScreen.tsx`

**Remove:**

- `allArticles`, `setAllArticles` useState
- `page`, `setPage` useState
- Pagination accumulation useEffect
- `totalPages`, `hasMore` manual derivation
- `displayArticles` useMemo
- `handleLoadMore`, `onRefresh`
- `renderFooter`, `renderEmpty` (or simplify them)
- All unused imports

**Replace with:**

```typescript
import { usePaginatedQuery } from '@/lib/hooks/usePaginatedQuery';

// Inside component:
const {
  items: displayArticles,
  isLoading,
  isFetching,
  isError,
  hasMore,
  loadMore,
  refresh,
} = usePaginatedQuery(
  useGetArticlesQuery,
  {
    ...(selectedCategoryId ? { categoryId: selectedCategoryId } : {}),
    lang
  },
  {
    pageSize: PAGE_SIZE,
    selectItems: (data) => data.items,
    selectTotalPages: (data) => data.totalPages,
  },
);

// Simplified handlers:
const handleLoadMore = useCallback(() => {
  if (!isFetching && hasMore) loadMore();
}, [isFetching, hasMore, loadMore]);

const onRefresh = useCallback(() => {
  refresh();
}, [refresh]);

const renderFooter = () => {
  if (!isFetching) return null;
  return <ActivityIndicator />;
};
```

### 2. `src/screens/ArticleListScreen.tsx`

Same pattern as HomeScreen.

**Replace:**

- Remove `allArticles`, `page`, accumulation useEffect
- Replace with `usePaginatedQuery(useGetArticlesQuery, { ...params }, { selectItems, selectTotalPages })`

### 3. `src/screens/TagArticlesScreen.tsx`

**Replace:**

- Remove `allArticles`, `page`, accumulation useEffect
- Replace with `usePaginatedQuery(useGetTagBySlugQuery, { slug: tagSlug, lang }, { selectItems: (data) => data.articles.items, selectTotalPages: (data) => data.articles.totalPages })`

### 4. `src/screens/CategoryArticlesScreen.tsx`

**Replace:**

- Remove `allArticles`, `page`, accumulation useEffect
- Replace with `usePaginatedQuery(useGetCategoryBySlugQuery, { slug: categorySlug, lang }, { selectItems: (data) => data.articles.items, selectTotalPages: (data) => data.articles.totalPages })`

## Migration Steps

| Step | Action                                          | Risk                                                         |
| ---- | ----------------------------------------------- | ------------------------------------------------------------ |
| 1    | Create `src/lib/hooks/usePaginatedQuery.ts`     | Low — new file                                               |
| 2    | Update `HomeScreen.tsx`                         | High — complex screen with category filter, scroll, prefetch |
| 3    | Update `ArticleListScreen.tsx`                  | Medium — sort option adds complexity                         |
| 4    | Update `TagArticlesScreen.tsx`                  | Medium — verify with useGetTagBySlugQuery                    |
| 5    | Update `CategoryArticlesScreen.tsx`             | Medium — verify with useGetCategoryBySlugQuery               |
| 6    | Run `npx tsc --noEmit`                          | —                                                            |
| 7    | QA: scroll, load more, refresh on all 4 screens | High                                                         |

## Dependency

Existing hook at [`src/lib/hooks/useVideoPlayback.ts`](src/lib/hooks/useVideoPlayback.ts) — new hook follows same pattern and directory structure.

## TypeScript Notes

- Generic `<TData, TItem>` allows the hook to work with any RTK Query hook regardless of response shape
- `selectItems` and `selectTotalPages` handle the different data paths (direct vs nested)
- `any` casts on `item.id` are safe because all FrontendArticle items have an `id: string` field
