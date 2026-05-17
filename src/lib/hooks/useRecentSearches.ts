/**
 * useRecentSearches — MMKV-backed recent search history
 *
 * Extracted from SearchScreen.tsx to be reusable across the app.
 * Manages a list of up to MAX_RECENT recent search queries,
 * persisted to MMKV storage.
 */

import { useState, useCallback } from 'react';
import { storage } from '@/lib/storage';

const RECENT_SEARCHES_KEY = 'recent_searches';
const MAX_RECENT = 10;

/**
 * Load persisted recent searches from MMKV on first call.
 */
function loadRecentSearches(): string[] {
  try {
    const stored = storage.getString(RECENT_SEARCHES_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch {
    // Ignore parse errors — return empty array
  }
  return [];
}

/**
 * Persist recent searches to MMKV.
 */
function persistRecentSearches(searches: string[]): void {
  storage.set(RECENT_SEARCHES_KEY, JSON.stringify(searches));
}

export interface UseRecentSearchesReturn {
  /** Current list of recent search queries (newest first) */
  recentSearches: string[];
  /** Save a new search query (deduplicates, caps at MAX_RECENT) */
  saveRecentSearch: (query: string) => void;
  /** Clear all recent searches */
  clearRecentSearches: () => void;
  /** Remove a specific search query from history */
  removeRecentSearch: (query: string) => void;
}

/**
 * Hook for managing recent search history persisted to MMKV.
 *
 * @example
 * const { recentSearches, saveRecentSearch, clearRecentSearches } = useRecentSearches();
 */
export function useRecentSearches(): UseRecentSearchesReturn {
  const [recentSearches, setRecentSearches] = useState<string[]>(loadRecentSearches);

  const saveRecentSearch = useCallback((query: string) => {
    if (!query.trim()) return;

    setRecentSearches(prev => {
      const updated = [query, ...prev.filter(s => s !== query)].slice(0, MAX_RECENT);
      persistRecentSearches(updated);
      return updated;
    });
  }, []);

  const clearRecentSearches = useCallback(() => {
    setRecentSearches([]);
    storage.delete(RECENT_SEARCHES_KEY);
  }, []);

  const removeRecentSearch = useCallback((query: string) => {
    setRecentSearches(prev => {
      const updated = prev.filter(s => s !== query);
      persistRecentSearches(updated);
      return updated;
    });
  }, []);

  return {
    recentSearches,
    saveRecentSearch,
    clearRecentSearches,
    removeRecentSearch,
  };
}
