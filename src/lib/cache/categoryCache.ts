/**
 * Category Cache — MMKV persistence layer
 *
 * Stores category list data in MMKV for cold-start display and tab-switch scenarios.
 * Uses a TTL-based staleness strategy: cached data is shown immediately on
 * mount, while a silent background refresh fetches the latest data (SWR pattern).
 *
 * Cache key pattern: categories:${lang}
 *
 * Analogous to articleListCache.ts but simpler — categories are a flat array,
 * no pagination or SSE-driven mutation needed.
 */
import { storage } from '@/lib/storage';
import { recordCacheHit, recordCacheMiss } from '@/lib/monitoring';
import type { FrontendCategory } from '@/types/frontend-blog';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CACHE_PREFIX = 'categories';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CategoryCacheEntry {
  categories: FrontendCategory[];
  cachedAt: number;
  language: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildCacheKey(lang: string): string {
  return `${CACHE_PREFIX}:${lang}`;
}

function isExpired(cachedAt: number): boolean {
  return Date.now() - cachedAt > CACHE_TTL_MS;
}

// ---------------------------------------------------------------------------
// Core API
// ---------------------------------------------------------------------------

/**
 * Save category list to MMKV cache.
 * Called after every successful API fetch of categories.
 */
export function saveCategoryCache(
  lang: string,
  categories: FrontendCategory[],
): void {
  try {
    const key = buildCacheKey(lang);
    const entry: CategoryCacheEntry = {
      categories,
      cachedAt: Date.now(),
      language: lang,
    };
    storage.set(key, JSON.stringify(entry));
  } catch (error) {
    console.warn('[CategoryCache] Failed to save categories:', error);
  }
}

/**
 * Load cached category list from MMKV.
 * Returns null if cache is missing, expired, or corrupted.
 */
export function loadCategoryCache(lang: string): CategoryCacheEntry | null {
  try {
    const key = buildCacheKey(lang);
    const raw = storage.getString(key);
    if (!raw) {
      recordCacheMiss('CategoryListScreen');
      return null;
    }

    const entry: CategoryCacheEntry = JSON.parse(raw);

    // Validate structure
    if (
      !Array.isArray(entry.categories) ||
      typeof entry.cachedAt !== 'number'
    ) {
      recordCacheMiss('CategoryListScreen');
      return null;
    }

    // Expired — caller should refresh but can still use the data (SWR)
    if (isExpired(entry.cachedAt)) {
      recordCacheHit('CategoryListScreen');
      return entry;
    }

    recordCacheHit('CategoryListScreen');
    return entry;
  } catch {
    recordCacheMiss('CategoryListScreen');
    return null;
  }
}

/**
 * Clear category cache for a specific language.
 * Called when the user switches languages.
 */
export function clearCategoryCache(lang: string): void {
  try {
    const key = buildCacheKey(lang);
    storage.delete(key);
  } catch (error) {
    console.warn('[CategoryCache] Failed to clear cache:', error);
  }
}

/**
 * Clear ALL category caches across all languages.
 */
export function clearAllCategoryCache(): void {
  try {
    const allKeys = storage.getAllKeys();
    const prefix = `${CACHE_PREFIX}:`;
    for (const key of allKeys) {
      if (key.startsWith(prefix)) {
        storage.delete(key);
      }
    }
  } catch (error) {
    console.warn('[CategoryCache] Failed to clear all caches:', error);
  }
}
