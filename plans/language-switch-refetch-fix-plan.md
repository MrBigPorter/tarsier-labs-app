# Comprehensive Android + Language Switch Fix Plan

## Problem Summary

1. **Language switch doesn't re-fetch articles** (iOS partially works, Android doesn't at all)
2. **Android pull-to-refresh after language switch still shows old language**
3. **Android TabBar cuts off bottom content** (60px hardcoded, `insets.bottom = 0`)
4. **Android tab switching is very laggy** (mass re-renders from language change)
5. **Android pull-to-refresh stuck / can't drag** — spinner appears but page feels unresponsive. **Root cause: same as Issue 8** (slow API from `credentials: 'include'`)
6. **Home screen spacing inconsistent** — article list items hidden behind TabBar on Android (`paddingBottom: 16px` vs TabBar height: 60px)
7. **Android slow API requests** — like endpoint: 2267ms vs iOS 236ms (~10x slower). **Root cause: `credentials: 'include'` triggers synchronous Android CookieManager IPC via OkHttp**

---

## Root Cause Analysis

### Issue 1: `useCurrentLanguage()` unreliable on Android

**File**: [`src/lib/i18n/index.ts:133-136`](src/lib/i18n/index.ts:133)

```ts
export function useCurrentLanguage(): string {
  const { i18n: i18nInstance } = useTranslation();
  return i18nInstance.language;
}
```

This hook relies on `useTranslation()` from `react-i18next` to trigger re-renders when `i18n.language` changes. On **Android**, `useTranslation()` does NOT reliably propagate language change events to all subscribed components, especially when changed programmatically via `i18n.changeLanguage()`.

When `i18n.changeLanguage('zh')` is called from [`LanguageSwitcher`](src/components/features/LanguageSwitcher.tsx:76-83):

1. `i18n.language` updates ✅
2. `useTranslation()` should trigger re-render ❌ (fails on Android)
3. `useCurrentLanguage()` returns new lang ❌ (never called)
4. Components pass new `lang` to RTK Query hooks ❌
5. RTK Query sees changed params → re-fetches ❌

### Issue 2: Pagination state not reset on language change

Three screens accumulate paginated articles:

| Screen                     | File                                                                                        | State Variables       | Issue                                             |
| -------------------------- | ------------------------------------------------------------------------------------------- | --------------------- | ------------------------------------------------- |
| **HomeScreen**             | [`src/screens/HomeScreen.tsx:130-214`](src/screens/HomeScreen.tsx:130)                      | `page`, `allArticles` | Never reset when `lang` changes                   |
| **ArticleListScreen**      | [`src/screens/ArticleListScreen.tsx:59-94`](src/screens/ArticleListScreen.tsx:59)           | `page`, `allArticles` | Reset for `categorySlug`/`tagSlug` but NOT `lang` |
| **CategoryArticlesScreen** | [`src/screens/CategoryArticlesScreen.tsx:44-77`](src/screens/CategoryArticlesScreen.tsx:44) | `page`, `allArticles` | Never reset when `lang` changes                   |

Even if Issue 1 is fixed, the accumulation logic appends new-language articles to existing old-language `allArticles` when `page > 1`:

```ts
// HomeScreen.tsx:198-204
setAllArticles(prev => {
  const existingIds = new Set(prev.map(a => a.id));
  const newOnes = (result?.items ?? []).filter(a => !existingIds.has(a.id));
  return [...prev, ...newOnes]; // ← mixes old + new language!
});
```

### Issue 3: `searchArticles` endpoint ignores `lang` parameter

**File**: [`src/api/endpoints/articles.ts:128-142`](src/api/endpoints/articles.ts:128)

```ts
searchArticles: builder.query<..., SearchParams>({
  query: ({ q, page, pageSize }) => ({  // lang is destructured but NOT used
    url: '/api/v1/frontend/blog/search',
    params: { q, page, pageSize },       // lang MISSING from params
  }),
```

