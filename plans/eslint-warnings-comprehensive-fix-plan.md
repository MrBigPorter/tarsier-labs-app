# ESLint Warnings — Comprehensive Fix Plan

## Overview

Eliminate all 122 ESLint warnings across 10 rule categories. The plan is divided into **3 phases**:

| Phase | Approach               | Warnings | Effort    |
| ----- | ---------------------- | -------- | --------- |
| 0     | Create `.eslintignore` | 3        | 1 file    |
| 1     | `eslint --fix` (auto)  | ~92      | 1 command |
| 2     | Manual fixes           | ~27      | ~15 files |

---

## Phase 0 — Ignore Generated Files

**Goal:** Suppress 3 `eslint-comments/no-unlimited-disable` warnings in `coverage/` dir.

### Create `.eslintignore`

```
coverage/
```

- **Files silenced:**
  - `coverage/lcov-report/block-navigation.js`
  - `coverage/lcov-report/prettify.js`
  - `coverage/lcov-report/sorter.js`

---

## Phase 1 — Auto-fix with `--fix`

**Goal:** Resolve ~92 warnings in one command.

```bash
npx eslint . --fix
```

**Covers these rules:**

| Rule           | Count | Files                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `curly`        | ~55   | App.tsx, baseApi.ts, comments.ts, CategoryFilter.tsx, CommentItem.tsx, VideoPlayer.tsx, Skeleton.tsx, env.ts, useCommentSSE.ts, useCommentsInfiniteQuery.ts, useImagePrefetch.ts, useNetworkQuality.ts, useOAuth.ts, useRecentSearches.ts, useVideoPlayback.ts, i18n/index.ts, PerfContext.tsx, autoProfile.ts, useRenderTiming.ts, api.ts, date.ts, image.ts, ArticleDetailScreen.tsx, ArticleListScreen.tsx, BookmarksScreen.tsx, CategoryArticlesScreen.tsx, TagArticlesScreen.tsx |
| `quotes`       | 4     | baseApi.ts:167, MarkdownRenderer.tsx:126, PerfContext.tsx:230, autoProfile.ts:104                                                                                                                                                                                                                                                                                                                                                                                                     |
| `dot-notation` | 3     | colors.ts:55, 56, 57                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

---

## Phase 2 — Manual Fixes (Non-auto-fixable)

### 2a — Simple Removals / Renames (6 warnings)

#### 1. `metro.config.js:1` — `no-unused-vars`

- **File:** [`metro.config.js`](metro.config.js:1)
- **Fix:** Remove unused `path` import:
  ```js
  // Before
  const path = require('path');
  // After
  // (delete the line entirely)
  ```
- **Risk:** Low — `path` is genuinely unused in the file.

#### 2. `App.tsx:26` — `eslint-comments/no-unused-disable`

- **File:** [`App.tsx`](App.tsx:26)
- **Fix:** Remove the unused `eslint-disable` comment:
  ```
  Before: /* eslint-disable @typescript-eslint/no-var-requires */
  After:  (delete the comment line)
  ```

#### 3. `types.ts:126` — `eslint-comments/no-unused-disable`

- **File:** [`src/navigation/types.ts`](src/navigation/types.ts:126)
- **Fix:** Remove unused `eslint-disable` comment:
  ```
  Before: /* eslint-disable @typescript-eslint/no-namespace */
  After:  (delete the comment line)
  ```

#### 4. `ArticleDetailScreen.tsx:288` — `no-catch-shadow` + `@typescript-eslint/no-shadow`

- **File:** [`src/screens/ArticleDetailScreen.tsx`](src/screens/ArticleDetailScreen.tsx:288)
- **Fix:** Rename catch clause variable from `error` to `submissionError`:
  ```tsx
  // Before
  } catch (error) {
    console.warn('[Comment] Failed to submit comment:', error);
  }
  // After
  } catch (submissionError) {
    console.warn('[Comment] Failed to submit comment:', submissionError);
  }
  ```
- **Reason:** `error` shadows a hook-level variable `error` at line 100.

#### 5. `date.ts:198` — `@typescript-eslint/no-shadow`

- **File:** [`src/lib/utils/date.ts`](src/lib/utils/date.ts:198)
- **Fix:** Rename the inner `articles` variable:
  ```tsx
  // Before
  const articles = ...
  // After
  const filteredArticles = ...
  ```
- **Note:** Need to verify exact context at line 198.

---

### 2b — Inline Styles → StyleSheet (19 warnings, 11 files)

Each warning requires moving an inline `style={{...}}` prop into the component's `StyleSheet.create()`.

