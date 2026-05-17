# Style Comparison Analysis: Mobile App vs Web App

## Overview

Comprehensive comparison between [`frontend-blog-mobile`](/) (React Native) and [`frontend-blog`](/Volumes/MySSD/work/JoyMini_Nest_Monorepo/apps/frontend-blog) (Next.js Web).

---

## 🔴 Critical: Brand Color Mismatch

| Scale | Mobile App (design_tokens) | Web App (globals.css) |
|-------|---------------------------|----------------------|
| `primary-50` | `#fef6ee` | `#fbf7eb` |
| `primary-100` | `#fdead7` | `#f5ebd1` |
| `primary-200` | `#f9dbaf` | `#edd5a3` |
| `primary-300` | `#f7b27a` | `#e4bc73` |
| `primary-400` | `#f38744` | `#dca449` |
| **`primary-500`** | **`#fc7701`** 🟠 | **`#d68a29`** 🟤 |
| `primary-600` | `#e04f16` | `#ba6b20` |
| `primary-700` | `#b93815` | `#954f1d` |
| `primary-800` | `#932f19` | `#7a3f1d` |
| `primary-900` | `#772917` | `#65331b` |

**The web app's brand color (#d68a29) is an amber-brown, while the mobile app uses vibrant orange (#fc7701).** The web app's `globals.css` has hardcoded values that do NOT match the shared `variables.tokens.json`.

**Decision needed:** Which is the CORRECT brand color? The design tokens (`variables.tokens.json`) define the source of truth.

---

## Component-by-Component Comparison

### 1. ArticleCard

| Feature | Mobile ([`ArticleCard.tsx`](src/components/blog/ArticleCard.tsx)) | Web ([`ArticleCard.tsx`](/Volumes/MySSD/work/JoyMini_Nest_Monorepo/apps/frontend-blog/src/components/blog/ArticleCard.tsx)) |
|---------|------|-----|
| **Layout** | Horizontal (image left + content right). Compact mode: column, 280px wide | Vertical (image on top by default). Configurable: `imagePosition='left'` or `'top'` |
| **Image** | Simple `<Image>` with WebP format conversion | Rich: `BlurhashImage` with blurhash placeholder, `HlsVideoPlayer`, native `<video>` with play overlay |
| **Video support** | ❌ None | ✅ HLS streaming + native video + duration badge + play overlay |
| **Category badge** | Semi-transparent overlay (`colors.primary + '20'`) | Solid color (`bg-primary-50 dark:bg-primary-900/30`) |
| **Bookmark** | Simple star character (☆/★) | Full `BookmarkIconButton` component with backdrop blur |
| **Meta row** | Author avatar + name, bookmark star, timeAgo | Views count, comments count, category badge |
| **Hover effects** | N/A (touch) | `group-hover:scale-105`, `hover:shadow-md`, `hover:border-primary/20` |
| **Loading** | Skeleton component | Inline skeleton with `animate-pulse` |
| **Color keys used** | `colors.surface`, `colors.text`, `colors.primary`, `colors.textSecondary`, `colors.textTertiary`, `colors.border` | Tailwind: `bg-white dark:bg-slate-900`, `text-slate-800 dark:text-slate-200`, `border-slate-200 dark:border-slate-700` |

### 2. Hero/Featured Section

| Feature | Mobile ([`HomeScreen.tsx`](src/screens/HomeScreen.tsx)) | Web ([`HeroSection.tsx`](/Volumes/MySSD/work/JoyMini_Nest_Monorepo/apps/frontend-blog/src/components/blog/HeroSection.tsx)) |
|---------|------|-----|
| **Layout** | Horizontal FlatList, card width = 75% screen | Large carousel with auto-play (5s), side article grid (2 cols) |
| **Auto-play** | ❌ None | ✅ 5s interval, pause on hover |
| **Max articles** | Unlimited | 5 articles |
| **Video support** | ❌ | ✅ HLS video + native video |
| **Dark overlay** | ❌ | ✅ Gradient overlay on hero images |
| **Dot indicators** | ❌ | ✅ (implicit, via activeIndex) |

### 3. Header