`SearchParams` interface includes `lang?: string` (line 22), and [`SearchScreen`](src/screens/SearchScreen.tsx:78-81) passes `lang` to the hook, but the endpoint's `query` function silently drops it.

### Issue 4: Android TabBar cuts off bottom content

**File**: [`src/navigation/RootNavigator.tsx:350-362`](src/navigation/RootNavigator.tsx:350)

```ts
const TAB_BAR_VISIBLE_HEIGHT = 60;
const styles = StyleSheet.create({
  tabBarWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: TAB_BAR_VISIBLE_HEIGHT, // 60px
    overflow: 'hidden',
    zIndex: 100,
  },
});
```

Screens calculate `paddingBottom` using `insets.bottom + spacing.xl`:

- [`HomeScreen.tsx:507`](src/screens/HomeScreen.tsx:507) — `paddingBottom: insets.bottom + spacing.xl`
- **iOS**: `insets.bottom` ≈ 34px → paddingBottom ≈ 54px (content mostly visible) ✅
- **Android**: `insets.bottom` = 0px → paddingBottom ≈ 20px → 40px hidden under 60px TabBar ❌

### Issue 5: Android tab switching lag

Caused by the language change triggering mass re-renders across all subscribed components simultaneously:

- `HomeScreen` (article list + features)
- `ArticleListScreen`
- `CategoryArticlesScreen`
- `ArchiveScreen`
- `ArticleDetailScreen`
- `CategoryFilter`
- `SearchScreen`

Each component re-renders AND triggers its own RTK Query re-fetch. On Android (especially lower-end devices), this causes visible jank during tab switches.

### Issue 6: Android pull-to-refresh stuck / can't drag

**Reported**: "下啦刷新，安卓页面拖不动，只有loading" — Pull-to-refresh shows loading spinner but page feels stuck/draggable. User asks "这是对的吗" (is this correct?).

**Root Cause**: This is a **symptom of Issue 6 (slow Android API)** rather than an independent bug.

The [`onRefresh`](src/screens/HomeScreen.tsx:377-388) callback:

1. Sets `refreshing=true` → spinner appears
2. Calls `refetch()` which goes through `baseQuery` with `credentials: 'include'`
3. On Android, each request takes `~2000ms+` due to synchronous CookieManager IPC (see Issue 6 detailed analysis below)
4. If the request returns a 5xx error (cookie-related), the retry mechanism kicks in: 3 retries × exponential backoff (1s, 2s, 4s) = up to **7 seconds**
5. `refreshing` stays `true` for the entire duration — user sees spinner but no content update

The scroll handler's [`overscroll boundary detection`](src/screens/HomeScreen.tsx:267-274) is **not the cause** — it only skips animation worklet calls during overscroll, but does NOT block the `RefreshControl`'s own gesture handling, which is independent.

**Fix**: This is **automatically resolved** by fixing the root cause in Issue 6 (removing `credentials: 'include'`). No additional code changes needed. Once API calls complete in `<500ms`, pull-to-refresh will feel responsive.

---

### Issue 7: Home screen spacing inconsistent

**Reported**: "首页iOS安卓的间距header,tab和列表，要优化" — Spacing between Header, TabBar, and article list needs optimization for both platforms.

**Root Cause**: The `paddingBottom` formula [`paddingBottom: insets.bottom + spacing.xl`](src/screens/HomeScreen.tsx:508) doesn't account for the TabBar height on Android:

| Platform    | `insets.bottom`                 | Current `paddingBottom` | TabBar height | Content hidden behind TabBar? |
| ----------- | ------------------------------- | ----------------------- | ------------- | ----------------------------- |
| **iOS**     | ≈34px (home indicator)          | 34 + 16 = 50px          | 60px          | ≈10px (minimal) ✅            |
| **Android** | 0px (`edgeToEdgeEnabled=false`) | 0 + 16 = 16px           | 60px          | **44px hidden** ❌            |

