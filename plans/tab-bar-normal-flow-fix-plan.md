# Fix: TabBar Normal Flow — Remove position: absolute

## Problem

The TabBar uses `position: absolute; bottom: 0` in [`RootNavigator.tsx:353-362`](src/navigation/RootNavigator.tsx:353). This causes the TabBar to **overlay on top** of all screen content. To compensate, **5 screens** must manually add `TAB_BAR_HEIGHT` to their `paddingBottom`. This fragile approach:

1. Requires perfect synchronization between `TAB_BAR_HEIGHT` and the actual rendered TabBar height
2. Breaks when `TAB_BAR_HEIGHT` is too small (content hidden) or too large (iOS wasted space)
3. Cannot dynamically adapt to device-specific safe areas and navigation bar heights
4. Already failed — Android bottom covered AND iOS also broken after bumping to 80px

## Fix: Remove `position: absolute`, Use Normal Flow

### Before (Current — Broken)

```
┌──────────────────────┐
│   FlatList            │  ← flex: 1, fills entire area
│   paddingBottom:      │  ← manual hack: +TAB_BAR_HEIGHT
│   insets.bottom + 80  │
│   + spacing.xl        │
├──────────────────────┤
│ TabBar (absolute)     │  ← overlays content, bottom: 0
│ height: 80            │
│ overflow: hidden      │
└──────────────────────┘
```

### After (Fixed)

```
┌──────────────────────┐
│   FlatList            │  ← flex: 1, fills remaining space
│   paddingBottom:      │  ← only safe area + visual spacing
│   insets.bottom       │
│   + spacing.xl        │
├──────────────────────┤
│ TabBar (normal flow)  │  ← naturally positioned below content
│ maxHeight: animates   │  ← collapses to 0 when scrolling down
│ overflow: hidden      │
└──────────────────────┘
```

## Changes Required

### 1. [`src/navigation/RootNavigator.tsx`](src/navigation/RootNavigator.tsx)

#### 1a. `tabBarWrapper` style — Remove `position: absolute`

```tsx
// Before
tabBarWrapper: {
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  height: TAB_BAR_HEIGHT,
  overflow: 'hidden',
  zIndex: 100,
},

// After — let navigator layout handle positioning
tabBarWrapper: {
  overflow: 'hidden',
  zIndex: 100,
},
```

#### 1b. `tabBarAnimatedStyle` — Change to `maxHeight` animation

```tsx
// Before (translateY pushes tab bar down off-screen)
const tabBarAnimatedStyle = useAnimatedStyle(() => ({
  transform: [{ translateY: tabBarTranslateY.value }],
}));

// After (maxHeight collapses the tab bar in-place)
const tabBarAnimatedStyle = useAnimatedStyle(() => ({
  maxHeight: Math.max(0, TAB_BAR_HEIGHT + tabBarTranslateY.value),
}));
```

`tabBarTranslateY` range changes:

- **Visible**: `tabBarTranslateY = 0` → `maxHeight = TAB_BAR_HEIGHT` (full height)
- **Hidden**: `tabBarTranslateY = -TAB_BAR_HEIGHT` → `maxHeight = 0` (collapsed)

### 2. [`src/screens/HomeScreen.tsx`](src/screens/HomeScreen.tsx)

#### 2a. Fix scroll handler — Change tabBarTranslateY direction

```tsx
// Before (line ~299-300):
catFilterTranslateY.value = withTiming(-CAT_FILTER_HEIGHT, { duration: 200 });
tabBarTranslateY.value = withTiming(TAB_BAR_HEIGHT, { duration: 200 }); // positive = push down

// After:
catFilterTranslateY.value = withTiming(-CAT_FILTER_HEIGHT, { duration: 200 });
tabBarTranslateY.value = withTiming(-TAB_BAR_HEIGHT, { duration: 200 }); // negative = collapse
```

#### 2b. Fix paddingBottom — Remove TAB_BAR_HEIGHT

```tsx
// Before (line ~523):
paddingBottom: insets.bottom + TAB_BAR_HEIGHT + spacing.xl,

// After:
paddingBottom: insets.bottom + spacing.xl,
```

### 3. All other screens — Remove `TAB_BAR_HEIGHT` from paddingBottom

| #   | File                                                                                   | Line | Change                                                                       |
| --- | -------------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------- |
| 1   | [`src/screens/ArticleListScreen.tsx`](src/screens/ArticleListScreen.tsx:226)           | 226  | `insets.bottom + TAB_BAR_HEIGHT + spacing.xl` → `insets.bottom + spacing.xl` |
| 2   | [`src/screens/BookmarksScreen.tsx`](src/screens/BookmarksScreen.tsx:226)               | 226  | Same                                                                         |
| 3   | [`src/screens/ArchiveScreen.tsx`](src/screens/ArchiveScreen.tsx:176)                   | 176  | Same                                                                         |
| 4   | [`src/screens/CategoryArticlesScreen.tsx`](src/screens/CategoryArticlesScreen.tsx:217) | 217  | Same                                                                         |

## How It Works Visually

```
┌─────────────────────────┐
│  Screen Content         │  ← flex: 1, fills remaining space
│  (no paddingBottom      │     above TabBar
│   for TabBar)           │
│                         │
├─────────────────────────┤
│  TabBar                 │  ← normal flow, maxHeight: 80
│  ┌──┬──┬──┬──┬──┐      │     overflow: hidden
│  │H │T │C │B │A │      │
│  └──┴──┴──┴──┴──┘      │
└─────────────────────────┘

Scrolling down ⬇︎:
┌─────────────────────────┐
│  Screen Content         │  ← fills entire area
│                         │
│  (naturally scrolls     │
│   to fill screen)       │
│                         │
├─────────────────────────┤
│  TabBar (collapsed)     │  ← maxHeight: 0
└─────────────────────────┘
```

When TabBar collapses via `maxHeight: 0`, the screen content (with `flex: 1`) naturally expands to fill the vacated space. No gap, no overlap, no layout shift.

## Execution Order

1. [`src/navigation/RootNavigator.tsx`](src/navigation/RootNavigator.tsx) — style + animation
2. [`src/screens/HomeScreen.tsx`](src/screens/HomeScreen.tsx) — scroll handler + paddingBottom
3. [`src/screens/ArticleListScreen.tsx`](src/screens/ArticleListScreen.tsx) — paddingBottom
4. [`src/screens/BookmarksScreen.tsx`](src/screens/BookmarksScreen.tsx) — paddingBottom
5. [`src/screens/ArchiveScreen.tsx`](src/screens/ArchiveScreen.tsx) — paddingBottom
6. [`src/screens/CategoryArticlesScreen.tsx`](src/screens/CategoryArticlesScreen.tsx) — paddingBottom
7. `npx tsc --noEmit` — verify

## Risk Assessment

| Risk                                                          | Mitigation                                                                                                            |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| TabBar animation direction change (`translateY` negative now) | Only HomeScreen updates `tabBarTranslateY`; verify scroll handler                                                     |
| Other screens using `tabBarTranslateY`                        | Search confirms only HomeScreen uses it                                                                               |
| `maxHeight` + `overflow: hidden` clipping TabBar content      | TabBar natural height ~70-114px; `TAB_BAR_HEIGHT = 80` clips excess safe-area padding but icons/labels remain visible |
| Layout shift on screens w/out paddingBottom fix               | All 5 affected screens identified and included                                                                        |
