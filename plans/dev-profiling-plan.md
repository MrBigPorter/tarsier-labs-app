# Performance Profiling in Development — Plan

## Layer 1 — Built-in (zero install)

| 工具 | 触发方式 | 检测内容 |
|------|----------|----------|
| **FPS Monitor** | 摇晃设备 → "Show Perf Monitor" | 实时 FPS、JS 线程占用、内存 |
| **React DevTools (inline)** | 摇晃设备 → "Open React DevTools" | 组件树、Props、Profiler 火焰图 |

## Layer 2 — 新增工具 (recommended)

### A. `react-devtools` (standalone Profiler)

安装: `yarn add -D react-devtools`

```
make devtools    # 启动独立 React DevTools（新窗口）
```

- 比 inline 版更强：Profiler tab 可录制交互，查看每次 commit 的渲染耗时
- 识别不必要的 re-render、定位慢组件

### B. Hermes CPU Profiler

```
make profile     # 捕获 Hermes CPU 火焰图
```

- `react-native profile-hermes` 生成 Chrome DevTools 兼容的 `.cpuprofile`
- 打开 `chrome://inspect` 加载即可看到火焰图
- 精确定位 JS 线程瓶颈

## Layer 3 — 可选 (Why Did You Render)

安装: `yarn add -D @welldone-software/why-did-you-render`

- 检测组件 props/state 未变化却重新渲染的情况
- 需要在 `App.tsx` 加初始化代码（仅 dev 环境生效）
- 适合优化阶段启用，日常开发可以不开启

---

## Proposed Makefile additions

```makefile
devtools: ## Launch standalone React DevTools for component profiling
	npx react-devtools

profile: env-dev ## Capture Hermes CPU profile (flamegraph)
	yarn react-native profile-hermes

perf: env-dev ## Dev mode + React DevTools (two terminals needed)
	@echo "📱 Open another terminal and run: make devtools"
	@echo "📱 Then shake device → Open React DevTools"
	yarn start
```