On Android with [`edgeToEdgeEnabled=false`](android/gradle.properties:48), Android draws the system navigation bar OVER the app content. React Native returns `insets.bottom = 0` for this reason. The 60px TabBar at `bottom: 0` is also partially behind the nav bar, but the critical issue is that the FlatList's `paddingBottom` of 16px is far less than the 60px TabBar — causing the last ~44px of article list items to be hidden.

**Additional spacing concern**: The Header overlay at `top: 0` and `paddingTop: insets.top + CONTENT_TOP` (100px) uses different effective values per platform:

- **iOS**: `insets.top ≈ 50-60px` → `paddingTop ≈ 150-160px` (status bar + notch + Header + CategoryFilter)
- **Android**: `insets.top ≈ 24px` (status bar) → `paddingTop ≈ 124px`

This top spacing difference is **less noticeable** because the Header component handles its own safe area internally. The primary fix needed is the bottom padding.

**Fix**: Change `paddingBottom` from `insets.bottom + spacing.xl` to `insets.bottom + TAB_BAR_HEIGHT + spacing.xl` on all TabBar screens (already covered by Step 6).

---

### Issue 8: Android slow API requests (like endpoint 2267ms vs 236ms)

**Observed**: `POST /api/v1/frontend/blog/articles/lucky-form-theme-validator-system/like` takes **2267ms on Android** vs **236ms on iOS**. Flutter on the same Android device is also fast, confirming this is React Native-specific.

**Root Cause Analysis**:

The root cause is **`credentials: 'include'`** in [`src/api/baseApi.ts:84`](src/api/baseApi.ts:84), which triggers **synchronous Android CookieManager IPC overhead** on React Native Android.

**How React Native Android handles `credentials: 'include'`:**

[`NetworkingModule.kt:371-373`](node_modules/react-native/ReactAndroid/src/main/java/com/facebook/react/modules/network/NetworkingModule.kt:371):

```kotlin
if (!withCredentials) {
  clientBuilder.cookieJar(CookieJar.NO_COOKIES)
}
```

- **`credentials: 'include'`** → Keeps the default `ReactCookieJarContainer` → `ForwardingCookieHandler` → Android's **`CookieManager.getCookie()`** (a **synchronous WebView IPC call**)
- **`credentials: 'omit'`** → Sets `CookieJar.NO_COOKIES` → No cookie processing at all

**Why it's slow only on React Native Android:**

| Platform                                          | Cookie Handling                                                    | Speed            |
| ------------------------------------------------- | ------------------------------------------------------------------ | ---------------- |
| **iOS (NSURLSession)**                            | Native, efficient, handles cookies in URL loading system           | Fast ~236ms      |
| **Flutter (dart:io HttpClient)**                  | No cookie jar by default, no synchronous IPC                       | Fast             |
| **React Native Android (OkHttp + CookieManager)** | `CookieManager.getCookie()` is **synchronous IPC** through WebView | **Slow ~2267ms** |

The `CookieManager.getCookie()` call is a synchronous cross-process communication to WebView's cookie storage. If the backend has previously returned `Set-Cookie` headers from any API response, the cookie jar accumulates entries, and each subsequent `credentials: 'include'` request must synchronously read from CookieManager — which on some Android devices can take 1000-2000ms.

**The app does NOT use cookie-based auth** — it uses `Authorization: Bearer` token authentication. Therefore `credentials: 'include'` is completely unnecessary and actively harmful on Android.

---

## Solution Plan

### Step 1: Add phased timing instrumentation to `baseApi.ts` (diagnostic)

Before making changes, add timing instrumentation to isolate where the 2267ms is spent:

```ts
const baseQuery = async (args, api, extraOptions) => {
  const startTime = Date.now();
  // ...
  const t0 = Date.now();
  let result = await rawBaseQuery(args, api, extraOptions);
  const t1 = Date.now();

  let attempt = 1;
  while (isRetryableError(result.error) && attempt <= RETRY_MAX) {
    const backoffMs = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
    const tRetryStart = Date.now();
    console.warn(
      `[API] ⏱️ Retry ${attempt}: first attempt took ${t1 - t0}ms, waiting ${backoffMs}ms`,
    );
    await delay(backoffMs);
    result = await rawBaseQuery(args, api, extraOptions);
    const tRetryEnd = Date.now();
    console.warn(
      `[API] ⏱️ Retry ${attempt} completed in ${tRetryEnd - tRetryStart}ms, status: ${result.error?.status ?? 200}`,
    );
    attempt++;
  }
  // ...
};
```

This will confirm or rule out the retry hypothesis.

### Step 2: Remove `credentials: 'include'` from `baseApi.ts`

**File**: [`src/api/baseApi.ts:84`](src/api/baseApi.ts:84)

Change from `'include'` to `'omit'` since the app uses Bearer token auth, not cookies:

```diff
- credentials: 'include',
+ credentials: 'omit',
```

Also update the same setting in the token refresh retry query ([`src/api/baseApi.ts:175`](src/api/baseApi.ts:175)):

```diff
- credentials: 'include',
+ credentials: 'omit',
```

**Also fixes**: Android pull-to-refresh stuck issue (Issue 5). Once API requests complete in `<500ms` instead of `~2000ms`, the `refreshing` state no longer persists for extended periods, making pull-to-refresh feel responsive again.

**Rationale**:

- No cookie-based auth is used anywhere in the app
- `credentials: 'include'` on Android OkHttp causes synchronous CookieManager IPC overhead via `ForwardingCookieHandler` → `CookieManager.getCookie()` WebView IPC (~2000ms per request)
- Removing it eliminates the root cause of the slow API on Android
- Safe change since backend authentication is purely Bearer-token-based

### Step 3: Create reliable `useAppLanguage()` hook

**File**: [`src/lib/i18n/index.ts`](src/lib/i18n/index.ts)

Replace the existing `useCurrentLanguage()` with a more robust `useAppLanguage()` that directly subscribes to `i18n.on('languageChanged')` events using `useState` + `useEffect`:

```ts
import { useState, useEffect } from 'react';

export function useAppLanguage(): string {
  const [lang, setLang] = useState<string>(i18n.language || defaultLocale);

  useEffect(() => {
    const handleLanguageChanged = (lng: string) => {
      setLang(lng);
    };
    i18n.on('languageChanged', handleLanguageChanged);
    return () => {
      i18n.off('languageChanged', handleLanguageChanged);
    };
  }, []);

  return lang;
}
```

Keep `useCurrentLanguage()` as a backward-compatible alias:

```ts
export const useCurrentLanguage = useAppLanguage;
```

**Change all screen imports** from `useCurrentLanguage` to `useAppLanguage`:

- [`src/screens/HomeScreen.tsx:54`](src/screens/HomeScreen.tsx:54)
- [`src/screens/ArticleListScreen.tsx:32`](src/screens/ArticleListScreen.tsx:32)
- [`src/screens/CategoryArticlesScreen.tsx:26`](src/screens/CategoryArticlesScreen.tsx:26)
- [`src/screens/ArchiveScreen.tsx:29`](src/screens/ArchiveScreen.tsx:29)
- [`src/screens/ArticleDetailScreen.tsx:1`](src/screens/ArticleDetailScreen.tsx:1)
- [`src/screens/SearchScreen.tsx:30`](src/screens/SearchScreen.tsx:30)
- [`src/components/blog/CategoryFilter.tsx:29`](src/components/blog/CategoryFilter.tsx:29)

### Step 4: Reset pagination state on language change

For each screen with `allArticles` accumulation, add a `useEffect` that resets `page` and `allArticles` when `lang` changes.

#### HomeScreen ([`src/screens/HomeScreen.tsx`](src/screens/HomeScreen.tsx))

Add `useRef` to track previous language:

