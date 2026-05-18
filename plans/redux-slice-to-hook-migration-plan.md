# Redux Slice → Custom Hook Migration Plan

## Problem Statement

The app currently uses **Redux slices** (`bookmarksSlice`, `likesSlice`) to manage optimistic UI state for bookmark and like toggles. This adds unnecessary boilerplate and architectural complexity now that RTK Query handles all API calls. As you noted: _"都用RTK了，为什么页面还大量使用state,你看ahooks都不需要管理state"_ — RTK Query already fetches and caches data; the optimistic state can be managed in a custom hook without Redux.

## Current Architecture (3 Layers)

```
┌─────────────────────────────────────────────────────┐
│  Layer 1: RTK Query (API)                            │
│  - src/api/endpoints/bookmarks.ts                    │
│  - src/api/endpoints/likes.ts                        │
│  - Handles add/remove/fetch server-side              │
├─────────────────────────────────────────────────────┤
│  Layer 2: Redux Slices (Optimistic State)            │
│  - src/store/slices/bookmarksSlice.ts                │
│  - src/store/slices/likesSlice.ts                    │
│  - Stores bookmarkedIds / likedIds                   │
│  - Persists to MMKV via storage.set/get              │
├─────────────────────────────────────────────────────┤
│  Layer 3: Components (Consumers)                     │
│  - HomeScreen: useAppSelector + useAppDispatch       │
│  - ArticleDetailScreen: useAppSelector + useAppDispatch│
│  - clearAppCache: store.dispatch(clearCache)          │
└─────────────────────────────────────────────────────┘
```

## Target Architecture (1 Layer — Custom Hooks)

```
┌─────────────────────────────────────────────────────┐
│  Custom Hooks                                        │
│  - useBookmark(articleId)                             │
│  - useLike(articleId)                                 │
│  - Internal: useState (optimistic)                    │
│  - Internal: RTK Query mutations (server sync)       │
│  - Internal: MMKV (persistence)                      │
│  - Expose: { isBookmarked, toggleBookmark }          │
├─────────────────────────────────────────────────────┤
│  Components (Simpler)                                │
│  - HomeScreen: const { isBookmarked, toggle } =      │
│                  useBookmark(item.id)                │
│  - ArticleDetailScreen: same pattern                 │
└─────────────────────────────────────────────────────┘
```

## Files to Delete

| File                                 | Reason                                |
| ------------------------------------ | ------------------------------------- |
| `src/store/slices/bookmarksSlice.ts` | All logic moves to `useBookmark` hook |
| `src/store/slices/likesSlice.ts`     | All logic moves to `useLike` hook     |

## Files to Create

### 1. `src/lib/hooks/useBookmark.ts`

New custom hook that encapsulates everything for bookmark optimistic state:

```typescript
interface UseBookmarkResult {
  isBookmarked: boolean;
  toggleBookmark: () => void;
}

function useBookmark(articleId: string): UseBookmarkResult;
```

**Internal behavior:**

- `useState<boolean>` — local optimistic state, initialized from MMKV
- `useAddBookmarkMutation()` / `useRemoveBookmarkMutation()` — RTK Query mutations for server sync
- `useEffect` to sync local state when `articleId` changes
- On `toggleBookmark`: 1) toggle local `useState` 2) call RTK mutation 3) on error, rollback local state
- MMKV read/write for persistence across app restarts (key: `'bookmark_ids'`)
- **Rollback on mutation failure** — revert optimistic state to previous value
- **Singleton MMKV key** — all `useBookmark` instances share the same MMKV key (`'bookmark_ids'`), so one component toggling a bookmark is visible to all others

### 2. `src/lib/hooks/useLike.ts`

Same pattern as `useBookmark` but for likes:

```typescript
interface UseLikeResult {
  isLiked: boolean;
  toggleLike: () => void;
}

function useLike(articleId: string): UseLikeResult;
```

**Internal behavior:**

