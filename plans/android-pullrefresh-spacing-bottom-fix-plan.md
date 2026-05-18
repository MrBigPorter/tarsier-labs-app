# Android 修复计划：下拉刷新、页面间距、底部被遮挡

## 问题分析

### 问题 1：Android 下拉刷新只显示 loading 但不刷新

**根因**：在 [`HomeScreen.tsx:400-411`](src/screens/HomeScreen.tsx:400)

```typescript
const onRefresh = useCallback(() => {
  setRefreshing(true);
  setPage(1);
  requestAnimationFrame(() => {
    refetch().finally(() => {
      setRefreshing(false);
    });
  });
}, [refetch, refreshing]);
```

存在 **race condition**：

1. `refetch()` 调用的是**旧 query**（当前 page 的 query，比如 page=3），不是新的 page=1
2. `setPage(1)` 会触发新的 `useGetArticlesQuery({page:1,...})`，但 `refetch()` 仍然在拉旧 page 的数据
3. 旧数据请求完成后 `setRefreshing(false)`，此时新 page=1 请求可能仍在 pending
4. spinner 提前消失 → 用户看到 loading 但没有数据刷新效果

### 问题 2：Header 和 CategoryFilter + 列表贴在一起

**根因**：在 [`HomeScreen.tsx:73`](src/screens/HomeScreen.tsx:73) 用 `const HEADER_HEIGHT = 50` 硬编码，但实际 Header 高度是 platform-aware 的。

在 [`Header.tsx:70`](src/components/layout/Header.tsx:70)：

```typescript
const headerHeight = Platform.OS === 'ios' ? 44 : 56;
```

Header 的容器还有 `paddingTop: insets.top`（safe area）。

| 平台        | HEADER_HEIGHT (HomeScreen) | 实际 Header 内高 | 差异                                             |
| ----------- | -------------------------- | ---------------- | ------------------------------------------------ |
| iOS         | 50                         | 44               | ✅ 6px 间隔                                      |
| **Android** | **50**                     | **56**           | ❌ **6px 重叠**！CategoryFilter 盖在 Header 底部 |

**Android 上效果**：

- CategoryFilter `top: HEADER_HEIGHT(50) + insets.top` = y=50+insets.top
- Header 实际底部 = insets.top + 56
- CategoryFilter 顶部 (50+insets.top) 在 Header 底部 (insets.top+56) **之上 6px**
- → CategoryFilter **覆盖** Header 底部 6px

### 问题 3：底部内容被 TabBar 盖住

**根因**：

1. `TAB_BAR_HEIGHT = 60` 偏小。实际 TabBar 内容在 Android 上：
   - Container paddingTop: 4 + paddingBottom: 4 = 8
   - TabItem paddingVertical: 4+4 = 8 (around icon 40 + label ~14)
   - 实际 ≈ 62-70px，wrapper height=60 不够
2. `Platform.OS !== 'android'` 导致 TabBar 在 Android 上从不隐藏
3. `paddingBottom = 0 insets.bottom + 60 TAB_BAR_HEIGHT + 16 spacing.xl = 76px`，只比 wrapper (60px) 多 16px，最后一篇文章和 TabBar 间距太小

---

## 修改方案

### 修改文件 1：`src/screens/HomeScreen.tsx`

#### 修改 A：修复 HEADER_HEIGHT —— platform-aware

```typescript
// Before (line 73):
const HEADER_HEIGHT = 50;
// After:
const HEADER_HEIGHT = Platform.OS === 'ios' ? 44 : 56;
```

#### 修改 B：修复 TAB_BAR_HEIGHT —— 增大到 80

```typescript
// Before (line 79):
const TAB_BAR_HEIGHT = 60;
// After:
const TAB_BAR_HEIGHT = 80;
```

#### 修改 C：修复下拉刷新

**移除**：

- `refreshing` state (line 139)
- `requestAnimationFrame` + `refetch()` 模式

**改为**：

- 使用 `isFetching && page === 1` 作为 `RefreshControl.refreshing` prop
- `onRefresh` 简化为 `setPage(1); setAllArticles([])`

具体 diff：

