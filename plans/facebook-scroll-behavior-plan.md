# Facebook-Style Scroll Behavior Plan

## Current Architecture (Already Implements 3/3 Behaviors)

The scroll-driven hide/show behavior for Header + CategoryFilter + TabBar is **already architecturally implemented**. Two bugs need fixing.

---

### Behavior 1: Header hides on scroll down, shows on scroll up ✅

| State | `headerTranslateY` | Effect |
|-------|-------------------|--------|
| Visible | `0` | Header at `top:0`, content visible |
| Hidden | `-HEADER_HEIGHT` (-50) | Header slides up off-screen |

- Uses `Animated.timing` with `useNativeDriver: true` (transform only) — no frozen object bug
- See [`HomeScreen.tsx:137-175`](../src/screens/HomeScreen.tsx:137)

### Behavior 2: CategoryFilter sticks to top when Header hides ✅

The CategoryFilter shares the **same `headerTranslateY`** as the Header:

```
When visible:  top: HEADER_HEIGHT + insets.top + translateY(0)
               = 50 + insets.top
When hidden:   top: HEADER_HEIGHT + insets.top + translateY(-HEADER_HEIGHT)
               = 50 + insets.top + (-50)
               = insets.top  ← sticks to safe area top!
```

- See [`HomeScreen.tsx:352-365`](../src/screens/HomeScreen.tsx:352)

### Behavior 3: TabBar hides on scroll down, shows on scroll up ⚠️ (partial bug)

| State | `tabBarTranslateY` | Effect |
|-------|-------------------|--------|
| Visible | `0` | TabBar at normal position |
| Hidden | `TAB_BAR_HEIGHT(60)` ❌ | TabBar only moves 60px down, **still partially visible** |

**Root cause:** TabBar actual height ≈ **86px** on devices with home indicator (insets.bottom ≈ 34), but `TAB_BAR_HEIGHT = 60` only pushes it 60px down. 26px remains visible.

TabBar height breakdown ([`TabBar.tsx:161-165`](../src/components/layout/TabBar.tsx:161)):
```
paddingTop(4) + paddingVertical(4) + icon_marginBottom(2) + icon(24) + label(~14)
+ paddingVertical(4) + paddingBottom(Math.max(insets.bottom, 4) ≈ 34)
= ~86px on home-indicator devices
```

**Fix:** Increase `TAB_BAR_HEIGHT => TAB_BAR_HIDE_OFFSET (120)` to ensure TabBar fully leaves screen on all devices.

---

## Bug 2: `paddingTop` Too Small ❌

**Current (wrong):**
```typescript
paddingTop: CAT_FILTER_HEIGHT,  // 50px
```

**Problem:** When Header is visible, total overlay height = `insets.top + HEADER_HEIGHT(50) + CAT_FILTER_HEIGHT(50)` = `insets.top + 100`. With paddingTop only 50, content starts BETWEEN Header and CategoryFilter — content peeks through the gap.

**Fix:**
```typescript
paddingTop: insets.top + HEADER_HEIGHT + CAT_FILTER_HEIGHT,
```

Add constant for clarity:
```typescript
const CONTENT_TOP = HEADER_HEIGHT + CAT_FILTER_HEIGHT; // 100px
```

Then:
```typescript
paddingTop: insets.top + CONTENT_TOP,
```

### After fix — visual behavior:

| Header state | Content starts at | Overlay bottom | Gap |
|---|---|---|---|
| Visible (translateY:0) | `insets.top + 100` | CategoryFilter at `insets.top + 100` | 0 ✅ |
| Hidden (translateY:-50) | `insets.top + 100` | CategoryFilter at `insets.top + 50` | 50px (header area) ✅ |

---

## Files to Change

### 1. [`src/screens/HomeScreen.tsx`](../src/screens/HomeScreen.tsx)

Four small changes:

**a) Add `CONTENT_TOP` constant** (around line 62):
```typescript
const CONTENT_TOP = HEADER_HEIGHT + CAT_FILTER_HEIGHT; // 100px
```

**b) Rename `TAB_BAR_HEIGHT` to `TAB_BAR_HIDE_OFFSET` and increase value** (line 62):
```typescript
const TAB_BAR_HIDE_OFFSET = 120; // Large enough to fully push TabBar off-screen on any device
```

Keep `TAB_BAR_HEIGHT = 60` for paddingBottom calculation (separate concern).

**c) Fix paddingTop** (line 321):
```typescript
// Before:
paddingTop: CAT_FILTER_HEIGHT,
// After:
paddingTop: insets.top + CONTENT_TOP,
```

**d) Fix TabBar hide translateY** (line 150/165):
```typescript
// Before:
toValue: TAB_BAR_HEIGHT,
// After:
toValue: TAB_BAR_HIDE_OFFSET,
```

### 2. No changes needed to:
- [`src/lib/ScrollContext.tsx`](../src/lib/ScrollContext.tsx) — already provides `tabBarTranslateY`
- [`src/navigation/RootNavigator.tsx`](../src/navigation/RootNavigator.tsx) — already wraps TabBar with `Animated.View`
- [`src/components/layout/TabBar.tsx`](../src/components/layout/TabBar.tsx) — no changes needed

---

## Summary

| Feature | Status | Fix |
|---------|--------|-----|
| Header hide/show | ✅ Done | `headerTranslateY` Animated.timing, useNativeDriver:true |
| CategoryFilter sticky | ✅ Done | Same `headerTranslateY` + `top: HEADER_HEIGHT + insets.top` math |
| TabBar hide/show | ❌ Partial | `TAB_BAR_HEIGHT(60)` → `TAB_BAR_HIDE_OFFSET(120)` — TabBar not fully pushed off-screen |
| paddingTop | ❌ Bug | `CAT_FILTER_HEIGHT(50)` → `insets.top + CONTENT_TOP(100)` — content peeks between overlays |

**Total work:** ~4 lines changed in 1 file, no new files, no new dependencies.
