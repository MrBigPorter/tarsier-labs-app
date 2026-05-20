/**
 * SSE Hook for Real-time Comment Updates
 *
 * Ported from the web version. Uses react-native-sse library since
 * React Native doesn't have native EventSource.
 *
 * Singleton connection registry with refCount pattern:
 * - Multiple components can share one SSE connection for the same article
 * - Connection auto-closes when refCount reaches 0
 *
 * Events handled:
 *   - "moderated": commentStatusManager.updateByRealId()
 *   - "reply": insertReplyIntoCache via store.dispatch
 */

import { useEffect, useRef } from 'react';
import EventSource from 'react-native-sse';
import { env } from '@/lib/env';
import { commentStatusManager } from '@/lib/utils/commentStatus';
import { commentApi } from '@/api/endpoints/comments';
import { store } from '@/store';
import type { Comment } from '@/types/blog';

// ---------------------------------------------------------------------------
// Module-level SSE singleton registry
// ---------------------------------------------------------------------------

interface SSEEntry {
  es: EventSource;
  refCount: number;
  articleId: string;
  onMessageHandlers: Set<(data: SSEEvent) => void>;
}

const sseRegistry = new Map<string, SSEEntry>();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** AI auto-reply event */
interface CommentReplyEvent {
  type?: 'reply';
  articleId: string;
  parentId: string;
  replyId: string;
  content: string;
  author: string;
  createdAt: string;
}

/** Moderation result event (replaces frontend polling) */
interface CommentModeratedEvent {
  type: 'moderated';
  commentId: string;
  articleId: string;
  status: 'approved' | 'rejected';
}

type SSEEvent = CommentReplyEvent | CommentModeratedEvent;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Subscribe to real-time comment updates via SSE
 *
 * @param articleId - Article DB ID for SSE endpoint filtering
 */
export function useCommentSSE(articleId: string | undefined): void {
  const handlerRef = useRef<((data: SSEEvent) => void) | null>(null);

  useEffect(() => {
    if (!articleId) {
      return;
    }

    const handler = (data: SSEEvent) => {
      // Moderation event: notify CommentStatusManager
      if (data.type === 'moderated') {
        commentStatusManager.updateByRealId(data.commentId, data.status);
        return;
      }

      // AI auto-reply event: insert into cache
      const replyData = data as CommentReplyEvent;
      insertReplyIntoCache(articleId, replyData);
    };
    handlerRef.current = handler;

    // -----------------------------------------------------------------------
    // Singleton: reuse existing SSE connection
    // -----------------------------------------------------------------------
    const existing = sseRegistry.get(articleId);
    if (existing) {
      existing.refCount++;
      existing.onMessageHandlers.add(handler);
    } else {
      const baseUrl = env.API_URL.replace(/\/+$/, '');
      const sseUrl = `${baseUrl}/api/v1/frontend/blog/comments/stream?articleId=${articleId}`;

      const es = new EventSource(sseUrl, { lineEndingCharacter: '\n' });
      const handlers = new Set<(data: SSEEvent) => void>();
      handlers.add(handler);

      const entry: SSEEntry = {
        es,
        refCount: 1,
        articleId,
        onMessageHandlers: handlers,
      };
      sseRegistry.set(articleId, entry);

      // Handle incoming SSE messages
      es.addEventListener('message', (event: any) => {
        try {
          const rawData =
            typeof event.data === 'string'
              ? event.data
              : event.data?.data || event.data;
          const parsed = JSON.parse(rawData);
          const data: SSEEvent = parsed.data ?? parsed;

          // Broadcast to all registered handlers
          const reg = sseRegistry.get(articleId);
          reg?.onMessageHandlers.forEach(h => h(data));
        } catch (err) {
          console.warn('[SSE] Failed to parse event data:', err);
        }
      });

      // Handle errors — EventSource auto-reconnects via react-native-sse
      es.addEventListener('error', () => {
        // Auto-reconnect is handled by the library
      });
    }

    // -----------------------------------------------------------------------
    // Cleanup: decrement refCount; close connection when 0
    // -----------------------------------------------------------------------
    return () => {
      const reg = sseRegistry.get(articleId);
      if (!reg) {
        return;
      }

      if (handlerRef.current) {
        reg.onMessageHandlers.delete(handlerRef.current);
        handlerRef.current = null;
      }
      reg.refCount--;

      if (reg.refCount <= 0) {
        reg.es.close();
        sseRegistry.delete(articleId);
      }
    };
  }, [articleId]);
}

// ---------------------------------------------------------------------------
// Cache helper
// ---------------------------------------------------------------------------

/**
 * Insert a new reply directly into the RTK Query cache
 */
function insertReplyIntoCache(
  articleId: string,
  data: CommentReplyEvent,
): void {
  const newReply: Comment = {
    id: data.replyId,
    articleId: data.articleId,
    parentId: data.parentId,
    author: data.author,
    email: null,
    website: null,
    content: data.content,
    approved: true,
    likes: 0,
    createdAt: data.createdAt,
    updatedAt: data.createdAt,
    children: [],
  };

  // Try to insert into the first page cache
  try {
    store.dispatch(
      commentApi.util.updateQueryData(
        'getComments',
        { articleId, page: 1, pageSize: 20 },
        draft => {
          if (!draft?.items) {
            return;
          }

          let replyInserted = false;

          const updatedItems = draft.items.map(comment => {
            // Direct parent match
            if (comment.id === data.parentId) {
              replyInserted = true;
              const alreadyExists = (comment.children || []).some(
                c => c.id === data.replyId,
              );
              if (alreadyExists) {
                return comment;
              }
              return {
                ...comment,
                children: [...(comment.children || []), newReply],
              };
            }

            // Nested: parent is a child of this top-level comment
            if (comment.children?.length) {
              const parentIdx = comment.children.findIndex(
                child => child.id === data.parentId,
              );
              if (parentIdx !== -1) {
                replyInserted = true;
                const alreadyExists = (
                  comment.children[parentIdx].children || []
                ).some(c => c.id === data.replyId);
                if (alreadyExists) {
                  return comment;
                }
                const updatedChildren = comment.children.map((child, idx) =>
                  idx === parentIdx
                    ? {
                        ...child,
                        children: [...(child.children || []), newReply],
                      }
                    : child,
                );
                return { ...comment, children: updatedChildren };
              }
            }

            return comment;
          });

          if (replyInserted) {
            draft.items = updatedItems;
            draft.total = (draft.total || 0) + 1;
          }
        },
      ),
    );
  } catch {
    // Cache not found — comment page hasn't been loaded yet, skip silently
  }
}
