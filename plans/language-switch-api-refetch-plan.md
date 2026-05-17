# Language Switch — API Data Refresh Plan

## Problem

When the user switches language in `SettingsScreen`, only **UI text** (via `react-i18next` `useTranslation()`) updates immediately. All **API-fetched data** (articles, categories, tags, tag articles, category articles, article detail, archive, featured articles, popular articles, etc.) remains in the old language.

## Root Cause Analysis

Two interrelated issues:

### Issue 1: `lang` parameter missing from most API queries

| Screen | Hook | Passes `lang`? |
|--------|------|---------------|
| `HomeScreen` | `useGetArticlesQuery` | ✅ (via `getCurrentLanguage()`) |
| `CategoryListScreen` | `useGetCategoriesQuery(undefined)` | ❌ |
| `TagListScreen` | `useGetTagsQuery(undefined)` | ❌ |
| `ArticleListScreen` | `useGetArticlesQuery({...})` | ❌ |
| `TagArticlesScreen` | `useGetTagBySlugQuery({ slug, page, pageSize })` | ❌ |
| `CategoryArticlesScreen` | `useGetCategoryBySlugQuery({ slug, page, pageSize })` | ❌ |
| `ArchiveScreen` | `useGetArticlesQuery({ page: 1, pageSize: 200 })` | ❌ |
| `ArticleDetailScreen` | `useGetArticleBySlugQuery({ slug })` | ❌ |
| `BookmarksScreen` | Redux `fetchBookmarks` | ❌ (not RTK Query) |

### Issue 2: `getCurrentLanguage()` is NOT reactive

Even in `HomeScreen` where `lang` IS passed, `getCurrentLanguage()` reads `i18n.language` at call time but does **not** subscribe to `i18n` change events. When `i18n.changeLanguage()` is called:

- `useTranslation()` hooks re-render (UI text updates)
- `getCurrentLanguage()` value does NOT change because the component doesn't re-render
- RTK Query doesn't detect a new query parameter → no refetch

## Solution Architecture

### Approach: Reactive `useCurrentLanguage()` hook + add `lang` to all queries

```
┌─────────────────────────────────────────────────────────────────┐
│                    Language Change Flow                         │
│                                                                 │
│  SettingsScreen                                                 │
│  ┌──────────────────────────────────────────────┐               │
│  │ handleLanguageSelect(langCode)                │               │
│  │   setCurrentLang(langCode)                    │               │
│  │   changeLanguage(langCode)  ──────────────────┼──┐           │
│  └──────────────────────────────────────────────┘  │           │
│                                                    ▼           │
│                                          ┌───────────────────┐  │
│                                          │  i18n.changeLanguage│  │
│                                          │  (react-i18next)   │  │
│                                          └────────┬──────────┘  │
│                                                   │              │
│                     ┌─────────────────────────────┼──────────┐   │
│                     │         Triggers re-render  │          │   │
│                     │           in all components │          │   │
│                     │     using useCurrentLanguage()         │   │
│                     └─────────────────────────────┼──────────┘   │
│                                                   ▼              │
│                                          ┌───────────────────┐  │
│                                          │ Component         │  │
│                                          │ re-renders with   │  │
│                                          │ new `lang` value  │  │
│                                          └────────┬──────────┘  │
│                                                   │              │
│                                                   ▼              │
│                                          ┌───────────────────┐  │
│                                          │ RTK Query detects │  │
│                                          │ new cache key     │  │
│                                          │ (lang changed)    │  │
│                                          │ → re-fetches      │  │
│                                          └───────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Implementation Steps

### Step 1: Create `useCurrentLanguage()` reactive hook

**File:** `src/lib/i18n/index.ts`

Add a custom hook that wraps `useTranslation()` for reactivity:

```typescript
import { useTranslation } from 'react-i18next';

/**
 * Reactive language hook — triggers re-render when i18n language changes.
 * Use this instead of getCurrentLanguage() in React components.
 */
