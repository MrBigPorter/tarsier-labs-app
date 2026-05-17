# Pagination Accumulation Fix Plan

## Bug Analysis

The HomeScreen's scroll-breaking bug is caused by **article data replacement on page change**.

### Current broken flow

```
User sees articles [1-10] (page=1)
  ↓ Scroll to bottom → onEndReached fires
  ↓ setPage(2)
  ↓ useGetArticlesQuery({page: 2, pageSize: 10}) → new cache key
  ↓ articlesData now contains ONLY items [11-20]
  ↓ FlatList data=[11-20] replaces [1-10] ← CONTENT SHIFT!
  ↓ Scroll position invalid → feels "stuck", can't scroll back
```

### Root cause

[`HomeScreen.tsx:69`](src/screens/HomeScreen.tsx:69) uses `articles = articlesData?.items || []` directly. When `page` changes, `useGetArticlesQuery` creates a new cache key, fetches only the new page's data, and returns it — **replacing** the previous page's articles instead of appending.

### All affected screens

| Screen | Data source | Accumulation? | Status |
|--------|------------|---------------|--------|
| [`HomeScreen`](src/screens/HomeScreen.tsx:69) | `articles = articlesData?.items` | ❌ No | **Fix needed** |
| [`CategoryArticlesScreen`](src/screens/CategoryArticlesScreen.tsx:53) | `articles = categoryData?.articles?.items` | ❌ No | **Fix needed** |
| [`TagArticlesScreen`](src/screens/TagArticlesScreen.tsx:49) | `articles = tagData?.articles?.items` | ❌ No | **Fix needed** |
| [`ArticleListScreen`](src/screens/ArticleListScreen.tsx:56-82) | `allArticles` via useEffect | ✅ Yes | Reference pattern |
| [`BookmarksScreen`](src/screens/BookmarksScreen.tsx:79-97) | `allArticles` with dedup | ✅ Yes | Reference pattern |

---

## Fix Strategy

Apply the same accumulation pattern used in [`ArticleListScreen.tsx`](src/screens/ArticleListScreen.tsx:74-82) to all 3 broken screens:

### Pattern (from ArticleListScreen)

```typescript
// 1. Add accumulation state
const [allArticles, setAllArticles] = useState<FrontendArticle[]>([]);

// 2. Accumulate articles when data changes
React.useEffect(() => {
  if (data?.items) {
    if (page === 1) {
      setAllArticles(data.items);       // Replace on fresh load
    } else {
      setAllArticles(prev => [...prev, ...data.items]);  // Append on load more
    }
  }
}, [data, page]);

// 3. Use accumulated data in FlatList
<FlatList data={allArticles} ... />

// 4. Clear on refresh
const handleRefresh = () => {
  setPage(1);
  setAllArticles([]);
  refetch();
};
```

---

## Detailed Changes

### 1. [`HomeScreen.tsx`](src/screens/HomeScreen.tsx)

**Add state** (after line 52):
```typescript
const [allArticles, setAllArticles] = useState<FrontendArticle[]>([]);
```

**Add accumulation useEffect** (after `hasMore` line 71):
```typescript
React.useEffect(() => {
  if (articlesData?.items) {
    if (page === 1) {
      setAllArticles(articlesData.items);
    } else {
      setAllArticles(prev => [...prev, ...articlesData.items]);
    }
  }
}, [articlesData, page]);
```

**Change FlatList** (line 202):
```typescript
data={allArticles}   // was: data={articles}
```

**Update renderEmpty** (line 155, 169):
- Line 155: `if (isError && !articles.length)` → `if (isError && !allArticles.length)`
- Line 169: `if (!articles.length)` → `if (!allArticles.length)`

**Update onRefresh** (line 109-114):
```typescript
const onRefresh = useCallback(async () => {
  setRefreshing(true);
  setPage(1);
  setAllArticles([]);
  await refetch();
  setRefreshing(false);
}, [refetch]);
```

**Update contentContainerStyle** (line 222):
```typescript
allArticles.length === 0 && styles.emptyList,   // was: articles.length === 0
```

**Remove unused `articles` variable** (line 69) — keep `totalPages` and `hasMore`.

### 2. [`CategoryArticlesScreen.tsx`](src/screens/CategoryArticlesScreen.tsx)

**Add state** (after line 39):
```typescript
const [allArticles, setAllArticles] = useState<FrontendArticle[]>([]);
```

**Add accumulation useEffect** (after line 55):
```typescript
React.useEffect(() => {
  if (categoryData?.articles?.items) {
    if (page === 1) {
      setAllArticles(categoryData.articles.items);
    } else {
      setAllArticles(prev => [...prev, ...categoryData.articles.items]);
    }
  }
}, [categoryData, page]);
```

**Change FlatList** (line 178):
```typescript
data={allArticles}   // was: data={articles}
```

**Update renderListHeader visibility** (line 186):
```typescript
ListHeaderComponent={allArticles.length > 0 ? renderListHeader : null}
```

**Update handleRefresh** (line 89-92):
```typescript
const handleRefresh = useCallback(() => {
  setPage(1);
  setAllArticles([]);
  refetch();
}, [refetch]);
```

**Remove unused `articles` variable** (line 53) — keep `totalPages` and `hasMore`.

### 3. [`TagArticlesScreen.tsx`](src/screens/TagArticlesScreen.tsx)

**Add state** (after line 39):
```typescript
const [allArticles, setAllArticles] = useState<FrontendArticle[]>([]);
```

**Add accumulation useEffect** (after line 51):
```typescript
React.useEffect(() => {
  if (tagData?.articles?.items) {
    if (page === 1) {
      setAllArticles(tagData.articles.items);
    } else {
      setAllArticles(prev => [...prev, ...tagData.articles.items]);
    }
  }
}, [tagData, page]);
```

**Change FlatList** (line 154):
```typescript
data={allArticles}   // was: data={articles}
```

**Update renderListHeader visibility** (line 162):
```typescript
ListHeaderComponent={allArticles.length > 0 ? renderListHeader : null}
```

**Update handleRefresh** (line 81-84):
```typescript
const handleRefresh = useCallback(() => {
  setPage(1);
  setAllArticles([]);
  refetch();
}, [refetch]);
```

**Remove unused `articles` variable** (line 49) — keep `totalPages` and `hasMore`.

---

## Execution Order

1. Fix [`HomeScreen.tsx`](src/screens/HomeScreen.tsx) — primary user-reported bug
2. Fix [`CategoryArticlesScreen.tsx`](src/screens/CategoryArticlesScreen.tsx) — same pattern, preventive
3. Fix [`TagArticlesScreen.tsx`](src/screens/TagArticlesScreen.tsx) — same pattern, preventive
4. Run `npx tsc --noEmit` to verify type safety
