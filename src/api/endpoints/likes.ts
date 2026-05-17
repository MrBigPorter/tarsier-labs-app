import { blogApi, ApiResponseWrapper } from '@/api/baseApi';

function unwrapData<T>(response: ApiResponseWrapper<T>): T {
  return response.data;
}

interface LikeActionParams {
  /** Article slug (URL-friendly string, NOT database UUID) */
  slug: string;
}

interface LikeCountResponse {
  likeCount: number;
}

interface LikeStatusResponse {
  liked: boolean;
}

export const likeApi = blogApi.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * Like an article
     * POST /api/v1/frontend/blog/articles/:slug/like
     *
     * Backend uses LikeDeduplicationGuard (IP+UA fingerprint, 24h Redis TTL).
     * Returns updated likeCount.
     */
    likeArticle: builder.mutation<LikeCountResponse, LikeActionParams>({
      query: ({ slug }) => ({
        url: `/api/v1/frontend/blog/articles/${slug}/like`,
        method: 'POST',
      }),
      transformResponse: (response: ApiResponseWrapper<LikeCountResponse>) =>
        unwrapData(response),
      invalidatesTags: ['Like'],
    }),

    /**
     * Unlike an article
     * POST /api/v1/frontend/blog/articles/:slug/unlike
     *
     * Backend generates fingerprint server-side from IP+UA+slug.
     * Deletes Redis fingerprint key so user can re-like.
     * Safeguarded to not decrement below 0.
     */
    unlikeArticle: builder.mutation<LikeCountResponse, LikeActionParams>({
      query: ({ slug }) => ({
        url: `/api/v1/frontend/blog/articles/${slug}/unlike`,
        method: 'POST',
      }),
      transformResponse: (response: ApiResponseWrapper<LikeCountResponse>) =>
        unwrapData(response),
      invalidatesTags: ['Like'],
    }),

    /**
     * Check if current device has liked the article
     * GET /api/v1/frontend/blog/articles/:slug/like-status
     *
     * Backend checks Redis for IP+UA+slug fingerprint key.
     * No auth required — fingerprint-based.
     */
    checkLikeStatus: builder.query<LikeStatusResponse, LikeActionParams>({
      query: ({ slug }) => ({
        url: `/api/v1/frontend/blog/articles/${slug}/like-status`,
        method: 'GET',
      }),
      transformResponse: (response: ApiResponseWrapper<LikeStatusResponse>) =>
        unwrapData(response),
      providesTags: ['Like'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useLikeArticleMutation,
  useUnlikeArticleMutation,
  useCheckLikeStatusQuery,
  useLazyCheckLikeStatusQuery,
} = likeApi;
