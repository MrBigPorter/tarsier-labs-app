# Plan: Skeleton UI Improvement — Match Each Page's Structure

## Current State

| Issue | Location | Severity |
|-------|----------|----------|
| `colors.skeleton` is **undefined** (no token, no alias) | [`Skeleton.tsx:60`](../src/components/core/Skeleton.tsx:60) | 🔴 Global — ALL skeletons invisible |
| `colors.card` is **undefined** (no token, no alias) | [`Skeleton.tsx:123`](../src/components/core/Skeleton.tsx:123), [`Skeleton.tsx:290`](../src/components/core/Skeleton.tsx:290) | 🔴 Card/container backgrounds transparent |
| `ArticleCardSkeleton` meta row doesn't match real `ArticleCard` | [`Skeleton.tsx:149`](../src/components/core/Skeleton.tsx:149) | 🟡 Layout mismatch |
| Missing category badge in skeleton | [`Skeleton.tsx:129`](../src/components/core/Skeleton.tsx:129) | 🟡 Missing element |
| `ArticleListSkeleton` uses wrong padding | [`Skeleton.tsx:197`](../src/components/core/Skeleton.tsx:197) | 🟡 Visual misalignment with HomeScreen |

## Root Cause

In [`ThemeContext.tsx:27-32`](../src/lib/theme/ThemeContext.tsx:27), `resolveThemeColors()` only aliases 5 legacy keys:
```
background → bgPrimary
text       → textPrimary
primary    → utilityBrand500
border     → borderSecondary
surface    → bgSecondary
```

No `skeleton` or `card` key exists. So `colors.skeleton` → `undefined` → transparent skeletons.

## Target: Homepage (Phase 1)

The homepage uses [`ArticleListSkeleton`](../src/components/core/Skeleton.tsx:195) which renders multiple [`ArticleCardSkeleton`](../src/components/core/Skeleton.tsx:113) inside a padded container.

### Real ArticleCard Layout (target for skeleton)

```
┌─────────────────────────────────────┐
│  ┌───────────────────────────────┐  │
│  │   16:9 Cover Image           │  │
│  │                         ┌────┐│  │
│  │                         │cat ││  │  ← category badge (bottom-left)
│  │                         └────┘│  │
│  └───────────────────────────────┘  │
│                                     │
│  Article Title (3 lines max)        │
│                                     │
│  Article excerpt text goes here...  │
│  and continues on next line...      │
│                                     │
│  👁 1.2k  💬 45  Author Name    ★  │  ← meta row
└─────────────────────────────────────┘
```

Current ArticleCardSkeleton layout (broken):

```
┌─────────────────────────────────────┐
│  ┌───────────────────────────────┐  │
│  │   16:9 Cover Image           │  │
│  └───────────────────────────────┘  │
│                                     │
│  Title line 1 (85%)                 │
│  Title line 2 (60%)                 │
│                                     │
│  Excerpt line 1 (100%)              │
│  Excerpt line 2 (92%)               │
│  Excerpt line 3 (75%)               │
│                                     │
│  ◉  Author Name           [date]   │  ← WRONG: avatar+name+date
└─────────────────────────────────────┘         should be views+comments+author+bookmark
```

### Color Values (TokensLight)

| Token | Value | Usage |
|-------|-------|-------|
| `bgTertiary` | `#f5f5f5` | ✅ Replace `colors.skeleton` — visible light gray |
| `bgPrimary` | `#ffffff` | ✅ Replace `colors.card` — card background |

No changes to `ThemeContext.tsx` needed — `bgTertiary` and `bgPrimary` already exist as direct token keys.

## Exact Changes

### Change 1: Fix base skeleton color — [`Skeleton.tsx:60`](../src/components/core/Skeleton.tsx:60)

```diff
-  backgroundColor: colors.skeleton,
+  backgroundColor: colors.bgTertiary,
```

This fixes **all** skeletons across the entire app (homepage, article list, article detail, etc.).

