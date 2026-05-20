# Blurhash Fix Plan

## Bug Description

API list response returns blurhash at `meta.images.blurhash`, but the frontend reads `meta.blurhash` (which is `undefined` in the API response). This causes blurhash placeholders to never render — always falling back to gray skeleton.

## Affected Files

| File                                                                                    | Line | Current Code                        | Issue                          |
| --------------------------------------------------------------------------------------- | ---- | ----------------------------------- | ------------------------------ |
| [`src/components/blog/ArticleCard.tsx`](../src/components/blog/ArticleCard.tsx)         | 125  | `blurhash={article.meta?.blurhash}` | `meta.blurhash` is `undefined` |
| [`src/components/features/VideoPlayer.tsx`](../src/components/features/VideoPlayer.tsx) | 85   | `blurhash={article.meta?.blurhash}` | `meta.blurhash` is `undefined` |

## API Response Shape (Actual)

```json
{
  "meta": {
    "images": {
      "blurhash": "L75$Z3%jj{Z%-;awf,ofZLMvWApI",
      "original": "...",
      "large": { "webp": "...", "jpg": "..." },
      "medium": { "webp": "...", "jpg": "..." },
      "thumbnail": { "webp": "...", "jpg": "..." }
    }
  }
}
```

## Type Definition (Current)

[`src/types/frontend-blog.ts`](../src/types/frontend-blog.ts:14-22)

```typescript
export interface ArticleMeta {
  blurhash?: string; // ← NOT in API response
  images?: {
    blurhash: string; // ← Actual API location
    original: string;
    large: { webp: string; jpg: string };
    medium: { webp: string; jpg: string };
    thumbnail: { webp: string; jpg: string };
  };
}
```

## Fix Steps

### Step 1: Update `ArticleCard.tsx`

Change [`src/components/blog/ArticleCard.tsx:125`](../src/components/blog/ArticleCard.tsx:125):

```diff
- blurhash={article.meta?.blurhash}
+ blurhash={article.meta?.images?.blurhash ?? article.meta?.blurhash}
```

This provides a fallback chain: try `meta.images.blurhash` first (the actual API location), fall back to `meta.blurhash` (for backward compatibility).

### Step 2: Update `VideoPlayer.tsx`

Change [`src/components/features/VideoPlayer.tsx:85`](../src/components/features/VideoPlayer.tsx:85):

```diff
- blurhash={article.meta?.blurhash}
+ blurhash={article.meta?.images?.blurhash ?? article.meta?.blurhash}
```

Same fallback chain for video poster.

### Step 3 (Optional): Update Type Definition

Consider updating [`src/types/frontend-blog.ts`](../src/types/frontend-blog.ts:14-22) to remove the misleading `ArticleMeta.blurhash` field since the API never returns it at that location:

```diff
export interface ArticleMeta {
- blurhash?: string;
  images?: {
    blurhash: string;
    ...
  };
```

This is optional — the existing `meta.blurhash` won't cause bugs since the fallback chain already handles it. But removing it improves type accuracy.

## Verification

After the fix:

1. `ArticleCard` will pass a valid blurhash string to `AppImage`
2. `AppImage` will render `<Blurhash>` component as loading placeholder
3. Home screen article list will show blurhash placeholder while images load
4. All other list screens (ArticleListScreen, CategoryArticlesScreen, BookmarksScreen, SearchScreen) benefit automatically since they all use `ArticleCard`
5. Video poster will also show blurhash via `VideoPlayer`

## Data Flow After Fix

```
API Response (meta.images.blurhash = "L75$Z3...")
  → ArticleCard (article.meta?.images?.blurhash ?? article.meta?.blurhash)
    → AppImage (blurhash prop)
      → showBlurhash = true (since blurhash string is truthy)
        → <Blurhash blurhash="L75$Z3..." /> renders
```