- Same pattern as `useBookmark`
- Persists to MMKV key: `'liked_ids'`
- Uses `useLikeArticleMutation()` / `useUnlikeArticleMutation()` from `@/api/endpoints/likes`

### 3. `src/lib/hooks/index.ts` (optional)

Barrel export for convenience:

```typescript
export { useBookmark } from './useBookmark';
export { useLike } from './useLike';
```

## Files to Modify

### 1. `src/store/index.ts`

**Changes:**

- Remove import of `bookmarksReducer` (line 5)
- Remove import of `likesReducer` (line 6)
- Remove `bookmarks: bookmarksReducer` from `rootReducer` (line 12)
- Remove `likes: likesReducer` from `rootReducer` (line 13)

### 2. `src/screens/HomeScreen.tsx`

**Before:**

```typescript
import { toggleBookmarkOptimistic } from '@/store/slices/bookmarksSlice';
// ...
const dispatch = useAppDispatch();
const bookmarkedIds = useAppSelector(state => state.bookmarks.bookmarkedIds);
// ...
const handleBookmark = useCallback((article: FrontendArticle) => {
  const newIsBookmarked = !bookmarkedIds[article.id];
  dispatch(toggleBookmarkOptimistic(article.id));
  if (newIsBookmarked) {
    addBookmark({ articleId: article.id }).catch(() => {
      dispatch(toggleBookmarkOptimistic(article.id));
    });
  } else {
    removeBookmark({ articleId: article.id }).catch(() => {
      dispatch(toggleBookmarkOptimistic(article.id));
    });
  }
}, [dispatch, bookmarkedIds, addBookmark, removeBookmark]);
// ...
<ArticleCard
  onBookmark={handleBookmark}
  isBookmarked={!!bookmarkedIds[item.id]}
/>
```

**After:**

```typescript
import { useBookmark } from '@/lib/hooks/useBookmark';
// ...
// Remove: dispatch, bookmarkedIds, useAppSelector for bookmarks
// Remove: handleBookmark callback entirely
// Remove: addBookmark, removeBookmark mutation hooks
// Each item in FlatList uses its own useBookmark hook:
<ArticleCard
  onBookmark={(article) => {
    const { toggleBookmark } = useBookmark(article.id); // Can't use hook in callback
  }}
  isBookmarked={/* need per-item access */}
/>
```

**Important consideration:** Since `ArticleCard` renders items in a `FlatList` `renderItem` callback, hooks can't be called there. The solution is to either:

**Option A (Recommended):** Create a wrapper component `<BookmarkableArticleCard>` that calls `useBookmark` internally:

```typescript
const BookmarkableArticleCard: React.FC<{
  article: FrontendArticle;
  onPress: (article: FrontendArticle) => void;
  showExcerpt?: boolean;
  networkQuality?: NetworkQuality;
  priority?: boolean;
}> = ({ article, ...rest }) => {
  const { isBookmarked, toggleBookmark } = useBookmark(article.id);
  return (
    <ArticleCard
      article={article}
      onBookmark={() => toggleBookmark()}
      isBookmarked={isBookmarked}
      {...rest}
    />
  );
};
```

**Option B:** Pass `articleId` to `ArticleCard` and let it call `useBookmark` internally. This requires modifying `ArticleCard` to accept `articleId` and call the hook, plus calling `onBookmark` from inside `ArticleCard` with the hook's toggle function.

**Note:** Remove `import { useAddBookmarkMutation, useRemoveBookmarkMutation }` from HomeScreen since mutations are now inside `useBookmark` hook.

### 3. `src/screens/ArticleDetailScreen.tsx`

**Before:**

```typescript
import { toggleBookmarkOptimistic } from '@/store/slices/bookmarksSlice';
import { toggleLikeOptimistic } from '@/store/slices/likesSlice';
// ...
const dispatch = useAppDispatch();
const bookmarkedIds = useAppSelector(state => state.bookmarks.bookmarkedIds);
const likedIds = useAppSelector(state => state.likes.likedIds);
const [isBookmarked, setIsBookmarked] = useState(
  article ? !!bookmarkedIds[article.id] : false,
);
const [isLiked, setIsLiked] = useState(
  article ? !!likedIds[article.id] : false,
);
const [addBookmark] = useAddBookmarkMutation();
const [removeBookmark] = useRemoveBookmarkMutation();
const [likeArticle] = useLikeArticleMutation();
const [unlikeArticle] = useUnlikeArticleMutation();
// + effects to sync, + handlers with rollback
```

