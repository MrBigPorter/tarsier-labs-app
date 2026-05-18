# Related Articles Android Spacing Fix Plan (v2)

## Problem

On Android, the related article items in the article detail screen's horizontal scroll list appear "stuck together" (贴在一起) — the cards touch each other with no visible gap. iOS works fine.

## Root Cause (Real)

The [`ArticleCard`](src/components/blog/ArticleCard.tsx:330-331) compact variant has a **fixed width of 280dp**:

```tsx
compactCard: {
  width: 280,        // ← FIXED WIDTH
  marginBottom: 0,
  borderRadius: 10,
},
```

But its wrapping container in [`ArticleDetailScreen.tsx:529`](src/screens/ArticleDetailScreen.tsx:529) uses a **relative width** `screenWidth * 0.7` (70% of screen).

On smaller Android screens (e.g., 360dp width): container = **252dp**, but card = **280dp**. The card **overflows** 28dp beyond its container into the next item's space, visually collapsing the gap between items regardless of `marginRight`.

iOS devices tend to have larger screens (e.g., iPhone 14 Pro = 390dp → container = 273dp, card still 280dp → overflows only 7dp), making the issue less noticeable or hidden.

## Fix

Two changes needed:

### Change 1: Remove fixed width from compact Card

**File:** [`src/components/blog/ArticleCard.tsx`](src/components/blog/ArticleCard.tsx:330-331)

Remove `width: 280` from `compactCard` so the card fills its parent container instead of overflowing.

```diff
 compactCard: {
-  width: 280,
   marginBottom: 0,
   borderRadius: 10,
 },
```

The wrapping `<View>` in ArticleDetailScreen already provides the width constraint (`screenWidth * 0.7`), so the card will naturally fill that space.

### Change 2: Keep marginRight as spacing.md

**File:** [`src/screens/ArticleDetailScreen.tsx`](src/screens/ArticleDetailScreen.tsx:529)

Keep the existing `marginRight: spacing.md` (already applied). No further changes needed here.

### Why this fixes the issue

Without the fixed `width: 280`, the compact ArticleCard will stretch to fill its container (`screenWidth * 0.7`). Each container has `marginRight: spacing.md` (8dp), so there will always be a visible 8dp gap between cards on all screen sizes, on both Android and iOS.

### Testing

- Verify on a small Android screen (360dp, e.g., Pixel 4a) that cards no longer touch
- Verify on a larger Android screen that cards look proportionally sized
- Verify iOS still works correctly
- Check that the `compact` prop is not used elsewhere (it's only used in [`ArticleDetailScreen.tsx:533`](src/screens/ArticleDetailScreen.tsx:533))
