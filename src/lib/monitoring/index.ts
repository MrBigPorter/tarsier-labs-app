/**
 * Monitoring Service Layer — barrel export
 *
 * This is the only public entry point for consuming monitoring functions.
 * Components, screens, and hooks import from here and never import Sentry
 * directly.
 *
 * Usage:
 *   import { recordApiLatency, recordLogin, recordImageFallback, ... } from '@/lib/monitoring';
 *
 * All functions are no-ops when Sentry is disabled (__DEV__ mode without
 * SENTRY_DSN), because Sentry SDK internally checks its enabled state
 * before sending.
 *
 * ── Sentry Primitive Quick Reference ─────────────────────────────────────────
 *
 * 1. Metrics — Sentry.metrics.count / Sentry.metrics.distribution
 *    → 场景：高频事件，只关心聚合统计，不关心单个实例
 *    → 比如：API 延迟分布、缓存命中率、登录成功/失败计数
 *    → 优点：100% 采样零开销，适合 Dashboard 和告警
 *    → 不适合：需要看耗时瀑布图或单个请求上下文
 *
 * 2. Tracing Spans — Sentry.startInactiveSpan / span.end()
 *    → 场景：测量耗时，需要瀑布图父子关系
 *    → 比如：API 调用耗时、Screen 渲染时间、冷启动时间
 *    → 优点：能看到"哪个 API 慢 + 是哪个页面发起的"
 *    → 限制：受 tracesSampleRate 控制，样本量较少
 *
 * 3. Breadcrumbs — Sentry.addBreadcrumb({ category, message, level })
 *    → 场景：记录事件序列，帮助调试"事故发生前发生了什么"
 *    → 比如：background/foreground、logout、网络切换
 *    → 优点：免费附属数据，不产生独立 Issue
 *    → 注意：必须关联到 error 才有价值，单独看不到
 *
 * 4. captureException — Sentry.captureException(error, { tags, extra })
 *    → 场景：非预期严重错误，需要创建 Issue 触发告警
 *    → 比如：token refresh 失败 → 用户被强制登出
 *    → 注意：很克制地用，预期内的错误（如 500）用 metrics 而非此
 *
 * 5. captureMessage — Sentry.captureMessage(msg, level)
 *    → 场景：业务日志，既不贵也无上下文
 *    → 本项目未使用：用 breadcrumb 替代（免费），或用 metrics（更结构化）
 *    → 如需使用，建议加 __DEV__ 守卫避免生产环境污染 Issues
 *
 * ── 选择口诀 ────────────────────────────────────────────────────────────────
 *    "Metrics 算数量，Spans 量时间，Breadcrumbs 记过程，captureException 报 bug"
 */

// Types (re-export for convenience)
export type {
  ImageFailureContext,
  ImageLoadAttrs,
  ImageLoadTracker,
} from './imageMonitoring';
export type { AuthMethod, OAuthProvider } from './authMonitoring';
export type { ApiCallAttrs } from './apiMonitoring';

// ── API Monitoring ────────────────────────────────────────────────────────
export {
  recordApiLatency,
  recordApiError,
  recordApiRetry,
  recordApiRetrySuccess,
  recordApiRetryExhausted,
  recordTokenRefresh,
  recordTokenRefreshSuccess,
  recordTokenRefreshFailure,
} from './apiMonitoring';

// ── Auth Monitoring ───────────────────────────────────────────────────────
export {
  recordLogin,
  recordRegister,
  recordOAuth,
  recordOAuthTimeout,
  recordLogout,
  recordSendEmailCode,
} from './authMonitoring';

// ── Image Monitoring ──────────────────────────────────────────────────────
export {
  startImageLoad,
  recordImageFallback,
  recordImageTotalFailure,
  getTimeSinceAppStartMs,
} from './imageMonitoring';

// ── Comment Monitoring ────────────────────────────────────────────────────
export {
  recordCommentSubmit,
  recordCommentSubmitSuccess,
  recordCommentSubmitFailure,
  recordSSEConnect,
  recordSSEDisconnect,
  recordSSEError,
  recordSSEReplyReceived,
  recordSSEModerated,
  recordCommentFlag,
  recordCommentBlock,
} from './commentMonitoring';

// ── Interaction Monitoring ─────────────────────────────────────────────────
export {
  recordBookmarkAdd,
  recordBookmarkRemove,
  recordBookmarkRollback,
  recordLike,
  recordShare,
} from './interactionMonitoring';

// ── Lifecycle Monitoring ──────────────────────────────────────────────────
export {
  startColdStartSpan,
  endColdStartSpan,
  recordAppBackground,
  recordAppForeground,
  recordCacheHit,
  recordCacheMiss,
} from './lifecycleMonitoring';

// ── Network Monitoring ────────────────────────────────────────────────────
export {
  recordNetworkQualityChange,
  recordOffline,
  recordOnline,
} from './networkMonitoring';

// ── Performance Monitoring (Tracing) ───────────────────────────────────────
export { startApiSpan, useScreenRenderSpan } from './performanceMonitoring';
