# Empty State i18n Implementation Plan

## Problem
All empty/error state text across screens is hardcoded in English. When the user switches language (Settings → Language), these strings remain in English.

## Solution
Replace hardcoded strings with `t('key.path')` calls. Some keys already exist in `en.json`; new keys will be added to all 6 language files.

## Existing Keys (no new keys needed)
These i18n keys already exist and can be reused directly:

| Key | English Value | Screens Using It |
|-----|---------------|-----------------|
| `common.retry` | "Retry" | HomeScreen, ArticleListScreen, ArticleDetailScreen, SearchScreen, TagListScreen, CategoryListScreen, TagArticlesScreen, CategoryArticlesScreen, ArchiveScreen |
| `common.noResults` | "No results found" | SearchScreen |
| `comment.noComments` | "No comments yet" | ArticleDetailScreen |
| `comment.writeComment` | "Write a comment" | ArticleDetailScreen |
| `search.title` | "Search Articles" | SearchScreen |
| `search.loadFailed` | "Search failed, please try again" | SearchScreen |
| `home.empty` | "No articles yet" | HomeScreen, ArticleListScreen |
| `categories.empty` | "No categories yet" | CategoryListScreen |
| `categories.emptyArticles` | "No articles in this category yet" | HomeScreen, ArticleListScreen, CategoryArticlesScreen |
| `tags.empty` | "No tags yet" | TagListScreen |
| `tags.emptyArticles` | "No articles using this tag yet" | TagArticlesScreen, ArticleListScreen |
| `bookmarks.empty` | "No bookmarked articles yet" | BookmarksScreen |

## New Keys to Add (6 language files)

### `common` namespace
```json
"common": {
  "goBack": "Go back",
  "pullDownToRetry": "Pull down to retry",
  "checkBackLater": "Check back later for new content"
}
```

### `home` namespace
```json
"home": {
  "error": {
    "unableToLoad": "Unable to load articles"
  }
}
```

### `article` namespace
```json
"article": {
  "empty": {
    "inCategory": "No articles in this category"
  },
  "error": {
    "loadFailed": "Failed to load articles",
    "loadFailedSingle": "Failed to load article",
    "generic": "An error occurred",
    "pullDownToRetry": "Pull down to retry loading"
  }
}
```

### `search` namespace
```json
"search": {
  "recent": "Recent Searches",
  "clear": "Clear",
  "empty": {
    "hint": "Type at least 2 characters to search across all articles",
    "noResultsFor": "No articles matching \"{{query}}\""
  },
  "error": {
    "connection": "Please check your connection and try again"
  }
}
```

### `tags` namespace
```json
"tags": {
  "error": {
    "loadFailed": "Failed to load tags"
  },
  "empty": {
    "description": "Tags will appear here once articles are categorized"
  }
}
```

### `categories` namespace
```json
"categories": {
  "error": {
    "loadFailed": "Failed to load categories"
  },
  "empty": {
    "description": "Categories will appear here once articles are created"
  }
}
```

### `bookmarks` namespace
```json
"bookmarks": {
  "signInToView": "Sign in to view bookmarks",
  "saveDescription": "Save articles to read later by tapping the bookmark icon",
  "signIn": "Sign In",
  "emptyTitle": "No bookmarks yet",
  "emptyHint": "Tap the bookmark icon on any article to save it here"
}
```

### `archive` namespace (NEW top-level key)
```json
"archive": {
  "error": {
    "loadFailed": "Failed to load archive"
  },
  "empty": {
    "noArchived": "No archived articles",
    "description": "Articles will appear here once published"
  }
}
```

### `comment` namespace
```json
"comment": {
  "beFirst": "Be the first to share your thoughts"
}
```

## Screen-by-Screen Changes

### 1. HomeScreen.tsx
- **Import to add**: `import { useTranslation } from 'react-i18next';`
- **Hook to add**: `const { t } = useTranslation();`
- **Replacements**:

