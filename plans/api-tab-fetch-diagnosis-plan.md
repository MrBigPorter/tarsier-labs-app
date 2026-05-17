# API Tab Fetch Diagnosis & Fix Plan

## Problem
用户反馈点击底部 Tab 时，没有触发 API 请求（"接口对不上"）。

## Architecture Overview

```
TabBar.tsx → RootNavigator.onTabPress → navigation.navigate('TabName')
  → BottomTab switches → Stack screen mounts → RTK Query hook fires
    → baseApi.ts baseQuery → HTTP request to backend
```

## Tab → API Mapping

| Tab | Screen | API Hook | Endpoint |
|-----|--------|----------|----------|
| Home | HomeScreen.tsx | useGetArticlesQuery | GET /api/v1/frontend/blog/articles |
| Tags | TagListScreen.tsx | useGetTagsQuery | GET /api/v1/frontend/blog/tags |
| Categories | CategoryListScreen.tsx | useGetCategoriesQuery | GET /api/v1/frontend/blog/categories |
| Bookmarks | BookmarksScreen.tsx | Redux fetchBookmarks thunk | GET /api/v1/frontend/blog/bookmarks |
| About | AboutScreen.tsx | None (static) | — |

API Base URL: `https://dev-api.joyminis.com` (from src/lib/env.ts)

## Identified Issues

### Issue 1: API Base URL / Backend Availability
- Dev API URL hardcoded in src/lib/env.ts → `https://dev-api.joyminis.com`
- If server not running or URL is wrong, ALL requests fail
- **Action**: Verify backend is running at this URL

### Issue 2: API Endpoint Paths May Not Match Backend
- Code uses: `/api/v1/frontend/blog/articles`, `/tags`, `/categories`, `/featured`, `/search`
- Backend may use different route structure
- **Action**: Confirm actual backend routes

### Issue 3: Response Format Mismatch (Silent Failure)
- Code expects: `{ code: number, message: string, data: T, timestamp?: number }`
- transformResponse calls `unwrapData()` which returns `response.data`
- If backend returns raw array/object (no wrapper), `unwrapData` returns `undefined`
- Components see `undefined` data → show empty state (no error shown)
- **Action**: Check actual backend response format

### Issue 4: baseQuery Lang Parameter Mutation
- In src/api/baseApi.ts lines 46-53, baseQuery mutates `args.params` by injecting `lang`
- But endpoints ALREADY pass `lang` from component query params
- Result: duplicate `?lang=en&lang=en` in requests
- Mutation of shared args object may affect RTK Query cache keying
- **Action**: Remove lang injection from baseQuery; let endpoints handle it

### Issue 5: Tab Switching Doesn't Re-trigger API Calls
- `@react-navigation/bottom-tabs` keeps screens mounted when switching tabs
- If initial API call failed, switching back to tab won't retry
- User must pull-to-refresh to trigger retry
- **Action**: Add `refetchOnFocus` option or use `useFocusEffect` to re-fetch on tab focus

### Issue 6: No Error Visibility
- If API calls fail, there's no console.error or user-visible feedback in most screens
- Loading state shows skeleton indefinitely on some screens
- **Action**: Add error logging and ensure error states are properly displayed

## Proposed Fixes

### Step 1: Verify Backend
- Check if `https://dev-api.joyminis.com` is accessible
- Confirm actual API route structure and response format

### Step 2: Fix baseQuery lang injection (src/api/baseApi.ts)
- Remove the lang parameter mutation from baseQuery
- lang is already passed by each endpoint's query function

### Step 3: Align Endpoint Paths & Response Formats
- Update endpoint paths to match actual backend routes
- Update transformResponse if backend uses different response structure

### Step 4: Add Tab Focus Refetching
- Configure RTK Query with `refetchOnFocus: true`
- Or add `useFocusEffect` to trigger refetch when tab becomes active

### Step 5: Improve Error Handling
- Add console.error for failed API calls
- Ensure error states render correctly on all screens