```ts
const prevLangRef = useRef(lang);

useEffect(() => {
  if (prevLangRef.current !== lang) {
    prevLangRef.current = lang;
    setPage(1);
    setAllArticles([]);
    setSelectedCategoryId(null);
  }
}, [lang]);
```

#### ArticleListScreen ([`src/screens/ArticleListScreen.tsx:90-94`](src/screens/ArticleListScreen.tsx:90))

Add `lang` to the existing parameter-reset `useEffect`:

```ts
React.useEffect(() => {
  setPage(1);
  setAllArticles([]);
}, [categorySlug, tagSlug, lang]); // ← add lang
```

#### CategoryArticlesScreen ([`src/screens/CategoryArticlesScreen.tsx`](src/screens/CategoryArticlesScreen.tsx))

Add a new `useEffect` with `prevLangRef`:

```ts
const prevLangRef = useRef(lang);

React.useEffect(() => {
  if (prevLangRef.current !== lang) {
    prevLangRef.current = lang;
    setPage(1);
    setAllArticles([]);
  }
}, [lang]);
```

### Step 5: Fix `searchArticles` endpoint

**File**: [`src/api/endpoints/articles.ts:128-142`](src/api/endpoints/articles.ts:128)

```ts
searchArticles: builder.query<..., SearchParams>({
  query: ({ q, page, pageSize, lang }) => ({  // ← destructure lang
    url: '/api/v1/frontend/blog/search',
    params: { q, page, pageSize, lang },       // ← pass lang in params
  }),
```

### Step 6: Fix Android TabBar content cutoff & home screen spacing

**Also fixes**: Home screen spacing inconsistency (Issue 6). By changing `paddingBottom` from `insets.bottom + spacing.xl` to `insets.bottom + TAB_BAR_HEIGHT + spacing.xl`, the article list no longer has content hidden behind the TabBar on either platform.

**Create a shared constant** — export `TAB_BAR_HEIGHT` from [`src/navigation/RootNavigator.tsx`](src/navigation/RootNavigator.tsx):

```ts
export const TAB_BAR_HEIGHT = 60;
```

Then update `paddingBottom` in all affected screens to account for the TabBar:

| Screen                                                                         | Current                      | Fixed                                         |
| ------------------------------------------------------------------------------ | ---------------------------- | --------------------------------------------- |
| [`HomeScreen.tsx:507`](src/screens/HomeScreen.tsx:507)                         | `insets.bottom + spacing.xl` | `insets.bottom + TAB_BAR_HEIGHT + spacing.xl` |
| [`ArticleListScreen.tsx:225`](src/screens/ArticleListScreen.tsx:225)           | `insets.bottom + spacing.xl` | `insets.bottom + TAB_BAR_HEIGHT + spacing.xl` |
| [`CategoryArticlesScreen.tsx:206`](src/screens/CategoryArticlesScreen.tsx:206) | `insets.bottom + spacing.xl` | `insets.bottom + TAB_BAR_HEIGHT + spacing.xl` |
| [`ArchiveScreen.tsx:174`](src/screens/ArchiveScreen.tsx:174)                   | `insets.bottom + spacing.xl` | `insets.bottom + TAB_BAR_HEIGHT + spacing.xl` |
| [`BookmarksScreen.tsx:224`](src/screens/BookmarksScreen.tsx:224)               | `insets.bottom + spacing.xl` | `insets.bottom + TAB_BAR_HEIGHT + spacing.xl` |

### Step 7: Optimize Android tab switching performance

After Steps 3-5 fix the language re-fetch, if tab switching remains laggy:

1. **Wrap screen components with `React.memo`** to prevent unnecessary re-renders
2. **Use `useAppLanguage()` at the `RootNavigator` level** and pass `lang` as a prop/context instead of each screen subscribing independently — reduces the number of `useEffect` subscriptions
3. **Disable scroll-hide animation on Android** — the `withTiming` animations in `HomeScreen`'s scroll handler can cause jank on Android
4. **Batch RTK Query subscriptions** — use `useGetArticlesQuery` with `skip` option to avoid redundant fetches during tab switches

