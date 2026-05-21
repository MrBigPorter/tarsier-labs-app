# README 优化计划 — 面试 Portfolio 导向

> 基于当前 README.md（560 行）进行全面重构，精简至约 300-350 行，
> 面向求职面试场景，"假装已上线"的 Portfolio 项目展示。

---

## 一、当前 README 问题诊断

| #   | 问题                        | 严重程度 | 说明                                                |
| --- | --------------------------- | -------- | --------------------------------------------------- |
| 1   | ❌ 截图区域是 TODO 占位符   | **致命** | 面试官第一眼看的永远是截图，占位符直接扣分          |
| 2   | ❌ 没有商店入口徽章         | **高**   | 没有 Google Play / App Store 按钮，不像已上线       |
| 3   | ❌ 没有"技术挑战"板块       | **高**   | 面试官想看到你解决了什么难题，而非单纯介绍功能      |
| 4   | ❌ 项目定位不够自信         | **中**   | "Built as a portfolio project" 可以改为更自信的表述 |
| 5   | ❌ CodePush ~100 行         | **中**   | 面试场景不需要知道 deployment key 怎么配            |
| 6   | ❌ CI/CD + 发布 ~200 行     | **中**   | 细节太多，分散注意力。精简后挪到 docs/              |
| 7   | ❌ 显示名不一致             | **低**   | app.json 是 "Porter Dev"，README 是 "Tarsier"       |
| 8   | ❌ 没有质量数据             | **中**   | 测试覆盖、性能优化成果 — 展示工程化能力             |
| 9   | ⚠️ About Developer 不够突出 | **中**   | 面试官会看开发者背景，需要更清晰的 profile          |

---

## 二、推荐的新结构

```
# 🐵 Tarsier — React Native Blog App (已上线)
[Google Play 徽章] [App Store 徽章] [技术栈徽章] [License 徽章]

> 一句话定位：已上线 Google Play 的全功能博客 App，展示完整 React Native 开发能力

## ✨ 技术亮点           ← NEW! 面试官最想看的
5-6 个具体技术挑战 + 解决方案
  - 多语言环境下的 API 缓存一致性
  - Reanimated UI 线程动画实现流畅 Tab Bar
  - 自托管 CodePush 热更新体系
  - RTK Query 乐观更新 + 离线缓存
  - SSE 实时评论推送
  - 等

## 📸 截图                 ← 替换 TODO（本次暂不添加）
3-4 张精选截图（Home / Article Detail / Search / Dark Mode）

## 🏗️ 架构                  ← 保留精简版
Provider 树 + Data Flow 图，去掉过深的技术细节

## 🧪 技术栈                ← 保留

## 🚀 线上地址              ← NEW!（本次暂不添加链接）

## ✨ 核心功能              ← 精简到 8-10 个
去掉过度详细的描述，每个功能一句话

## 👨‍💻 关于开发者            ← 加强
GitHub / LinkedIn / Email 更突出
直接关联到项目中展示的技术能力

## 🚀 快速开始              ← 精简
只需安装 + 运行的基本命令

## 📊 质量与测试            ← NEW!
测试覆盖度、性能优化成果、Sentry 监控

## 📄 License

---

### 附录：深度文档（从 README 移出）
- 自托管 CodePush → docs/self-hosted-codepush-flow.md
- CI/CD 配置 → docs/ci-cd-setup-guide.md
- Google Play 上架 → docs/android-google-play-complete-flow.md

---

## 三、具体修改项

### Step 1: 顶部改造 ✅ 本次执行
- 添加 Google Play / App Store badges（无链接，仅显示徽章）
- 改写 intro 为更自信的语气
- 新增 shields：Jest、CodePush、Sentry

### Step 2: 新增「技术亮点」板块 ✅ 本次执行
从已有 plans/ 和代码中提取的面试亮点：
1. **多语言 API 缓存一致性** — 切换语言时 RTK Query 自动用 lang tag 失效缓存
2. **Reanimated UI 线程动画** — Tab Bar 切换使用 useSharedValue + withSpring，0 帧丢失
3. **自托管 CodePush** — 完全自建热更新体系，脱离 App Center 依赖
4. **RTK Query 乐观更新** — 书签/点赞即时反馈 + 后台同步 + 离线回滚
5. **SSE 实时评论** — react-native-sse 实现长连接，新评论实时推送
6. **主题系统** — 设计 Token 体系 + MMKV 持久化 + Reanimated 过渡动画

### Step 3: 截图占位符 ✅ 本次执行
- 截图区域保留为占位符（移除 TODO 注释标记，改为待添加提示）

### Step 4: 精简 CodePush 章节 ✅ 本次执行
- 100 行 → ~20 行概述 + 指向 docs/

### Step 5: 精简 CI/CD & 发布章节 ✅ 本次执行
- 200 行 → ~30 行概览 + 指向 docs/

### Step 6: 线上地址 ✅ 本次执行
- 保留结构，链接待补充

### Step 7: 加强 About Developer ✅ 本次执行

### Step 8: 新增质量指标 ✅ 本次执行

---

## 四、前置条件（后续补充）

- [ ] 截图：从模拟器截取 4 张高质量截图
- [ ] Google Play 链接
- [ ] App Store 链接
```
