# Runtime Crash Fix Plan

## Root Cause Analysis

After thorough investigation, I've identified the root cause chain of both runtime errors:

### Primary Root Cause: `onQueryStarted` crashes when RTK Query cache is empty

**File**: [`src/api/endpoints/comments.ts`](src/api/endpoints/comments.ts:83)

The `createComment` mutation's `onQueryStarted` calls `updateQueryData` to optimistically insert a temp comment into the cache:

```ts
commentApi.util.updateQueryData(
  'getComments',
  { articleId, page: 1, pageSize: 20 },
  (draft) => {
    draft.items = [tempComment, ...(draft.items || [])];  // 💥 draft is undefined
  },
);
```

**Problem**: `useCommentsInfiniteQuery` ([`src/lib/hooks/useCommentsInfiniteQuery.ts`](src/lib/hooks/useCommentsInfiniteQuery.ts:47)) uses `useLazyGetCommentsQuery` which fetches lazily. When `createComment` is dispatched BEFORE the GET query finishes its first fetch, the cache key `{ articleId, page: 1, pageSize: 20 }` doesn't exist yet. RTK Query creates the entry but initializes `draft` to `undefined`, so `draft.items` throws `TypeError: Cannot read property 'items' of undefined`.

### Secondary Effect: Hooks Order Violation

The `TypeError` thrown during `updateQueryData`'s dispatch corrupts React's fiber tree during error recovery. The corrupted internal state causes React to detect a hooks order violation on the subsequent render attempt — producing `Cannot create property 'current' on boolean 'true'`.

**WDYR** ([`@welldone-software/why-did-you-render`](App.tsx:25)) is active in dev mode and patches React internals, which may exacerbate the corruption during error recovery, but the root cause remains Error 1.

### Tertiary: 404 Errors

The 404 for article ID `cmotio5lh005umi8zi6dl3jh9` is a backend data issue (article doesn't exist on the staging API server), not a code bug.

---

## Fix: Guard optimistic update against empty cache

### File: [`src/api/endpoints/comments.ts`](src/api/endpoints/comments.ts)

Two places need guards:

1. **Line 92** — Initial optimistic insert into cache:
   - Add `if (!draft) return;` at the top of the callback
   - This skips the optimistic update if the cache entry hasn't been created yet

2. **Line 121** — Success handler (replace temp with real):
   - Add `if (!draft?.items) return;` at the top of the callback
   - This skips if the cache was cleared between insert and success

### File: [`src/lib/hooks/useCommentSSE.ts`](src/lib/hooks/useCommentSSE.ts)

The `insertReplyIntoCache` function (line 190) **already has** `if (!draft?.items) return;` — no change needed here.

### No changes needed for:
- `ArticleDetailScreen.tsx` — hooks are all unconditional, no hooks order issue when Error 1 is fixed
- `useCommentsInfiniteQuery.ts` — all hooks are unconditional
- `CommentItem.tsx` — no issue
- `App.tsx` — WDYR is fine, not the root cause

---

## Data Flow: Before vs After Fix

### Before (crash path):
```
User taps Submit
  → createComment() dispatched
  → onQueryStarted fires
    → updateQueryData('getComments', {articleId, page:1, pageSize:20}, draft => {...})
      → draft is undefined (cache key doesn't exist yet)
      → draft.items → 💥 TypeError
        → React error recovery corrupts fiber tree
          → Hooks order violation on next render
            → App crashes
```

### After (safe path):
```
User taps Submit
  → createComment() dispatched
  → onQueryStarted fires
    → updateQueryData('getComments', {articleId, page:1, pageSize:20}, draft => {...})
      → draft is undefined (cache key doesn't exist yet)
      → if (!draft) return; ✅ — gracefully skips optimistic update
  → queryFulfilled resolves (API call succeeds)
    → Success handler also guarded ✅
  → invalidatesTags triggers refetch
    → Comments appear after GET completes
```

---

## Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Comment not showing immediately (no optimistic update) | Low — comment appears after GET refetch | High (first comment on a fresh page load) | Acceptable — the `invalidatesTags` triggers a refetch automatically |
| Guard masking a deeper issue | Medium | Low | The guard is a standard pattern for RTK Query optimistic updates |
| WDYR still causing hooks warnings | Low | Low | If hooks order warnings persist after fix, WDYR configuration may need adjustment |

---

## Implementation Steps

1. Add `if (!draft) return;` guard to the initial optimistic insert callback (line 92)
2. Add `if (!draft?.items) return;` guard to the success replacement callback (line 121)
3. Restart Metro with `--reset-cache` to clear any corrupted cache state
