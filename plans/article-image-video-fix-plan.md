# Article Image & Video Fix Plan

## Root Cause Analysis

The API returns `coverImage` and `meta.images` data correctly, but the app code has rendering bugs.

## Bugs Found

### 🐛 Bug 1 (P0): ArticleDetailScreen — Cover image shows placeholder instead of actual Image

**File:** [`src/screens/ArticleDetailScreen.tsx`](../src/screens/ArticleDetailScreen.tsx) lines 281–299

**Problem:** When `coverImageUrl` is truthy, the code renders a `View` placeholder with only the first letter of the title — NOT the actual `<Image>` component.

```tsx
// Current (BROKEN) — renders placeholder when image exists
{coverImageUrl ? (
    <View style={styles.coverImageContainer}>
        <View style={[styles.coverImagePlaceholder, ...]}>
            <Text>{article.title?.charAt(0)}</Text>  ← just first letter!
        </View>
    </View>
) : null}
```

**Fix:** Invert the logic — render `<Image>` when URL exists, show placeholder only when no image.

---

### 🐛 Bug 2 (P0): ArticleCard WebP conversion gives broken URLs

**File:** [`src/components/blog/ArticleCard.tsx`](../src/components/blog/ArticleCard.tsx) lines 63–70

**Problem:** The WebP URL is derived by simple extension replacement, but the actual WebP files live at different paths.

```tsx
// Current (WRONG) — tries coverImage.replace(/\.(jpg|jpeg|png)$/i, '.webp')
// Actual WebP URL is at: article.meta?.images?.large?.webp (different path!)
```

**Fix:** Use `article.meta?.images?.large?.webp` when available, fall back to `article.coverImage`.

---

### 🐛 Bug 3 (P1): No hero video in ArticleDetailScreen

**File:** [`src/screens/ArticleDetailScreen.tsx`](../src/screens/ArticleDetailScreen.tsx)

**Problem:** The type `ArticleMeta.video` defines `hlsUrl`, `poster`, `duration`, but there's no video player in the article detail.

**Fix:** When `article.meta?.video` exists, render an HLS video player section at the top (above or replacing cover image).

---

### 🐛 Bug 4 (P1): No inline video in MarkdownRenderer

**Files:** 
- [`src/components/blog/MarkdownRenderer.tsx`](../src/components/blog/MarkdownRenderer.tsx)
- [`src/types/frontend-blog.ts`](../src/types/frontend-blog.ts) — `contentVideo` mapping

**Problem:** Markdown `<video src="xxx.mp4">` tags are not rendered. The API provides `contentVideo[]` mappings to replace source URLs with HLS URLs.

**Fix:** Add custom render rule in MarkdownRenderer for video elements, using `contentVideo` mappings.

---

## Execution Order

| Step | Priority | File | Change |
|------|----------|------|--------|
| 1 | P0 | `ArticleDetailScreen.tsx` | Fix cover image: render `<Image>` when URL exists, placeholder when absent |
| 2 | P0 | `ArticleCard.tsx` | Fix WebP URL: use `meta.images.large.webp` instead of extension replace |
| 3 | P1 | `ArticleDetailScreen.tsx` | Add hero HLS video player when `meta.video` exists |
| 4 | P1 | `MarkdownRenderer.tsx` + add `react-native-video` | Add custom render rule for `<video>` using `contentVideo` mappings |

## Verification

After fixing Steps 1-2:
- Article cards on list screens show cover images correctly
- Article detail screen shows the actual cover image (not placeholder)
- TypeScript: `npx tsc --noEmit` passes
