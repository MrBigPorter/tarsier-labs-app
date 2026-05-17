# Tab Flash Fix Plan

## Root Cause

The flash (闪一下) when switching tabs is caused by **unnecessary state updates from identical data**.

### HomeScreen
[`src/screens/HomeScreen.tsx`](src/screens/HomeScreen.tsx:122-135)
```ts
useEffect(() => {
    if (articlesData?.items) {
      if (page === 1) {
        setAllArticles(articlesData.items); // ← ALWAYS runs, even if data is identical
      }
    }
}, [articlesData, page]);
```
When `useFocusEffect` calls `refetch()`, the API returns the same articles (nothing changed). But `articlesData` is a **new object reference**, so the `useEffect` fires and `setAllArticles` replaces the array. This causes FlatList to re-render all items → visible flash.

### TagListScreen
[`src/screens/TagListScreen.tsx`](src/screens/TagListScreen.tsx:120)
```ts
{tags.map((tag, index) => { ... })}
```
`tags` comes directly from `useGetTagsQuery()`. On refetch, even identical data returns a **new array reference**, causing all tag chips to re-render → visible flash.

### CategoryListScreen
Same pattern — `categories` array reference changes on every refetch.

## Fix Strategy: Identity-Based State Guard

### Fix 1: HomeScreen — Add article ID comparison
Replace the unconditional `setAllArticles` with a check: compare IDs of current vs new data. Only update state if the data actually changed.

Add `prevArticleIdsRef` (a `useRef<Set<string> | null>`) to track the last known article IDs.

### Fix 2: TagListScreen — Memoize tags with ID comparison
Add `prevTagIdsRef` to track last known tag IDs. Only update if changed. OR simply remove `useFocusEffect` from TagListScreen since the initial mount fetch is sufficient.

### Fix 3: CategoryListScreen — Same pattern
Add `prevCategoryIdsRef` to track last known category IDs. Only update if changed.

## Alternative Considered (Rejected)

- **useLazyQuery**: Too much refactoring. HomeScreen uses `isFetching` for pagination guard.
- **Remove useFocusEffect entirely**: Fixes flash but loses tab-refetch behavior. User originally wanted API calls on tab click.
- **Stale-time throttle**: Reduces flash frequency but doesn't eliminate it.