**After:**

```typescript
import { useBookmark } from '@/lib/hooks/useBookmark';
import { useLike } from '@/lib/hooks/useLike';
// ...
const { isBookmarked, toggleBookmark } = useBookmark(article?.id ?? '');
const { isLiked, toggleLike } = useLike(article?.id ?? '');
// Remove: dispatch, bookmarkedIds, likedIds, all useAppSelector for bookmarks/likes
// Remove: setIsBookmarked, setIsLiked useState
// Remove: bookmark sync useEffect, like sync useEffect
// Remove: handleBookmark callback, handleLike callback
// Remove: useAddBookmarkMutation, useRemoveBookmarkMutation
// Remove: useLikeArticleMutation, useUnlikeArticleMutation
// Remove: toggleBookmarkOptimistic import, toggleLikeOptimistic import
// JSX: use isBookmarked / toggleBookmark directly
```

**Edge case:** `article?.id` could be `''` (empty string) while article is loading. The hook should handle empty `articleId` gracefully (return `isBookmarked: false`, `toggleBookmark: noop`).

### 4. `src/lib/cache/clearAppCache.ts`

**Before (line 89-94):**

```typescript
// ── 3. Redux bookmarks cache ─────────────────────────────────
try {
  store.dispatch(clearCache());
} catch (error) {
  console.warn('[clearAppCache] Redux cache clear failed:', error);
}
```

**After:**

```typescript
// ── 3. Clear bookmark/like MMKV cache ────────────────────────
try {
  storage.delete('bookmark_ids');
  storage.delete('liked_ids');
} catch (error) {
  console.warn('[clearAppCache] Bookmark/like cache clear failed:', error);
}
```

**Note:** Remove `import { clearCache } from '@/store/slices/bookmarksSlice'` from this file (it may be using `store.dispatch` directly, so check the actual import).

## Migration Steps (Ordered)

| Step | Action                                                                           | Risk                                                                    |
| ---- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 1    | Create `src/lib/hooks/useBookmark.ts`                                            | Low — new file, no breaking changes                                     |
| 2    | Create `src/lib/hooks/useLike.ts`                                                | Low — new file, no breaking changes                                     |
| 3    | Update `src/screens/ArticleDetailScreen.tsx` to use `useBookmark` + `useLike`    | Medium — component behavior changes; verify bookmark toggle still works |
| 4    | Update `src/screens/HomeScreen.tsx` to use `useBookmark` (via wrapper component) | Medium — FlatList renderItem pattern change; verify scroll performance  |
| 5    | Update `src/lib/cache/clearAppCache.ts` to use `storage.delete` directly         | Low — straight replacement                                              |
| 6    | Delete `src/store/slices/bookmarksSlice.ts`                                      | Low — no more imports                                                   |
| 7    | Delete `src/store/slices/likesSlice.ts`                                          | Low — no more imports                                                   |
| 8    | Update `src/store/index.ts` — remove reducer imports + registration              | Low — verify store compiles                                             |
| 9    | Run `npx tsc --noEmit` to verify no TypeScript errors                            | —                                                                       |
| 10   | Run full test suite and manual QA on bookmark/like toggle                        | High — verify optimistic + rollback still works                         |

## Risk Assessment

