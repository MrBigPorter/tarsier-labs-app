# Performance Monitoring — Enterprise Plan

## Current State

| 项目 | 状态 |
|------|------|
| Sentry DSN in `.env.production` | ✅ 已配置 |
| Sentry DSN in `.env.staging` | ✅ 已配置 |
| `env.SENTRY_ENABLED` logic | ✅ 已实现（staging/prod 启用） |
| ErrorBoundary `onError` callback | ✅ 预留接口 |
| `@sentry/react-native` SDK | ❌ 未安装 |
| Sentry 初始化代码 | ❌ 未实现 |
| Sentry Performance Tracing | ❌ 未实现 |
| React DevTools | ❌ 未安装 |
| Detox 性能断言 | ❌ 未实现 |
| Hermes Profiler 脚本 | ❌ 未加入 Makefile |
| `make profile` 命令 | ❌ 未实现 |

---

## Tier 1 — Development（开发阶段 · 本地分析）

目标：开发时发现性能瓶颈，不需要集成第三方。

### 1.1 React DevTools Profiler

```
yarn add -D react-devtools
```

用法：
```
make devtools    # 启动独立 React DevTools（新窗口）
make perf        # Metro + DevTools 同时启动
```

功能：
- 录制交互过程，查看每次 React commit 的渲染耗时
- 定位哪些组件渲染慢、渲染次数多
- 识别不必要的 re-render

### 1.2 Hermes CPU Profiler

RN 0.85 默认使用 Hermes 引擎，内置 profiling 工具。

```
make profile     # 捕获 CPU 火焰图
```

生成 `.cpuprofile` 文件 → 在 `chrome://inspect` 中加载 → 查看火焰图。

适用场景：
- JS 线程卡顿（滚动不流畅、动画掉帧）
- 定位 CPU 热点函数
- API 数据处理瓶颈

### 1.3 RN 内置 FPS Monitor

无需安装，摇晃设备 → "Show Perf Monitor" → 实时查看 FPS / JS 线程 / RAM。

### 1.4 开发环境 Makefile 命令

新增以下 Makefile target：

```makefile
devtools: ## Launch standalone React DevTools
	npx react-devtools

profile: env-dev ## Capture Hermes CPU flamegraph
	yarn react-native profile-hermes

perf: env-dev ## Dev mode hint with profiling tools
	@echo "📱 Terminal 1: make devtools"
	@echo "📱 Terminal 2: make dev"
	@echo "📱 Shake device → Open React DevTools"
```

---

## Tier 2 — CI（持续集成 · 自动化检测）

目标：在合并代码前自动发现性能回退。

### 2.1 Detox 性能预算

`detox` 已在 [`package.json`](package.json:59) devDependencies 中。

可以在 E2E 测试中添加性能断言：

```ts
it('should render home screen within 500ms', async () => {
  await device.reloadReactNative();
  await expect(element(by.id('home-screen'))).toBeVisible();

  const metrics = await device.getPerformanceMetrics('HomeScreen');
  expect(metrics.jsThreadUsage).toBeLessThan(80);   // JS 线程 < 80%
  expect(metrics.fps).toBeGreaterThan(30);           // FPS > 30
});
```

### 2.2 TypeScript 编译检查（已实现）

```
make check    # lint + typecheck + test
```

已在 [`Makefile`](Makefile) 中实现。

### 2.3 CI Workflow 扩展建议

在 [`.github/workflows/test.yml`](.github/workflows/test.yml) 中加入：

```yaml
- name: TypeScript Check
  run: yarn tsc --noEmit

- name: Run Detox with Performance Budget
  run: yarn detox test --configuration ios.sim.release
```

---

## Tier 3 — Production（生产环境 · 真实用户数据）

目标：在用户设备上自动采集性能数据，发现真实环境的问题。

### 3.1 安装 Sentry SDK

```sh
yarn add @sentry/react-native
cd ios && pod install && cd ..
```

### 3.2 Sentry 初始化

创建 [`src/lib/sentry.ts`](src/lib/sentry.ts)：

