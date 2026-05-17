# Comment System Fix Plan

## Root Cause Found!

**H5 works, mobile doesn't** — but the server is fine.

The comments API expects a **slug** as the `articleId` parameter, but the mobile app passes the **database ID** (`article?.id`).

| | H5 (正常) | 移动端 (报错) |
|---|---|---|
| URL | `.../articles/**joymini-blog-platform**/comments` | `.../articles/**cmotio5lh005umi8zi6dl3jh9**/comments` |
| 参数 | **slug** | **数据库 ID** (`article?.id`) |

**Fix**: Change all `article?.id` → `slug` in comments-related calls in ArticleDetailScreen.

---

## Changes Required

### File: [`src/screens/ArticleDetailScreen.tsx`](../src/screens/ArticleDetailScreen.tsx)

| Line | Current | Fix |
|------|---------|-----|
| 96 | `useCommentsInfiniteQuery(**article?.id**)` | `useCommentsInfiniteQuery(**slug**)` |
| 97 | `useCommentSSE(**article?.id**)` | `useCommentSSE(**slug**)` |
| 182 | `articleId: **article.id**` | `articleId: **slug**` |
| ~204 | `articleId: **article.id**` | `articleId: **slug**` |

The `slug` variable is already available from `route.params` at the top of the component:
```typescript
const { slug } = route.params;
```

No other files need changes because the hooks (`useCommentsInfiniteQuery`, `useCommentSSE`, `createComment`) all pass `articleId` through to the API URL — they don't care whether it's a slug or database ID.

---

## Updated Todo List

- [ ] **Fix ArticleDetailScreen — wrong parameter**: Change `article?.id` → `slug` in all comments-related calls (lines 96, 97, 182, ~204)
- [ ] **Fix OAuth token fragment**: Strip `#` in `parseQueryParams` (already planned in `oauth-refresh-token-fragment-fix-plan.md`)
- [ ] **Fix temp comment content**: Change `content: ''` → `content: data.content` in comments.ts line 101
- [ ] **Fix missing polling fallback**: Call `commentStatusManager.startStatusPolling()` after `registerPendingComment`
- [ ] **Fix error handling**: Add `commentsQuery.error` state handling and non-empty catch blocks
- [ ] **Clean up duplicate invalidatesTags**: Remove to avoid refetch flicker