### Change 2: Fix card container background — [`Skeleton.tsx:123`](../src/components/core/Skeleton.tsx:123), [`Skeleton.tsx:290`](../src/components/core/Skeleton.tsx:290)

```diff
-  backgroundColor: colors.card,
+  backgroundColor: colors.bgPrimary,
```

Applies to `ArticleCardSkeleton` container (line 123) and `CategoryCardSkeleton` container (line 290).

### Change 3: Add category badge — [`Skeleton.tsx:129`](../src/components/core/Skeleton.tsx:129)

Insert between cover image skeleton and content area. The real ArticleCard renders the category badge as an absolute-positioned overlay at the bottom-left of the image container.

Add inside the cover image container (or just below it in the content area):

```tsx
{/* Category badge */}
<Skeleton
  width={60}
  height={22}
  borderRadiusVal={borderRadius.sm}
  style={{ position: 'absolute', bottom: spacing.sm, left: spacing.sm }}
/>
```

### Change 4: Redesign meta row — [`Skeleton.tsx:149-156`](../src/components/core/Skeleton.tsx:149)

Replace:
```tsx
<View style={articleCardStyles.meta}>
  <View style={articleCardStyles.authorRow}>
    <Skeleton width={28} height={28} borderRadiusVal={14} />  {/* avatar circle */}
    <Skeleton width={80} height={12} />                        {/* author name */}
  </View>
  <Skeleton width={60} height={12} />                          {/* date */}
</View>
```

With:
```tsx
<View style={articleCardStyles.meta}>
  {/* Left: views, comments, author */}
  <View style={articleCardStyles.metaLeft}>
    <Skeleton width={40} height={12} />                        {/* 👁 views count */}
    <Skeleton width={40} height={12} />                        {/* 💬 comments count */}
    <Skeleton width={60} height={12} />                        {/* author name */}
  </View>
  {/* Right: bookmark */}
  <Skeleton width={22} height={22} borderRadiusVal={4} />      {/* ★ bookmark */}
</View>
```

### Change 5: Add new styles — `articleCardStyles`

Add after existing `authorRow` style:

```ts
metaLeft: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: spacing.sm,
},
```

The existing `meta` style already has `flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'` — perfect match for the ArticleCard's `metaRow` style.

### Change 6: Fix ArticleListSkeleton padding — [`Skeleton.tsx:197`](../src/components/core/Skeleton.tsx:197)

```diff
-  <View style={{ paddingHorizontal: spacing.xxl }}>
+  <View style={{ paddingHorizontal: spacing.md }}>
```

### Change 7: Fix ArticleCardSkeleton card width — [`Skeleton.tsx:116`](../src/components/core/Skeleton.tsx:116)

Since the outer padding changes from `spacing.xxl` (20) to `spacing.md` (8), the card width must also change:

```diff
-  const cardWidth = screenWidth - spacing.xxl * 2;
+  const cardWidth = screenWidth - spacing.md * 2;
```

This ensures the skeleton card fills the same width as real ArticleCards.

## Files Modified

| File | Changes |
|------|---------|
| [`src/components/core/Skeleton.tsx`](../src/components/core/Skeleton.tsx) | Lines 60, 116, 123, 129 (new), 149-156, 185-189 (new), 197, 290 |

## Not Modified (Out of Scope for Phase 1)

- `ArticleDetailSkeleton` — layout is adequate for now
- `CategoryCardSkeleton` — layout is adequate for now
- `ThemeContext.tsx` — no alias needed, using direct tokens `bgTertiary`/`bgPrimary`
- `AppImage.tsx` — uses its own hardcoded skeleton colors, separate system
- Individual screen loading states — all already use skeletons correctly

## Visual Comparison (Expected Result)

**Before (broken):** Transparent/invisible skeleton blocks with only the opacity pulse animation flickering. Meta row shows wrong layout (avatar+name+date).

**After (fixed):** Visible light gray (`#f5f5f5`) skeleton blocks with smooth pulse animation. Meta row shows views count, comments count, author name (left) and bookmark icon placeholder (right) — matching the real ArticleCard layout.
