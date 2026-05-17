# Plan: Fix Frontend Like API Integration to Match Backend

## Background

The backend has added 3 new like-related endpoints in [`frontend-blog.controller.ts`](https://github.com/JoyMini_Nest_Monorepo/apps/api/src/blog/frontend/frontend-blog.controller.ts:394-433) and [`blog.service.ts`](https://github.com/JoyMini_Nest_Monorepo/apps/api/src/blog/blog.service.ts:1626-1825):

| Endpoint | Method | URL | Returns |
|---|---|---|---|
| Like | `POST` | `/frontend/blog/articles/:slug/like` | `{ likeCount: number }` |
| Unlike | `POST` | `/frontend/blog/articles/:slug/unlike` | `{ likeCount: number }` |
| Like Status | `GET` | `/frontend/blog/articles/:slug/like-status` | `{ liked: boolean }` |

Key backend details:
- Uses **`slug`** as route param (not database `id`)
- Like uses `LikeDeduplicationGuard` (IP+UA fingerprint, 24h Redis cooldown)
- Unlike generates fingerprint server-side from IP+UA+slug
- Responses return `{ likeCount: number }` from `select: { likeCount: true }`
- Article response already includes `likes` field (see [`frontend-blog.service.ts:341`](https://github.com/JoyMini_Nest_Monorepo/apps/api/src/blog/frontend/frontend-blog.service.ts:341))

## Current Frontend State — Problems Identified

### Problem 1: Wrong Route Parameter in [`src/api/endpoints/likes.ts`](../src/api/endpoints/likes.ts:24-46)

```typescript
// CURRENT (WRONG) — uses articleId, wrong method/URL for unlike
likeArticle: builder.mutation<LikeResponse, LikeActionParams>({
  query: ({ articleId }) => ({
    url: `/api/v1/frontend/blog/articles/${articleId}/like`,  // ❌ should be slug, not articleId
    method: 'POST',
  }),
  ...
}),
unlikeArticle: builder.mutation<void, LikeActionParams>({
  query: ({ articleId }) => ({
    url: `/api/v1/frontend/blog/articles/${articleId}/like`,  // ❌ should be slug + /unlike path
    method: 'DELETE',  // ❌ should be POST
  }),
}),
```

Problems:
1. Uses `articleId` as param — backend expects `slug`
2. `unlikeArticle` uses `DELETE` + same URL as like — backend expects `POST /.../:slug/unlike`
3. `LikeResponse` interface expects `{ id, articleId, userId, createdAt }` — backend returns `{ likeCount: number }`
4. Missing `checkLikeStatus` query endpoint

### Problem 2: Wrong Parameter Passed in [`ArticleDetailScreen.tsx`](../src/screens/ArticleDetailScreen.tsx:197-209)

```typescript
// CURRENT (WRONG) — passes article.id, but backend expects slug
likeArticle({ articleId: article.id }).catch(...)
unlikeArticle({ articleId: article.id }).catch(...)
```

`article.id` is a UUID, but the backend route is `articles/:slug/like` — it needs the URL-friendly slug string.

### Problem 3: Like Status Not Synced from Server

Currently like state is purely local/optimistic (stored in MMKV via [`likesSlice.ts`](../src/store/slices/likesSlice.ts:30-36)). The new `checkLikeStatus` endpoint allows syncing the actual server-side like status on mount. However, note that like deduplication is **fingerprint-based** (IP+UA), not user-based, so there's no auth required for this endpoint.

## Action Plan

### Task 1: Fix `src/api/endpoints/likes.ts`

**Changes:**
1. Change param interface from `LikeActionParams` with `articleId` to `LikeActionParams` with `slug`
2. Fix `likeArticle` URL: use `slug` instead of `articleId`
3. Fix `unlikeArticle`: use `POST` method and URL path `.../${slug}/unlike`
4. Fix response types: both like/unlike return `{ likeCount: number }`
5. Add `checkLikeStatus` query endpoint: `GET .../:slug/like-status` returning `{ liked: boolean }`
6. Add `LikeCountResponse` and `LikeStatusResponse` interfaces

**New interface shapes:**
```typescript
interface LikeActionParams { slug: string; }
interface LikeCountResponse { likeCount: number; }
interface LikeStatusResponse { liked: boolean; }
```

**New exports:**
```typescript
export const {
  useLikeArticleMutation,
  useUnlikeArticleMutation,
  useCheckLikeStatusQuery,
  useLazyCheckLikeStatusQuery,
} = likeApi;
```

### Task 2: Fix `ArticleDetailScreen.tsx` — Pass slug instead of articleId

**Changes in [`ArticleDetailScreen.tsx`](../src/screens/ArticleDetailScreen.tsx:197-209):**
1. In `handleLike`, change `likeArticle({ articleId: article.id })` to `likeArticle({ slug: article.slug })`
2. In `handleLike`, change `unlikeArticle({ articleId: article.id })` to `unlikeArticle({ slug: article.slug })`

This is a small but critical fix — the rest of the like flow (optimistic Redux + animation + rollback) stays the same.

### Task 3 (Optional): Add like-status sync on mount

**Changes in [`ArticleDetailScreen.tsx`](../src/screens/ArticleDetailScreen.tsx):**
1. Import `useLazyCheckLikeStatusQuery` from likes endpoint
2. After article loads, call `checkLikeStatus({ slug: article.slug })` to sync the actual server-side like state
3. If server says `liked: true` but local state says `false` (or vice versa), dispatch `setLikedStatus` to reconcile

This is **optional** because:
- The optimistic local MMKV cache is usually sufficient
- Fingerprint-based deduplication is transparent to the user
- It adds an extra API call on article mount

### Task 4: Update bookmark API endpoints to use slug (if not already done)

The existing [`bookmarks.ts`](../src/api/endpoints/bookmarks.ts) may have the same articleId-vs-slug issue. This should be verified but is out of scope for the current "like API" task.

## Architecture Diagram

```mermaid
flowchart TD
    subgraph User Action
        A[User taps Like] --> B{isLiked?}
    end

    subgraph Local UI
        B -->|No, like| C[dispatch toggleLikeOptimistic]
        B -->|Yes, unlike| C
        C --> D[Animated scale bounce 1→1.3→1]
        C --> E[Update Redux likedIds + MMKV cache]
    end

    subgraph API Calls
        C -->|like| F[POST /articles/:slug/like]
        C -->|unlike| G[POST /articles/:slug/unlike]
        F --> H[LikeDeduplicationGuard\nIP+UA fingerprint, 24h Redis TTL]
        H --> I[blogArticle.likeCount++]
        G --> J[Generate fingerprint on server]
        J --> K[blogArticle.likeCount--\n+ delete Redis fingerprint]
        I --> L[Return { likeCount }]
        K --> L
    end

    subgraph Rollback
        F -->|on error| M[dispatch toggleLikeOptimistic\nrevert]
        G -->|on error| M
    end

    subgraph Mount Sync
        N[ArticleDetail mounts] --> O[useLazyCheckLikeStatusQuery]
        O --> P[GET /articles/:slug/like-status]
        P --> Q[Return { liked: boolean }]
        Q --> R[If mismatch,\ndispatch setLikedStatus]
    end

    style F fill:#4CAF50,color:#fff
    style G fill:#FF9800,color:#fff
    style H fill:#9C27B0,color:#fff
    style M fill:#f44336,color:#fff
    style R fill:#2196F3,color:#fff
```

## Files to Modify

| # | File | Change |
|---|---|---|
| 1 | [`src/api/endpoints/likes.ts`](../src/api/endpoints/likes.ts) | Fix param from articleId→slug, fix unlike method/URL, fix response types, add checkLikeStatus query |
| 2 | [`src/screens/ArticleDetailScreen.tsx`](../src/screens/ArticleDetailScreen.tsx) | Change `likeArticle({ articleId })` → `likeArticle({ slug })` in handleLike (2 call sites) |

## Not Changed

- [`likesSlice.ts`](../src/store/slices/likesSlice.ts) — Redux slice + MMKV cache are fine as-is
- [`store/index.ts`](../src/store/index.ts) — Already registers likesReducer
- [`ArticleDetailScreen.tsx`](../src/screens/ArticleDetailScreen.tsx) — handleLike logic, optimistic dispatch, animation, and rollback all stay the same

## Priority Order

1. **Task 1** — Fix `likes.ts` endpoints to match backend contract
2. **Task 2** — Fix `ArticleDetailScreen.tsx` to pass `slug` instead of `articleId`
3. **Task 3** (Optional) — Add like-status sync on mount for server reconciliation
