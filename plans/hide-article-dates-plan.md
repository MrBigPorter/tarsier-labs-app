# Plan: Hide Article Dates

## Objective

Remove date/time display from article UI surfaces. Comment dates and archive grouping remain unchanged since they serve different functional purposes.

## Analysis of Current Date Display Locations

### 1. [`ArticleCard.tsx`](../src/components/blog/ArticleCard.tsx) — Lines 108-124, 315-318

**What it shows:** Relative time ("2h ago", "3d ago", "Just now") computed from `article.publishedAt`.

**Where it's used (components that render ArticleCard):**
- [`HomeScreen.tsx`](../src/screens/HomeScreen.tsx) — Main article feed
- [`ArticleListScreen.tsx`](../src/screens/ArticleListScreen.tsx) — Filtered article listing
- [`BookmarksScreen.tsx`](../src/screens/BookmarksScreen.tsx) — Bookmarked articles
- [`CategoryArticlesScreen.tsx`](../src/screens/CategoryArticlesScreen.tsx) — Category-filtered articles
- [`ArticleDetailScreen.tsx`](../src/screens/ArticleDetailScreen.tsx) — Related articles (compact mode)

**Change:** Remove the `timeAgo` computation and the `<Text>{timeAgo}</Text>` render from the meta row.

---

### 2. [`ArticleDetailScreen.tsx`](../src/screens/ArticleDetailScreen.tsx) — Lines 334-341, 370-377

**What it shows:**
- `formatDate(article.publishedAt || article.updatedAt)` in the author/date meta row (line 340)
- Same date with a clock icon in the stats row (lines 370-377)

**Change:** Remove both date displays.

---

### 3. Screens intentionally NOT modified

- [`ArchiveScreen.tsx`](../src/screens/ArchiveScreen.tsx) — The entire screen is a date-based archive grouped by year/month. Hiding dates here would break its core purpose.
- [`CommentItem.tsx`](../src/components/blog/CommentItem.tsx) — Shows relative time for comments, not article dates. Unaffected.

## Changes Summary

| File | Change |
|------|--------|
| `src/components/blog/ArticleCard.tsx` | Remove the `timeAgo` memo computation (lines 108-124) and the `<Text>{timeAgo}</Text>` from the meta row (lines 315-318). The `article.publishedAt` import/usage is already local and there's no unused import to clean up — the `timeAgo` variable is the only downstream consumer. |
| `src/screens/ArticleDetailScreen.tsx` | Remove the date `<Text>` in the author/date meta row (lines 334-341). Remove the entire clock stat `<View>` from the stats row (lines 370-377). The `formatDate` import (line 55) will become unused and should be removed. |

## Execution Order

1. Edit [`ArticleCard.tsx`](../src/components/blog/ArticleCard.tsx) — Remove `timeAgo` computation and its rendering
2. Edit [`ArticleDetailScreen.tsx`](../src/screens/ArticleDetailScreen.tsx) — Remove both date displays and the unused `formatDate` import