| #   | File                                                               | Line(s) | Current Inline Style                                                                               | Proposed StyleSheet Name   |
| --- | ------------------------------------------------------------------ | ------- | -------------------------------------------------------------------------------------------------- | -------------------------- |
| 1   | [`CategoryFilter.tsx`](src/components/blog/CategoryFilter.tsx:63)  | 63      | `{ backgroundColor: isDark ? '#22262f' : '#f0f0f1' }`                                              | `styles.chipBackground`    |
| 2   | [`CategoryFilter.tsx`](src/components/blog/CategoryFilter.tsx:171) | 171     | `{ color: selectedCategoryId === null ? '#ffffff' : colors.textSecondary }`                        | `styles.allChipText`       |
| 3   | [`CategoryFilter.tsx`](src/components/blog/CategoryFilter.tsx:215) | 215     | `{ color: isSelected ? '#ffffff' : colors.textSecondary }`                                         | `styles.chipText`          |
| 4   | [`CategoryFilter.tsx`](src/components/blog/CategoryFilter.tsx:226) | 226     | `{ color: isSelected ? 'rgba(255,255,255,0.6)' : colors.textTertiary }`                            | `styles.chipCount`         |
| 5   | [`CommentItem.tsx`](src/components/blog/CommentItem.tsx:96)        | 96      | `{ backgroundColor: depth > 0 ? 'transparent' : colors.card }`                                     | `styles.commentContainer`  |
| 6   | [`CommentItem.tsx`](src/components/blog/CommentItem.tsx:100)       | 100     | `{ borderLeftWidth: 2 }`                                                                           | `styles.threadLine`        |
| 7   | [`CommentItem.tsx`](src/components/blog/CommentItem.tsx:150)       | 150     | `{ opacity: 0.5 }`                                                                                 | `styles.deletedComment`    |
| 8   | [`TagChip.tsx`](src/components/blog/TagChip.tsx:29)                | 29      | `{ borderWidth: 1 }`                                                                               | `styles.chip`              |
| 9   | [`TagChip.tsx`](src/components/blog/TagChip.tsx:45)                | 45      | `{ color: active ? '#fff' : colors.textSecondary }`                                                | `styles.chipText`          |
| 10  | [`TagChip.tsx`](src/components/blog/TagChip.tsx:57)                | 57      | `{ backgroundColor: active ? 'rgba(255,255,255,0.2)' : colors.border }`                            | `styles.chipBackground`    |
| 11  | [`TagChip.tsx`](src/components/blog/TagChip.tsx:65)                | 65      | `{ color: active ? '#fff' : colors.textTertiary }`                                                 | `styles.chipCount`         |
| 12  | [`Skeleton.tsx`](src/components/core/Skeleton.tsx:141)             | 141     | `{ position: 'absolute' }`                                                                         | `styles.absolute`          |
| 13  | [`ThemeToggle.tsx`](src/components/features/ThemeToggle.tsx:85)    | 85      | `{ backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }`                       | `styles.toggleBackground`  |
| 14  | [`BottomSheet.tsx`](src/components/layout/BottomSheet.tsx:202)     | 202     | `{ backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.4)' }`                              | `styles.overlay`           |
| 15  | [`BottomSheet.tsx`](src/components/layout/BottomSheet.tsx:223)     | 223     | `{ borderTopLeftRadius: 16, borderTopRightRadius: 16 }`                                            | `styles.sheetContainer`    |
| 16  | [`SearchBar.tsx`](src/components/layout/SearchBar.tsx:162)         | 162     | `{ backgroundColor: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.3)' }`                              | `styles.backdrop`          |
| 17  | [`TabBar.tsx`](src/components/layout/TabBar.tsx:170)               | 170     | `{ fontWeight: isActive ? '600' : '400' }`                                                         | `styles.tabLabel`          |
| 18  | [`AuthScreen.tsx`](src/screens/AuthScreen.tsx:542)                 | 542     | `{ backgroundColor: isDark ? '#1C1C1E' : '#000000', borderColor: isDark ? '#333333' : '#000000' }` | `styles.authButton`        |
| 19  | [`AuthScreen.tsx`](src/screens/AuthScreen.tsx:550)                 | 550     | `{ color: '#FFFFFF' }`                                                                             | `styles.authButtonText`    |
| 20  | [`SettingsScreen.tsx`](src/screens/SettingsScreen.tsx:331)         | 331     | `{ borderLeftColor: destructive ? (colors.textErrorPrimary ?? '#d92d20') : 'transparent' }`        | `styles.destructiveBorder` |
| 21  | [`SettingsScreen.tsx`](src/screens/SettingsScreen.tsx:629)         | 629     | `{ backgroundColor: isSelected ? (colors.bgBrandPrimary ?? '#fbf7eb') : 'transparent' }`           | `styles.langItemBg`        |
| 22  | [`SettingsScreen.tsx`](src/screens/SettingsScreen.tsx:641)         | 641     | `{ fontWeight: isSelected ? '600' : '400' }`                                                       | `styles.langItemText`      |

> **Important:** Dynamic inline styles that depend on runtime values (theme colors, conditional state) cannot always be moved to `StyleSheet.create()` because stylesheets are static. For those, keep the inline style but disable the lint rule for that specific line with `// eslint-disable-next-line react-native/no-inline-styles`. But for truly static values (e.g., `position: 'absolute'`, `borderWidth: 1`, `opacity: 0.5`, `borderLeftWidth: 2`, `borderTopLeftRadius: 16`), they should be moved to StyleSheet.

**Classification:**

- **Can move to StyleSheet (static):** #6, #7, #8, #12, #15
- **Must keep inline (dynamic) + eslint-disable:** #1-5, #9-11, #13, #14, #16-22

