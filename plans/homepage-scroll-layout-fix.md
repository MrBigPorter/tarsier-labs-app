# HomeScreen 完整滚动布局修复

## 问题清单

| # | 问题 | 根因 |
|---|------|------|
| 1 | Header 滑动后顶部留空白区域 | `headerArea` 没有 `position: absolute`，translateY 只是视觉位移，布局空间还在 |
| 2 | CategoryFilter 不应该跟着 Header 一起隐藏 | 两者在同一个 `Animated.View` 里，用同一个 translateY |
| 3 | TabBar 滑出屏幕太远 | TabBar 动画用的 `HEADER_AREA_HEIGHT` (120px) 而不是 TabBar 自身高度 (60px) |

## 最终方案

### 布局结构

```
Container (flex:1) {bg: colors.bgSecondary}
│
├── FlatList (flex:1)                          ← 占满全屏
│   contentContainerStyle:
│     paddingTop: animatedValue (H+C ↔ C)       ← Header高度+Cat高度 → 仅Cat高度
│     paddingBottom: safeArea + spacing + TAB_H  ← 底部留出 TabBar 空间
│   ListEmptyComponent: renderEmpty()
│   ListFooterComponent: renderFooter()
│   refreshControl: RefreshControl
│   onScroll: onScroll
│
├── Animated.View (Header)                      ← position:absolute, top:0, zIndex:11
│   transform: [{translateY: headerTranslateY}]  ← 0 ↔ -HEADER_HEIGHT
│   <Header title="Tarsier" />
│
├── Animated.View (CategoryFilter)              ← position:absolute, top:HEADER_HEIGHT, zIndex:10
│   transform: [{translateY: headerTranslateY}]  ← 0 ↔ -HEADER_HEIGHT (同 Header!)
│   <CategoryFilter ... />
│
├── NetworkStatusBar                            ← position:absolute, top:(Header visible area)
│
└── TabBar (来自 RootNavigator, 不修改)          ← position:absolute, bottom:0
    transform: [{translateY: tabBarTranslateY}]   ← 0 ↔ TAB_BAR_HEIGHT
```

### 滚动行为

```
向下滚动 (diff > 5, currentY > 50):
├── Header:     top:0 + translateY:0→-HEADER_H  → 移出屏幕 (top:-HEADER_H)
├── CategoryFil: top:HEADER_H + translateY:0→-HEADER_H → 吸到顶部 (top:0)
├── paddingTop: (HEADER_H+CAT_H)→CAT_H          → 内容填满
└── TabBar:     translateY:0→TAB_H              → 移出屏幕

向上滚动 (diff < -5):
├── Header:     translateY:-HEADER_H→0          → 回到原位
├── CategoryFil: translateY:-HEADER_H→0          → 回到 Header 下方
├── paddingTop: CAT_H→(HEADER_H+CAT_H)           → 内容下移
└── TabBar:     translateY:TAB_H→0               → 回到原位
```

### 常量和状态变更

```
旧的常量:                    新的常量:
HEADER_AREA_HEIGHT = 120 →  HEADER_HEIGHT = 50     (仅 Header 高度)
                             CAT_FILTER_HEIGHT = 50  (仅 CategoryFilter 高度)
                             TAB_BAR_HEIGHT = 60     (已有)
                             CONTENT_TOP = HEADER_HEIGHT + CAT_FILTER_HEIGHT (=100)

旧的 animated value:        新的 animated value:
headerTranslateY            headerTranslateY (不变, 但只驱动 Header)
                            新: contentPaddingTop (驱动 FlatList paddingTop)

ScrollContext: 不变 (tabBarTranslateY, lastScrollY)
```

### 修改文件清单

#### 1. `src/screens/HomeScreen.tsx` — 唯一需要修改的文件

具体改动点：

1. **常量区** — `HEADER_AREA_HEIGHT = 120` → 拆分为 `HEADER_HEIGHT = 50`, `CAT_FILTER_HEIGHT = 50`
2. **Animated.Value** — 新增 `contentPaddingTop = useRef(new Animated.Value(HEADER_HEIGHT + CAT_FILTER_HEIGHT)).current`
3. **onScroll** — `Animated.parallel` 加第三个动画：`contentPaddingTop → CAT_FILTER_HEIGHT` (隐藏时) / `→ HEADER_HEIGHT + CAT_FILTER_HEIGHT` (显示时)
4. **JSX 布局**:
   - Header: 独立 `Animated.View`, `position: absolute, top: 0`
   - CategoryFilter: 独立 `Animated.View`, `position: absolute, top: HEADER_HEIGHT`
   - 两者用同一个 `{ transform: [{ translateY: headerTranslateY }] }`
   - FlatList 的 `contentContainerStyle` 加入 `paddingTop: contentPaddingTop`
   - FlatList 的 `contentContainerStyle` 的 `paddingBottom` 加上 `TAB_BAR_HEIGHT`
5. **样式** — `headerArea` 删除，改为 `headerOverlay` + `categoryFilterOverlay` 两个 absolute 样式

保持不变的部分:
- Pagination accumulation (已修好)
- Category change/debounce
- Pull-to-refresh
- Empty/loading/error states
- renderItem / renderFooter

### 风险

`contentPaddingTop` 需要用 `useNativeDriver: false`，因为 paddingTop 是布局属性。但由于动画只会在滚动方向变化时触发一次（200ms 完成），不会逐帧触发，所以性能影响可以忽略。

### 验证

1. `npx tsc --noEmit` — 零错误
2. 滚动测试:
   - 向下滑 → Header 隐藏, CategoryFilter 吸顶, TabBar 隐藏, 内容填满无空白
   - 向上滑 → Header 显示, CategoryFilter 回到 Header 下方, TabBar 显示
   - 快速来回滑动 → 动画平滑
   - 下拉刷新 → RefreshControl 正常工作
   - 分类切换 → CategoryFilter 选择正常
