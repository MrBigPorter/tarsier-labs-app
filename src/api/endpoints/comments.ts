import { blogApi, ApiResponseWrapper, ApiPaginatedResponse } from '../baseApi';
import type { Comment } from '../../types/blog';

function unwrapData<T>(response: ApiResponseWrapper<T>): T {
  return response.data;
}

interface CommentListParams {
  articleId: string;
  page?: number;
  pageSize?: number;
}

interface CreateCommentParams {
  articleId: string;
  author: string;
  email?: string;
  content: string;
  parentId?: string;
}

export const commentApi = blogApi.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * Get comments for an article
     * GET /api/v1/frontend/blog/articles/:articleId/comments
     *
     * Note: The backend returns status field (PENDING/APPROVED/REJECTED)
     * which is transformed to the approved boolean field.
     */
    getComments: builder.query<ApiPaginatedResponse<Comment>, CommentListParams>({
      query: ({ articleId, page, pageSize }) => ({
        url: `/api/v1/frontend/blog/articles/${articleId}/comments`,
        params: { page, pageSize },
      }),
      transformResponse: (response: ApiResponseWrapper<ApiPaginatedResponse<any>>) => {
        const data = unwrapData(response);
        // Transform status → approved for frontend compatibility
        if (data.items) {
          data.items = data.items.map((item: any) => ({
            ...item,
            approved: item.status === 'APPROVED',
            email: item.email || null,
            website: item.website || null,
            likes: item.likes || 0,
            children: item.children || [],
          }));
        }
        return data;
      },
      providesTags: (_result, _error, { articleId }) => [
        { type: 'Comment', id: `ARTICLE_${articleId}` },
      ],
    }),

    /**
     * Submit a comment
     * POST /api/v1/frontend/blog/articles/:articleId/comments
     */
    createComment: builder.mutation<Comment, CreateCommentParams>({
      query: ({ articleId, author, email, content, parentId }) => ({
        url: `/api/v1/frontend/blog/articles/${articleId}/comments`,
        method: 'POST',
        body: { author, email, content, parentId },
      }),
      transformResponse: (response: ApiResponseWrapper<Comment>) =>
        unwrapData(response),
      invalidatesTags: (_result, _error, { articleId }) => [
        { type: 'Comment', id: `ARTICLE_${articleId}` },
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetCommentsQuery,
  useCreateCommentMutation,
  useLazyGetCommentsQuery,
} = commentApi;
