import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { storage } from '../../lib/storage';
import { env } from '../../lib/env';
import type { FrontendPaginatedResponse, BookmarkedArticle } from '../../types/frontend-blog';

const BOOKMARKS_KEY = 'bookmarks_cache';
const BOOKMARK_IDS_KEY = 'bookmark_ids';

interface BookmarksState {
  /** Cached bookmarked articles list */
  articles: BookmarkedArticle[];
  /** Set of article IDs that are bookmarked (for quick lookup) */
  bookmarkedIds: Record<string, boolean>;
  /** Pagination */
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: string | null;
}

const initialState: BookmarksState = {
  articles: [],
  bookmarkedIds: {},
  total: 0,
  page: 1,
  pageSize: 20,
  totalPages: 0,
  isLoading: false,
  error: null,
};

// Restore cached state from MMKV on app start
try {
  const cachedArticles = storage.getString(BOOKMARKS_KEY);
  const cachedIds = storage.getString(BOOKMARK_IDS_KEY);
  if (cachedArticles) {
    const parsed = JSON.parse(cachedArticles) as Omit<BookmarksState, 'isLoading' | 'error'>;
    initialState.articles = parsed.articles || [];
    initialState.total = parsed.total || 0;
    initialState.page = parsed.page || 1;
    initialState.pageSize = parsed.pageSize || 20;
    initialState.totalPages = parsed.totalPages || 0;
  }
  if (cachedIds) {
    initialState.bookmarkedIds = JSON.parse(cachedIds);
  }
} catch {
  // Ignore cache read errors
}

export const fetchBookmarks = createAsyncThunk(
  'bookmarks/fetch',
  async (
    params: { page?: number; pageSize?: number; locale?: string },
    { rejectWithValue },
  ) => {
    try {
      const searchParams = new URLSearchParams();
      if (params.page) searchParams.set('page', String(params.page));
      if (params.pageSize) searchParams.set('pageSize', String(params.pageSize));
      if (params.locale) searchParams.set('lang', params.locale);

      const response = await fetch(
        `${env.API_URL}/api/v1/frontend/blog/bookmarks?${searchParams.toString()}`,
        { headers: { 'Content-Type': 'application/json' } },
      );
      const data = await response.json();
      if (!response.ok) {
        return rejectWithValue(data.message || 'Failed to fetch bookmarks');
      }
      return data.data as FrontendPaginatedResponse<BookmarkedArticle>;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Network error');
    }
  },
);

export const addBookmark = createAsyncThunk(
  'bookmarks/add',
  async (articleId: string, { rejectWithValue }) => {
    try {
      const response = await fetch(
        `${env.API_URL}/api/v1/frontend/blog/articles/${articleId}/bookmark`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' } },
      );
      const data = await response.json();
      if (!response.ok) {
        return rejectWithValue(data.message || 'Failed to add bookmark');
      }
      return { articleId };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Network error');
    }
  },
);

export const removeBookmark = createAsyncThunk(
  'bookmarks/remove',
  async (articleId: string, { rejectWithValue }) => {
    try {
      const response = await fetch(
        `${env.API_URL}/api/v1/frontend/blog/articles/${articleId}/bookmark`,
        { method: 'DELETE', headers: { 'Content-Type': 'application/json' } },
      );
      const data = await response.json();
      if (!response.ok) {
        return rejectWithValue(data.message || 'Failed to remove bookmark');
      }
      return { articleId };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Network error');
    }
  },
);

export const checkBookmarkStatus = createAsyncThunk(
  'bookmarks/checkStatus',
  async (articleId: string, { rejectWithValue }) => {
    try {
      const response = await fetch(
        `${env.API_URL}/api/v1/frontend/blog/articles/${articleId}/bookmark-status`,
        { headers: { 'Content-Type': 'application/json' } },
      );
      const data = await response.json();
      if (!response.ok) {
        return rejectWithValue(data.message || 'Failed to check bookmark status');
      }
      return { articleId, isBookmarked: data.data.isBookmarked };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Network error');
    }
  },
);

const bookmarksSlice = createSlice({
  name: 'bookmarks',
  initialState,
  reducers: {
    /** Optimistically set bookmark status (for instant UI feedback) */
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

    /** Clear all cached bookmarks */
    clearCache(state) {
      state.articles = [];
      state.bookmarkedIds = {};
      state.total = 0;
      state.page = 1;
      state.pageSize = 20;
      state.totalPages = 0;
      storage.delete(BOOKMARKS_KEY);
      storage.delete(BOOKMARK_IDS_KEY);
    },

    /** Sync bookmark IDs from fetched articles */
    syncBookmarkIdsFromArticles(state, action: PayloadAction<string[]>) {
      const ids = action.payload;
      ids.forEach((id) => {
        state.bookmarkedIds[id] = true;
      });
      storage.set(BOOKMARK_IDS_KEY, JSON.stringify(state.bookmarkedIds));
    },
  },
  extraReducers: builder => {
    builder
      // Fetch bookmarks
      .addCase(fetchBookmarks.pending, state => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchBookmarks.fulfilled, (state, action) => {
        state.isLoading = false;
        const { items, total, page, pageSize, totalPages } = action.payload;
        state.articles = items;
        state.total = total;
        state.page = page;
        state.pageSize = pageSize;
        state.totalPages = totalPages;

        // Update bookmarked IDs from fetched articles
        items.forEach((article) => {
          state.bookmarkedIds[article.id] = true;
        });

        // Cache to MMKV
        storage.set(
          BOOKMARKS_KEY,
          JSON.stringify({ articles: state.articles, total, page, pageSize, totalPages }),
        );
        storage.set(BOOKMARK_IDS_KEY, JSON.stringify(state.bookmarkedIds));
      })
      .addCase(fetchBookmarks.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })

      // Add bookmark
      .addCase(addBookmark.fulfilled, (state, action) => {
        const { articleId } = action.payload;
        state.bookmarkedIds[articleId] = true;
        storage.set(BOOKMARK_IDS_KEY, JSON.stringify(state.bookmarkedIds));
      })
      .addCase(addBookmark.rejected, state => {
        state.error = 'Failed to add bookmark';
      })

      // Remove bookmark
      .addCase(removeBookmark.fulfilled, (state, action) => {
        const { articleId } = action.payload;
        state.bookmarkedIds[articleId] = false;
        // Remove from cached articles list
        state.articles = state.articles.filter(a => a.id !== articleId);
        state.total = Math.max(0, state.total - 1);
        storage.set(BOOKMARK_IDS_KEY, JSON.stringify(state.bookmarkedIds));
        storage.set(
          BOOKMARKS_KEY,
          JSON.stringify({
            articles: state.articles,
            total: state.total,
            page: state.page,
            pageSize: state.pageSize,
            totalPages: state.totalPages,
          }),
        );
      })

      // Check bookmark status
      .addCase(checkBookmarkStatus.fulfilled, (state, action) => {
        const { articleId, isBookmarked } = action.payload;
        state.bookmarkedIds[articleId] = isBookmarked;
        storage.set(BOOKMARK_IDS_KEY, JSON.stringify(state.bookmarkedIds));
      });
  },
});

export const {
  toggleBookmarkOptimistic,
  setBookmarkStatus,
  clearCache,
  syncBookmarkIdsFromArticles,
} = bookmarksSlice.actions;

export default bookmarksSlice.reducer;
