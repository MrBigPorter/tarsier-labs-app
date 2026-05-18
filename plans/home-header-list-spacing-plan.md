# Plan: Improve HomeScreen Header Tab & List Spacing

## Problem

On the HomeScreen, the [`CategoryFilter`](src/components/blog/CategoryFilter.tsx) (tab bar with category chips) sits flush against the first article card in the FlatList. There is zero visual gap between them because:

- `CAT_FILTER_HEIGHT = 50` (line 76 in [`HomeScreen.tsx`](src/screens/HomeScreen.tsx))
- `CONTENT_TOP = HEADER_HEIGHT + CAT_FILTER_HEIGHT` (line 78)
- The CategoryFilter overlay is positioned at `top: HEADER_HEIGHT + insets.top`
- The FlatList `paddingTop = insets.top + CONTENT_TOP`

This means content starts exactly at the bottom edge of the CategoryFilter, with no breathing room.

## Current Layout (visual)

```
┌──────────────────────┐
│      Header          │  ← HEADER_HEIGHT (44/56) + insets.top
├──────────────────────┤
│ CategoryFilter chip  │  ← top: HEADER_HEIGHT + insets.top
│  [All] [Dev] [Life]  │  ← CAT_FILTER_HEIGHT = 50
├──────────────────────┤  ← Content starts here, NO gap
│                      │
│  ┌──────────────┐    │
│  │ Article Card  │    │  ← First card immediately below filter
│  └──────────────┘    │
│                      │
│  ┌──────────────┐    │
│  │ Article Card  │    │
│  └──────────────┘    │
```

## Proposed Solution

Add a `LIST_TOP_GAP` constant and include it in `CONTENT_TOP` to create a deliberate gap between the CategoryFilter and the article list.

### Changes in `HomeScreen.tsx`

1. **Add a new constant** `LIST_TOP_GAP` between the CategoryFilter and list content:

   ```tsx
   const LIST_TOP_GAP = spacing.xl; // 16px
   ```

   Using `spacing.xl` (16px) — generous enough to feel premium, but not wasteful of vertical space. Alternative options:
   - `spacing.lg` (12px) — subtle
   - `spacing.xxl` (20px) — more spacious
   - `spacing['3xl']` (24px) — very generous

2. **Update `CONTENT_TOP`** to include the gap:

   ```tsx
   // Before:
   const CONTENT_TOP = HEADER_HEIGHT + CAT_FILTER_HEIGHT;

   // After:
   const CONTENT_TOP = HEADER_HEIGHT + CAT_FILTER_HEIGHT + LIST_TOP_GAP;
   ```

3. **The CategoryFilter overlay position stays unchanged** at `top: HEADER_HEIGHT + insets.top` — no adjustment needed there.

4. **The `PullToRefreshWrapper`'s `spinnerOffset`** already uses `insets.top + CONTENT_TOP`, so it auto-adjusts.

### Visual Result

```
┌──────────────────────┐
│      Header          │  ← HEADER_HEIGHT (44/56) + insets.top
├──────────────────────┤
│ CategoryFilter chip  │  ← top: HEADER_HEIGHT + insets.top
│  [All] [Dev] [Life]  │  ← CAT_FILTER_HEIGHT = 50
├──────────────────────┤
│   ← 16px gap →       │  ← LIST_TOP_GAP (new)
├──────────────────────┤
│  ┌──────────────┐    │
│  │ Article Card  │    │  ← First card now has breathing room
│  └──────────────┘    │
│                      │
│  ┌──────────────┐    │
│  │ Article Card  │    │
│  └──────────────┘    │
```

### Scroll Animation Behavior

When the user scrolls down and the CategoryFilter slides up to hide (`catFilterTranslateY → -CAT_FILTER_HEIGHT`), the 16px gap is part of the content padding. It scrolls along with the articles, revealing naturally behind the CategoryFilter. The animation logic in [`scrollHandler`](src/screens/HomeScreen.tsx:247) requires no changes.

## Files to Modify

| File                                                       | Change                                                                                |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| [`src/screens/HomeScreen.tsx`](src/screens/HomeScreen.tsx) | Add `LIST_TOP_GAP` constant (line ~78), update `CONTENT_TOP` to include it (line ~78) |

## Verification Steps

1. CategoryFilter should have ~16px visible gap between its bottom edge and the first article card at rest state
2. When scrolling down, the CategoryFilter slides up smoothly and the gap scrolls with content
3. When scrolling back up, the CategoryFilter reappears with proper gap
4. Pull-to-refresh spinner offset should still align correctly
