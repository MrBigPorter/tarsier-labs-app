# Plan: Align Mobile Comment System with Web Version

## Goal

Match the mobile app's comment system to the web version **exactly** — remove name/email form, require login, add optimistic updates, SSE real-time, comment status tracking, inline reply textarea, rejected fade-out animation, infinite scroll pagination, and all supporting API endpoints.

---

## Full Feature Comparison

| # | Feature | Web Status | Mobile Status | Action |
|---|---------|------------|---------------|--------|
| 1 | **Require login to comment** — login prompt for unauth users | ✅ | ❌ Shows name/email form | Implement |
| 2 | **No name/email form** — only content textarea | ✅ | ❌ Has author form | Remove |
| 3 | **Optimistic update** — temp comment, replace on success/error | ✅ | ❌ Blocks on API + full refetch | Implement |
| 4 | **Comment status tracking** — pending/approved/rejected badges | ✅ | ❌ Not implemented | Implement |
| 5 | **SSE real-time** — `moderated` + `reply` events | ✅ | ❌ Not implemented | Implement |
| 6 | **CommentStatusManager** singleton (registerPendingComment, updateByRealId, subscribe, startStatusPolling) | ✅ | ❌ Not created | Create |
| 7 | **AutoReplyStatusManager** singleton + getCommentReplies API | ✅ | ❌ Not created | Create |
| 8 | **Inline reply textarea** — reply input inside the Comment component | ✅ | ❌ Bottom panel only | Implement |
| 9 | **Rejected fade-out animation** — opacity 0 over 1s → isRemoved | ✅ | ❌ Not implemented | Implement |
| 10 | **Infinite scroll pagination** — custom hook accumulating pages | ✅ | ❌ Single page only | Implement |
| 11 | **Simplified API** — no author/email in postComment body | ✅ | ❌ Sends author+email | Fix |
| 12 | **getCommentStatus** and **getCommentReplies** API endpoints | ✅ | ❌ Not in comments.ts | Add |

---

## Files to Create

### 1. `src/lib/utils/commentStatus.ts` — CommentStatusManager

Port from web. Singleton that tracks temp → real comment ID mapping, manages status listeners, and falls back to polling when SSE disconnects.

```typescript
export type CommentStatus = 'pending' | 'approved' | 'rejected' | 'unknown';

export interface PendingCommentInfo {
  tempId: string;
  realId: string;
  articleId: string;
  submittedAt: Date;
  status: CommentStatus;
  pollAttempts: number;
  maxPollAttempts: number;
  pollInterval: number;
  pollTimer?: ReturnType<typeof setInterval>;
}

class CommentStatusManager {
  private static instance: CommentStatusManager;
  private pendingComments: Map<string, PendingCommentInfo> = new Map();
  private statusListeners: Map<string, Array<(status: CommentStatus) => void>> = new Map();

  static getInstance(): CommentStatusManager { ... }
  registerPendingComment(tempId, realId, articleId, options?): void { ... }
  updateCommentStatus(tempId, status): void { ... }
  updateByRealId(realId, status): void { ... } // called by SSE
  getCommentStatus(tempId): CommentStatus | null { ... }
  removePendingComment(tempId): void { ... }
  startStatusPolling(tempId, checkStatusCallback): void { ... }
  subscribe(tempId, callback): () => void { ... } // returns unsubscribe fn
  cleanupExpiredComments(): void { ... }
  reset(): void { ... }
}

export const commentStatusManager = CommentStatusManager.getInstance();
```

### 2. `src/lib/utils/autoReplyStatus.ts` — AutoReplyStatusManager

Port from web. Singleton that tracks AI auto-reply status. Polls `getCommentReplies` API to check if an AI reply has been generated.

```typescript
export type AutoReplyStatus = 'pending' | 'received' | 'timeout' | 'error';

export interface AutoReplyInfo {
  commentId: string;
  articleId: string;
  submittedAt: Date;
  status: AutoReplyStatus;
  pollAttempts: number;
  maxPollAttempts: number;
  pollInterval: number;
  pollTimer?: ReturnType<typeof setInterval>;
  replyContent?: string;
  replyAuthor?: string;
}

class AutoReplyStatusManager {
  // Same singleton/subscribe pattern as CommentStatusManager
}

export const autoReplyStatusManager = AutoReplyStatusManager.getInstance();
```

