# Homepage Image Flickering Fix Plan

## Root Cause Analysis

The flickering is caused by **prop reference instability** flowing from RTK Query → HomeScreen → FlatList → ArticleCard → AppImage → React Native Image.

### Chain of events:

1. **RTK Query refetches data** (on screen focus, cache invalidation, etc.) — returns new object references even when content is identical
2. **`displayArticles` useMemo** (`[articlesData, page, allArticles]`) returns a new array reference because `articlesData.items` is a new array
3. **FlatList receives new `data` prop** — re-renders visible items
4. **Each ArticleCard gets a new `article` prop** (new object from new array) — re-renders
5. **AppImage gets new `images`/`coverImage` prop references** — `resolvedUrl` useMemo re-computes
6. **`source={{ uri: optimizedUrl }}` creates a NEW object literal on every render** — React Native's Image detects a new source object and re-enters loading state, causing a visible flash

The core problem is that `source={{ uri: optimizedUrl }}` creates a new anonymous object on every render, and RN's Image treats any new source object as a potential new image to load, even if the URI string is identical.

## Fix Plan

### Fix 1: Memoize `imageSource` in AppImage (HIGHEST IMPACT)

**File:** [`src/components/core/AppImage.tsx`](src/components/core/AppImage.tsx:119)

Replace `source={{ uri: optimizedUrl }}` with a memoized source object:

```tsx
// Before line 125 (after optimizedUrl useMemo)
const imageSource = React.useMemo(() => {
  if (!optimizedUrl) return null;
  return { uri: optimizedUrl };
}, [optimizedUrl]);
```

Then use it in the Image component:

```tsx
// Line 196-208
<Image
  source={imageSource}
  ...
/>
```

**Why this works:** `source={{ uri: optimizedUrl }}` creates a new `{ uri: string }` object on every render of AppImage. Even when `optimizedUrl` string is identical, the wrapper object is new. React Native's Image component compares source objects by reference — a new object reference triggers a re-load. By memoizing with `useMemo`, we return the same object reference when the URI hasn't changed, preventing the re-load flash.

### Fix 2: Wrap AppImage with React.memo

**File:** [`src/components/core/AppImage.tsx`](src/components/core/AppImage.tsx:89)

Wrap the export:

```tsx
export const AppImage = React.memo(function AppImage({...}: AppImageProps) {
```

**Why this works:** Prevents AppImage from re-rendering when parent (ArticleCard) re-renders but AppImage's props haven't changed (by value). Since `images`, `coverImage`, and `blurhash` come from RTK Query responses with new references, we need to ensure the memo comparison handles this. We'll use a custom comparator or rely on the default shallow comparison which will work once Fix 3 is applied.

**Note:** This alone won't fully solve the issue because props ARE new references. But combined with Fix 3 (React.memo on ArticleCard), it provides defense-in-depth.

### Fix 3: Wrap ArticleCard with React.memo

**File:** [`src/components/blog/ArticleCard.tsx`](src/components/blog/ArticleCard.tsx:64)

```tsx
export const ArticleCard = React.memo(function ArticleCard({...}: ArticleCardProps) {
```

**Why this works:** ArticleCard receives `article` as a prop. When `displayArticles` changes reference, the `item` passed to `renderArticleItem` is a new object. React.memo's default shallow comparison will detect this and still re-render. However, it provides a clear boundary for future optimization, and combined with stable references from Fix 4, can be optimized further.

### Fix 4: Stabilize `displayArticles` reference in HomeScreen

**File:** [`src/screens/HomeScreen.tsx`](src/screens/HomeScreen.tsx:162)

Add a deep comparison to only create a new array when data actually changes. Since articles have UUIDs, we can compare by ID:

```tsx
const displayArticles = React.useMemo<FrontendArticle[]>(() => {
    if (page === 1 && articlesData?.items) {
      return articlesData.items;
    }
    return allArticles;
}, [articlesData, page, allArticles]);
```

Change to compare by article IDs:

```tsx
const articlesDataItems = articlesData?.items;
const displayArticles = React.useMemo<FrontendArticle[]>(() => {
    if (page === 1 && articlesDataItems) {
      return articlesDataItems;
    }
    return allArticles;
    // eslint-disable-next-line react-hooks/exhaustive-deps
}, [
    articlesDataItems?.length,
    articlesDataItems?.[0]?.id,
    articlesDataItems?.[articlesDataItems.length - 1]?.id,
    page,
    allArticles,
]);
```

Actually, a simpler approach is to add a comparison in the existing `useEffect` that syncs `allArticles`:

```tsx
useEffect(() => {
    if (articlesData?.items) {
      if (page === 1) {
        // Already handled by returning articlesData.items directly
        // but we should still update allArticles for consistency
        setAllArticles(prev => {
          if (prev.length === articlesData.items.length &&
              prev[0]?.id === articlesData.items[0]?.id) {
            return prev; // Same data, keep reference
          }
          return articlesData.items;
        });
      }
```

The `setAllArticles` identity check already preserves the reference for `allArticles`, but `displayArticles` for page 1 returns `articlesData.items` directly (a new array from RTK Query each time).

**Better approach:** Always use `allArticles` for display, not `articlesData.items` directly. The useEffect already keeps `allArticles` stable.

```tsx
const displayArticles = React.useMemo<FrontendArticle[]>(() => {
    return allArticles;
}, [allArticles]);
```

This way, when RTK Query returns new data but content hasn't changed, `setAllArticles` returns the previous reference (thanks to the identity check), `allArticles` stays stable, `displayArticles` stays stable, and FlatList doesn't re-render.

### Implementation Summary

| # | File | Change | Impact |
|---|------|--------|--------|
| 1 | `src/components/core/AppImage.tsx` | Memoize `imageSource` with `useMemo` | **HIGH** — Prevents RN Image from re-loading |
| 2 | `src/components/core/AppImage.tsx` | Wrap with `React.memo` | MEDIUM — Prevents unnecessary re-render |
| 3 | `src/components/blog/ArticleCard.tsx` | Wrap with `React.memo` | MEDIUM — Prevents unnecessary re-render |
| 4 | `src/screens/HomeScreen.tsx` | Always use `allArticles` for `displayArticles` | **HIGH** — Stabilizes FlatList data prop |

## Execution Order

1. Fix 1 (memoize imageSource in AppImage)
2. Fix 2 (React.memo AppImage)
3. Fix 3 (React.memo ArticleCard)
4. Fix 4 (stabilize displayArticles in HomeScreen)
5. Run TypeScript compilation check
6. Test on device/simulator
