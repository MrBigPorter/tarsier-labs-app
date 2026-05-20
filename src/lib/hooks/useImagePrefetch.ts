/**
 * useImagePrefetch — Image prefetching hook
 *
 * Wraps React Native's built-in `Image.prefetch()` with:
 * - Batch prefetch (parallel, auto-skip null/undefined)
 * - Dedup via internal Set (avoids re-prefetching same URL)
 * - Loading status tracking
 *
 * Usage:
 * ```tsx
 * const { prefetch, prefetchMany, prefetched, isPrefetching } = useImagePrefetch();
 *
 * // Single image
 * await prefetch('https://img.joyminis.com/photo.jpg');
 *
 * // Batch prefetch (parallel, skips nulls)
 * await prefetchMany([url1, url2, null, url3]);
 * ```
 */

import { useCallback, useRef } from 'react';
import { Image } from 'react-native';

const LOG_PREFIX = '[useImagePrefetch]';

export interface UseImagePrefetchReturn {
  /** Prefetch a single image URL */
  prefetch: (url: string) => Promise<boolean>;
  /** Prefetch multiple URLs in parallel (auto-skips null/undefined) */
  prefetchMany: (urls: Array<string | null | undefined>) => Promise<boolean[]>;
  /** Set of URLs that have already been prefetched */
  prefetched: ReadonlySet<string>;
  /** Whether a prefetch is currently in progress */
  isPrefetching: boolean;
}

/**
 * Hook wrapping RN's Image.prefetch() with dedup and batch support.
 *
 * Uses a ref-based Set for O(1) dedup across renders.
 * The `prefetched` set is exposed as readonly for consumers to check.
 */
export function useImagePrefetch(): UseImagePrefetchReturn {
  // Use ref to avoid re-renders when prefetching
  const prefetchedRef = useRef<Set<string>>(new Set());
  const isPrefetchingRef = useRef(false);

  const prefetch = useCallback(async (url: string): Promise<boolean> => {
    // Skip if already prefetched
    if (prefetchedRef.current.has(url)) {
      return true;
    }

    isPrefetchingRef.current = true;
    try {
      const result = await Image.prefetch(url);
      if (result) {
        prefetchedRef.current.add(url);
      }
      return result;
    } catch (error) {
      console.warn(
        `${LOG_PREFIX} prefetch failed for "${url.slice(0, 60)}"`,
        error,
      );
      return false;
    } finally {
      isPrefetchingRef.current = false;
    }
  }, []);

  const prefetchMany = useCallback(
    async (urls: Array<string | null | undefined>): Promise<boolean[]> => {
      const validUrls = urls.filter(
        (u): u is string => typeof u === 'string' && u.length > 0,
      );
      if (validUrls.length === 0) {
        return [];
      }

      // Only prefetch URLs not already in the set
      const newUrls = validUrls.filter(u => !prefetchedRef.current.has(u));
      if (newUrls.length === 0) {
        return [];
      }

      isPrefetchingRef.current = true;
      try {
        const results = await Promise.allSettled(
          newUrls.map(url => Image.prefetch(url)),
        );

        const outcomes: boolean[] = [];
        results.forEach((result, i) => {
          if (result.status === 'fulfilled' && result.value) {
            prefetchedRef.current.add(newUrls[i]);
            outcomes.push(true);
          } else {
            outcomes.push(false);
          }
        });
        return outcomes;
      } finally {
        isPrefetchingRef.current = false;
      }
    },
    [],
  );

  return {
    prefetch,
    prefetchMany,
    prefetched: prefetchedRef.current,
    isPrefetching: isPrefetchingRef.current,
  };
}
