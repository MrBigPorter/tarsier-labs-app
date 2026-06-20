/**
 * Tag Cache — MMKV persistence layer
 *
 * Stores tag list data in MMKV for cold-start display and tab-switch scenarios.
 * Uses a TTL-based staleness strategy: cached data is shown immediately on
 * mount, while a silent background refresh fetches the latest data (SWR pattern).
 *
 * Cache key pattern: tags:${lang}
 *
 * Analogous to articleListCache.ts but simpler — tags are a flat array,
 * no pagination or SSE-driven mutation needed.
 */
import { storage } from '@/lib/storage';
import { recordCacheHit, recordCacheMiss } from '@/lib/monitoring';
import type { FrontendTag } from '@/types/frontend-blog';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CACHE_PREFIX = 'tags';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TagCacheEntry {
  tags: FrontendTag[];
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
 * Save tag list to MMKV cache.
 * Called after every successful API fetch of tags.
 */
export function saveTagsCache(lang: string, tags: FrontendTag[]): void {
  try {
    const key = buildCacheKey(lang);
    const entry: TagCacheEntry = {
      tags,
      cachedAt: Date.now(),
      language: lang,
    };
    storage.set(key, JSON.stringify(entry));
  } catch (error) {
    console.warn('[TagCache] Failed to save tags:', error);
  }
}

/**
 * Load cached tag list from MMKV.
 * Returns null if cache is missing, expired, or corrupted.
 */
export function loadTagsCache(lang: string): TagCacheEntry | null {
  try {
    const key = buildCacheKey(lang);
    const raw = storage.getString(key);
    if (!raw) {
      recordCacheMiss('TagListScreen');
      return null;
    }

    const entry: TagCacheEntry = JSON.parse(raw);

    // Validate structure
    if (!Array.isArray(entry.tags) || typeof entry.cachedAt !== 'number') {
      recordCacheMiss('TagListScreen');
      return null;
    }

    // Expired — caller should refresh but can still use the data (SWR)
    if (isExpired(entry.cachedAt)) {
      recordCacheHit('TagListScreen');
      return entry;
    }

    recordCacheHit('TagListScreen');
    return entry;
  } catch {
    recordCacheMiss('TagListScreen');
    return null;
  }
}

/**
 * Clear tag cache for a specific language.
 * Called when the user switches languages.
 */
export function clearTagCache(lang: string): void {
  try {
    const key = buildCacheKey(lang);
    storage.delete(key);
  } catch (error) {
    console.warn('[TagCache] Failed to clear cache:', error);
  }
}

/**
 * Clear ALL tag caches across all languages.
 */
export function clearAllTagCache(): void {
  try {
    const allKeys = storage.getAllKeys();
    const prefix = `${CACHE_PREFIX}:`;
    for (const key of allKeys) {
      if (key.startsWith(prefix)) {
        storage.delete(key);
      }
    }
  } catch (error) {
    console.warn('[TagCache] Failed to clear all caches:', error);
  }
}
