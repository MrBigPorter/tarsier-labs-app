# ArticleCard 背景/边框修复计划

## 用户反馈
> "好像不太对，你看看 airticel 每个 item 都是有背景边框的，app 就漏了"
> "你先解释哦"

## 根因分析

### 问题：Card 背景 === Screen 背景，完全相同

| Mode | 元素 | Token 链 | 当前值 | 问题 |
|------|------|----------|--------|------|
| **Light** | Screen 背景 | `colors.background` → `colors.bgPrimary` | `#ffffff` | ❌ |
| **Light** | Card 背景 | `colors.bgPrimary` | `#ffffff` | ❌ 与 screen 相同 |
| **Light** | Card 边框 | `colors.borderSecondary` | `#e9eaeb` | ✅ 勉强可见 |
| **Dark** | Screen 背景 | `colors.background` → `colors.bgPrimary` | `#22262f` | ❌ |
| **Dark** | Card 背景 | `colors.bgPrimary` | `#22262f` | ❌ 与 screen 相同 |
| **Dark** | Card 边框 | `colors.borderSecondary` | `#22262f` | ❌ 完全不可见 |

### Web 端对比

Web 端用 Tailwind：
```tsx
<div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
```
- **Card** = `bg-white` (`#ffffff`) / `dark:bg-slate-900` (`#0f172a`)
- **边框** = `border-slate-200` (`#e2e8f0`) / `dark:border-slate-700` (`#334155`)
- **页面背景** = body 默认（不是白色），所以 card 能「浮出来」

### 关键差异

Web 端 **页面背景 ≠ Card 背景**，因此 card 有视觉层次感。而 App 端两者都是 `colors.bgPrimary`。

### 为什么之前没发现？

之前的 token 同步工作专注于品牌色（`#fc7701` → `#d68a29`）和布局结构，没有检查背景/边框的对比度。`colors.background` 和 `colors.bgPrimary` 的绑定关系是 `ThemeContext.tsx` 中定义的别名映射，之前没有修改过。

---

## 修复方案

### 方案：对齐 Web 端 — Screen 用 bgSecondary，Card 保持白色

模仿 Web 端「灰色页面背景 + 白色卡片」的设计模式。

| 元素 | 当前值 (Light) | 修复后 (Light) | 当前值 (Dark) | 修复后 (Dark) |
|------|---------------|---------------|---------------|---------------|
| **Screen 背景** | `colors.bgPrimary` = `#ffffff` | `colors.bgSecondary` = `#f5f5f5` | `colors.bgPrimary` = `#22262f` | `colors.bgSecondary` = `#0a0d12` |
| **Card 背景** | `colors.bgPrimary` = `#ffffff` | ✅ 保持不变 `#ffffff` | `colors.bgPrimary` = `#22262f` | ✅ 需提亮 |
| **Card 边框** | `colors.borderSecondary` = `#e9eaeb` | ✅ 保持不变 | `colors.borderSecondary` = `#22262f` | ❌ 需修复 |

### 需要修复的 Dark Mode 边框值

当前：`TokensDark.borderSecondary` = `#22262f`（和 bgPrimary 完全相同）
应为：`#373a41`（类似 Web 端 `slate-700` `#334155`）

---

## 实施步骤

### Step 1: 修复 `assets/variables.tokens.json` 中的 Dark Mode 边框值

找到 `TokensDark` 下的 `borderSecondary`，将值从 `#22262f` 改为 `#373a41`。

### Step 2: 重新生成 `design_tokens.g.ts`

运行 token 生成脚本，使 `TokensDark.borderSecondary` 更新为 `#373a41`。

### Step 3: 修改所有 Article List Screen 的容器背景

将这些文件的 `{ backgroundColor: colors.background }` 改为 `{ backgroundColor: colors.bgSecondary }`：

| 文件 | 行数（约） | 改动 |
|------|-----------|------|
| `src/screens/ArticleListScreen.tsx` | 204, 215 | 2 处 |
| `src/screens/CategoryArticlesScreen.tsx` | 107, 119 | 2 处 |
| `src/screens/TagArticlesScreen.tsx` | 102, 114 | 2 处 |
| `src/screens/BookmarksScreen.tsx` | 165, 183, 196 | 3 处 |
| `src/screens/ArchiveScreen.tsx` | 151, 163 | 2 处 |
| `src/screens/HomeScreen.tsx` | 489 — 仅外层 container | 1 处 |
| `src/screens/TagListScreen.tsx` | 67, 93 | 2 处 |
| `src/screens/CategoryListScreen.tsx` | 73, 96 | 2 处 |
| `src/screens/SearchScreen.tsx` | (待确认) | 1 处 |

**不移改的屏幕**（它们保持白色背景是合理的）：
- `SettingsScreen.tsx` — 设置页用白色
- `AboutScreen.tsx` — 关于页用白色
- `StatsScreen.tsx` — 统计页用白色

### Step 4: 修改 `ArticleCard.tsx` — 提亮 Dark Mode Card 背景

当前 `colors.bgPrimary` 在 dark mode 下是 `#22262f`，和 `colors.bgSecondary` 的 `#0a0d12` 对比不够强。
改为使用 `colors.surface`（= `colors.bgSecondary`？不）或给 Card 在 dark mode 下使用稍亮的颜色。

实际方案：Card 的 `backgroundColor` 在 dark mode 下保持 `colors.bgPrimary`（`#22262f`），但由于 screen 背景变为 `colors.bgSecondary`（`#0a0d12`），现在 `#22262f` 和 `#0a0d12` 之间有足够对比。

| Mode | Screen 背景 | Card 背景 | 对比度 |
|------|------------|-----------|--------|
| Light | `#f5f5f5` | `#ffffff` | ✅ 明显 |
| Dark | `#0a0d12` | `#22262f` | ✅ 明显（深灰 vs 更深灰） |
| Dark Border | — | `#373a41` | ✅ 可见 |

### Step 5: 验证

运行 TypeScript 检查，确认没有类型错误。

---

## 文件修改汇总

| # | 文件 | 改动类型 | 说明 |
|---|------|---------|------|
| 1 | `assets/variables.tokens.json` | 值修改 | Dark `borderSecondary`: `#22262f` → `#373a41` |
| 2 | `src/lib/theme/design_tokens.g.ts` | 自动生成 | 重新生成 |
| 3 | `src/screens/ArticleListScreen.tsx` | 背景色 | `colors.background` → `colors.bgSecondary` |
| 4 | `src/screens/CategoryArticlesScreen.tsx` | 背景色 | 同上 |
| 5 | `src/screens/TagArticlesScreen.tsx` | 背景色 | 同上 |
| 6 | `src/screens/BookmarksScreen.tsx` | 背景色 | 同上 |
| 7 | `src/screens/ArchiveScreen.tsx` | 背景色 | 同上 |
| 8 | `src/screens/HomeScreen.tsx` | 背景色 | 同上 |
| 9 | `src/screens/TagListScreen.tsx` | 背景色 | 同上 |
| 10 | `src/screens/CategoryListScreen.tsx` | 背景色 | 同上 |
| 11 | `src/screens/SearchScreen.tsx` | 背景色 | 同上（如需要） |
