/**
 * Comment Monitoring — Sentry instrumentation for comment system.
 *
 * Tracks comment submission, SSE connection health, and moderation actions.
 *
 * Usage:
 *   import { recordCommentSubmit, recordCommentSubmitSuccess, recordSSEConnect, recordCommentFlag } from '@/lib/monitoring/commentMonitoring';
 *
 *   recordCommentSubmit();
 *   recordCommentSubmitSuccess();
 *   recordSSEConnect(articleId);
 *   recordCommentFlag(commentId);
 */
import * as Sentry from '@sentry/react-native';
import {
  getPlatformAttr,
  COMMENT_SUBMIT,
  COMMENT_SUBMIT_SUCCESS,
  COMMENT_SUBMIT_FAILURE,
  COMMENT_SSE_CONNECT,
  COMMENT_SSE_DISCONNECT,
  COMMENT_SSE_ERROR,
  COMMENT_SSE_REPLY_RECEIVED,
  COMMENT_SSE_MODERATED,
  COMMENT_FLAG,
  COMMENT_BLOCK,
} from './types';

/**
 * Record a comment submission attempt.
 */
export function recordCommentSubmit(): void {
  Sentry.metrics.count(COMMENT_SUBMIT, 1, {
    attributes: { platform: getPlatformAttr() },
  });
}

/**
 * Record a successful comment submission.
 */
export function recordCommentSubmitSuccess(): void {
  Sentry.metrics.count(COMMENT_SUBMIT_SUCCESS, 1, {
    attributes: { platform: getPlatformAttr() },
  });
}

/**
 * Record a failed comment submission.
 */
export function recordCommentSubmitFailure(): void {
  Sentry.metrics.count(COMMENT_SUBMIT_FAILURE, 1, {
    attributes: { platform: getPlatformAttr() },
  });
}

/**
 * Record that an SSE connection was established for real-time comments.
 *
 * @param articleId — The article the SSE stream is subscribing to
 */
export function recordSSEConnect(articleId: string): void {
  Sentry.metrics.count(COMMENT_SSE_CONNECT, 1, {
    attributes: {
      articleId,
      platform: getPlatformAttr(),
    },
  });
}

/**
 * Record that an SSE connection was closed.
 *
 * @param articleId — The article the SSE stream was for
 */
export function recordSSEDisconnect(articleId: string): void {
  Sentry.metrics.count(COMMENT_SSE_DISCONNECT, 1, {
    attributes: {
      articleId,
      platform: getPlatformAttr(),
    },
  });
}

/**
 * Record an SSE error (parse failure, connection drop).
 *
 * @param articleId — The article the SSE stream was for
 */
export function recordSSEError(articleId: string): void {
  Sentry.metrics.count(COMMENT_SSE_ERROR, 1, {
    attributes: {
      articleId,
      platform: getPlatformAttr(),
    },
  });
}

/**
 * Record that an AI auto-reply event was received via SSE.
 *
 * @param articleId — The article receiving the auto-reply
 */
export function recordSSEReplyReceived(articleId: string): void {
  Sentry.metrics.count(COMMENT_SSE_REPLY_RECEIVED, 1, {
    attributes: {
      articleId,
      platform: getPlatformAttr(),
    },
  });
}

/**
 * Record that a comment moderation event was received via SSE.
 *
 * @param articleId — The article the moderated comment belongs to
 */
export function recordSSEModerated(articleId: string): void {
  Sentry.metrics.count(COMMENT_SSE_MODERATED, 1, {
    attributes: {
      articleId,
      platform: getPlatformAttr(),
    },
  });
}

/**
 * Record that a comment was flagged for review.
 */
export function recordCommentFlag(): void {
  Sentry.metrics.count(COMMENT_FLAG, 1, {
    attributes: { platform: getPlatformAttr() },
  });
}

/**
 * Record that a user was blocked via their comment.
 */
export function recordCommentBlock(): void {
  Sentry.metrics.count(COMMENT_BLOCK, 1, {
    attributes: { platform: getPlatformAttr() },
  });
}
