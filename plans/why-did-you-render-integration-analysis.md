# Why Did You Render — 集成分析

## 用户需求

> "好像有插件可以检查哪些文件如何渲染吧？我 why dorender"

需要一个工具来回答：**这个组件为什么重新渲染了？**

---

## 方案对比

### 方案 A：React DevTools Profiler（已有，零配置）

`react-devtools` v7 已经在 [`package.json`](package.json:76) 的 devDependencies 中。

**使用方式：**
```bash
# 终端 1：启动 devtools
npx react-devtools

# 终端 2：启动 RN 应用（连接模拟器）
npx react-native start --reset-cache
```

**能力：**
- **Profiler 选项卡** → 录制渲染 → 点击组件 → 查看 "Why did this render?"
- **Components 选项卡** → Settings → 勾选 "Highlight updates when components render"
- 组件树中直接显示 `rendered by` 链路

**优点：** 零代码改动，React 19 官方支持，UI 界面直观
**缺点：** 需要手动录制/观察，不能持续在控制台输出

### 方案 B：`@welldone-software/why-did-you-render`

**安装：**
```bash
yarn add -D @welldone-software/why-did-you-render
```

**集成到 App.tsx：**
`require()` 必须在所有 React 渲染之前执行，放在文件顶部：

```tsx
// App.tsx — 顶部
if (__DEV__) {
  const whyDidYouRender = require('@welldone-software/why-did-you-render');
  whyDidYouRender(React, {
    trackAllPureComponents: false, // 不全局追踪，避免噪音
    trackExtraFunctionCalls: true,
  });
}
```

**标记组件**（在组件文件中）：
```tsx
// EmptyLogoContent.tsx
EmptyLogoContent.whyDidYouRender = true;

// ArticleCard.tsx
ArticleCard.whyDidYouRender = true;
```

**TypeScript 类型扩展**：
需要添加 `.d.ts` 文件扩展 React 类型：

```tsx
// src/types/why-did-you-render.d.ts
import React from 'react';

declare module 'react' {
  interface FunctionComponent<P = {}> {
    whyDidYouRender?: boolean;
  }
  interface MemoExoticComponent<T = any> {
    whyDidYouRender?: boolean;
  }
}
```

**控制台输出示例：**
```
EmptyLogoContent rendered because props changed:
  [title] "No articles yet" → "No articles yet"
  [description] "Check back later" → "Check back later"
```

**优点：** 持续在控制台输出，不需要手动操作，精确到具体 prop 变化
**缺点：** 需要代码改动；React 19 兼容性需要验证（库最新版 v8+ 声称支持）

---

## 当前项目的关键组件追踪建议

如果集成，建议优先标记以下组件排查 flickering：

| 组件 | 文件 | 标记原因 |
|------|------|----------|
| `EmptyLogoContent` | [`src/components/core/EmptyLogoContent.tsx`](src/components/core/EmptyLogoContent.tsx) | 已加 `React.memo`，验证是否生效 |
| `HomeScreen` | [`src/screens/HomeScreen.tsx`](src/screens/HomeScreen.tsx) | 整个 screen 的渲染频率 |
| `ArticleCard` | [`src/components/blog/ArticleCard.tsx`](src/components/blog/ArticleCard.tsx) | FlatList 中是否不必要重渲染 |
| `AppImage` | [`src/components/core/AppImage.tsx`](src/components/core/AppImage.tsx) | 图片组件的渲染行为 |

---

## 执行步骤

```
1. [安装] yarn add -D @welldone-software/why-did-you-render
2. [配置] App.tsx 顶部添加 __DEV__ 初始化代码
3. [类型] src/types/why-did-you-render.d.ts 类型扩展
4. [标记] 在 EmptyLogoContent.tsx 等组件上加 whyDidYouRender = true
5. [验证] npx react-native start --reset-cache 重启 Metro
6. [观察] 控制台日志确认 EmptyLogoContent 是否因 props 不变而跳过渲染
```

---

## 风险

1. **React 19 兼容性** — 库的 `trackExtraFunctionCalls` 在 React 18+ 有 breaking change，需要先安装测试
2. **Metro 缓存** — 确保 `--reset-cache` 启动，否则 require 可能不生效
3. **Console 噪音** — 建议 `trackAllPureComponents: false` + 手动标记，避免被日志淹没