---

## Files to Modify

| File                                                                               | Changes                                                             |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| [`src/api/baseApi.ts`](src/api/baseApi.ts)                                         | Remove `credentials: 'include'` → `'omit'`; add phased timing logs  |
| [`src/lib/i18n/index.ts`](src/lib/i18n/index.ts)                                   | Add `useAppLanguage()` hook with direct i18n event subscription     |
| [`src/api/endpoints/articles.ts`](src/api/endpoints/articles.ts)                   | Fix `searchArticles` to pass `lang` param                           |
| [`src/screens/HomeScreen.tsx`](src/screens/HomeScreen.tsx)                         | Use `useAppLanguage()`, add lang reset useEffect, fix paddingBottom |
| [`src/screens/ArticleListScreen.tsx`](src/screens/ArticleListScreen.tsx)           | Use `useAppLanguage()`, add lang to reset deps, fix paddingBottom   |
| [`src/screens/CategoryArticlesScreen.tsx`](src/screens/CategoryArticlesScreen.tsx) | Use `useAppLanguage()`, add lang reset useEffect, fix paddingBottom |
| [`src/screens/ArchiveScreen.tsx`](src/screens/ArchiveScreen.tsx)                   | Use `useAppLanguage()`, fix paddingBottom                           |
| [`src/screens/SearchScreen.tsx`](src/screens/SearchScreen.tsx)                     | Use `useAppLanguage()`                                              |
| [`src/screens/ArticleDetailScreen.tsx`](src/screens/ArticleDetailScreen.tsx)       | Use `useAppLanguage()`                                              |
| [`src/components/blog/CategoryFilter.tsx`](src/components/blog/CategoryFilter.tsx) | Use `useAppLanguage()`                                              |
| [`src/navigation/RootNavigator.tsx`](src/navigation/RootNavigator.tsx)             | Export `TAB_BAR_HEIGHT` constant                                    |
| [`src/screens/BookmarksScreen.tsx`](src/screens/BookmarksScreen.tsx)               | Fix paddingBottom                                                   |

---

## Data Flow After Fix

```
LanguageSwitcher.handleSelect(locale)
  │
  ├─► i18n.changeLanguage(locale)     // Updates i18n.language
  │     │
  │     └─► i18n emits 'languageChanged' event
  │           │
  │           └─► useAppLanguage() setLang(newLang)
  │                 │                                   Android: ✓ (direct event sub)
  │                 └─► Component re-renders with new `lang`
  │                       │
  │                       ├─► useEffect: reset page=1, allArticles=[]
  │                       │
  │                       └─► useGetArticlesQuery({ lang: newLang, page: 1 })
  │                             │
  │                             └─► RTK Query re-fetches with new params
  │                                   │
  │                                   └─► baseQuery: no credentials (omit)
  │                                         │
  │                                         └─► No cookie overhead, no 5xx retry
  │                                               │
  │                                               └─► Returns articles in new language ✓
  │
  └─► dispatch(setLanguage(locale))  // Updates Redux ui.language (for other consumers)
```

---

## Testing Checklist

- [ ] Switch language on iOS → articles re-fetch in new language automatically
- [ ] Switch language on Android → articles re-fetch in new language automatically
- [ ] Switch language when on page > 1 → reset to page 1, correct language only
- [ ] Switch language on Search screen → search results in new language
- [ ] Switch language while viewing article detail → article re-fetched in new language
- [ ] Switch language → CategoryFilter re-fetches categories in new language
- [ ] Android: bottom of list is not cut off by TabBar
- [ ] Android: tab switching is not excessively laggy
- [ ] Android: like/unlike API requests complete within normal range (<500ms)
- [ ] Pull-to-refresh after language switch → correct language articles
- [ ] Verify `credentials: 'omit'` doesn't break auth (Bearer token still sent)
- [ ] Check phased timing logs to confirm retry chain is gone on Android
