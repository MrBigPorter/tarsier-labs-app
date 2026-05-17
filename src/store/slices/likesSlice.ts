import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { storage } from '@/lib/storage';

const LIKED_IDS_KEY = 'liked_ids';

interface LikesState {
  /** Set of article IDs that are liked (for quick lookup) */
  likedIds: Record<string, boolean>;
}

const initialState: LikesState = {
  likedIds: {},
};

// Restore cached liked IDs from MMKV on app start
try {
  const cachedIds = storage.getString(LIKED_IDS_KEY);
  if (cachedIds) {
    initialState.likedIds = JSON.parse(cachedIds);
  }
} catch {
  // Ignore cache read errors
}

const likesSlice = createSlice({
  name: 'likes',
  initialState,
  reducers: {
    /** Optimistically toggle like status (for instant UI feedback) */
    toggleLikeOptimistic(state, action: PayloadAction<string>) {
      const articleId = action.payload;
      const currentlyLiked = state.likedIds[articleId];
      state.likedIds[articleId] = !currentlyLiked;
      // Persist liked IDs to MMKV
      storage.set(LIKED_IDS_KEY, JSON.stringify(state.likedIds));
    },

    /** Set liked status for a specific article */
    setLikedStatus(
      state,
      action: PayloadAction<{ articleId: string; isLiked: boolean }>,
    ) {
      const { articleId, isLiked } = action.payload;
      state.likedIds[articleId] = isLiked;
      storage.set(LIKED_IDS_KEY, JSON.stringify(state.likedIds));
    },

    /** Clear all cached liked IDs */
    clearLikes(state) {
      state.likedIds = {};
      storage.delete(LIKED_IDS_KEY);
    },
  },
});

export const {
  toggleLikeOptimistic,
  setLikedStatus,
  clearLikes,
} = likesSlice.actions;

export default likesSlice.reducer;
