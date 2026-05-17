# Fix: Bottom Content Hidden Behind Tab Bar — Normal Flow Approach

## Root Cause

[`tabBarWrapper`](src/navigation/RootNavigator.tsx:348-354) uses `position: absolute; bottom: 0` which makes the tab bar **overlay** on top of screen content. All screens needed manual `paddingBottom` hacks to compensate.

## Fix: Remove `position: absolute`, Use Normal Flow

### Before (Hack)
```
┌──────────────────┐
│   ScrollView     │  ← flex: 1, fills entire area
│   paddingBottom  │  ← manual hack: +TAB_BAR_HEIGHT
│   + TAB_BAR_HEIGHT│
├──────────────────┤
│ TabBar (absolute)│  ← overlays content
└──────────────────┘
```

### After (Normal Flow)
```
┌──────────────────┐
│   ScrollView     │  ← flex: 1, fills remaining space
│   (no hack)      │  ← no manual padding needed
├──────────────────┤
│ TabBar (normal)  │  ← naturally positioned, no overlap
└──────────────────┘
```

## Changes Required

### 1. [`RootNavigator.tsx`](src/navigation/RootNavigator.tsx:348-354) — Remove `position: absolute`

```tsx
// Before
tabBarWrapper: {
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  zIndex: 100,
},

// After — let the navigator layout handle positioning naturally
tabBarWrapper: {
  // No position: absolute — natural flow
  zIndex: 100,
}
```

### 2. TabBar Hide/Show Animation — Change to Height Animation

Since the tab bar is now in normal flow, `translateY` would leave a gap. Change to animate the wrapper's **height** with `overflow: hidden`:

In [`RootNavigator.tsx`](src/navigation/RootNavigator.tsx:182-184), change:

```tsx
// Before
const tabBarAnimatedStyle = useAnimatedStyle(() => ({
  transform: [{ translateY: tabBarTranslateY.value }],
}));

// After
const TAB_BAR_HEIGHT = 60;
const tabBarAnimatedStyle = useAnimatedStyle(() => ({
  maxHeight: Math.max(0, TAB_BAR_HEIGHT + tabBarTranslateY.value),
  overflow: 'hidden',
}));
```

Where `tabBarTranslateY` goes from `0` (visible, maxHeight = 60) to `-TAB_BAR_HEIGHT` (hidden, maxHeight = 0).

### 3. [`ScrollContext.tsx`](src/lib/ScrollContext.tsx) — Update Hide Offset

Change the hide offset value from `TAB_BAR_HIDE_OFFSET` (which was ~120px for pushing below screen) to just `-TAB_BAR_HEIGHT` (60px for collapsing to zero height).

### 4. 7 Tab Screens — Remove `TAB_BAR_HEIGHT` from paddingBottom

Since the tab bar no longer overlays, remove the `TAB_BAR_HEIGHT` hack from:

| Screen | Change |
|--------|--------|
| [`HomeScreen`](src/screens/HomeScreen.tsx:446) | `insets.bottom + spacing.xl + TAB_BAR_HEIGHT` → `insets.bottom + spacing.xl` |
| [`AboutScreen`](src/screens/AboutScreen.tsx:488) | Already `insets.bottom + spacing.xl` — no change needed |
| [`BookmarksScreen`](src/screens/BookmarksScreen.tsx:223) | Already `insets.bottom + spacing.xl` — no change needed |
| [`CategoryListScreen`](src/screens/CategoryListScreen.tsx:105) | Already correct |
| [`TagListScreen`](src/screens/TagListScreen.tsx:139) | Already correct |
| [`TagArticlesScreen`](src/screens/TagArticlesScreen.tsx:177) | Already correct |
| [`CategoryArticlesScreen`](src/screens/CategoryArticlesScreen.tsx:201) | Already correct |
| [`ArticleListScreen`](src/screens/ArticleListScreen.tsx:220) | Already correct |

**Only HomeScreen** needs its `TAB_BAR_HEIGHT` removed from paddingBottom since it was the only one that had the workaround.

## Summary of Changes

| File | Change |
|------|--------|
| [`RootNavigator.tsx`](src/navigation/RootNavigator.tsx:348) | Remove `position: absolute` from `tabBarWrapper` |
| [`RootNavigator.tsx`](src/navigation/RootNavigator.tsx:182) | Change animation from `translateY` to `maxHeight` + `overflow: hidden` |
| [`ScrollContext.tsx`](src/lib/ScrollContext.tsx) — or home screen | Change hide offset to `-TAB_BAR_HEIGHT` |
| [`HomeScreen.tsx`](src/screens/HomeScreen.tsx:446) | Remove `+ TAB_BAR_HEIGHT` from `paddingBottom` |