| Risk                                                        | Impact | Likelihood | Mitigation                                                                                              |
| ----------------------------------------------------------- | ------ | ---------- | ------------------------------------------------------------------------------------------------------- |
| Race condition: rapid toggles cause wrong optimistic state  | Medium | Low        | Use ref to track previous state value before toggle; ignore mutation results for out-of-order responses |
| MMKV read/write perf on rapid toggles                       | Low    | Low        | Debounce MMKV writes (use `useRef` + `setTimeout` to batch writes)                                      |
| FlatList re-render perf with per-item `useBookmark` hook    | Medium | Medium     | Wrap `<BookmarkableArticleCard>` in `React.memo`; use `useCallback` for toggle function                 |
| `article?.id` changes mid-lifecycle (e.g., language switch) | Medium | Low        | Hook resets state when `articleId` changes (handle in `useEffect` cleanup)                              |
| Bookmark/like state not synced across tabs                  | Low    | Low        | All `useBookmark` instances share the same MMKV key; use `useMMKVStorage` or re-read from MMKV on focus |

## Hook Implementation Detail

```typescript
// src/lib/hooks/useBookmark.ts

import { useState, useCallback, useRef, useEffect } from 'react';
import { storage } from '@/lib/storage';
import {
  useAddBookmarkMutation,
  useRemoveBookmarkMutation,
} from '@/api/endpoints/bookmarks';

const BOOKMARK_IDS_KEY = 'bookmark_ids';

function loadBookmarkIds(): Record<string, boolean> {
  try {
    const raw = storage.getString(BOOKMARK_IDS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function persistBookmarkIds(ids: Record<string, boolean>) {
  storage.set(BOOKMARK_IDS_KEY, JSON.stringify(ids));
}

export function useBookmark(articleId: string) {
  const [addBookmark] = useAddBookmarkMutation();
  const [removeBookmark] = useRemoveBookmarkMutation();

  // Initialize from MMKV
  const [isBookmarked, setIsBookmarked] = useState(() => {
    if (!articleId) return false;
    const ids = loadBookmarkIds();
    return !!ids[articleId];
  });

  // Track previous articleId for cleanup
  const prevIdRef = useRef(articleId);

  // Sync state when articleId changes (e.g., navigating between articles)
  useEffect(() => {
    if (prevIdRef.current !== articleId) {
      prevIdRef.current = articleId;
      if (articleId) {
        const ids = loadBookmarkIds();
        setIsBookmarked(!!ids[articleId]);
      } else {
        setIsBookmarked(false);
      }
    }
  }, [articleId]);

  // Track previous state for rollback
  const prevStateRef = useRef(isBookmarked);
  prevStateRef.current = isBookmarked;

  const toggleBookmark = useCallback(() => {
    if (!articleId) return;

    const newState = !prevStateRef.current;
    setIsBookmarked(newState);

    // Persist to MMKV
    const ids = loadBookmarkIds();
    if (newState) {
      ids[articleId] = true;
    } else {
      delete ids[articleId];
    }
    persistBookmarkIds(ids);

    // Sync to server
    const mutation = newState
      ? addBookmark({ articleId })
      : removeBookmark({ articleId });

    mutation.unwrap().catch(() => {
      // Rollback on failure
      const rollbackState = !newState;
      setIsBookmarked(rollbackState);
      const rollbackIds = loadBookmarkIds();
      if (rollbackState) {
        rollbackIds[articleId] = true;
      } else {
        delete rollbackIds[articleId];
      }
      persistBookmarkIds(rollbackIds);
    });
  }, [articleId, addBookmark, removeBookmark]);

  return { isBookmarked, toggleBookmark };
}
```

## Verification Checklist

- [ ] Tapping bookmark star on HomeScreen instantly toggles icon
- [ ] Tapping bookmark star on ArticleDetailScreen instantly toggles icon
- [ ] Tapping like heart on ArticleDetailScreen instantly toggles icon
- [ ] After page refresh/reload, bookmark states persist from MMKV
- [ ] After page refresh/reload, like states persist from MMKV
- [ ] Offline toggle still works (optimistic from MMKV)
- [ ] Toggling bookmark on HomeScreen reflects on ArticleDetailScreen for same article
- [ ] `npx tsc --noEmit` passes with no errors
- [ ] No Redux-related warnings in Metro console