### 3. `src/lib/hooks/useCommentSSE.ts` — SSE Hook

Port from web. Uses `react-native-sse` (since RN lacks native EventSource).

Singleton connection registry with refCount pattern:
- Multiple components can share one SSE connection
- Connection closes when refCount reaches 0

```typescript
// Module-level singleton registry
interface SSEEntry {
  es: EventSourceClient; // from react-native-sse
  refCount: number;
  cacheKey: string;
  onMessageHandlers: Set<(data: SSEEvent) => void>;
}
const sseRegistry = new Map<string, SSEEntry>();

// Two event types:
interface CommentReplyEvent {
  type?: 'reply';
  articleId: string;
  parentId: string;
  replyId: string;
  content: string;
  author: string;
  createdAt: string;
}
interface CommentModeratedEvent {
  type: 'moderated';
  commentId: string;
  articleId: string;
  status: 'approved' | 'rejected';
}

export function useCommentSSE(articleId: string | undefined, cacheArticleId?: string) {
  // useEffect: create or reuse SSE connection
  //   - "moderated" → commentStatusManager.updateByRealId()
  //   - "reply" → insertReplyIntoCache() via updateQueryData
  // cleanup: decrement refCount, close if 0
}
```

### 4. `src/lib/hooks/useCommentsInfiniteQuery.ts` — Infinite Scroll Hook

