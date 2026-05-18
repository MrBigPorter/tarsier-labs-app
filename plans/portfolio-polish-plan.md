# Portfolio Polish Plan — 项目分析与全面改造方案

## 📋 项目现状全面评估

### ✅ 项目优势 (Strengths)

| 类别            | 优势                                                                                  |
| --------------- | ------------------------------------------------------------------------------------- |
| **技术栈**      | React Native 0.85 + TypeScript 5.x + Redux Toolkit 2.x + RTK Query — 现代移动端技术栈 |
| **架构**        | 清晰的目录分层 (`api/`、`components/`、`lib/`、`navigation/`、`screens/`、`store/`)   |
| **国际化**      | 支持 6 种语言 (EN/ZH/JA/KO/FR/DE)，基于 i18next                                       |
| **主题系统**    | 暗/亮模式切换，通过 Design Tokens 驱动，与 Flutter 项目共享                           |
| **性能监控**    | FPS 追踪、Hermes Profiler 自动触发、API 计时 (PerfContext)                            |
| **UI 动效**     | 自定义 Spring 动画 TabBar、滚动隐藏头部/筛选栏、Haptic Feedback                       |
| **功能丰富**    | 文章浏览/搜索、分类/标签筛选、书签、评论、认证、存档、统计                            |
| **测试**        | Jest 单元测试 + Detox E2E 测试 + ESLint + Prettier                                    |
| **CI/CD**       | GitHub Actions workflows + Husky Git hooks                                            |
| **深链接**      | `tarsier://` 自定义 scheme + Universal Links                                          |
| **离线支持**    | MMKV 本地存储 + Redux 状态管理                                                        |
| **原生能力**    | OAuth (Google/Apple)、视频播放、图片缓存、SSE 评论推送                                |
| **组件设计**    | 骨架屏加载、空状态、错误边界、网络状态提示                                            |
| **AboutScreen** | 已有完整的个人介绍页面：头像、统计数据、GitHub/邮箱链接、技能标签、技术栈展示         |

### ❌ 需要修复的问题 (Issues)

| #   | 问题                                   | 区域         | 严重程度 | 描述                                                                                                                                                                                                        |
| --- | -------------------------------------- | ------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **启动画面简陋**                       | LaunchScreen | 🔴 高    | [`LaunchScreen.storyboard`](ios/FrontendBlogMobile/LaunchScreen.storyboard:18) 只显示 "FrontendBlogMobile" 和 "Powered by React Native"                                                                     |
| 2   | **初始化白屏**                         | App.tsx      | 🔴 高    | [`App.tsx:160-163`](App.tsx:160) 返回 `null`，用户看到白屏                                                                                                                                                  |
| 3   | **Readme 非个人风格**                  | README.md    | 🔴 高    | 企业文档风格，版权归 "Tarsier Labs"，有残留代码行                                                                                                                                                           |
| 4   | **AboutScreen 品牌名 "Tarsier Labs"**  | AboutScreen  | 🔴 高    | Footer 硬编码 "Tarsier Labs"([`AboutScreen.tsx:461`](src/screens/AboutScreen.tsx:461))，i18n 标题/描述/版权都引用 Tarsier Labs                                                                              |
| 5   | **i18n 翻译含 Tarsier Labs**           | en.json      | 🔴 高    | `about.title`="About Tarsier Labs"，`about.copyright`="© 2026 Tarsier Labs"([`en.json:219,229`](src/messages/en.json:219))                                                                                  |
| 6   | **i18n 描述语需个性化**                | en.json      | 🟡 中    | `about.visionDescription`="Tarsier Labs builds modern web..."，`about.founderDescription`="Creator of Tarsier Labs"                                                                                         |
| 7   | **AboutScreen 缺 React Native 技术栈** | AboutScreen  | 🔴 高    | Mobile Development 分类只有 Flutter 技术([`AboutScreen.tsx:69-79`](src/screens/AboutScreen.tsx:69))，完全缺少这个项目实际使用的 React Native 技术（Reanimated、MMKV、Gesture Handler、React Navigation 等） |
| 8   | **Bootsplash 未配置**                  | package.json | 🟡 中    | `react-native-bootsplash` 在依赖中但未配置使用                                                                                                                                                              |
| 9   | **命名不一致**                         | 多处         | 🟡 中    | `app.json` 的 `displayName` 是 "Tarsier"，但 LaunchScreen 用的是 "FrontendBlogMobile"                                                                                                                       |
| 10  | **无截图/预览**                        | README.md    | 🟡 中    | 没有任何视觉展示，招聘方无法快速了解 UI 质量                                                                                                                                                                |
| 11  | **技术栈侧重 Web 端**                  | AboutScreen  | 🟢 低    | Tech Stack 包含 Next.js/Tailwind CSS 等 Web 技术，这是 RN 移动端项目，可以补充移动端比重                                                                                                                    |
| 12  | **缺少项目链接**                       | AboutScreen  | 🟢 低    | AboutScreen 的 Connect 部分可以添加指向本项目 GitHub 的链接                                                                                                                                                 |

