/**
 * Interaction Monitoring — Sentry instrumentation for user interactions.
 *
 * Tracks bookmark, like, and share actions including optimistic update
 * rollbacks (when the API fails after the UI has already updated).
 *
 * Usage:
 *   import { recordBookmarkAdd, recordBookmarkRollback, recordLike, recordShare } from '@/lib/monitoring/interactionMonitoring';
 *
 *   recordBookmarkAdd(true);
 *   recordBookmarkRollback();
 *   recordLike('like', true);
 */
import * as Sentry from '@sentry/react-native';
import {
  getPlatformAttr,
  BOOKMARK_ADD,
  BOOKMARK_REMOVE,
  BOOKMARK_ROLLBACK,
  LIKE,
  SHARE,
} from './types';

/**
 * Record a bookmark being added.
 *
 * @param success — Whether the API call succeeded
 */
export function recordBookmarkAdd(success: boolean): void {
  Sentry.metrics.count(BOOKMARK_ADD, 1, {
    attributes: {
      success: String(success),
      platform: getPlatformAttr(),
    },
  });
}

/**
 * Record a bookmark being removed.
 *
 * @param success — Whether the API call succeeded
 */
export function recordBookmarkRemove(success: boolean): void {
  Sentry.metrics.count(BOOKMARK_REMOVE, 1, {
    attributes: {
      success: String(success),
      platform: getPlatformAttr(),
    },
  });
}

/**
 * Record an optimistic update rollback — the UI was updated to show the
 * bookmark action, but the API call failed, so the UI had to revert.
 *
 * This is a critical UX signal. High rollback rates indicate API issues.
 */
export function recordBookmarkRollback(): void {
  Sentry.metrics.count(BOOKMARK_ROLLBACK, 1, {
    attributes: { platform: getPlatformAttr() },
  });
}

/**
 * Record a like or unlike action.
 *
 * @param action — 'like' or 'unlike'
 * @param success — Whether the API call succeeded
 */
export function recordLike(action: 'like' | 'unlike', success: boolean): void {
  Sentry.metrics.count(LIKE, 1, {
    attributes: {
      action,
      success: String(success),
      platform: getPlatformAttr(),
    },
  });
}

/**
 * Record a share attempt.
 *
 * @param success — Whether the native share sheet opened successfully
 */
export function recordShare(success: boolean): void {
  Sentry.metrics.count(SHARE, 1, {
    attributes: {
      success: String(success),
      platform: getPlatformAttr(),
    },
  });
}
