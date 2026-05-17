# Programmatic Performance Monitoring — Architecture Plan

## Goal

自动采集性能数据，设定阈值自动告警，而不是靠人眼盯着 FPS 数字。

## Architecture

```
src/lib/perf/
├── PerfProvider.tsx      ← 在 App.tsx 包裹（仅 dev 环境）
├── useFPS.ts             ← 采集实时 FPS / JS 线程延迟
├── useRenderTracker.ts   ← 追踪组件渲染次数和触发来源
├── useNetworkTiming.ts   ← 监控 RTK Query 接口耗时
├── perfConfig.ts         ← 阈值配置（可调）
└── PerfOverlay.tsx       ← 可选：开发时悬浮显示（非必需）
```

## Data Flow

```
App.tsx → PerfProvider 启动所有 hook
                │
        ┌───────┼───────┐
        │       │       │
    useFPS  useRender  useNetwork
                │       │
        ┌───────┴───────┘
        │
    perfConfig.ts (threshold check)
        │
        ▼
  console.warn / logger.warn
  ──────────────────────────
  e.g. "[Perf] FPS dropped to 18 for 3+ seconds"
  e.g. "[Perf] ArticleCard re-rendered 12 times in 5s"
  e.g. "[Perf] GET /articles took 4.2s (threshold: 2s)"
```

## Detection Rules (自动判定)

| 指标 | 阈值 | 触发动作 |
|------|------|----------|
| FPS < 30 持续 2s+ | `fpsThreshold: 30` | `logger.warn` + 记录时间窗口 |
| 连续 5 帧 > 50ms | `jankThreshold: 50ms` | 标记为 jank 事件 |
| 单一组件 5s 内 re-render > 10 次 | `renderCountThreshold: 10` | 警告 + 记录调用栈 |
| RTK Query 响应 > 3s | `apiThreshold: 3000ms` | 警告慢接口 |
| RTK Query 响应 > 8s | `apiErrorThreshold: 8000ms` | 视为异常 |
| 屏幕切换 > 500ms | `navigationThreshold: 500ms` | 警告慢导航 |

## Integration Points

### 1. FPS Tracking (`useFPS.ts`)
- 用 `requestAnimationFrame` loop 计算实时帧率
- 不依赖第三方库，纯 JS 实现
- 记录最低 FPS + 低帧持续时间

### 2. Render Tracking (`useRenderTracker.ts`)
- 在需要关注的组件加 `useTrackRender('ComponentName')`
- 自动统计 5s 滑动窗口内的渲染次数
- 超过阈值自动告警

### 3. Network Timing (`useNetworkTiming.ts`)
- 通过 Redux middleware 监听 `rtk-query` 的 `fulfilled` / `rejected` action
- 计算请求耗时（`meta.requestStatus` + `meta.requestId`）
- 超过 `apiThreshold` 自动输出警告

### 4. Navigation Timing
- 监听 React Navigation 的 `state` 变化
- 测量 `beforeRemove` → `focus` 的耗时
- 超过 500ms 告警

## Usage

```typescript
// App.tsx (only in dev)
if (__DEV__) {
  const { PerfProvider } = require('@/lib/perf/PerfProvider');
  // wrap app with PerfProvider
}

// In any component (optional)
import { useTrackRender } from '@/lib/perf/useRenderTracker';

function ArticleCard({ article }: Props) {
  useTrackRender('ArticleCard', { article: article.id });
  // ...
}
```

## Output Example

```
[PerfMonitor] ⚠️  FPS dropped to 18 for 3.2s
    → Screen: HomeScreen
    → Timestamp: 2026-05-14T17:00:00.000Z

[PerfMonitor] ⚠️  ArticleCard (articles-list) re-rendered 14 times in 5s
    → Suggestion: check parent state updates or missing React.memo

[PerfMonitor] ⚠️  GET /v1/frontend/blog/articles took 4.5s
    → Threshold: 3s
    → Suggestion: check network or paginate data

[PerfMonitor] ✅  Navigation to ArticleDetail took 320ms
    → Within threshold (500ms)
```

## Implementation Steps

1. Create `src/lib/perf/` directory with files above
2. Implement `useFPS.ts` — frame timing via rAF
3. Implement `useRenderTracker.ts` — render count + deps tracking
4. Implement `useNetworkTiming.ts` — Redux middleware for RTK Query timing
5. Implement `PerfProvider.tsx` — aggregates all hooks
6. Wire into `App.tsx` behind `__DEV__` guard
7. Add `make perf` target to Makefile (launch Metro with profiling)