export function useCurrentLanguage(): string {
  const { i18n } = useTranslation();
  return i18n.language;
}
```

This works because `useTranslation()` from `react-i18next` subscribes to `i18n` event `languageChanged` and triggers re-render when the language changes.

### Step 2: Add `lang` to `SearchParams` interface (for SearchScreen)

**File:** `src/api/endpoints/articles.ts`

The `SearchParams` interface (line 18-22) does not include `lang`. Add it:

```typescript
interface SearchParams {
  q: string;
  page?: number;
  pageSize?: number;
  lang?: string;
}
```

### Step 3: Update all screens to use `useCurrentLanguage()` and pass `lang`

| # | File | Change |
|---|------|--------|
| 3a | `src/screens/HomeScreen.tsx` | Replace `getCurrentLanguage()` with `useCurrentLanguage()` at line 137 |
| 3b | `src/screens/CategoryListScreen.tsx` | Add `const lang = useCurrentLanguage()`, change to `useGetCategoriesQuery(lang)` |
| 3c | `src/screens/TagListScreen.tsx` | Add `const lang = useCurrentLanguage()`, change to `useGetTagsQuery(lang)` |
| 3d | `src/screens/ArticleListScreen.tsx` | Add `const lang = useCurrentLanguage()`, pass in params `{ page, pageSize, ..., lang }` |
| 3e | `src/screens/TagArticlesScreen.tsx` | Add `const lang = useCurrentLanguage()`, pass in params `{ slug, page, pageSize, lang }` |
| 3f | `src/screens/CategoryArticlesScreen.tsx` | Add `const lang = useCurrentLanguage()`, pass in params `{ slug, page, pageSize, lang }` |
| 3g | `src/screens/ArchiveScreen.tsx` | Add `const lang = useCurrentLanguage()`, pass in params `{ page: 1, pageSize: 200, lang }` |
| 3h | `src/screens/ArticleDetailScreen.tsx` | Add `const lang = useCurrentLanguage()`, pass to `useGetArticleBySlugQuery({ slug, lang })` |
| 3i | `src/screens/SearchScreen.tsx` | Add `const lang = useCurrentLanguage()`, pass in params `{ q, page, pageSize: 20, lang }` |

### Step 4: Endpoints that cannot accept `lang` (backend limitation)

These endpoint type definitions do NOT have a `lang` parameter:

- `getPopularArticles` — `number | void` (limit only)
- `getPopularTags` — `number | void` (limit only)
- `getRelatedArticles` — `{ articleId, limit }`
- `useGetPopularTagsQuery` is NOT actually used in any screen (TagListScreen only imports `useGetTagsQuery`)

These would require backend API changes to accept a `lang` parameter before we can add it client-side. Document for future backend work.

`getFeaturedArticles` — `string | void` — This DOES accept lang. Check if any screen uses it.

Let me verify which screens use these endpoints...

Actually let me check if `getFeaturedArticles` is used anywhere and if there are other endpoints used in the app.

Actually, I already checked the screens. Let me list what's used:

From the HomeScreen, I see it imports `useGetArticlesQuery` but not the others.

Let me check what else is used...

Actually, I should also check if there's a `SearchScreen` or similar.

Let me also look for `getFeaturedArticles`, `getPopularArticles`, `getPopularTags` usage.

Actually, I should search for these. But for the plan, let me also note:

**`getFeaturedArticles`** (accepts `string | void` — lang parameter):
- Need to check if used anywhere

**`getPopularArticles`** (accepts `number | void` — limit only):
- Cannot add lang parameter without backend change

**`getPopularTags`** (accepts `number | void` — limit only):
- Cannot add lang parameter without backend change

**`getRelatedArticles`** (accepts `{ articleId, limit }`):
- Cannot add lang parameter without backend change

**`searchArticles`** (accepts `SearchParams` with `q, page, pageSize`):
- Cannot add lang parameter without backend change

### Step 4: TypeScript verification

After all changes, run `npx tsc --noEmit` to verify clean compilation.

## Implementation Order

1. Add `useCurrentLanguage()` hook to `src/lib/i18n/index.ts`
2. Update `HomeScreen.tsx` (replace `getCurrentLanguage()` with `useCurrentLanguage()`)
3. Update `CategoryListScreen.tsx` (add lang to `useGetCategoriesQuery`)
4. Update `TagListScreen.tsx` (add lang to `useGetTagsQuery`)
5. Update `ArticleListScreen.tsx` (add lang to params)
6. Update `TagArticlesScreen.tsx` (add lang to params)
7. Update `CategoryArticlesScreen.tsx` (add lang to params)
8. Update `ArchiveScreen.tsx` (add lang to params)
9. Update `ArticleDetailScreen.tsx` (add lang to params)
10. Run TypeScript check