---

## 🎯 全面改造方案

### Phase 1: App 启动体验改造

#### 1.1 修复 LaunchScreen.storyboard

**目标**: 替换 "FrontendBlogMobile" 为品牌名，美化布局

**涉及文件**:

- [`ios/FrontendBlogMobile/LaunchScreen.storyboard`](ios/FrontendBlogMobile/LaunchScreen.storyboard:18)

**改动内容**:

- 将 "FrontendBlogMobile" 文本改为 "Tarsier"
- 移除 "Powered by React Native" 标签
- 背景色匹配 app 品牌色
- 可选：添加 logo 图片引用（需先在 Xcode asset catalog 中添加）

#### 1.2 配置 react-native-bootsplash

**目标**: 在 JS 层初始化期间（auth restore、Sentry init）展示品牌启动画面，避免白屏

**涉及文件**:

- 生成 bootsplash 资源
- 修改 [`App.tsx`](App.tsx:132)

**改动内容**:

```bash
# 生成 bootsplash 资源
yarn react-native generate-bootsplash assets/logo.png \
  --background-color=FFFFFF \
  --logo-width=150 \
  --assets-path=assets/ \
  --flavor=main
```

- 在 [`App.tsx:160`](App.tsx:160) 中将 `return null` 替换为展示 BootSplash
- 初始化完成后调用 `BootSplash.hide({ fade: true })`

#### 1.3 统一应用命名

- 确认 Xcode build settings 中 `DISPLAY_NAME` = "Tarsier"
- Android `strings.xml` 已有 "Tarsier" ✅

---

### Phase 2: AboutScreen + 品牌清洗 + 技术栈补充

#### 2.1 修改 AboutScreen.tsx — Footer 品牌

**涉及文件**:

- [`src/screens/AboutScreen.tsx`](src/screens/AboutScreen.tsx:461)

**改动内容**:

- 第 461 行：将 `Tarsier Labs` 改为个人品牌名（如 `Porter` 或保留 `Tarsier` 但不加 `Labs`）

#### 2.2 AboutScreen Tech Stack — 加入 React Native 技术

**涉及文件**:

- [`src/screens/AboutScreen.tsx`](src/screens/AboutScreen.tsx:69-79)

**改动内容**:

在 **Mobile Development** 分类中，将当前只有 Flutter 的技术卡片改为包含两类移动端技术：

**方案**: 保持 Flutter 卡片，同时在 Mobile Development 分类下新增 React Native 技术卡片

```typescript
{
  category: 'mobile',
  title: 'Mobile Development',
  description: 'Cross-platform mobile development',
  items: [
    // React Native (this project)
    { name: 'React Native', icon: '📱', description: 'Cross-platform mobile framework', descKey: 'about.techRn' },
    { name: 'Reanimated', icon: '🎭', description: 'High-performance animations on UI thread', descKey: 'about.techReanimated' },
    { name: 'MMKV', icon: '💾', description: 'Fast key-value local storage', descKey: 'about.techMmkv' },
    { name: 'React Navigation', icon: '🧭', description: 'Declarative navigation & routing', descKey: 'about.techReactNavigation' },
    { name: 'Gesture Handler', icon: '👆', description: 'Native gesture handling', descKey: 'about.techGestureHandler' },
    // Flutter (other projects)
    { name: 'Flutter', icon: '📱', description: 'Cross-platform mobile framework', descKey: 'about.techFlutter' },
    { name: 'Shorebird', icon: '🔄', description: 'Flutter hot update solution', descKey: 'about.techShorebird' },
  ],
},
```

**同时需要在 i18n 翻译中添加新的 key**:

- `about.techRn` / `about.techReanimated` / `about.techMmkv` / `about.techReactNavigation` / `about.techGestureHandler`

#### 2.3 更新 i18n 翻译 (所有 6 种语言)

**涉及文件**:

- [`src/messages/en.json`](src/messages/en.json:218-297)
- `src/messages/zh.json`
- `src/messages/ja.json`
- `src/messages/ko.json`
- `src/messages/fr.json`
- `src/messages/de.json`

**改动内容** (以 en.json 为例):

**品牌清洗**:

