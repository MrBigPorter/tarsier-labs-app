/**
 * Infinite Scroll Hook for Comments
 *
 * Custom hook wrapping RTK Query's useLazyGetCommentsQuery to provide
 * infinite scroll pagination. RTK Query doesn't have a built-in
 * useInfiniteQuery like React Query, so we accumulate pages manually.
 *
 * Features:
 * - Accumulates comment items across pages
 * - Deduplicates by comment ID (safety net for race conditions)
 * - Exposes loadMore, hasMore, isLoadingMore, reload
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLazyGetCommentsQuery } from '@/api/endpoints/comments';
import type { Comment } from '@/types/blog';

interface UseCommentsInfiniteQueryOptions {
  pageSize?: number;
  enabled?: boolean;
}

interface UseCommentsInfiniteQueryResult {
  items: Comment[];
  total: number;
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  error: boolean;
  loadMore: () => void;
  reload: () => void;
  /** Directly prepend a comment to the top of the list (bypasses RTK Query cache) */
  prependComment: (comment: Comment) => void;
  /** Insert a reply into a parent comment's children array */
  addReply: (parentId: string, reply: Comment) => void;
  /** Remove all comments by a specific author (for block) */
  removeCommentsByAuthor: (author: string) => void;
}

export function useCommentsInfiniteQuery(
  articleId: string | undefined,
  options?: UseCommentsInfiniteQueryOptions,
): UseCommentsInfiniteQueryResult {
  const { pageSize = 20, enabled = true } = options || {};

  const [page, setPage] = useState(1);
  const [allItems, setAllItems] = useState<Comment[]>([]);
  const [total, setTotal] = useState(0);
  const [_totalPages, setTotalPages] = useState<number | undefined>(undefined);
  const [hasMore, setHasMore] = useState(true);
  const isInitialLoadDone = useRef(false);

  const [fetchComments, { data, isLoading, isFetching, isError }] =
    useLazyGetCommentsQuery();

  // Initial fetch when articleId is available
  useEffect(() => {
    if (!enabled || !articleId) {
      return;
    }

    // Reset state when article changes
    setPage(1);
    setAllItems([]);
    setTotal(0);
    setTotalPages(0);
    setHasMore(true);
    isInitialLoadDone.current = false;

    fetchComments({ articleId, page: 1, pageSize }, true);
  }, [articleId, enabled, fetchComments, pageSize]);

  // Process new data when it arrives
  useEffect(() => {
    if (!data) {
      return;
    }

    const {
      items: newItems = [],
      total: newTotal,
      totalPages: newTotalPages,
    } = data;

    setTotal(newTotal);
    setTotalPages(newTotalPages);

    if (newTotalPages !== undefined) {
      setHasMore(page < newTotalPages);
    } else {
      setHasMore(newItems.length >= pageSize);
    }

    if (page === 1) {
      // Page 1: replace all items (handles initial load AND cache updates from mutations)
      setAllItems(newItems);
    } else {
      // Subsequent pages: append with deduplication
      setAllItems(prev => {
        const existingIds = new Set(prev.map(c => c.id));
        const uniqueNewItems = newItems.filter(
          (item: Comment) => !existingIds.has(item.id),
        );
        return [...prev, ...uniqueNewItems];
      });
    }
  }, [data, page, pageSize]);

  const loadMore = useCallback(() => {
    if (!articleId || isFetching || !hasMore) {
      return;
    }

    const nextPage = page + 1;
    setPage(nextPage);
    fetchComments({ articleId, page: nextPage, pageSize }, false);
  }, [articleId, isFetching, hasMore, page, pageSize, fetchComments]);

  const reload = useCallback(() => {
    if (!articleId) {
      return;
    }

    setPage(1);
    setAllItems([]);
    setTotal(0);
    setTotalPages(0);
    setHasMore(true);
    isInitialLoadDone.current = false;

    fetchComments({ articleId, page: 1, pageSize }, true);
  }, [articleId, fetchComments, pageSize]);

  /**
   * Directly prepend a comment to the list state, bypassing the RTK Query
   * cache propagation pipeline. This avoids duplicates caused by the complex
   * updateQueryData → cache → lazy query data → effect chain.
   */
  const prependComment = useCallback((comment: Comment) => {
    setAllItems(prev => {
      // Guard: don't add if already present (e.g., refetch beat us to it)
      if (prev.some(c => c.id === comment.id)) {
        return prev;
      }
      return [comment, ...prev];
    });
    setTotal(prev => prev + 1);
  }, []);

  /**
   * Insert a reply into a parent comment's children array.
   * Recursively searches allItems for the parent by ID, then prepends
   * the reply to that parent's children array.
   */
  const addReply = useCallback((parentId: string, reply: Comment) => {
    setAllItems(prev => {
      function findAndInsert(comments: Comment[]): Comment[] {
        return comments.map(comment => {
          if (comment.id === parentId) {
            const existing = comment.children || [];
            if (existing.some(c => c.id === reply.id)) {
              return comment;
            }
            return { ...comment, children: [reply, ...existing] };
          }
          if (comment.children?.length) {
            return { ...comment, children: findAndInsert(comment.children) };
          }
          return comment;
        });
      }
      return findAndInsert(prev);
    });
    // Replies don't change the total top-level comment count
  }, []);

  /**
   * Recursively remove all comments by a specific author from local state.
   * Used for instant UI feedback when a user blocks another user.
   * Operates on local state only — does not make an API call.
   */
  const removeCommentsByAuthor = useCallback((author: string) => {
    setAllItems(prev => {
      function filterAuthor(comments: Comment[]): Comment[] {
        return comments
          .filter(comment => comment.author !== author)
          .map(comment => ({
            ...comment,
            children: comment.children
              ? filterAuthor(comment.children)
              : undefined,
          }));
      }
      return filterAuthor(prev);
    });
  }, []);

  return {
    items: allItems,
    total,
    hasMore,
    isLoading: isLoading && !isInitialLoadDone.current,
    isLoadingMore: isFetching && isInitialLoadDone.current,
    error: isError,
    loadMore,
    reload,
    prependComment,
    addReply,
    removeCommentsByAuthor,
  };
}
