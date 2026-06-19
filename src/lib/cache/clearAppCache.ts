/**
 * clearAppCache — Comprehensive app cache clearing utility
 *
 * Clears all cached data for App Store compliance:
 * - MMKV storage (includes auth tokens — user will need to re-login)
 * - Redux bookmarks cache
 * - FastImage disk/memory cache (react-native-fast-image)
 * - Image prefetch cache
 *
 * Optionally clears server-side user data (comments, likes, bookmarks).
 *
 * App Store Requirement: Users must be able to clear all cached data.
 * This is enforced by Apple's guideline 5.1.1 (Data Collection and Storage).
 * By clearing auth tokens too, the app fully resets the user's data footprint
 * on the device, satisfying audit requirements.
 */
import FastImage from 'react-native-fast-image';
import { storage } from '@/lib/storage';
import { store } from '@/store';
import { clearCache } from '@/store/slices/bookmarksSlice';
import { logout } from '@/store/slices/authSlice';
import { authApi } from '@/api/endpoints/auth';
import { clearAllArticleCache } from '@/lib/cache/articleListCache';

/** Response shape from the server-side clear data endpoint */
export interface ClearDataResult {
  /** Number of comments anonymised as "[deleted]" on the server */
  anonymizedComments: number;
  /** Number of bookmarks deleted from the server */
  deletedBookmarks: number;
  /** True if server was called and succeeded */
  serverCleared: boolean;
  /** Error message if server call failed, null otherwise */
  serverError: string | null;
}

/**
 * Clear all app caches with a single call.
 *
 * Order matters:
 * 1. (Optional) Call server API to clear user activity data
 * 2. Clear FastImage cache (async)
 * 3. Clear Redux bookmarks cache
 * 4. Clear MMKV storage (includes auth, settings cache, i18n cache)
 *
 * After calling this, the user will need to sign in again.
 *
 * @param options.clearServerData - If true, also calls the backend API to
 *   delete the user's comments, likes, and bookmarks from the server.
 * @returns Object summarizing what was cleared.
 */
export async function clearAppCache(options?: {
  clearServerData?: boolean;
}): Promise<ClearDataResult> {
  const result: ClearDataResult = {
    anonymizedComments: 0,
    deletedBookmarks: 0,
    serverCleared: false,
    serverError: null,
  };

  // ── 1. Server-side data clearing (optional) ────────────────────
  if (options?.clearServerData) {
    try {
      const serverResult = await store
        .dispatch(authApi.endpoints.clearUserData.initiate())
        .unwrap();

      result.anonymizedComments = serverResult.anonymizedComments ?? 0;
      result.deletedBookmarks = serverResult.deletedBookmarks ?? 0;
      result.serverCleared = true;
    } catch (error) {
      // Server call failed — don't block client-side cache clearing
      const message =
        error instanceof Error ? error.message : 'Unknown server error';
      console.warn('[clearAppCache] Server data clear failed:', message);
      result.serverError = message;
    }
  }

  // ── 2. FastImage cache (async, fire-and-forget) ──────────────
  try {
    FastImage.clearDiskCache();
    FastImage.clearMemoryCache();
  } catch (error) {
    // FastImage cache clearing may fail if not mounted; safe to ignore
    console.warn('[clearAppCache] FastImage cache clear failed:', error);
  }

  // ── 3. Redux bookmarks cache ─────────────────────────────────
  try {
    store.dispatch(clearCache());
  } catch (error) {
    console.warn('[clearAppCache] Redux cache clear failed:', error);
  }

  // ── 3.5 Article list cache (MMKV) ──────────────────────────────
  try {
    clearAllArticleCache();
  } catch (error) {
    console.warn('[clearAppCache] Article list cache clear failed:', error);
  }

  // ── 4. MMKV storage (auth tokens, settings, i18n, cached data) ──
  try {
    storage.clearAll();
  } catch (error) {
    console.warn('[clearAppCache] MMKV clear failed:', error);
  }

  // ── 5. Sync Redux auth state (MMKV was cleared, so user is logged out) ──
  store.dispatch(logout());

  return result;
}
