import { blogApi, ApiResponseWrapper, ApiPaginatedResponse } from '../baseApi';
import type { BookmarkedArticle, BookmarkResponse, BookmarkStatusResponse } from '../../types/frontend-blog';

function unwrapData<T>(response: ApiResponseWrapper<T>): T {
  return response.data;
}

interface FetchBookmarksParams {
  page?: number;
  pageSize?: number;
  locale?: string;
}

interface BookmarkActionParams {
  articleId: string;
}

export const bookmarkApi = blogApi.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * Get paginated list of bookmarked articles
     * GET /api/v1/frontend/blog/bookmarks
     */
    getBookmarks: builder.query<ApiPaginatedResponse<BookmarkedArticle>, FetchBookmarksParams>({
      query: ({ page, pageSize, locale }) => ({
        url: '/api/v1/frontend/blog/bookmarks',
        params: { page, pageSize, lang: locale },
      }),
      transformResponse: (response: ApiResponseWrapper<ApiPaginatedResponse<BookmarkedArticle>>) =>
        unwrapData(response),
      providesTags: ['Bookmark'],
    }),

    /**
     * Add a bookmark for an article
     * POST /api/v1/frontend/blog/articles/:articleId/bookmark
     */
    addBookmark: builder.mutation<BookmarkResponse, BookmarkActionParams>({
      query: ({ articleId }) => ({
        url: `/api/v1/frontend/blog/articles/${articleId}/bookmark`,
        method: 'POST',
      }),
      transformResponse: (response: ApiResponseWrapper<BookmarkResponse>) =>
        unwrapData(response),
      invalidatesTags: ['Bookmark'],
    }),

    /**
     * Remove a bookmark from an article
     * DELETE /api/v1/frontend/blog/articles/:articleId/bookmark
     */
    removeBookmark: builder.mutation<void, BookmarkActionParams>({
      query: ({ articleId }) => ({
        url: `/api/v1/frontend/blog/articles/${articleId}/bookmark`,
        method: 'DELETE',
      }),
      transformResponse: (response: ApiResponseWrapper<any>) =>
        unwrapData(response),
      invalidatesTags: ['Bookmark'],
    }),

    /**
     * Check if an article is bookmarked
     * GET /api/v1/frontend/blog/articles/:articleId/bookmark-status
     */
    getBookmarkStatus: builder.query<BookmarkStatusResponse, BookmarkActionParams>({
      query: ({ articleId }) => ({
        url: `/api/v1/frontend/blog/articles/${articleId}/bookmark-status`,
      }),
      transformResponse: (response: ApiResponseWrapper<BookmarkStatusResponse>) =>
        unwrapData(response),
      providesTags: (_result, _error, { articleId }) => [
        { type: 'Bookmark', id: `ARTICLE_${articleId}` },
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetBookmarksQuery,
  useAddBookmarkMutation,
  useRemoveBookmarkMutation,
  useGetBookmarkStatusQuery,
  useLazyGetBookmarksQuery,
} = bookmarkApi;
