/**
 * Comment Status Management
 *
 * Singleton that tracks temporary comment → real comment ID mapping,
 * manages status listeners, and falls back to polling when SSE disconnects.
 *
 * Ported from the web version's CommentStatusManager.
 */

export type CommentStatus = 'pending' | 'approved' | 'rejected' | 'unknown';

export interface PendingCommentInfo {
  /** Temporary comment ID (temp-xxx) */
  tempId: string;
  /** Real comment ID (returned by server) */
  realId: string;
  /** Article ID */
  articleId: string;
  /** Submission time */
  submittedAt: Date;
  /** Current status */
  status: CommentStatus;
  /** Poll attempt counter */
  pollAttempts: number;
  /** Maximum poll attempts before giving up */
  maxPollAttempts: number;
  /** Poll interval in milliseconds */
  pollInterval: number;
  /** Poll timer ID */
  pollTimer?: ReturnType<typeof setInterval>;
}

/**
 * Comment status manager — singleton
 *
 * Tracks pending comments and notifies UI components when status changes.
 * SSE is the primary update mechanism; polling is the fallback.
 */
class CommentStatusManager {
  private static instance: CommentStatusManager;
  private pendingComments: Map<string, PendingCommentInfo> = new Map();
  private statusListeners: Map<
    string,
    Array<(status: CommentStatus) => void>
  > = new Map();

  private constructor() {
    // Private constructor ensures singleton
  }

  static getInstance(): CommentStatusManager {
    if (!CommentStatusManager.instance) {
      CommentStatusManager.instance = new CommentStatusManager();
    }
    return CommentStatusManager.instance;
  }

  /**
   * Register a pending (temporary) comment
   */
  registerPendingComment(
    tempId: string,
    realId: string,
    articleId: string,
    options?: {
      maxPollAttempts?: number;
      pollInterval?: number;
    },
  ): void {
    const pendingComment: PendingCommentInfo = {
      tempId,
      realId,
      articleId,
      submittedAt: new Date(),
      status: 'pending',
      pollAttempts: 0,
      maxPollAttempts: options?.maxPollAttempts ?? 3,
      pollInterval: options?.pollInterval ?? 60000,
    };

    this.pendingComments.set(tempId, pendingComment);
  }

  /**
   * Update comment status by temp ID
   */
  updateCommentStatus(tempId: string, status: CommentStatus): void {
    const comment = this.pendingComments.get(tempId);
    if (!comment) {
      return;
    }

    comment.status = status;

    // If status is final, clear polling timer
    if (status === 'approved' || status === 'rejected') {
      this.clearPollingTimer(tempId);

      // Auto-cleanup after 24 hours
      setTimeout(
        () => {
          this.removePendingComment(tempId);
        },
        24 * 60 * 60 * 1000,
      );
    }

    // Notify listeners
    this.notifyStatusChange(tempId, status);
  }

  /**
   * Get comment status by temp ID
   */
  getCommentStatus(tempId: string): CommentStatus | null {
    const comment = this.pendingComments.get(tempId);
    return comment?.status ?? null;
  }

  /**
   * Update status by real comment ID (used by SSE events)
   * Looks up the temp ID that maps to this real ID
   */
  updateByRealId(realId: string, status: 'approved' | 'rejected'): void {
    for (const [tempId, info] of this.pendingComments.entries()) {
      if (info.realId === realId) {
        this.updateCommentStatus(tempId, status);
        return;
      }
    }
  }

  /**
   * Get pending comment info by temp ID
   */
  getCommentInfo(tempId: string): PendingCommentInfo | null {
    return this.pendingComments.get(tempId) ?? null;
  }

  /**
   * Remove a pending comment
   */
  removePendingComment(tempId: string): void {
    this.clearPollingTimer(tempId);
    this.pendingComments.delete(tempId);
    this.statusListeners.delete(tempId);
  }

  /**
   * Clear the polling timer for a given temp ID
   */
  private clearPollingTimer(tempId: string): void {
    const comment = this.pendingComments.get(tempId);
    if (comment?.pollTimer) {
      clearInterval(comment.pollTimer);
      comment.pollTimer = undefined;
    }
  }

  /**
   * Start status polling as a fallback when SSE is not available
   */
  startStatusPolling(
    tempId: string,
    checkStatusCallback: () => Promise<CommentStatus>,
  ): void {
    const comment = this.pendingComments.get(tempId);
    if (!comment) {
      return;
    }

    // Clear existing timer
    this.clearPollingTimer(tempId);

    comment.pollTimer = setInterval(async () => {
      comment.pollAttempts++;

      try {
        const status = await checkStatusCallback();

        if (status === 'approved' || status === 'rejected') {
          this.updateCommentStatus(tempId, status);
        } else if (comment.pollAttempts >= comment.maxPollAttempts) {
          this.clearPollingTimer(tempId);
          this.updateCommentStatus(tempId, 'unknown');
        }
      } catch {
        if (comment.pollAttempts >= comment.maxPollAttempts) {
          this.clearPollingTimer(tempId);
          this.updateCommentStatus(tempId, 'unknown');
        }
      }
    }, comment.pollInterval);
  }

  /**
   * Subscribe to status changes for a given temp ID
   * Returns an unsubscribe function
   */
  subscribe(
    tempId: string,
    callback: (status: CommentStatus) => void,
  ): () => void {
    if (!this.statusListeners.has(tempId)) {
      this.statusListeners.set(tempId, []);
    }

    const listeners = this.statusListeners.get(tempId)!;
    listeners.push(callback);

    // Return unsubscribe function
    return () => {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }

  /**
   * Notify all listeners of a status change
   */
  private notifyStatusChange(tempId: string, status: CommentStatus): void {
    const listeners = this.statusListeners.get(tempId);
    if (listeners) {
      listeners.forEach((callback) => {
        try {
          callback(status);
        } catch {
          // Silently handle listener errors
        }
      });
    }
  }

  /**
   * Get all pending comments
   */
  getAllPendingComments(): PendingCommentInfo[] {
    return Array.from(this.pendingComments.values());
  }

  /**
   * Clean up expired comments (older than 24 hours)
   */
  cleanupExpiredComments(): void {
    const now = new Date();
    const expiredTime = 24 * 60 * 60 * 1000;

    for (const [tempId, comment] of this.pendingComments.entries()) {
      const age = now.getTime() - comment.submittedAt.getTime();
      if (age > expiredTime) {
        this.removePendingComment(tempId);
      }
    }
  }

  /**
   * Reset the manager (mainly for testing)
   */
  reset(): void {
    for (const [tempId] of this.pendingComments.entries()) {
      this.clearPollingTimer(tempId);
    }
    this.pendingComments.clear();
    this.statusListeners.clear();
  }
}

// Export singleton instance
export const commentStatusManager = CommentStatusManager.getInstance();
