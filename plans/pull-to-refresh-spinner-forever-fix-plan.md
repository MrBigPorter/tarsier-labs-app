# Pull-to-Refresh Spinner Never Disappears — Fix Plan

## Bug Description

After scrolling down several pages (loading pages 2, 3, 4...) in a paginated list, returning to the top, and pulling to refresh, the loading spinner never goes away.

## Root Cause

### Primary issue: `usePaginatedQuery.refresh()` refetches the wrong page

In [`usePaginatedQuery.ts`](../../src/lib/hooks/usePaginatedQuery.ts:171-175):

```ts
const refresh = useCallback(() => {
  setPage(1); // Queued — not applied yet
  setAllItems([]); // Queued — not applied yet
  refetch(); // Refetches CURRENT page (e.g., page 4), NOT page 1!
}, [refetch]);
```

**Execution trace when on page 4:**

1. User pulls to refresh → `onRefresh()` fires
2. `setIsManualRefreshing(true)` → `isManualRefreshing = true`
3. `refresh()` is called:
   - `setPage(1)` — queued async
   - `setAllItems([])` — queued async
   - `refetch()` — refetches **page 4** (because `effectivePage` is still 4 in this render)
4. React re-renders with `page=1`, `effectivePage=1`
5. `useGetArticlesQuery({..., page:1})` is called
6. **If page 1 is cached**, RTK Query returns cached data with `isFetching: false` immediately
7. The auto-clear effect runs:
   ```ts
   if (prevIsFetchingRef.current && !isFetching) {
     setIsManualRefreshing(false);
   }
   ```

   - `prevIsFetchingRef.current` was `false` (before refresh)
   - `isFetching` is `false` (cached page 1)
   - Condition `true → false` is **NOT met** → `setIsManualRefreshing(false)` is **never called**
8. `isManualRefreshing` stays `true` forever → RefreshControl spinner never hides

### Secondary issue: data is stale

Even if the spinner went away, the displayed data is the **stale cached** page 1 data, not freshly fetched data from the server. The `refetch()` on page 4 completes in the background but nobody is subscribed to it.

### Same pattern in other screens

All screens with pull-to-refresh + pagination have the same bug pattern:

| Screen                   | Refreshing Prop                   | Handle Refresh                              | Bug                             |
| ------------------------ | --------------------------------- | ------------------------------------------- | ------------------------------- |
| `HomeScreen`             | `isManualRefreshing`              | `setIsManualRefreshing(true); refresh()`    | Spinner stays forever           |
| `ArticleListScreen`      | `isFetching && page === 1`        | `setPage(1); setAllArticles([]); refetch()` | Spinner may flicker or not show |
| `CategoryArticlesScreen` | `isFetching && page === 1`        | `setPage(1); setAllArticles([]); refetch()` | Same                            |
| `TagArticlesScreen`      | `isFetching && page === 1`        | `setPage(1); setAllArticles([]); refetch()` | Same                            |
| `BookmarksScreen`        | `isFetching && currentPage === 1` | `setCurrentPage(1); refetch()`              | Same                            |

## Fix Strategy: `refreshKey` Pattern

Instead of calling `refetch()` on the wrong page, introduce a `refreshKey` state counter that:

1. Increments on each `refresh()` call
2. Is included as a query parameter (`_refreshKey`)
3. Forces RTK Query to treat it as a **new cache key**, guaranteeing a fresh server fetch
4. Ensures `isFetching` properly transitions `false → true → false` for the NEW page 1 query

### Key insight

RTK Query creates cache entries based on the full query parameter object. By adding `_refreshKey` (an incrementing integer), each refresh produces a unique cache key that:

- Never hits the stale cache
- Always fetches fresh data from the server
- Properly sets `isFetching = true` during the fetch
- Sets `isFetching = false` when the fetch completes
- Allows the auto-clear effect or `refreshing` prop binding to work correctly

### Why this is safe

The `_refreshKey` parameter is sent as a query string parameter to the API. Since it's not a recognized API parameter, the server will simply ignore it. This is a common RTK Query pattern for cache busting.