```diff
- "title": "About Tarsier Labs",
+ "title": "About",
- "subtitle": "Building the next-generation user experience platform",
+ "subtitle": "A React Native blog application built with modern mobile technologies",
- "visionDescription": "Tarsier Labs builds modern web and mobile applications...",
+ "visionDescription": "A personal blog application showcasing modern mobile development...",
- "founderDescription": "Creator and core developer of Tarsier Labs",
+ "founderDescription": "Full Stack Developer passionate about building elegant mobile experiences",
- "copyright": "© 2026 Tarsier Labs. All rights reserved.",
+ "copyright": "© 2026 Porter. All rights reserved.",
```

**新增 React Native 技术描述**:

```json
"techRn": "Cross-platform mobile framework",
"techReanimated": "High-performance animations on UI thread",
"techMmkv": "Fast key-value local storage",
"techReactNavigation": "Declarative navigation & routing",
"techGestureHandler": "Native gesture handling",
```

> **注意**: 需要同步更新 `zh.json`、`ja.json`、`ko.json`、`fr.json`、`de.json` 中对应的值

---

### Phase 3: README.md 全面改版

#### 3.1 新 README 结构

```markdown
# 🐵 Tarsier — React Native Blog App

[![Platform: iOS](https://img.shields.io/badge/iOS-000?logo=ios)]()
[![Platform: Android](https://img.shields.io/badge/Android-3DDC84?logo=android)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript)]()
[![React Native](https://img.shields.io/badge/React_Native-0.85-61DAFB?logo=react)]()

## 📱 Screenshots ← 新增

> 放 4-5 张关键页面截图

## ✨ Features ← 保留并优化

> 突出移动端特有的交互亮点

## 🛠️ Tech Stack ← 保留

## 🏗️ Architecture ← 保留架构图

## 🚀 Quick Start ← 精简

## 📂 Project Structure ← 精简

## 👨‍💻 About the Developer ← 新增

> Porter — Full Stack Developer
> GitHub: [MrBigPorter](https://github.com/MrBigPorter)
> 本项目的技术亮点和我的贡献

## 📄 License

> MIT © 2026 Porter
```

**涉及文件**:

- [`README.md`](README.md:1) — 全文重写

---

### Phase 4: 截图/视觉素材

#### 4.1 生成 App 截图

**建议截图内容** (在 iOS Simulator 中截图，Cmd+S):

1. **HomeScreen** — 文章列表 + 分类筛选 + TabBar（亮色模式）
2. **ArticleDetailScreen** — 文章详情页
3. **Dark Mode 页面** — 暗色模式下的同一个页面
4. **Search 页面** — 搜索功能界面
5. **AboutScreen** — 个人介绍和技术栈页面

**可选**: GIF 动图展示 Tab 切换、暗/亮模式切换等交互

---

## 📝 完整执行清单

```
[ ] Phase 1: App 启动体验
  [ ] 1.1 更新 LaunchScreen.storyboard — 品牌名 + 美化
  [ ] 1.2 生成 bootsplash 资源 (yarn generate-bootsplash)
  [ ] 1.3 修改 App.tsx — BootSplash.hide() 代替 return null
  [ ] 1.4 验证：无白屏、启动画面显示正确

[ ] Phase 2: AboutScreen + 品牌清洗
  [ ] 2.1 修改 AboutScreen.tsx Footer — "Tarsier Labs" → 个人品牌
  [ ] 2.2 AboutScreen Tech Stack — 加入 React Native 技术（Reanimated, MMKV, Gesture Handler, React Navigation）
  [ ] 2.3 更新 en.json — about 部分去 Tarsier Labs 化 + 新增 RN 技术描述
  [ ] 2.4 同步更新 zh.json
  [ ] 2.5 同步更新 ja.json
  [ ] 2.6 同步更新 ko.json
  [ ] 2.7 同步更新 fr.json
  [ ] 2.8 同步更新 de.json

[ ] Phase 3: README 改版
  [ ] 3.1 重写 README 为 portfolio 风格
  [ ] 3.2 添加技术栈徽章 (shields.io)
  [ ] 3.3 添加作者信息、GitHub 链接、个人 License
  [ ] 3.4 移除 Tarsier Labs 版权信息

[ ] Phase 4: 截图素材
  [ ] 4.1 在模拟器截图关键页面 (Home, Article, Dark Mode, About)
  [ ] 4.2 将截图加入 README
  [ ] 4.3 可选：制作 GIF 动图展示交互
```

## 🔄 执行顺序

```
Phase 1 (启动画面) ──→ 需要模拟器验证
     │
Phase 2 (品牌清洗 + RN 技术栈) ──→ 可并行
     │
Phase 3 (README) ────→ 依赖 Phase 4 的截图
     │
Phase 4 (截图) ──────→ 需要 Phase 1 完成后才能跑模拟器
```

**推荐执行顺序**: Phase 1 → Phase 2 → Phase 4 → Phase 3
