/**
 * Auto-Reply Status Management
 *
 * Singleton that tracks AI auto-reply status for comments.
 * Polls the getCommentReplies API to check if an AI reply has been generated.
 *
 * Ported from the web version's AutoReplyStatusManager.
 */

export type AutoReplyStatus = 'pending' | 'received' | 'timeout' | 'error';

export interface AutoReplyInfo {
  /** Comment ID */
  commentId: string;
  /** Article ID */
  articleId: string;
  /** Submission time */
  submittedAt: Date;
  /** Current status */
  status: AutoReplyStatus;
  /** Poll attempt counter */
  pollAttempts: number;
  /** Maximum poll attempts */
  maxPollAttempts: number;
  /** Poll interval in milliseconds */
  pollInterval: number;
  /** Poll timer ID */
  pollTimer?: ReturnType<typeof setInterval>;
  /** Auto-reply content (filled when received) */
  replyContent?: string;
  /** Auto-reply author */
  replyAuthor?: string;
}

/**
 * Auto-reply status manager — singleton
 *
 * Tracks whether an AI auto-reply has been generated for a comment.
 * Uses polling as the backend may not send SSE events for auto-replies.
 */
class AutoReplyStatusManager {
  private static instance: AutoReplyStatusManager;
  private autoReplyTrackers: Map<string, AutoReplyInfo> = new Map();
  private statusListeners: Map<
    string,
    Array<(status: AutoReplyStatus, reply?: { content: string; author: string }) => void>
  > = new Map();

  private constructor() {
    // Private constructor ensures singleton
  }

  static getInstance(): AutoReplyStatusManager {
    if (!AutoReplyStatusManager.instance) {
      AutoReplyStatusManager.instance = new AutoReplyStatusManager();
    }
    return AutoReplyStatusManager.instance;
  }

  /**
   * Register an auto-reply tracker for a comment
   */
  registerAutoReplyTracker(
    commentId: string,
    articleId: string,
    options?: {
      maxPollAttempts?: number;
      pollInterval?: number;
    },
  ): void {
    const tracker: AutoReplyInfo = {
      commentId,
      articleId,
      submittedAt: new Date(),
      status: 'pending',
      pollAttempts: 0,
      maxPollAttempts: options?.maxPollAttempts ?? 10,
      pollInterval: options?.pollInterval ?? 30000,
    };

    this.autoReplyTrackers.set(commentId, tracker);
  }

  /**
   * Update auto-reply status
   */
  updateAutoReplyStatus(
    commentId: string,
    status: AutoReplyStatus,
    reply?: { content: string; author: string },
  ): void {
    const tracker = this.autoReplyTrackers.get(commentId);
    if (!tracker) {
      return;
    }

    tracker.status = status;

    if (reply) {
      tracker.replyContent = reply.content;
      tracker.replyAuthor = reply.author;
    }

    // If status is final, clear polling timer
    if (status === 'received' || status === 'timeout' || status === 'error') {
      this.clearPollingTimer(commentId);

      // Auto-cleanup after 1 hour
      setTimeout(
        () => {
          this.removeAutoReplyTracker(commentId);
        },
        60 * 60 * 1000,
      );
    }

    // Notify listeners
    this.notifyStatusChange(commentId, status, reply);
  }

  /**
   * Get auto-reply status for a comment
   */
  getAutoReplyStatus(commentId: string): AutoReplyStatus | null {
    const tracker = this.autoReplyTrackers.get(commentId);
    return tracker?.status ?? null;
  }

  /**
   * Remove auto-reply tracker
   */
  removeAutoReplyTracker(commentId: string): void {
    this.clearPollingTimer(commentId);
    this.autoReplyTrackers.delete(commentId);
    this.statusListeners.delete(commentId);
  }

  /**
   * Clear polling timer for a comment
   */
  private clearPollingTimer(commentId: string): void {
    const tracker = this.autoReplyTrackers.get(commentId);
    if (tracker?.pollTimer) {
      clearInterval(tracker.pollTimer);
      tracker.pollTimer = undefined;
    }
  }

  /**
   * Start auto-reply polling
   * Checks the getCommentReplies API for auto-replies
   */
  startAutoReplyPolling(
    commentId: string,
    checkRepliesCallback: () => Promise<{
      hasReply: boolean;
      reply?: { content: string; author: string };
    }>,
  ): void {
    const tracker = this.autoReplyTrackers.get(commentId);
    if (!tracker) {
      return;
    }

    // Clear existing timer
    this.clearPollingTimer(commentId);

    tracker.pollTimer = setInterval(async () => {
      tracker.pollAttempts++;

      try {
        const { hasReply, reply } = await checkRepliesCallback();

        if (hasReply && reply) {
          this.updateAutoReplyStatus(commentId, 'received', reply);
        } else if (tracker.pollAttempts >= tracker.maxPollAttempts) {
          this.clearPollingTimer(commentId);
          this.updateAutoReplyStatus(commentId, 'timeout');
        }
      } catch {
        if (tracker.pollAttempts >= tracker.maxPollAttempts) {
          this.clearPollingTimer(commentId);
          this.updateAutoReplyStatus(commentId, 'error');
        }
      }
    }, tracker.pollInterval);
  }

  /**
   * Subscribe to auto-reply status changes
   * Returns an unsubscribe function
   */
  subscribe(
    commentId: string,
    callback: (
      status: AutoReplyStatus,
      reply?: { content: string; author: string },
    ) => void,
  ): () => void {
    if (!this.statusListeners.has(commentId)) {
      this.statusListeners.set(commentId, []);
    }

    const listeners = this.statusListeners.get(commentId)!;
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
  private notifyStatusChange(
    commentId: string,
    status: AutoReplyStatus,
    reply?: { content: string; author: string },
  ): void {
    const listeners = this.statusListeners.get(commentId);
    if (listeners) {
      listeners.forEach((callback) => {
        try {
          callback(status, reply);
        } catch {
          // Silently handle listener errors
        }
      });
    }
  }

  /**
   * Get all active trackers
   */
  getAllTrackers(): AutoReplyInfo[] {
    return Array.from(this.autoReplyTrackers.values());
  }

  /**
   * Clean up expired trackers (older than 1 hour)
   */
  cleanupExpiredTrackers(): void {
    const now = new Date();
    const expiredTime = 60 * 60 * 1000;

    for (const [commentId, tracker] of this.autoReplyTrackers.entries()) {
      const age = now.getTime() - tracker.submittedAt.getTime();
      if (age > expiredTime) {
        this.removeAutoReplyTracker(commentId);
      }
    }
  }

  /**
   * Reset the manager (mainly for testing)
   */
  reset(): void {
    for (const [commentId] of this.autoReplyTrackers.entries()) {
      this.clearPollingTimer(commentId);
    }
    this.autoReplyTrackers.clear();
    this.statusListeners.clear();
  }
}

// Export singleton instance
export const autoReplyStatusManager = AutoReplyStatusManager.getInstance();
