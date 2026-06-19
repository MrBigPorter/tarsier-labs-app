/**
 * useImagePrefetch — Image prefetching hook
 *
 * Uses FastImage.preload() for native disk-level caching via
 * SDWebImage (iOS) / Glide (Android) with LRU auto-eviction.
 *
 * Note: FastImage.preload() is fire-and-forget (returns void).
 * Unlike RN's Image.prefetch() which returns Promise<boolean>,
 * we treat any non-throwing call as success.
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
import FastImage from 'react-native-fast-image';

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
 * Hook wrapping FastImage.preload() with dedup and batch support.
 *
 * FastImage.preload() is fire-and-forget — it returns void and caches
 * images on the native side (SDWebImage/Glide LRU cache). This differs
 * from RN's Image.prefetch() which returns Promise<boolean>.
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
      // FastImage.preload() is fire-and-forget — caches to native disk
      // No boolean return to check, so we optimistically mark as prefetched.
      FastImage.preload([{ uri: url }]);
      prefetchedRef.current.add(url);
      return true;
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
        // FastImage.preload() handles parallel preloading natively
        FastImage.preload(newUrls.map(url => ({ uri: url })));
        newUrls.forEach(url => prefetchedRef.current.add(url));
        return newUrls.map(() => true);
      } catch (error) {
        console.warn(`${LOG_PREFIX} batch prefetch failed`, error);
        return newUrls.map(() => false);
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
