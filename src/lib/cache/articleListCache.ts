/**
 * Article List Cache — MMKV persistence layer
 *
 * Stores article list data in MMKV for cold-start display and offline access.
 * Uses a TTL-based staleness strategy: cached data is shown immediately on
 * cold start, while a silent background refresh fetches the latest data.
 *
 * Cache key pattern: article_list:${lang}:${categoryId || '__all__'}
 *
 * Phase 1: Basic save/load/clear (cold start display + silent refresh)
 * Phase B: Adds removeArticleFromCache / updateArticleInCache / prependArticleToCache
 *          for SSE-driven cache invalidation
 */
import { storage } from '@/lib/storage';
import { recordCacheHit, recordCacheMiss } from '@/lib/monitoring';
import type {
  FrontendArticle,
  FrontendPaginatedResponse,
} from '@/types/frontend-blog';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CACHE_PREFIX = 'article_list';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const DEFAULT_CATEGORY_KEY = '__all__';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ArticleListCacheEntry {
  items: FrontendArticle[];
  total: number;
  totalPages: number;
  pageSize: number;
  cachedAt: number; // Date.now()
  language: string;
  /** SSE event cursor for catch-up (Phase B) */
  eventCursor?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildCacheKey(lang: string, categoryId: string | null): string {
  return `${CACHE_PREFIX}:${lang}:${categoryId || DEFAULT_CATEGORY_KEY}`;
}

function isExpired(cachedAt: number): boolean {
  return Date.now() - cachedAt > CACHE_TTL_MS;
}

// ---------------------------------------------------------------------------
// Core API
// ---------------------------------------------------------------------------

/**
 * Save paginated article list response to MMKV.
 * Called after every successful API fetch.
 */
export function saveArticleList(
  lang: string,
  categoryId: string | null,
  data: FrontendPaginatedResponse<FrontendArticle>,
  eventCursor?: number,
): void {
  try {
    const key = buildCacheKey(lang, categoryId);
    const entry: ArticleListCacheEntry = {
      items: data.items,
      total: data.total,
      totalPages: data.totalPages,
      pageSize: data.pageSize,
      cachedAt: Date.now(),
      language: lang,
      ...(eventCursor !== undefined ? { eventCursor } : {}),
    };
    storage.set(key, JSON.stringify(entry));
  } catch (error) {
    console.warn('[ArticleCache] Failed to save article list:', error);
  }
}

/**
 * Load cached article list from MMKV.
 * Returns null if cache is missing, expired, or corrupted.
 */
export function loadArticleList(
  lang: string,
  categoryId: string | null,
): ArticleListCacheEntry | null {
  try {
    const key = buildCacheKey(lang, categoryId);
    const raw = storage.getString(key);
    if (!raw) {
      recordCacheMiss('HomeScreen');
      return null;
    }

    const entry: ArticleListCacheEntry = JSON.parse(raw);

    // Validate structure
    if (!Array.isArray(entry.items) || typeof entry.cachedAt !== 'number') {
      recordCacheMiss('HomeScreen');
      return null;
    }

    // Expired — caller should refresh but can still use the data
    if (isExpired(entry.cachedAt)) {
      recordCacheHit('HomeScreen');
      return entry; // Return stale data; caller decides (SWR pattern)
    }

    recordCacheHit('HomeScreen');
    return entry;
  } catch {
    recordCacheMiss('HomeScreen');
    return null;
  }
}

/**
 * Check if a non-expired cache entry exists for the given language/category.
 * Used to decide whether to show skeleton or cached content on cold start.
 */
export function hasValidCache(
  lang: string,
  categoryId: string | null,
): boolean {
  const entry = loadArticleList(lang, categoryId);
  if (!entry) {
    return false;
  }
  return !isExpired(entry.cachedAt);
}

/**
 * Clear all cached article lists for a specific language.
 * Called when the user switches languages.
 */
export function clearLanguageCache(lang: string): void {
  try {
    // Delete all keys matching article_list:${lang}:*
    const allKeys = storage.getAllKeys();
    const prefix = `${CACHE_PREFIX}:${lang}:`;
    for (const key of allKeys) {
      if (key.startsWith(prefix)) {
        storage.delete(key);
      }
    }
  } catch (error) {
    console.warn('[ArticleCache] Failed to clear language cache:', error);
  }
}

/**
 * Clear ALL article list caches across all languages and categories.
 * Called from clearAppCache or when user clears app data.
 */
export function clearAllArticleCache(): void {
  try {
    const allKeys = storage.getAllKeys();
    const prefix = `${CACHE_PREFIX}:`;
    for (const key of allKeys) {
      if (key.startsWith(prefix)) {
        storage.delete(key);
      }
    }
  } catch (error) {
    console.warn('[ArticleCache] Failed to clear all caches:', error);
  }
}

// ---------------------------------------------------------------------------
// Phase B: Fine-grained cache mutation (for SSE events)
// ---------------------------------------------------------------------------

/**
 * Raw save — writes an already-constructed entry directly to MMKV.
 * Used internally by the Phase B mutation functions.
 */
function saveEntryRaw(
  lang: string,
  categoryId: string | null,
  entry: ArticleListCacheEntry,
): void {
  try {
    const key = buildCacheKey(lang, categoryId);
    storage.set(key, JSON.stringify(entry));
  } catch (error) {
    console.warn('[ArticleCache] Failed to save entry:', error);
  }
}

/**
 * Remove an article from all cached lists by ID.
 * Called when an article.deleted SSE event is received (Phase B).
 */
export function removeArticleFromCache(articleId: string): void {
  try {
    const allKeys = storage.getAllKeys();
    const prefix = `${CACHE_PREFIX}:`;

    for (const key of allKeys) {
      if (!key.startsWith(prefix)) {
        continue;
      }

      const raw = storage.getString(key);
      if (!raw) {
        continue;
      }

      const entry: ArticleListCacheEntry = JSON.parse(raw);
      if (!Array.isArray(entry.items)) {
        continue;
      }

      const filtered = entry.items.filter(item => item.id !== articleId);
      if (filtered.length !== entry.items.length) {
        entry.items = filtered;
        entry.total = Math.max(0, entry.total - 1);
        saveEntryRaw(
          key.replace(`${CACHE_PREFIX}:`, '').split(':')[0],
          null,
          entry,
        );
      }
    }
  } catch (error) {
    console.warn('[ArticleCache] Failed to remove article from cache:', error);
  }
}

/**
 * Update an article's fields in all cached lists.
 * Called when an article.updated SSE event is received (Phase B).
 */
export function updateArticleInCache(
  articleId: string,
  changes: Partial<FrontendArticle>,
): void {
  try {
    const allKeys = storage.getAllKeys();
    const prefix = `${CACHE_PREFIX}:`;

    for (const key of allKeys) {
      if (!key.startsWith(prefix)) {
        continue;
      }

      const raw = storage.getString(key);
      if (!raw) {
        continue;
      }

      const entry: ArticleListCacheEntry = JSON.parse(raw);
      if (!Array.isArray(entry.items)) {
        continue;
      }

      let idx = -1;
      for (let i = 0; i < entry.items.length; i++) {
        if (entry.items[i].id === articleId) {
          idx = i;
          break;
        }
      }
      if (idx !== -1) {
        entry.items[idx] = { ...entry.items[idx], ...changes };
        saveEntryRaw(
          key.replace(`${CACHE_PREFIX}:`, '').split(':')[0],
          null,
          entry,
        );
      }
    }
  } catch (error) {
    console.warn('[ArticleCache] Failed to update article in cache:', error);
  }
}

/**
 * Prepend a new article to all relevant cached lists.
 * Called when an article.created SSE event is received (Phase B).
 */
export function prependArticleToCache(article: FrontendArticle): void {
  try {
    const allKeys = storage.getAllKeys();
    const prefix = `${CACHE_PREFIX}:`;

    for (const key of allKeys) {
      if (!key.startsWith(prefix)) {
        continue;
      }

      const raw = storage.getString(key);
      if (!raw) {
        continue;
      }

      const entry: ArticleListCacheEntry = JSON.parse(raw);
      if (!Array.isArray(entry.items)) {
        continue;
      }

      // Skip if already in cache
      const exists = entry.items.some(item => item.id === article.id);
      if (!exists) {
        entry.items.unshift(article);
        entry.total += 1;
        saveEntryRaw(
          key.replace(`${CACHE_PREFIX}:`, '').split(':')[0],
          null,
          entry,
        );
      }
    }
  } catch (error) {
    console.warn('[ArticleCache] Failed to prepend article to cache:', error);
  }
}