```typescript
import * as Sentry from '@sentry/react-native';
import { env } from '@/lib/env';

export function initSentry() {
  if (!env.SENTRY_ENABLED || !env.SENTRY_DSN) return;

  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.BUILD_VARIANT,

    // Performance Monitoring
    tracesSampleRate: env.BUILD_VARIANT === 'production' ? 0.1 : 1.0,

    // Screen tracking via React Navigation
    integrations: [
      Sentry.reactNavigationIntegration({
        enableTimeToInitialDisplay: true,
      }),
    ],

    // Slow/frozen frame tracking
    enableNativeFramesTracking: true,

    // HTTP client tracking (RTK Query via fetch)
    enableTracing: true,
  });
}
```

### 3.3 Sentry 接入点

| 接入点 | 位置 | 作用 |
|--------|------|------|
| **初始化** | [`App.tsx`](App.tsx) — 应用启动时 | 加载 Sentry SDK |
| **错误边界** | [`ErrorBoundary.tsx`](src/components/core/ErrorBoundary.tsx:20) — `onError` 回调 | 捕获 React 错误树 |
| **导航追踪** | `@sentry/react-native` 的 `reactNavigationIntegration` | 自动记录屏幕加载耗时 |
| **网络追踪** | Sentry 自动拦截 `fetch` | 自动记录 API 耗时 |
| **慢帧检测** | Sentry 原生自动采集 | 检测 UI 卡顿 |

### 3.4 Sentry Performance 自动采集的数据

| 指标 | 采集方式 | 阈值告警 |
|------|----------|----------|
| **屏幕加载时间** | React Navigation 集成 | 可设 > 2s 告警 |
| **慢帧 (Slow Frames)** | 原生帧率监控 | > 16ms/帧 记录 |
| **卡顿帧 (Frozen Frames)** | 原生帧率监控 | > 700ms/帧 记录 |
| **API 响应时间** | `fetch` 自动拦截 | 可设 > 3s 告警 |
| **App 启动时间** | `enableTimeToInitialDisplay` | 可设 > 5s 告警 |
| **崩溃率** | Sentry 自动 | 自动告警 |

### 3.5 接入 ErrorBoundary

在 [`ErrorBoundary.tsx`](src/components/core/ErrorBoundary.tsx:20) 中，`onError` 回调已预留接口，接入 Sentry：

```typescript
import * as Sentry from '@sentry/react-native';

// 在 ErrorBoundary 的 componentDidCatch 中：
componentDidCatch(error: Error, errorInfo: ErrorInfo) {
  Sentry.captureException(error, { extra: errorInfo });
  this.props.onError?.(error, errorInfo);
}
```

---

## Implementation Todo List

### Phase 1 — Dev Tools（低优先级 · 开发体验优化）

- [ ] `yarn add -D react-devtools`
- [ ] 在 Makefile 添加 `devtools` / `profile` / `perf` 命令

### Phase 2 — Production Monitoring（高优先级 · 上线前必须）

- [ ] `yarn add @sentry/react-native`
- [ ] 创建 [`src/lib/sentry.ts`](src/lib/sentry.ts) — Sentry 初始化 + Performance Tracing
- [ ] 在 [`App.tsx`](App.tsx) 中调用 `initSentry()`
- [ ] 在 [`ErrorBoundary.tsx`](src/components/core/ErrorBoundary.tsx) 中接入 Sentry 错误上报
- [ ] `cd ios && pod install`

### Phase 3 — CI Performance Budgets（中优先级 · 后续迭代）

- [ ] 配置 Detox 性能断言
- [ ] 在 CI workflow 中加入性能预算检查

---

## Monitoring Dashboard（Sentry 内）

上线后可在 Sentry 中查看以下看板：

1. **Performance → Transactions**: 各屏幕加载耗时排行
2. **Performance → Slow/Frozen Frames**: 卡顿设备分布
3. **Issues**: 按影响用户数排序的错误
4. **Dashboards**: 自定义看板（启动时间、API 响应、帧率趋势）

![Sentry Performance Dashboard](https://docs.sentry.io/performance/distributed-tracing/)

---

## 总结

| 环节 | 工具 | 发现问题类型 | 自动？ |
|------|------|-------------|--------|
| 开发 | Hermes Profiler + React DevTools | 渲染瓶颈、CPU 热点 | ❌ 手动分析 |
| CI | Detox 性能断言 | 性能回退 | ✅ 自动拦截 |
| 生产 | Sentry Performance | 真实用户卡顿、慢屏幕、API 慢 | ✅ 自动采集 |

核心建议：**优先上线 Phase 2（Sentry Performance）**，这样才能在真实用户设备上发现问题，而不是靠开发者自己复现。
