# Header + TabBar UI Optimization Plan

## Overview

Two areas need updating to match the web frontend design:
1. **Header** — Add logo, reduce icons, settings via BottomSheet
2. **TabBar** — Align icons and animation with web

---

## Part 1: Header Optimization

### Problem
- No logo (plain text "Tarsier" only)
- 4 icons inline (globe, themeToggle, search, user avatar) → cluttered

### Web Reference
Web mobile header ([`Header.tsx`](/Volumes/MySSD/work/JoyMini_Nest_Monorepo/apps/frontend-blog/src/components/Header.tsx)):
```
[Logo] Tarsier Labs          [⚙️]  [🔍]
```
Only 2 icons: Settings (opens `MobileSettingsDrawer`) + Search (opens `SearchModal`)

### Approach: BottomSheet (like web's MobileSettingsDrawer)
- Click ⚙️ → [`BottomSheet`](src/components/layout/BottomSheet.tsx) slides up with settings content
- Reuses existing [`ThemeToggle`](src/components/features/ThemeToggle.tsx) and [`LanguageSwitcher`](src/components/features/LanguageSwitcher.tsx)
- Stays in context (doesn't navigate away)

### Header Layout Change
```
Before: [        Tarsier        ] [🌐][🌙][🔍][👤]
After:  [🖼️ Tarsier]              [⚙️]  [🔍]
```

### Settings BottomSheet Content
```
┌──────────────────────────────────────┐
│  ─── drag handle ───                │
│                                      │
│  👤 User info / Sign In              │
│  ─────────────────────────────────   │
│  🌙 Theme toggle                     │
│  🌐 Language selector                │
│  🔖 Bookmarks                        │
│  ⚙️ Full Settings →                  │
│  ─────────────────────────────────   │
│  🚪 Sign Out (if logged in)          │
└──────────────────────────────────────┘
```

### Files: Header
| File | Change |
|------|--------|
| [`src/components/layout/Header.tsx`](src/components/layout/Header.tsx) | Major restructure |
| [`assets/logo.png`](assets/logo.png) | Copy from root [`logo.png`](logo.png) |

---

## Part 2: TabBar — Align with Web

### Current vs Web Comparison

| Aspect | Current Mobile | Web Frontend |
|--------|---------------|--------------|
| **Tabs** | Home, Search, Bookmarks, About | Home, Categories, Tags, Bookmarks, About |
| **Icons** | `home`, `search`, `bookmark`, `info` | House, Folder, Tag, Bookmark, User (SVG) |
| **Active animation** | Dot scale+fade below icon (Animated.timing) | Spring background circle using `layoutId` |

### Analysis

**Icons:**
- Web's Home icon → mobile's `home` ✅ Already matches
- Web's Categories (folder) → mobile currently maps Categories to `grid` icon. Web uses folder icon. Could update to use a folder-like icon or keep `grid` which is reasonable.
- Web's Tags (hash/tag) → `tag` icon exists in [`SvgIcon`](src/components/core/SvgIcon.tsx) ✅
- Web's Bookmarks → mobile's `bookmark` ✅ Already matches
- Web's About (user icon) → mobile currently uses `info`. Web uses a user/profile icon.

**Animation:**
- Web uses `framer-motion` spring animation with `layoutId` — a background circle (`bg-primary/10`, i.e., 10% opacity primary color) that smoothly transitions between tabs
- Mobile uses `Animated.Value` with scale/fade timing on a small dot below the icon
- **Proposed**: Replace with `react-native-reanimated` `withSpring()` for smooth spring animation, and use a background highlight circle behind the active icon (matching web's `rounded-full bg-primary/10`)

### SvgIcon Names Available
From [`SvgIcon.tsx`](src/components/core/SvgIcon.tsx):
- `home` ✅ Web match
- `search` (mobile-only, not in web bottom nav)
- `tag` ✅ Web match
- `bookmark` ✅ Web match
- `user` ✅ Web match (for About tab, currently using `info`)
- `grid` (currently used for Categories)

### Proposed TabBar Changes

1. **Update icon mapping** in [`RootNavigator.tsx`](src/navigation/RootNavigator.tsx) where `TabItem[]` is defined:
   - Home: `home` → `home` (unchanged)
   - Search: `search` → `search` (unchanged, mobile-specific)
   - Bookmarks: `bookmark` → `bookmark` (unchanged)
   - About: `info` → `user` (match web's user icon)

2. **Update animation** in [`TabBar.tsx`](src/components/layout/TabBar.tsx):
   - Replace `Animated.Value` timing with `react-native-reanimated` spring animation
   - Show active background circle behind icon (like web's `rounded-full bg-primary/10`) instead of dot below
   - Use `withSpring()` for smooth transition
   - Keep existing Animated API approach (framer-motion not available in RN)

### Files: TabBar

| File | Change |
|------|--------|
| [`src/components/layout/TabBar.tsx`](src/components/layout/TabBar.tsx) | Rewrite animation to spring, update active indicator style (circle → dot) |
| [`src/navigation/RootNavigator.tsx`](src/navigation/RootNavigator.tsx) | Update About tab icon from `info` to `user` |

---

## Complete File Change List

| File | Action | Description |
|------|--------|-------------|
| [`src/components/layout/Header.tsx`](src/components/layout/Header.tsx) | Modify | Add logo, reduce icons, BottomSheet for settings, remove modals |
| [`assets/logo.png`](assets/logo.png) | Create | Copy from root [`logo.png`](logo.png) |
| [`src/components/layout/TabBar.tsx`](src/components/layout/TabBar.tsx) | Modify | Spring animation, background circle indicator |
| [`src/navigation/RootNavigator.tsx`](src/navigation/RootNavigator.tsx) | Modify | About icon: `info` → `user` |

### Unchanged
- [`src/screens/HomeScreen.tsx`](src/screens/HomeScreen.tsx) — No changes needed
- [`src/screens/SettingsScreen.tsx`](src/screens/SettingsScreen.tsx) — No changes needed
- [`src/lib/ScrollContext.tsx`](src/lib/ScrollContext.tsx) — No changes needed
- [`src/components/features/ThemeToggle.tsx`](src/components/features/ThemeToggle.tsx) — Reused as-is
- [`src/components/features/LanguageSwitcher.tsx`](src/components/features/LanguageSwitcher.tsx) — Reused as-is

---

## Execution Steps

1. Copy `logo.png` to `assets/logo.png`
2. Edit [`Header.tsx`](src/components/layout/Header.tsx):
   - Add `Image` and `BottomSheet` imports
   - Rewrite leftSection: Logo + "Tarsier" (no back) or Back arrow (with back)
   - Rewrite rightSection: Remove globe, ThemeToggle, avatar. Add settings icon.
   - Add `showSettings` state and `BottomSheet` with settings content
   - Remove language modal and user menu modal blocks
   - Remove unused imports
   - Update StyleSheet
3. Edit [`TabBar.tsx`](src/components/layout/TabBar.tsx):
   - Replace timing animation with spring-based animation
   - Change active indicator from dot to background circle (like web)
4. Edit [`RootNavigator.tsx`](src/navigation/RootNavigator.tsx):
   - Change About icon from `info` to `user`
5. Verify TypeScript compilation
