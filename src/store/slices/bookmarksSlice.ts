/**
 * bookmarksSlice — Optimistic bookmark state management
 *
 * This slice ONLY handles local optimistic UI state (bookmarkedIds).
 * All actual API calls (fetch, add, remove, check status) are handled
 * by RTK Query endpoints in @/api/endpoints/bookmarks.
 *
 * The RTK Query endpoints go through baseApi.ts's baseQuery which
 * automatically injects the Authorization header and handles 401 token
 * refresh. Using raw fetch() thunks would miss the auth header.
 *
 * State:
 * - bookmarkedIds: Map of articleId → boolean for instant bookmark icon toggle
 * - Persisted to MMKV for offline access and app restart persistence
 */
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { storage } from '@/lib/storage';

const BOOKMARK_IDS_KEY = 'bookmark_ids';

interface BookmarksState {
  /** Set of article IDs that are bookmarked (for quick lookup) */
  bookmarkedIds: Record<string, boolean>;
}

const initialState: BookmarksState = {
  bookmarkedIds: {},
};

// Restore cached bookmark IDs from MMKV on app start
try {
  const cachedIds = storage.getString(BOOKMARK_IDS_KEY);
  if (cachedIds) {
    initialState.bookmarkedIds = JSON.parse(cachedIds);
  }
} catch {
  // Ignore cache read errors
}

const bookmarksSlice = createSlice({
  name: 'bookmarks',
  initialState,
  reducers: {
    /** Optimistically toggle bookmark status (for instant UI feedback) */
    toggleBookmarkOptimistic(state, action: PayloadAction<string>) {
      const articleId = action.payload;
      const currentlyBookmarked = state.bookmarkedIds[articleId];
      state.bookmarkedIds[articleId] = !currentlyBookmarked;
      // Persist bookmark IDs
      storage.set(BOOKMARK_IDS_KEY, JSON.stringify(state.bookmarkedIds));
    },

    /** Set bookmark status for a specific article */
    setBookmarkStatus(
      state,
      action: PayloadAction<{ articleId: string; isBookmarked: boolean }>,
    ) {
      const { articleId, isBookmarked } = action.payload;
      state.bookmarkedIds[articleId] = isBookmarked;
      storage.set(BOOKMARK_IDS_KEY, JSON.stringify(state.bookmarkedIds));
    },

    /** Clear all cached bookmark IDs */
    clearCache(state) {
      state.bookmarkedIds = {};
      storage.delete(BOOKMARK_IDS_KEY);
    },

    /** Sync bookmark IDs from fetched articles */
    syncBookmarkIdsFromArticles(state, action: PayloadAction<string[]>) {
      const ids = action.payload;
      ids.forEach(id => {
        state.bookmarkedIds[id] = true;
      });
      storage.set(BOOKMARK_IDS_KEY, JSON.stringify(state.bookmarkedIds));
    },
  },
});

export const {
  toggleBookmarkOptimistic,
  setBookmarkStatus,
  clearCache,
  syncBookmarkIdsFromArticles,
} = bookmarksSlice.actions;

export default bookmarksSlice.reducer;
