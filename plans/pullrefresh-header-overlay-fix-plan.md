# Pull-to-Refresh 修复计划：Header 遮挡 + Android 内容不跟随手指

## 问题分析

### 问题 1：iOS 下拉刷新 loading 不可见

**根因**：Header 覆盖层遮挡了 [`RefreshControl`](src/screens/HomeScreen.tsx:470) 的加载指示器。

在 [`HomeScreen.tsx:499`](src/screens/HomeScreen.tsx:499) 中，Header 是一个绝对定位覆盖层：

```tsx
<View style={styles.headerOverlay}>
  <Header title="Tarsier" hideSettings />
</View>
```

`headerOverlay` 样式 [`styles.headerOverlay:535`](src/screens/HomeScreen.tsx:535) 为 `position: 'absolute', top: 0, left: 0, right: 0`，Header 内部有 [`backgroundColor: colors.background`](src/components/layout/Header.tsx:94)。

由于 Header 在 FlatList **之后**渲染（DOM 顺序靠后，即 Z 轴在上），当 iOS 用户下拉时，`RefreshControl` 的 spinner 出现在 FlatList 最顶部（y=0），但被 Header 覆盖层完全遮挡。

FlatList 的 [`contentContainerStyle.paddingTop`](src/screens/HomeScreen.tsx:486) 为 `insets.top + CONTENT_TOP`（≈ 94–106px），但这个 padding 只影响列表内容，**不**影响 RefreshControl 的位置。

### 问题 2：Android loading 被 Header 盖住

**根因**：与 iOS 相同。Android 的 `RefreshControl`（底层使用 `SwipeRefreshLayout`）默认将加载指示器定位在 ScrollView 顶部（y=0），而 Header 覆盖层渲染在 FlatList 之上，导致指示器被遮挡。

### 问题 3：Android 下拉时 FlatList 内容不跟随手指（卡住），但松手后刷新触发

**用户反馈**：内容像卡住一样完全不跟随手指向下滚动，但刷新可以正常触发。

**根因分析**：

核心原因是 [`isTopOverscroll` 守卫](src/screens/HomeScreen.tsx:254) 在 Reanimated worklet 中提前返回：

```typescript
const isTopOverscroll = currentY < 0;
if (isBottomOverscroll || isTopOverscroll) {
  lastScrollY.value = currentY;
  return; // ← 在 pull-to-refresh 区域提前返回，跳过动画更新
}
```

当用户下拉时 `contentOffset.y < 0`，Reanimated 的 `useAnimatedScrollHandler` worklet **跳过**了 `catFilterTranslateY` 和 `tabBarTranslateY` 的 `withTiming()` 动画更新。

在 Android 上，`SwipeRefreshLayout`（`RefreshControl` 的原生实现）需要 scroll events 正常流经整个动画管道。当 Reanimated worklet 在负 offset 区域提前 return，虽然不直接阻止原生滚动，但会导致以下连锁反应：

1. Reanimated 的 UI-thread worklet 没有处理 `currentY < 0` 区域的 scroll events
2. `SwipeRefreshLayout` 检测到 scroll events 被"中断"，认为 FlatList 处于不可滚动状态
3. `SwipeRefreshLayout` 只显示刷新圆圈（spinner），但不驱动 FlatList 内容跟随手指下拉
4. 松手后 refresh 依然触发，因为 `SwipeRefreshLayout` 仍然接收到了足够的拖拽距离

**辅助因素**：

- 缺少 `overScrollMode="always"`：Android 默认 `overScrollMode` 为 `'auto'`，在嵌套滚动场景下可能不会启用 overscroll
- 缺少 `progressViewOffset`：FlatList 有较大的 `paddingTop`（`insets.top + CONTENT_TOP`），`SwipeRefreshLayout` 需要正确偏移来协调手势映射

---

## 修改方案

### 修改文件：`src/screens/HomeScreen.tsx`

#### 修改 A：为 RefreshControl 添加 `progressViewOffset`

**原因**：使加载指示器在 Header 覆盖层下方显示（iOS 和 Android）。

```diff
refreshControl={
  <RefreshControl
    refreshing={isFetching && isManualRefreshing}
    onRefresh={onRefresh}
    tintColor={colors.primary}
    colors={[colors.primary]}
+   progressViewOffset={insets.top + CONTENT_TOP}
  />
}
```

**说明**：

- `progressViewOffset` 告诉系统在距离 ScrollView 顶部 `insets.top + CONTENT_TOP` px 的位置渲染刷新指示器
- 这样指示器会出现在 Header 覆盖层和 CategoryFilter 下方，始终可见
- 同时作用于 iOS（`tintColor` spinner）和 Android（圆形进度指示器）

#### 修改 B：移除 scroll handler 中的 `isTopOverscroll` 提前返回

**原因**：Android 上 `currentY < 0` 时的提前返回可能干扰内容拖拽效果。对于 iOS，RefreshControl 自带橡皮筋效果，不需要这个守卫。

```diff
- const isTopOverscroll = currentY < 0;
-
- if (isBottomOverscroll || isTopOverscroll) {
+ if (isBottomOverscroll) {
    lastScrollY.value = currentY;
    return;
  }
```

**注意**：仅移除 `isTopOverscroll` 检查，保留 `isBottomOverscroll` 检查（防止底部橡皮筋抖动）。

#### 修改 C：为 Animated.FlatList 添加 `overScrollMode`

**原因**：确保 Android 在顶部 overscroll 时产生内容拖拽效果。

```diff
<Animated.FlatList
  ...
  showsVerticalScrollIndicator={false}
+ overScrollMode="always"
  contentContainerStyle={[
```

---

## 验证清单

| #   | 检查项                                      | 平台         |
| --- | ------------------------------------------- | ------------ |
| 1   | 下拉刷新时 loading 指示器在 Header 下方可见 | iOS, Android |
| 2   | 下拉时页面内容随手势滚动                    | Android      |
| 3   | 底部 overscroll 无抖动回归                  | iOS, Android |
| 4   | CategoryFilter 滑动隐藏/显示正常            | iOS, Android |
| 5   | `npx tsc --noEmit` 零错误                   | -            |

---

## 视觉示意图

```
Before:
┌─────────────────────┐
│  Header (z-index ↑) │ ← 覆盖 RefreshControl spinner
├─────────────────────┤
│  FlatList paddingTop │
│  ┌─┐                │
│  │↑│ spinner 被挡    │
│  └─┘                │
│  Article 1          │
│  Article 2          │
└─────────────────────┘

After (progressViewOffset):
┌─────────────────────┐
│  Header             │
├─────────────────────┤
│  ┌─┐                │
│  │↑│ spinner 可见    │ ← progressViewOffset = insets.top + CONTENT_TOP
│  └─┘                │
│  Article 1          │
│  Article 2          │
└─────────────────────┘
```
