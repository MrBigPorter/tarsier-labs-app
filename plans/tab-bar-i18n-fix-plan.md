# Fix: TabBar Labels Not Updating on Language Switch

## Problem

TabBar labels (Home, Tags, Categories, Bookmarks, About) stay in English when the user switches language. The tab labels are hardcoded as static strings in `tabBarLabel` options and never update when i18n locale changes.

## Root Cause

In `src/navigation/RootNavigator.tsx:224`, each `MainTab.Screen` has a hardcoded `tabBarLabel`:

```tsx
options={{ tabBarLabel: 'Home' }}
```

The TabBar component reads `descriptors[route.key]?.options?.tabBarLabel` at line 193, which returns the static English string regardless of the current language.

## Fix

Three changes to `src/navigation/RootNavigator.tsx`:

### 1. Add `useTranslation` import (line ~31)

```tsx
import { useTranslation } from 'react-i18next';
```

### 2. Add `TAB_LABEL_KEYS` mapping + use `useTranslation()` in `MainTabNavigator` (line ~178)

```tsx
/** Maps tab route names to i18n translation keys */
const TAB_LABEL_KEYS: Record<string, string> = {
  HomeTab: 'common.home',
  TagsTab: 'common.tags',
  CategoriesTab: 'common.categories',
  BookmarksTab: 'common.bookmarks',
  AboutTab: 'common.about',
};

const MainTabNavigator = React.memo(function MainTabNavigator(): React.JSX.Element {
  const { colors } = useTheme();
  const { tabBarTranslateY } = useScrollContext();
  const { t } = useTranslation();  // ← ADD THIS
```

### 3. Use translated labels in tabBar render (line ~193)

```diff
- label: descriptors[route.key]?.options?.tabBarLabel as string ?? route.name,
+ label: t(TAB_LABEL_KEYS[route.name] ?? route.name),
```

## How It Works

1. `useTranslation()` from `react-i18next` subscribes to i18next's `languageChanged` event
2. When language changes, the hook triggers a component re-render
3. The `tabBar` render function runs again with the new `t()` translations
4. TabBar receives translated labels as props

### Translation keys already exist in all locale files

| Key                 | en         | zh   | ja           | ko       | fr         | de          |
| ------------------- | ---------- | ---- | ------------ | -------- | ---------- | ----------- |
| `common.home`       | Home       | 首页 | ホーム       | 홈       | Accueil    | Startseite  |
| `common.tags`       | Tags       | 标签 | タグ         | 태그     | Étiquettes | Tags        |
| `common.categories` | Categories | 分类 | カテゴリー   | 카테고리 | Catégories | Kategorien  |
| `common.bookmarks`  | Bookmarks  | 收藏 | ブックマーク | 북마크   | Favoris    | Lesezeichen |
| `common.about`      | About      | 关于 | について     | 소개     | À propos   | Über        |

## Verification

Run `npx tsc --noEmit` — should pass with zero errors.