| Feature | Mobile ([`Header.tsx`](src/components/layout/Header.tsx)) | Web ([`Header.tsx`](/Volumes/MySSD/work/JoyMini_Nest_Monorepo/apps/frontend-blog/src/components/Header.tsx)) |
|---------|------|-----|
| **Back button** | Auto-detected via `canGoBack()` | N/A (SPA routing) |
| **Search** | Icon → navigates to SearchScreen | Inline search bar + SearchModal (dynamic import) |
| **Language switcher** | ❌ None | ✅ Full dropdown with flags, locale switching |
| **Theme toggle** | Separate `ThemeToggle` component | ✅ Sun/Moon icons in header |
| **User menu** | Avatar → Profile or Auth screen | ✅ Dropdown with login/logout, bookmarks, settings |
| **Bookmarks link** | ❌ | ✅ ProtectedLink in menu |
| **Headroom** | N/A | ✅ Hide on scroll for mobile |
| **Dynamic imports** | N/A | ✅ SearchModal, MobileSettingsDrawer dynamically loaded |
| **Color keys** | `colors.background`, `colors.border`, `colors.text`, `colors.textSecondary` | Tailwind CSS classes with dark mode |

### 4. Bottom Navigation

| Feature | Mobile ([`TabBar.tsx`](src/components/layout/TabBar.tsx)) | Web ([`BottomNavigation.tsx`](/Volumes/MySSD/work/JoyMini_Nest_Monorepo/apps/frontend-blog/src/components/BottomNavigation.tsx)) |
|---------|------|-----|
| **Tabs** | Home, Articles, Categories, Profile (4) | Home, Categories, Tags, Bookmarks, About (5) |
| **Animation** | React Native `Animated.Value` with timing | Framer Motion |
| **Active indicator** | Dot below label | Animated background/highlight |
| **Safe area** | `useSafeAreaInsets()` | Manual `visualViewport` API + `env(safe-area-inset-bottom)` |
| **Keyboard handling** | ❌ | ✅ Detects keyboard open → prevents blank space |
| **Protected links** | ❌ | ✅ ProtectedLink for bookmarks (auth-gated) |

### 5. Theme System

| Feature | Mobile ([`ThemeContext.tsx`](src/lib/theme/ThemeContext.tsx)) | Web ([`ThemeProvider.tsx`](/Volumes/MySSD/work/JoyMini_Nest_Monorepo/apps/frontend-blog/src/components/ThemeProvider.tsx)) |
|---------|------|-----|
| **Default mode** | Dark (`savedTheme ?? 'dark'`) | Dark |
| **Storage** | MMKV (React Native) | localStorage |
| **Tokens** | Full `TokensLight` / `TokensDark` from design_tokens.g.ts | CSS variables in `globals.css` + Tailwind dark variant |
| **Mechanism** | React Context with `useTheme()` / `useFront()` | CSS class toggle on `<html>` element (`dark` class) |

### 6. Typography

Both apps use **Inter** font family. The mobile app defines explicit `TextStyle` objects in [`typography.ts`](src/lib/theme/typography.ts) mapping to generated token values. The web app uses Tailwind's `font-sans` configured to Inter.

### 7. Spacing & Radius

Both apps derive from the same `variables.tokens.json`. The mobile app uses explicit [`spacing.ts`](src/lib/theme/spacing.ts) values, the web app uses Tailwind's built-in spacing scale (which maps to slightly different values).

---

## Summary of Differences

### High Priority
1. **🔴 Brand color mismatch** — Web app uses `#d68a29` instead of `#fc7701`
2. **🟡 Card layout** — Mobile uses horizontal layout; web uses vertical with richer meta data
3. **🟡 Missing features in mobile**:
   - HLS video support
   - Blurhash placeholders
   - Views/comments counts
   - Proper bookmark button with backdrop blur
   - Tag support (web has Tags tab in bottom nav)

### Medium Priority
4. **🟡 Header simplification** — Mobile missing language switcher, theme toggle, user menu dropdown
5. **🟡 No auto-play hero carousel** — Mobile uses simple horizontal FlatList
6. **🟡 Bottom nav differences** — Web has Tags + Bookmarks + About; Mobile has Profile + Articles
7. **🔵 Category card styling** — Should verify consistency

### Low Priority
8. **🔵 Animation libraries** — Web uses Framer Motion; Mobile uses RN Animated API
9. **🔵 Skeleton components** — Both have them but different implementations
10. **🔵 Hover effects** — Web has hover states; Mobile naturally doesn't

---

## Recommended Action Items

1. **Decide on the correct brand color** — The design tokens (`variables.tokens.json`) define `#fc7701` as Brand 500. If this is the source of truth, the web app's `globals.css` needs updating.

2. **Audit all color usage** — Check every component in both apps for color key usage and ensure they map to the same semantic meaning.

3. **Sync component features** — Add missing features to mobile: views/comments display, video player support, blurhash images.

4. **Unify navigation structure** — Align bottom nav tabs between apps.

5. **Add language switcher** — Mobile doesn't have it; web does. Mobile has `i18n` config already set up.