```typescript
// line 139: 删除这行
const [refreshing, setRefreshing] = useState(false);

// lines 400-411: 改为
const onRefresh = useCallback(() => {
    setPage(1);
    setAllArticles([]);
  }, []);

// lines 521-527: RefreshControl 改为
refreshControl={
  <RefreshControl
    refreshing={isFetching && page === 1}
    onRefresh={onRefresh}
    tintColor={colors.primary}
    colors={[colors.primary]}
  />
}
```

#### 修改 D：移除 Platform.OS guard —— 让 Android 也有 scroll-driven 动画

```typescript
// Before (lines 298-309):
if (diff > 5 && currentY > SCROLL_THRESHOLD) {
  if (Platform.OS !== 'android') {
    // ← 删除
    catFilterTranslateY.value = withTiming(-CAT_FILTER_HEIGHT, {
      duration: 200,
    });
    tabBarTranslateY.value = withTiming(TAB_BAR_HEIGHT, { duration: 200 });
  }
} else if (diff < -5) {
  if (Platform.OS !== 'android') {
    // ← 删除
    catFilterTranslateY.value = withTiming(0, { duration: 200 });
    tabBarTranslateY.value = withTiming(0, { duration: 200 });
  }
}

// After:
if (diff > 5 && currentY > SCROLL_THRESHOLD) {
  catFilterTranslateY.value = withTiming(-CAT_FILTER_HEIGHT, { duration: 200 });
  tabBarTranslateY.value = withTiming(TAB_BAR_HEIGHT, { duration: 200 });
} else if (diff < -5) {
  catFilterTranslateY.value = withTiming(0, { duration: 200 });
  tabBarTranslateY.value = withTiming(0, { duration: 200 });
}
```

### 修改文件 2：`src/navigation/RootNavigator.tsx`

#### 修改：同步增大 TAB_BAR_HEIGHT

```typescript
// Before (line 351):
export const TAB_BAR_HEIGHT = 60;
// After:
export const TAB_BAR_HEIGHT = 80;
```

---

> **✅ 2026-05-18: All changes have been applied and verified with `npx tsc --noEmit` (zero errors).**

---

## 修改总结

| #   | 文件                                                                       | 行      | 修改内容                                                      |
| --- | -------------------------------------------------------------------------- | ------- | ------------------------------------------------------------- |
| 1   | [`src/screens/HomeScreen.tsx`](src/screens/HomeScreen.tsx:73)              | 73      | `HEADER_HEIGHT` 50 → platform-aware (iOS 44 / Android 56)     |
| 2   | [`src/screens/HomeScreen.tsx`](src/screens/HomeScreen.tsx:79)              | 79      | `TAB_BAR_HEIGHT` 60 → 80                                      |
| 3   | [`src/screens/HomeScreen.tsx`](src/screens/HomeScreen.tsx:139)             | 139     | 删除 `refreshing` state                                       |
| 4   | [`src/screens/HomeScreen.tsx`](src/screens/HomeScreen.tsx:400)             | 400-411 | 重写 `onRefresh`，移除 `refetch()` + `requestAnimationFrame`  |
| 5   | [`src/screens/HomeScreen.tsx`](src/screens/HomeScreen.tsx:521)             | 521-527 | `RefreshControl.refreshing` 改为 `{isFetching && page === 1}` |
| 6   | [`src/screens/HomeScreen.tsx`](src/screens/HomeScreen.tsx:300)             | 300-309 | 移除 Platform.OS guard，启用 Android 动画                     |
| 7   | [`src/navigation/RootNavigator.tsx`](src/navigation/RootNavigator.tsx:351) | 351     | `TAB_BAR_HEIGHT` 60 → 80                                      |

---

## 验证

1. `npx tsc --noEmit` — 零错误
2. Android 真机验证：
   - 下拉刷新 → spinner 出现，数据刷新后 spinner 消失
   - Header 和 CategoryFilter 不重叠
   - 向下滚动 → CategoryFilter 隐藏，TabBar 隐藏
   - 底部内容 → 最后一条完整可见
   - 底部 overscroll → 没有抖动
3. iOS 回归验证：
   - 所有行为正常