---

## Changes Required

### 1. `usePaginatedQuery.ts` — Fix the `refresh` function

**File:** `src/lib/hooks/usePaginatedQuery.ts`

**Changes:**

- Add `refreshKey` state initialized to `0`
- Modify `refresh()` to increment `refreshKey` instead of calling `refetch()`
- Include `_refreshKey` in the query params passed to `useQueryHook`

```diff
+ const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setPage(1);
    setAllItems([]);
-   refetch();
+   setRefreshKey(k => k + 1);
- }, [refetch]);
+ }, []);
```

And in the query hook call:

```diff
  const { data, isLoading, isFetching, isError, error, refetch } = useQueryHook(
-   { ...params, page: effectivePage, pageSize },
+   { ...params, page: effectivePage, pageSize, _refreshKey: refreshKey },
  );
```

**Impact:** Fixes `HomeScreen` (the primary reported issue). Also ensures fresh data is always fetched on refresh.

### 2. `ArticleListScreen.tsx` — Add `refreshKey` pattern

**File:** `src/screens/ArticleListScreen.tsx`

**Changes:**

- Add `refreshKey` state
- Modify `handleRefresh` to increment `refreshKey` instead of calling `refetch()`
- Include `_refreshKey` in the query params

```diff
+ const [refreshKey, setRefreshKey] = useState(0);

  const { data, isLoading, isFetching, isError, error, refetch } =
    useGetArticlesQuery({
      page,
      pageSize: PAGE_SIZE,
      categoryId: categorySlug,
      tagId: tagSlug,
      lang,
+     _refreshKey: refreshKey,
    });

  const handleRefresh = useCallback(() => {
    setPage(1);
    setAllArticles([]);
-   refetch();
+   setRefreshKey(k => k + 1);
- }, [refetch]);
+ }, []);
```

### 3. `CategoryArticlesScreen.tsx` — Add `refreshKey` pattern

**File:** `src/screens/CategoryArticlesScreen.tsx`

**Changes:** Same pattern as `ArticleListScreen`:

- Add `refreshKey` state
- Replace `refetch()` call in `handleRefresh` with `setRefreshKey(k => k + 1)`
- Add `_refreshKey` to query params

```diff
+ const [refreshKey, setRefreshKey] = useState(0);

  const {
    data: categoryData,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useGetCategoryBySlugQuery({
    slug: categorySlug,
    page,
    pageSize: 15,
    lang,
+   _refreshKey: refreshKey,
  });

  const handleRefresh = useCallback(() => {
    setPage(1);
    setAllArticles([]);
-   refetch();
+   setRefreshKey(k => k + 1);
- }, [refetch]);
+ }, []);
```

### 4. `TagArticlesScreen.tsx` — Add `refreshKey` pattern

**File:** `src/screens/TagArticlesScreen.tsx`

**Changes:** Same pattern — add `refreshKey`, replace `refetch()` in `handleRefresh`, add `_refreshKey` to query params.

### 5. `BookmarksScreen.tsx` — Add `refreshKey` pattern

**File:** `src/screens/BookmarksScreen.tsx`

**Changes:** Same pattern — add `refreshKey`, replace `refetch()` in `handleRefresh`, add `_refreshKey` to query params.

---

## Verification Checklist

- [ ] HomeScreen: scroll down 4+ pages → scroll to top → pull to refresh → spinner shows and hides when data arrives
- [ ] HomeScreen: refresh with cached page 1 still shows spinning until server responds
- [ ] ArticleListScreen: same test
- [ ] CategoryArticlesScreen: same test
- [ ] TagArticlesScreen: same test
- [ ] BookmarksScreen: same test (requires auth)
- [ ] Language switch still resets and refreshes correctly
- [ ] Category filter change still resets and refreshes correctly
- [ ] Infinite scroll (load more) still works correctly
- [ ] No extra `_refreshKey` query param visible in API logs (server should ignore it)