RTK Query doesn't have built-in infinite query. Custom hook wrapping RTK Query that:
- Uses `useLazyGetCommentsQuery` + manual page tracking
- Accumulates items across pages
- Deduplicates by comment ID (like web's `seenIds` Set)

```typescript
export function useCommentsInfiniteQuery(articleId: string, options?: { pageSize?: number; enabled?: boolean }) {
  const [page, setPage] = useState(1);
  const [allItems, setAllItems] = useState<Comment[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const [fetchComments, { data, isLoading, isFetching }] = useLazyGetCommentsQuery();

  // Effect: when data changes, append new items with dedup
  // loadMore: increment page and fetch
  // reload: reset to page 1

  return { items: allItems, total, hasMore, isLoadingMore: isFetching, loadMore, reload, isLoading };
}
```

**Alternative**: If the existing `useGetCommentsQuery` can be used with `subscribe` approach, but lazy query gives more control for pagination.

---

## Files to Modify

### 5. `src/api/endpoints/comments.ts`

**Changes:**
- Remove `author` and `email` from `CreateCommentParams`
- Simplify `createComment` mutation body (always send `{author: 'Anonymous', email: undefined, website: undefined, content, parentId}`)
- Add `getCommentStatus` query endpoint
- Add `getCommentReplies` query endpoint
- Add optimistic update via `onQueryStarted` on `createComment`

```typescript
interface CreateCommentParams {
  articleId: string;
  content: string;
  parentId?: string;
}

// New endpoints:
getCommentStatus: builder.query<{ id: string; status: string; articleId: string }, string>({
  query: (commentId) => `/api/v1/frontend/blog/comments/${commentId}/status`,
}),
getCommentReplies: builder.query<{ commentId: string; replies: any[] }, string>({
  query: (commentId) => `/api/v1/frontend/blog/comments/${commentId}/replies`,
}),

// Optimistic update on createComment:
createComment: builder.mutation<Comment, CreateCommentParams>({
  query: ({ articleId, content, parentId }) => ({
    url: `/api/v1/frontend/blog/articles/${articleId}/comments`,
    method: 'POST',
    body: { author: 'Anonymous', email: undefined, website: undefined, content, parentId },
  }),
  async onQueryStarted({ articleId }, { dispatch, queryFulfilled }) {
    // 1. Create temp comment
    // 2. Patch cache via dispatch(commentApi.util.updateQueryData('getComments', ...))
    // 3. Wait for queryFulfilled
    // 4. On success: patch cache again to replace temp with real
    // 5. On error: patch cache to remove temp
  },
})
```

**IMPORTANT**: This is a significant deviation from web because RTK Query's `updateQueryData` is more limited than React Query's `setQueryData` — it only works for exact cache keys, not fuzzy matches. For our case with single-page comments, this is acceptable since we only cache one page at a time.

### 6. `src/components/blog/CommentItem.tsx`

**Changes:**
- Add new props: `onSubmitReply?: (content: string, parentId: string) => void`, `isAuthenticated: boolean`
- Add `isOptimistic` detection (`comment.id.startsWith('temp-')`)
- Add `commentStatus` state — subscribe to `commentStatusManager`
- Show **status badges** (pending spinner / approved checkmark / rejected cross) — can use dev-only or always visible
- Add **inline reply textarea**:
  - `showReplyInput` and `replyContent` state
  - Reply button → if not authenticated, trigger navigation to Auth
  - TextInput + Cancel/Submit buttons when `showReplyInput` is true
- Add **rejected fade-out animation**:
  - `Animated.Value` for opacity
  - On status='rejected': animate opacity to 0 over 1000ms → `setIsRemoved(true)`
  - If `isRemoved` → return null
- Pass `onSubmitReply` down to recursive children

### 7. `src/screens/ArticleDetailScreen.tsx`

**Changes:**
- **Remove**: `authorName`, `authorEmail`, `showAuthorForm` state — no longer needed
- **Remove**: `showAuthorForm` toggle logic (`if (!user && !authorName.trim()) { setShowAuthorForm(true); return; }`)
- **Remove**: Author form JSX block (`showAuthorForm && !user && <View style={styles.authorForm}>...`)
- **Remove**: `showAuthorForm` from `handleSubmitComment`
- **Simplify `handleSubmitComment`**: no author/email params, call `createComment({ articleId, content, parentId })`
- **Add login redirect**: In `handleReply`, if `!user`, navigate to Auth screen
- **Add `useCommentSSE`**: `useCommentSSE(article?.id)` — wire up SSE connection
- **Replace single-page query** with infinite scroll hook: `useCommentsInfiniteQuery(article?.id)`
- **Replace comment list rendering** to use infinite scroll items
- **Remove `refetchComments`** — optimistic updates + SSE make refetch unnecessary
- **Remove unused styles**: `authorForm`, `authorInput`
- **Remove unused imports**: remove `showAuthorForm`-related

### 8. `src/messages/en.json` (and all locale files)

**Add new i18n keys:**
```json
{
  "comment": {
    "commentPending": "Your comment is being reviewed...",
    "commentApproved": "Your comment has been published",
    "commentRejected": "Comment does not meet community guidelines, automatically removed"
  }
}
```

### 9. `package.json`

Add dependency:
```json
"react-native-sse": "^1.2.0"
```

---

## Implementation Order

| Step | Files | Description |
|------|-------|-------------|
| 1 | `package.json` | Install `react-native-sse` |
| 2 | `src/lib/utils/commentStatus.ts` | Create CommentStatusManager singleton |
| 3 | `src/lib/utils/autoReplyStatus.ts` | Create AutoReplyStatusManager singleton |
| 4 | `src/api/endpoints/comments.ts` | Simplify params + add optimistic updates + add status/replies endpoints |
| 5 | `src/lib/hooks/useCommentsInfiniteQuery.ts` | Create infinite scroll hook |
| 6 | `src/lib/hooks/useCommentSSE.ts` | Create SSE hook with singleton registry |
| 7 | `src/messages/en.json` (and all locales) | Add new i18n keys |
| 8 | `src/components/blog/CommentItem.tsx` | Add status tracking + inline reply + fade-out animation |
| 9 | `src/screens/ArticleDetailScreen.tsx` | Remove name/email form + login prompt + integrate all features |

---

## Data Flow Diagram

```
┌─ ArticleDetailScreen ──────────────────────────────────────────────┐
│                                                                     │
│  useCommentSSE(articleDbId)  ◄── SSE stream ────────────────┐      │
│       │                                                        │      │
│       ├─ "moderated" → commentStatusManager.updateByRealId()   │      │
│       │                  └─ notifies CommentItem subscribers    │      │
│       └─ "reply" → insertReplyIntoCache()                      │      │
│                      └─ updateQueryData('getComments', ...)     │      │
│                                                                 │      │
│  useCommentsInfiniteQuery() ──► useLazyGetCommentsQuery()       │      │
│       │                                                        │      │
│       ├─ page 1 → items[1..20]                                 │      │
│       ├─ page 2 → items[21..40] (accumulated)                  │      │
│       └─ deduplicate by comment.id                             │      │
│                                                                 │      │
│  CommentItem[] ← items                                          │      │
│       │                                                        │      │
│       ├─ isOptimistic=true                                      │      │
│       │   └─ subscribe(commentStatusManager)                    │      │
│       │       ├─ "pending"  → spinner badge                    │      │
│       │       ├─ "approved" → checkmark badge                  │      │
│       │       └─ "rejected" → fade-out [1000ms] → hide         │      │
│       │                                                        │      │
│       ├─ Reply button                                           │      │
│       │   ├─ !user → navigate('Auth')                          │      │
│       │   └─ user → show inline textarea                       │      │
│       │       └─ postComment({content, parentId})               │      │
│       │           └─ onQueryStarted:                            │      │
│       │               ├─ Create temp comment in cache           │      │
│       │               ├─ Wait for queryFulfilled                │      │
│       │               ├─ Success → replace temp with real       │      │
│       │               │   └─ commentStatusManager.register()    │      │
│       │               └─ Error → remove temp from cache         │      │
│       │                                                        │      │
│       └─ Normal comments: just render                           │      │
│                                                                 │      │
│  User not authenticated:                                         │      │
│    └─ Login prompt card instead of comment input                 │      │
│       └─ "Login now" button → navigate('Auth')                  │      │
│                                                                 │      │
└─────────────────────────────────────────────────────────────────┘      │
                                                                          │
┌─ Backend SSE ────────────────────────────────────────────┐              │
│  GET /v1/frontend/blog/comments/stream?articleId=X        │──────────────┘
│  Events:                                                   │
│    moderated: { type, commentId, status, articleId }       │
│    reply: { parentId, replyId, content, author, createdAt }│
└───────────────────────────────────────────────────────────┘

┌─ commentStatusManager Singleton ──────────────────────────┐
│                                                            │
│  Map<tempId, PendingCommentInfo>                           │
│    ├─ realId, articleId, status, pollTimer                 │
│    ├─ subscribe(tempId, callback) → unsubscribe()          │
│    ├─ updateByRealId(realId, status) // from SSE           │
│    └─ startStatusPolling(tempId, checkStatusCallback)      │
│        └─ setInterval → getCommentStatus API               │
│            └─ max 3 attempts × 60s = 3min fallback         │
└────────────────────────────────────────────────────────────┘
```

---

## Key Technical Decisions

### 1. Optimistic Updates via `onQueryStarted`

RTK Query's `updateQueryData` is the equivalent of React Query's `setQueryData`. The key difference:
- React Query: `queryClient.getQueriesData({ queryKey: ['comments', 'infinite', ...] })` finds ALL matching caches
- RTK Query: `dispatch(commentApi.util.updateQueryData('getComments', params, callback))` only works on EXACT cache key

Since the mobile app currently only loads ONE page of comments, this limitation is acceptable. The optimistic update will:
1. Get the current cache via `commentApi.util.getRunningQueriesThunk()` or read from `dispatch(commentApi.util.getQueryData('getComments', params))`
2. Insert temp comment into the cache
3. On success, replace temp with real
4. On error, rollback

### 2. SSE via `react-native-sse`

React Native doesn't have `EventSource`. The `react-native-sse` library provides a compatible API. The singleton registry pattern from the web is preserved.

### 3. Infinite Scroll

Since RTK Query doesn't have `useInfiniteQuery`, we use `useLazyGetCommentsQuery` with manual page tracking. This is simpler than trying to force an infinite query pattern onto RTK Query.

### 4. `author: 'Anonymous'` Hardcoded

The web sends `author: 'Anonymous'` with every comment. The mobile must do the same. The backend identifies the actual user from the JWT token in the Authorization header — the `author` field is just a display name.

---

## Risk Assessment

1. **`react-native-sse` compatibility** — Must verify with RN 0.85.3. Check if it supports the singleton pattern needed.

2. **RTK Query optimistic updates** — `updateQueryData` works differently from React Query's `setQueryData`. The current approach (single page) avoids the fuzzy-cache-matching problem.

3. **SSE connection lifecycle** — Must handle app background/foreground, network changes. The singleton registry handles unmount/remount, but we may need `AppState` listeners.

4. **Backend compatibility** — Verify the SSE endpoint and new status/replies endpoints are accessible from mobile (CORS headers if using a different domain).

5. **i18n consistency** — Must add new comment status messages to ALL locale files (en/zh/ja/ko/fr/de), not just English.
