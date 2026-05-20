# ESLint Warnings Fix Plan

## Overview

Fix all `@typescript-eslint/no-unused-vars` and `react-hooks/exhaustive-deps` warnings across 5 files. Each fix is a surgical change — no behavioral impact.

---

## File 1: [`src/screens/CategoryArticlesScreen.tsx`](src/screens/CategoryArticlesScreen.tsx)

### Fix A — Remove unused `TAB_BAR_HEIGHT` import

- **Line:** 24
- **Change:** Delete the line `import { TAB_BAR_HEIGHT } from '@/navigation/RootNavigator';`
- **Reason:** Never referenced in the component. Padding uses `insets.bottom + spacing.xl` instead.

### Fix B — Remove unused `ArticleCardSkeleton` import

- **Lines:** 30–33
- **Change:** Replace the multi-line import block with a single line:
  ```ts
  import { ArticleListSkeleton } from '@/components/core/Skeleton';
  ```
- **Reason:** Only `ArticleListSkeleton` is used in the loading state (line 225).

### Fix C — Add missing `refetch` dependency

- **Line:** 56
- **Change:** `[lang]` → `[lang, refetch]`
- **Reason:** `useEffect` calls `refetch()` on language change but omits it from deps. `refetch` from RTK Query is stable — no re-run side effects.

---

## File 2: [`src/screens/ArticleListScreen.tsx`](src/screens/ArticleListScreen.tsx)

### Fix A — Remove unused `TAB_BAR_HEIGHT` import

- **Line:** 39
- **Change:** Delete the line `import { TAB_BAR_HEIGHT } from '@/navigation/RootNavigator';`
- **Reason:** Never referenced.

### Fix B — Remove unused `sortBy`/`setSortBy` state + `SortOption` type

- **Lines:** 43, 62
- **Change:**
  - Delete line 43: `type SortOption = 'newest' | 'popular' | 'trending';`
  - Delete line 62: `const [sortBy, setSortBy] = useState<SortOption>('newest');`
- **Reason:** Sort functionality was planned but never implemented. State and type are entirely dead code.

### Fix C — Remove unused `error` from query destructuring

- **Line:** 69
- **Change:** `isError, error, refetch` → `isError, refetch`
- **Reason:** `error` is never referenced in the component.

### Fix D — Add missing `refetch` dependency

- **Line:** 95
- **Change:** `[categorySlug, tagSlug, lang]` → `[categorySlug, tagSlug, lang, refetch]`
- **Reason:** `useEffect` calls `refetch()` but omits it from deps. `refetch` is stable — no re-run side effects.

---

## File 3: [`src/screens/BookmarksScreen.tsx`](src/screens/BookmarksScreen.tsx)

### Fix A — Remove unused `TAB_BAR_HEIGHT` import

- **Line:** 32
- **Change:** Delete the line `import { TAB_BAR_HEIGHT } from '@/navigation/RootNavigator';`
- **Reason:** Never referenced.

### Fix B — Remove unused `EmptyState` import

- **Line:** 42
- **Change:** Delete the line `import { EmptyState } from '@/components/core/EmptyState';`
- **Reason:** The component uses `EmptyLogoContent` for its empty states, not `EmptyState`.

### Fix C — Remove unused `BookmarkedArticle` type import

- **Line:** 47
- **Change:** `import type { FrontendArticle, BookmarkedArticle }` → `import type { FrontendArticle }`
- **Reason:** Only `FrontendArticle` is used in the component.

### Fix D — Remove unused `error` and `refetch` from query destructuring

- **Line:** 69
- **Change:** `isFetching, error, refetch` → `isFetching`
- **Reason:** Neither `error` nor `refetch` are used in the component. Refresh uses the `refreshKey` pattern via `handleRefresh`.

### Fix E — Remove unused `handleRemoveBookmark` callback + `removeBookmark` mutation

- **Lines:** 76, 107–112
- **Change:**
  - Delete line 76: `const [removeBookmark] = useRemoveBookmarkMutation();`
  - Delete lines 107–112: the `handleRemoveBookmark` callback
- **Reason:** The bookmark removal feature exists in the API layer but is not wired to any UI. The `ArticleCard` accepts `onBookmark` prop but it's never passed. Dead code that can be restored when swipe-to-delete is implemented.

---

## File 4: [`src/components/blog/ArticleCard.tsx`](src/components/blog/ArticleCard.tsx)

### Fix — Remove unused `networkQuality` computation

- **Lines:** 70–72
- **Current code:**
  ```ts
  // Fallback to internal hook if parent doesn't provide networkQuality
  const internalNetworkQuality = useNetworkQuality();
  const networkQuality = externalNetworkQuality ?? internalNetworkQuality;
  ```
- **Change:** Delete lines 70–72.
- **Reason:** The `networkQuality` variable is computed but never referenced in the render tree. The `useNetworkQuality` hook call is unnecessary overhead. The prop `networkQuality`/`externalNetworkQuality` is kept in the public API for future use.
- **Note:** Also verify that removing code doesn't leave orphaned hooks. The `useNetworkQuality` import (line 30) and `NetworkQuality` type import (line 29) should be checked after the change.

---

## File 5: [`src/lib/hooks/usePaginatedQuery.ts`](src/lib/hooks/usePaginatedQuery.ts)

### Fix — Remove unused `refetch` from query destructuring

- **Line:** 124
- **Change:** `isError, error, refetch` → `isError, error`
- **Reason:** This hook intentionally uses a `refresh()` callback with cache-busting `_refreshKey` instead of `refetch()`. The comment on lines 175–177 explains this: `refetch()` fetched the wrong page during pagination, so `refresh()` was created as a replacement. `refetch` is genuinely dead code.

---

## Execution Order

| Step | File                                     | Changes                                          |
| ---- | ---------------------------------------- | ------------------------------------------------ |
| 1    | `src/screens/BookmarksScreen.tsx`        | 5 changes (most complex file)                    |
| 2    | `src/screens/ArticleListScreen.tsx`      | 4 changes                                        |
| 3    | `src/screens/CategoryArticlesScreen.tsx` | 3 changes                                        |
| 4    | `src/components/blog/ArticleCard.tsx`    | 1 change                                         |
| 5    | `src/lib/hooks/usePaginatedQuery.ts`     | 1 change                                         |
| 6    | —                                        | Run `npx eslint src/ --max-warnings 0` to verify |

## Risk Assessment

All changes are **low risk** — they only remove dead code or add stable references to dependency arrays. No behavioral logic is modified.
