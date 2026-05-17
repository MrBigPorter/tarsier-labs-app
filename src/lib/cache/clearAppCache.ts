/**
 * clearAppCache — Comprehensive app cache clearing utility
 *
 * Clears all cached data for App Store compliance:
 * - MMKV storage (includes auth tokens — user will need to re-login)
 * - Redux bookmarks cache
 * - FastImage disk/memory cache (react-native-fast-image)
 * - Image prefetch cache
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

/**
 * Clear all app caches with a single call.
 *
 * Order matters:
 * 1. Clear FastImage cache first (async)
 * 2. Clear Redux bookmarks cache
 * 3. Clear MMKV storage (includes auth, settings cache, i18n cache)
 *
 * After calling this, the user will need to sign in again.
 */
export function clearAppCache(): void {
  // ── 1. FastImage cache (async, fire-and-forget) ──────────────
  try {
    FastImage.clearDiskCache();
    FastImage.clearMemoryCache();
  } catch (error) {
    // FastImage cache clearing may fail if not mounted; safe to ignore
    console.warn('[clearAppCache] FastImage cache clear failed:', error);
  }

  // ── 2. Redux bookmarks cache ─────────────────────────────────
  try {
    store.dispatch(clearCache());
  } catch (error) {
    console.warn('[clearAppCache] Redux cache clear failed:', error);
  }

  // ── 3. MMKV storage (auth tokens, settings, i18n, cached data) ──
  try {
    storage.clearAll();
  } catch (error) {
    console.warn('[clearAppCache] MMKV clear failed:', error);
  }
}