---

### 2c — Nested Component in Render (1 warning)

#### `RootNavigator.tsx:219` — `react/no-unstable-nested-components`

- **File:** [`src/navigation/RootNavigator.tsx`](src/navigation/RootNavigator.tsx:219)
- **Issue:** The `tabBar` render prop creates an inline function that returns JSX:
  ```tsx
  tabBar={({ state, _descriptors, navigation }) => {
    const tabs: TabItem[] = ...
    return (
      <Animated.View>
        <TabBar ... />
      </Animated.View>
    );
  }}
  ```
- **Fix Option A (recommended):** Extract `TabBar` render to a named component:

  ```tsx
  const MainTabBar = ({ state, _descriptors, navigation }: any) => {
    const tabs: TabItem[] = ...
    return (
      <Animated.View>
        <TabBar ... />
      </Animated.View>
    );
  };
  ```

  Then use: `tabBar={MainTabBar}`

- **Fix Option B (simpler):** Add `// eslint-disable-next-line react/no-unstable-nested-components` with a comment explaining it's a known React Navigation pattern.
- **Recommendation:** Option A is preferred for correctness (avoids component re-creation on every render).

---

## Execution Order

| Step | Phase  | Description                                          | Warnings Fixed |
| ---- | ------ | ---------------------------------------------------- | -------------- |
| 0    | 0      | Create `.eslintignore` with `coverage/`              | 3              |
| 1    | 1      | Run `npx eslint . --fix`                             | ~92            |
| 2    | 2a     | Fix `metro.config.js` — remove unused `path`         | 1              |
| 3    | 2a     | Fix `App.tsx` — remove unused disable comment        | 1              |
| 4    | 2a     | Fix `types.ts` — remove unused disable comment       | 1              |
| 5    | 2a     | Fix `ArticleDetailScreen.tsx` — rename catch `error` | 2              |
| 6    | 2a     | Fix `date.ts` — rename shadowed `articles`           | 1              |
| 7    | 2b     | Fix inline styles in `CategoryFilter.tsx` (4)        | 4              |
| 8    | 2b     | Fix inline styles in `CommentItem.tsx` (3)           | 3              |
| 9    | 2b     | Fix inline styles in `TagChip.tsx` (4)               | 4              |
| 10   | 2b     | Fix inline styles in `Skeleton.tsx` (1)              | 1              |
| 11   | 2b     | Fix inline styles in `ThemeToggle.tsx` (1)           | 1              |
| 12   | 2b     | Fix inline styles in `BottomSheet.tsx` (2)           | 2              |
| 13   | 2b     | Fix inline styles in `SearchBar.tsx` (1)             | 1              |
| 14   | 2b     | Fix inline styles in `TabBar.tsx` (1)                | 1              |
| 15   | 2b     | Fix inline styles in `AuthScreen.tsx` (2)            | 2              |
| 16   | 2b     | Fix inline styles in `SettingsScreen.tsx` (3)        | 3              |
| 17   | 2c     | Fix `RootNavigator.tsx` — extract tabBar component   | 1              |
| 18   | Verify | Run `npx eslint src/ --max-warnings 0`               | —              |

---

## Risk Assessment

| Category                                       | Risk       | Mitigation                                                                                    |
| ---------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------- |
| Auto-fix (`--fix`)                             | Low        | ESLint transforms are mechanical and well-tested                                              |
| Remove unused code                             | Low        | Code is genuinely dead — no behavioral impact                                                 |
| Rename shadowed variables                      | Low        | Mechanical rename; no logic change                                                            |
| Move static inline styles to StyleSheet        | Low        | Visual identity preserved; style values unchanged                                             |
| Add `eslint-disable` for dynamic inline styles | Low        | Suppresses warning; behavior unchanged                                                        |
| Extract nested component in RootNavigator      | Low-Medium | Must ensure `tabBarAnimatedStyle` is still accessible; may need to lift style or pass as prop |

---

## Files Modified (Summary)

```
.eslintignore              (NEW)
metro.config.js             (1 change)
App.tsx                     (1 change)
src/navigation/types.ts     (1 change)
src/navigation/RootNavigator.tsx  (1 change — tabBar extraction)
src/screens/ArticleDetailScreen.tsx  (1 change — rename catch)
src/lib/utils/date.ts       (1 change — rename shadowed var)
src/components/blog/CategoryFilter.tsx  (4 inline styles)
src/components/blog/CommentItem.tsx     (3 inline styles)
src/components/blog/TagChip.tsx         (4 inline styles)
src/components/core/Skeleton.tsx        (1 inline style)
src/components/features/ThemeToggle.tsx  (1 inline style)
src/components/layout/BottomSheet.tsx    (2 inline styles)
src/components/layout/SearchBar.tsx      (1 inline style)
src/components/layout/TabBar.tsx         (1 inline style)
src/screens/AuthScreen.tsx              (2 inline styles)
src/screens/SettingsScreen.tsx          (3 inline styles)
```

**Total: 17 files modified + 1 new file + auto-fix touches ~28 files**
