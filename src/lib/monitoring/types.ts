/**
 * Shared types and constants for Sentry monitoring layer.
 *
 * All metric names follow the convention:
 *   app.<domain>.<action>[.<result>]
 *
 * All metrics include a `platform` attribute: 'ios' | 'android'.
 */
// ── Attribute helpers ─────────────────────────────────────────────────────

/** Platform attribute attached to every metric */
export type PlatformAttr = 'ios' | 'android';

export function getPlatformAttr(): PlatformAttr {
  // Use a require to avoid circular dependency issues
  const { Platform: RNPlatform } = require('react-native') as {
    Platform: { OS: PlatformAttr };
  };
  return RNPlatform.OS;
}

// ── Metric name constants ─────────────────────────────────────────────────

// API
export const API_LATENCY_MS = 'app.api.latency_ms' as const;
export const API_ERROR = 'app.api.error' as const;
export const API_RETRY = 'app.api.retry' as const;
export const API_RETRY_SUCCESS = 'app.api.retry_success' as const;
export const API_RETRY_EXHAUSTED = 'app.api.retry_exhausted' as const;
export const API_TOKEN_REFRESH = 'app.api.token_refresh' as const;
export const API_TOKEN_REFRESH_SUCCESS =
  'app.api.token_refresh_success' as const;
export const API_TOKEN_REFRESH_FAILURE =
  'app.api.token_refresh_failure' as const;

// Auth
export const AUTH_LOGIN = 'app.auth.login' as const;
export const AUTH_REGISTER = 'app.auth.register' as const;
export const AUTH_LOGOUT = 'app.auth.logout' as const;
export const AUTH_OAUTH = 'app.auth.oauth' as const;
export const AUTH_OAUTH_TIMEOUT = 'app.auth.oauth_timeout' as const;
export const AUTH_SEND_EMAIL_CODE = 'app.auth.send_email_code' as const;

// Image
export const IMAGE_FALLBACK = 'app.image.fallback' as const;
export const IMAGE_LOAD_TIME_MS = 'app.image.load_time_ms' as const;

// Comment
export const COMMENT_SUBMIT = 'app.comment.submit' as const;
export const COMMENT_SUBMIT_SUCCESS = 'app.comment.submit_success' as const;
export const COMMENT_SUBMIT_FAILURE = 'app.comment.submit_failure' as const;
export const COMMENT_SSE_CONNECT = 'app.comment.sse_connect' as const;
export const COMMENT_SSE_DISCONNECT = 'app.comment.sse_disconnect' as const;
export const COMMENT_SSE_ERROR = 'app.comment.sse_error' as const;
export const COMMENT_SSE_REPLY_RECEIVED =
  'app.comment.sse_reply_received' as const;
export const COMMENT_SSE_MODERATED = 'app.comment.sse_moderated' as const;
export const COMMENT_FLAG = 'app.comment.flag' as const;
export const COMMENT_BLOCK = 'app.comment.block' as const;

// Interactions
export const BOOKMARK_ADD = 'app.bookmark.add' as const;
export const BOOKMARK_REMOVE = 'app.bookmark.remove' as const;
export const BOOKMARK_ROLLBACK = 'app.bookmark.rollback' as const;
export const LIKE = 'app.like' as const;
export const SHARE = 'app.share' as const;

// Lifecycle
export const LIFECYCLE_BACKGROUND = 'app.lifecycle.background' as const;
export const LIFECYCLE_FOREGROUND = 'app.lifecycle.foreground' as const;
export const CACHE_HIT = 'app.cache.hit' as const;
export const CACHE_MISS = 'app.cache.miss' as const;

// Network
export const NETWORK_QUALITY_CHANGE = 'app.network.quality_change' as const;
export const NETWORK_OFFLINE = 'app.network.offline' as const;
export const NETWORK_ONLINE = 'app.network.online' as const;

// Performance (Tracing)
export const NAV_TRANSITION_MS = 'app.nav.transition_ms' as const;
