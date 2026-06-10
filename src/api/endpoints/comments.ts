import {
  blogApi,
  ApiResponseWrapper,
  ApiPaginatedResponse,
} from '@/api/baseApi';
import type { Comment } from '@/types/blog';
import { commentStatusManager } from '@/lib/utils/commentStatus';

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
  content: string;
  parentId?: string;
}

export const commentApi = blogApi.injectEndpoints({
  endpoints: builder => ({
    /**
     * Get comments for an article
     * GET /api/v1/frontend/blog/articles/:articleId/comments
     *
     * Note: The backend returns status field (PENDING/APPROVED/REJECTED)
     * which is transformed to the approved boolean field.
     */
    getComments: builder.query<
      ApiPaginatedResponse<Comment>,
      CommentListParams
    >({
      query: ({ articleId, page, pageSize }) => ({
        url: `/api/v1/frontend/blog/articles/${articleId}/comments`,
        params: { page, pageSize },
      }),
      transformResponse: (
        response: ApiResponseWrapper<ApiPaginatedResponse<any>>,
      ) => {
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
     *
     * UI insertion flow:
     *   1. Screen calls prependComment(result) — directly inserts into local
     *      allItems state (instant, no duplicate risk)
     *   2. updateQueryData patches the RTK Query cache (keeps Redux in sync
     *      for SSE, other components, and future navigations)
     *
     * No optimistic update — only a SINGLE cache patch on success, which
     * eliminates the temp-xxx → realComment race condition entirely.
     */
    createComment: builder.mutation<Comment, CreateCommentParams>({
      query: ({ articleId, content, parentId }) => ({
        url: `/api/v1/frontend/blog/articles/${articleId}/comments`,
        method: 'POST',
        body: {
          author: 'Anonymous',
          email: undefined,
          website: undefined,
          content,
          parentId,
        },
      }),
      transformResponse: (response: ApiResponseWrapper<Comment>) =>
        unwrapData(response),
      async onQueryStarted({ articleId }, { dispatch, queryFulfilled }) {
        try {
          const { data: realComment } = await queryFulfilled;

          // ── Status tracking (for SSE moderate events + polling) ──────
          // NOTE: UI insertion is handled by ArticleDetailScreen via
          // prependComment(). We do NOT patch the RTK Query cache here
          // because that creates a race condition with prependComment,
          // causing duplicate entries in the comment list.
          const tempId = `temp-${Date.now()}`;
          commentStatusManager.registerPendingComment(
            tempId,
            realComment.id,
            articleId,
            { maxPollAttempts: 3, pollInterval: 60000 },
          );

          commentStatusManager.startStatusPolling(tempId, async () => {
            try {
              const result = await dispatch(
                commentApi.endpoints.getCommentStatus.initiate(realComment.id),
              );
              const status = result.data?.status;
              if (status === 'APPROVED') {
                return 'approved';
              }
              if (status === 'REJECTED') {
                return 'rejected';
              }
              return 'pending';
            } catch {
              return 'unknown';
            }
          });
        } catch {
          // Mutation failed — nothing to clean up. The screen doesn't call
          // prependComment since unwrap() throws, so no UI update occurs.
        }
      },
    }),

    /**
     * Get comment status (for polling)
     * GET /api/v1/frontend/blog/comments/:commentId/status
     */
    getCommentStatus: builder.query<
      { id: string; status: string; articleId: string },
      string
    >({
      query: commentId => ({
        url: `/api/v1/frontend/blog/comments/${commentId}/status`,
      }),
      transformResponse: (response: ApiResponseWrapper<any>) =>
        unwrapData(response),
    }),

    /**
     * Get comment replies (for auto-reply detection)
     * GET /api/v1/frontend/blog/comments/:commentId/replies
     */
    getCommentReplies: builder.query<
      {
        commentId: string;
        replies: Array<{
          id: string;
          author: string;
          email: string;
          content: string;
          isAiGenerated: boolean;
          createdAt: string;
        }>;
      },
      string
    >({
      query: commentId => ({
        url: `/api/v1/frontend/blog/comments/${commentId}/replies`,
      }),
      transformResponse: (response: ApiResponseWrapper<any>) =>
        unwrapData(response),
    }),

    /**
     * Flag a comment for review
     * POST /api/v1/frontend/blog/comments/:commentId/flag
     */
    flagComment: builder.mutation<void, { commentId: string }>({
      query: ({ commentId }) => ({
        url: `/api/v1/frontend/blog/comments/${commentId}/flag`,
        method: 'POST',
      }),
    }),

    /**
     * Block a user (via their comment)
     * POST /api/v1/frontend/blog/comments/:commentId/block
     */
    blockUser: builder.mutation<
      { blockedUserId: string },
      { commentId: string }
    >({
      query: ({ commentId }) => ({
        url: `/api/v1/frontend/blog/comments/${commentId}/block`,
        method: 'POST',
      }),
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetCommentsQuery,
  useCreateCommentMutation,
  useLazyGetCommentsQuery,
  useGetCommentStatusQuery,
  useLazyGetCommentStatusQuery,
  useGetCommentRepliesQuery,
  useLazyGetCommentRepliesQuery,
  useFlagCommentMutation,
  useBlockUserMutation,
} = commentApi;