| Line | Hardcoded String | Replacement |
|------|-----------------|-------------|
| 377 | `"Unable to load articles"` | `t('home.error.unableToLoad')` |
| 378 | `"Pull down to retry"` | `t('common.pullDownToRetry')` |
| 379 | `"Retry"` | `t('common.retry')` |
| 391 | `'No articles in this category'` (with selectedCategoryId) | `t('categories.emptyArticles')` |
| 391 | `'No articles yet'` (without selectedCategoryId) | `t('home.empty')` |
| 392 | `'Try selecting a different category'` (with selectedCategoryId) | `t('article.empty.inCategory')` |
| 392 | `'Check back later for new content'` (without selectedCategoryId) | `t('common.checkBackLater')` |

### 2. ArticleListScreen.tsx
- **Import to add**: `import { useTranslation } from 'react-i18next';`
- **Hook to add**: `const { t } = useTranslation();`
- **Replacements**:

| Line | Hardcoded String | Replacement |
|------|-----------------|-------------|
| 165 | `"Failed to load articles"` | `t('article.error.loadFailed')` |
| 166 | `"Pull down to retry loading"` | `t('article.error.pullDownToRetry')` |
| 167 | `{ label: 'Retry'` | `{ label: t('common.retry')` |
| 175 | `"No articles in this category"` | `t('categories.emptyArticles')` |
| 176 | `"Check back later for new content"` | `t('common.checkBackLater')` |
| 184 | `"No articles with this tag"` | `t('tags.emptyArticles')` |
| 185 | `"Check back later for new content"` | `t('common.checkBackLater')` |
| 192 | `"No articles yet"` | `t('home.empty')` |
| 193 | `"Check back later for new content"` | `t('common.checkBackLater')` |

### 3. ArticleDetailScreen.tsx
- **Import to add**: `import { useTranslation } from 'react-i18next';`
- **Hook to add**: `const { t } = useTranslation();`
- **Replacements**:

| Line | Hardcoded String | Replacement |
|------|-----------------|-------------|
| 240 | `"Failed to load article"` | `t('article.error.loadFailedSingle')` |
| 241 | `'An error occurred'` | `t('article.error.generic')` |
| 242 | `{ label: 'Retry'` | `{ label: t('common.retry')` |
| 244 | `{ label: 'Go back'` | `{ label: t('common.goBack')` |
| 510 | `"No comments yet"` | `t('comment.noComments')` |
| 511 | `"Be the first to share your thoughts"` | `t('comment.beFirst')` |
| 512 | `"Write a comment"` | `t('comment.writeComment')` |

### 4. SearchScreen.tsx
- **Import to add**: `import { useTranslation } from 'react-i18next';`
- **Hook to add**: `const { t } = useTranslation();`
- **Replacements**:

| Line | Hardcoded String | Replacement |
|------|-----------------|-------------|
| 150 | `"Recent Searches"` | `t('search.recent')` |
| 159 | `"Clear"` | `t('search.clear')` |
| 202 | `"Search articles"` | `t('search.title')` |
| 203 | `"Type at least 2 characters to search across all articles"` | `t('search.empty.hint')` |
| 218 | `"Search failed"` | `t('search.loadFailed')` |
| 219 | `"Please check your connection and try again"` | `t('search.error.connection')` |
| 220 | `{ label: 'Retry'` | `{ label: t('common.retry')` |
| 229 | `"No results found"` | `t('common.noResults')` |
| 230 | ``No articles matching "${debouncedQuery}"`` | ``t('search.empty.noResultsFor', { query: debouncedQuery })`` |

### 5. TagListScreen.tsx
- **Import to add**: `import { useTranslation } from 'react-i18next';`
- **Hook to add**: `const { t } = useTranslation();`
- **Replacements**:

| Line | Hardcoded String | Replacement |
|------|-----------------|-------------|
| 211 | `"Failed to load tags"` | `t('tags.error.loadFailed')` |
| 212 | `"Retry"` | `t('common.retry')` |
| 218 | `"No tags yet"` | `t('tags.empty')` |
| 219 | `"Tags will appear here once articles are categorized"` | `t('tags.empty.description')` |

### 6. CategoryListScreen.tsx
- **Import to add**: `import { useTranslation } from 'react-i18next';`
- **Hook to add**: `const { t } = useTranslation();`
- **Replacements**:

| Line | Hardcoded String | Replacement |
|------|-----------------|-------------|
| 121 | `"Failed to load categories"` | `t('categories.error.loadFailed')` |
| 122 | `"Retry"` | `t('common.retry')` |
| 128 | `"No categories yet"` | `t('categories.empty')` |
| 129 | `"Categories will appear here once articles are created"` | `t('categories.empty.description')` |

### 7. BookmarksScreen.tsx
- **Import to add**: `import { useTranslation } from 'react-i18next';`
- **Hook to add**: `const { t } = useTranslation();`
- **Replacements**:

| Line | Hardcoded String | Replacement |
|------|-----------------|-------------|
| 177 | `"Sign in to view bookmarks"` | `t('bookmarks.signInToView')` |
| 182 | `"Save articles to read later by tapping the bookmark icon"` | `t('bookmarks.saveDescription')` |
| 191 | `"Sign In"` | `t('bookmarks.signIn')` |
| 236 | `"No bookmarks yet"` | `t('bookmarks.emptyTitle')` |
| 237 | `"Tap the bookmark icon on any article to save it here"` | `t('bookmarks.emptyHint')` |

### 8. TagArticlesScreen.tsx
- **Import to add**: `import { useTranslation } from 'react-i18next';`
- **Hook to add**: `const { t } = useTranslation();`
- **Replacements**:

| Line | Hardcoded String | Replacement |
|------|-----------------|-------------|
| 195 | `"Failed to load articles"` | `t('article.error.loadFailed')` |
| 196 | `"Pull down to retry"` | `t('common.pullDownToRetry')` |
| 197 | `{ label: 'Retry'` | `{ label: t('common.retry')` |
| 201 | `"No articles with this tag"` | `t('tags.emptyArticles')` |

### 9. CategoryArticlesScreen.tsx
- **Import to add**: `import { useTranslation } from 'react-i18next';`
- **Hook to add**: `const { t } = useTranslation();`
- **Replacements**:

| Line | Hardcoded String | Replacement |
|------|-----------------|-------------|
| 220 | `"Failed to load articles"` | `t('article.error.loadFailed')` |
| 221 | `"Pull down to retry"` | `t('common.pullDownToRetry')` |
| 222 | `{ label: 'Retry'` | `{ label: t('common.retry')` |
| 226 | `"No articles in this category"` | `t('categories.emptyArticles')` |

### 10. ArchiveScreen.tsx
- **Import to add**: `import { useTranslation } from 'react-i18next';`
- **Hook to add**: `const { t } = useTranslation();`
- **Replacements**:

| Line | Hardcoded String | Replacement |
|------|-----------------|-------------|
| 188 | `"Failed to load archive"` | `t('archive.error.loadFailed')` |
| 189 | `{ label: 'Retry'` | `{ label: t('common.retry')` |
| 193 | `"No archived articles"` | `t('archive.empty.noArchived')` |
| 194 | `"Articles will appear here once published"` | `t('archive.empty.description')` |

## Implementation Order

| Step | Files | Description |
|------|-------|-------------|
| 1 | `src/messages/en.json` | Add all new keys with English values |
| 2 | `src/messages/zh.json` | Add all new keys with Chinese translations |
| 3 | `src/messages/ja.json` | Add all new keys with Japanese translations |
| 4 | `src/messages/ko.json` | Add all new keys with Korean translations |
| 5 | `src/messages/fr.json` | Add all new keys with French translations |
| 6 | `src/messages/de.json` | Add all new keys with German translations |
| 7 | All 10 screen files | Add `useTranslation` import + `const { t } = useTranslation()` + replace strings |
| 8 | Terminal | Run `npx tsc --noEmit` to verify |

## Key Design Principle
- Each screen adds exactly ONE `const { t } = useTranslation()` call at the top of the component function
- All existing keys (`common.retry`, `home.empty`, etc.) are reused — no duplication
- New keys follow the pattern of existing keys in the same namespace
- Interpolation used for dynamic values: `t('search.empty.noResultsFor', { query: debouncedQuery })`
- The `EmptyState`/`EmptyContent`/`EmptyLogoContent` components themselves are untouched — only their call sites in screens are updated
