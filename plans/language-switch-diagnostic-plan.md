# Language Switch Diagnostic Plan

## Current Situation

User reports: "分类是跟着语言改了，但是列表不改，需要刷才改"

- **Categories (CategoryFilter) DO update** when language switches ✅
- **Article list (HomeScreen) does NOT update** when language switches ❌
- **Pull-to-refresh DOES update** the list ✅

The primary fix (delegating `useAppLanguage()` to `useTranslation()`) and secondary fix (adding `refetch()` safety nets) have been applied, but the article list still doesn't auto-refresh.

## Hypothesis

The `refetch()` IS being called, and the fetch IS completing with new data, but something prevents the `displayArticles` memo from returning the new data. Let me add diagnostic logging to verify.

## Diagnostic Additions

### 1. HomeScreen.tsx — Add console.log tracing

Add these logs to the lang-change effect:

```tsx
useEffect(() => {
  if (prevLangRef.current !== lang) {
    console.log(
      '[LangEffect] Language changed:',
      prevLangRef.current,
      '→',
      lang,
    );
    prevLangRef.current = lang;
    setPage(1);
    setSelectedCategoryId(null);
    console.log('[LangEffect] Calling refetch()');
    refetch()
      .then(() => {
        console.log('[LangEffect] refetch() completed');
      })
      .catch(err => {
        console.log('[LangEffect] refetch() error:', err);
      });
  }
}, [lang]);
```

Add a log in `displayArticles` memo:

```tsx
const displayArticles = React.useMemo<FrontendArticle[]>(() => {
  const result =
    page === 1 && articlesData?.items && articlesData.items.length > 0
      ? articlesData.items
      : allArticles;
  console.log(
    '[displayArticles] page:',
    page,
    'allArticles.length:',
    allArticles.length,
    'articlesData?.items?.length:',
    articlesData?.items?.length,
    'returning:',
    result === articlesData?.items ? 'articlesData.items' : 'allArticles',
    'items[0]?.title:',
    result[0]?.title?.substring(0, 30),
  );
  return result;
}, [articlesData, page, allArticles]);
```

Add a log in the pagination accumulation effect:

```tsx
useEffect(() => {
  if (articlesData?.items) {
    console.log('[PaginationEffect] articlesData.items.length:', articlesData.items.length, 'page:', page, 'lang:', lang);
    if (page === 1) {
      setAllArticles(articlesData.items);
    } else {
      ...
    }
  }
}, [articlesData, page]);
```

### 2. Test Steps

1. Open Metro bundler terminal
2. Switch app language from English to Chinese
3. Look for `[LangEffect]`, `[displayArticles]`, and `[PaginationEffect]` logs
4. Then pull-to-refresh and compare logs

This will answer:

- Does `[LangEffect]` fire? (Is the language change detected?)
- Does `refetch()` complete? (Does the API call succeed?)
- What does `displayArticles` return after refetch? (Is it using old `allArticles` or new `articlesData.items`?)
- Does the pagination effect fire with new data?

## Files to Modify

1. [`src/screens/HomeScreen.tsx`](src/screens/HomeScreen.tsx) — Add console.log statements (3 locations)

## Expected Behavior After Diagnostics

If the logs show:

- `[LangEffect]` fires AND `refetch()` completes BUT `displayArticles` still returns old data → issue is in displayArticles logic
- `[LangEffect]` fires BUT `refetch()` doesn't complete → issue is in RTK Query / API
- `[LangEffect]` doesn't fire → issue is in useAppLanguage / useTranslation subscription
