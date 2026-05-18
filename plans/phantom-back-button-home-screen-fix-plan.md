# Phantom Back Button on HomeScreen Fix Plan

## Bug Description

After navigating **HomeScreen → SearchScreen → ArticleDetailScreen → Back to HomeScreen**, the Header incorrectly displays a **back arrow button** on the HomeScreen. Tapping it triggers the `GO_BACK` warning.

## Root Cause Analysis

### Navigation Architecture

```
RootStack (NativeStack)
├── MainTabs (BottomTab)          ← initialRouteName='MainTabs'
│   ├── HomeTab (NativeStack)
│   │   ├── Home                  ← initial=Home
│   │   └── ArticleList
│   ├── TagsTab (NativeStack)
│   ├── CategoriesTab (NativeStack)
│   ├── BookmarksTab (NativeStack)
│   └── AboutTab (NativeStack)
├── ArticleDetail (overlays tabs)
├── Search
├── Auth
...
```

### The Chain of Events

1. **HomeScreen** renders `<Header title="Tarsier" hideSettings />` — **no `showBack` prop**

2. In [`Header.tsx:66-67`](../src/components/layout/Header.tsx:66):

   ```ts
   const canGoBack = navigation.canGoBack();
   const showBack = showBackProp !== undefined ? showBackProp : canGoBack;
   ```

   Since `showBack` is undefined, the Header auto-detects from `navigation.canGoBack()`.

3. **User taps search icon** → [`Header.tsx:80-82`](../src/components/layout/Header.tsx:80):

   ```ts
   navigation.navigate('Search'); // Traverses up HomeStack→MainTab→RootStack
   ```

   React Navigation dispatches through the navigator hierarchy, pushing Search onto RootStack.

4. **User taps an article in Search results** → [`SearchScreen.tsx:118`](../src/screens/SearchScreen.tsx:118):

   ```ts
   navigation.navigate('ArticleDetail', { slug, articleId });
   ```

   Both are on RootStack, so ArticleDetail pushes normally onto RootStack.

5. **User goes back** — RootStack pops back: ArticleDetail → Search → MainTabs.

6. **HomeScreen re-renders** — But now `navigation.canGoBack()` returns **`true`** on HomeStack's context, even though Home is the root screen. This is a React Navigation v7 behavior where cross-navigator `navigate` actions (that traverse through parent navigators) can leave **residual state** in the nested stack navigator.

7. **Header shows back button** because `showBack = canGoBack = true`.

8. **User taps the phantom back button** → [`Header.tsx:75-76`](../src/components/layout/Header.tsx:75):
   ```ts
   navigation.goBack(); // HomeStack has no entry to pop → GO_BACK warning
   ```

### Affected Screens

Screens using `getParent()?.navigate('ArticleDetail', ...)` for cross-navigator navigation:

| Screen                 | In Stack                 | Header `showBack` | Bug?                                     |
| ---------------------- | ------------------------ | ----------------- | ---------------------------------------- |
| **HomeScreen**         | HomeStack (root)         | auto-detect       | ✅ Phantom back button                   |
| ArticleListScreen      | HomeStack (pushed)       | auto-detect       | ❌ Correct (ArticleList is not root)     |
| TagArticlesScreen      | TagsStack (pushed)       | `showBack`        | ❌ Correct                               |
| ArchiveScreen          | RootStack                | `showBack`        | ❌ Correct                               |
| BookmarksScreen        | BookmarksStack (root)    | auto-detect       | ❌ Not reported (only 1 screen in stack) |
| CategoryArticlesScreen | CategoriesStack (pushed) | `showBack`        | ❌ Correct                               |

## Proposed Fix

### Change 1: HomeScreen — Explicit `showBack={false}`

**File**: [`src/screens/HomeScreen.tsx:510`](../src/screens/HomeScreen.tsx:510)

**Current:**

```tsx
<Header title="Tarsier" hideSettings />
```

**Fixed:**

```tsx
<Header title="Tarsier" hideSettings showBack={false} />
```

**Rationale**: HomeScreen is the root screen of HomeStack — it should **never** show a back button, regardless of `canGoBack()` state. This is the correct semantic behavior.

### Change 2: BookmarksScreen — Explicit `showBack={false}` (proactive)

**File**: [`src/screens/BookmarksScreen.tsx`](../src/screens/BookmarksScreen.tsx) — all 3 Header usages (lines 148, 185, 197)

**Current:**

```tsx
<Header title="Bookmarks" hideSearch hideSettings />
```

**Fixed:**

```tsx
<Header title="Bookmarks" hideSearch hideSettings showBack={false} />
```

**Rationale**: BookmarksStack has only 1 screen (`Bookmarks`), so it's always the root. Same vulnerability as HomeScreen.

### Change 3: TagListScreen — Explicit `showBack={false}` (proactive)

**File**: [`src/screens/TagListScreen.tsx`](../src/screens/TagListScreen.tsx) — lines 119, 145

**Current:**

```tsx
<Header title="Tags" hideSearch hideSettings />
```

**Fixed:**

```tsx
<Header title="Tags" hideSearch hideSettings showBack={false} />
```

### Change 4: CategoryListScreen — Explicit `showBack={false}` (proactive)

**File**: [`src/screens/CategoryListScreen.tsx`](../src/screens/CategoryListScreen.tsx) — lines 98, 110

**Current:**

```tsx
<Header title="Categories" hideSearch hideSettings />
```

**Fixed:**

```tsx
<Header title="Categories" hideSearch hideSettings showBack={false} />
```

### No Changes Needed For:

- **ArticleListScreen** — It's a pushed screen in HomeStack; auto-detecting `canGoBack()` is correct (should show back to Home)
- **All screens with explicit `showBack`** — Already correct

## Verification

1. Run TypeScript compilation: `npx tsc --noEmit`
2. Test the flow: Home → Search → ArticleDetail → Back → verify no back arrow on HomeScreen
3. Test the flow: Home → ArticleList (via category/tag) → verify back arrow appears on ArticleList
4. Test all other tab root screens for regression
