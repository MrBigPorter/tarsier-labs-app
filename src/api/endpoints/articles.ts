import { blogApi, ApiPaginatedResponse, ApiResponseWrapper } from '../baseApi';
import type {
  FrontendArticle,
  FrontendPaginatedResponse,
} from '../../types/frontend-blog';

/**
 * Article query parameters
 */
interface ArticleListParams {
  page?: number;
  pageSize?: number;
  categoryId?: string;
  tagId?: string;
  lang?: string;
}

interface SearchParams {
  q: string;
  page?: number;
  pageSize?: number;
}

/**
 * Transform the API response to unwrap the standard wrapper
 */
function unwrapData<T>(response: ApiResponseWrapper<T>): T {
  return response.data;
}

export const articleApi = blogApi.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * Get paginated article list
     * GET /api/v1/frontend/blog/articles
     */
    getArticles: builder.query<FrontendPaginatedResponse<FrontendArticle>, ArticleListParams | void>({
      query: (params) => ({
        url: '/api/v1/frontend/blog/articles',
        params: params || {},
      }),
      transformResponse: (response: ApiResponseWrapper<FrontendPaginatedResponse<FrontendArticle>>) =>
        unwrapData(response),
      providesTags: (result) =>
        result
          ? [
              ...result.items.map(({ id }) => ({ type: 'Article' as const, id })),
              { type: 'Article', id: 'LIST' },
            ]
          : [{ type: 'Article', id: 'LIST' }],
    }),

    /**
     * Get featured articles (for Home hero section)
     * GET /api/v1/frontend/blog/featured
     */
    getFeaturedArticles: builder.query<FrontendArticle[], string | void>({
      query: (lang) => ({
        url: '/api/v1/frontend/blog/featured',
        params: lang ? { lang } : {},
      }),
      transformResponse: (response: ApiResponseWrapper<FrontendArticle[]>) =>
        unwrapData(response),
      providesTags: [{ type: 'Article', id: 'FEATURED' }],
    }),

    /**
     * Get article detail by slug
     * GET /api/v1/frontend/blog/articles/:slug
     */
    getArticleBySlug: builder.query<FrontendArticle, { slug: string; lang?: string }>({
      query: ({ slug, lang }) => ({
        url: `/api/v1/frontend/blog/articles/${slug}`,
        params: lang ? { lang } : {},
      }),
      transformResponse: (response: ApiResponseWrapper<FrontendArticle>) =>
        unwrapData(response),
      providesTags: (result, _error, { slug }) =>
        result
          ? [{ type: 'Article', id: slug }]
          : [{ type: 'Article', id: slug }],
    }),

    /**
     * Get popular articles
     * GET /api/v1/frontend/blog/articles/popular
     */
    getPopularArticles: builder.query<FrontendArticle[], number | void>({
      query: (limit = 10) => ({
        url: '/api/v1/frontend/blog/articles/popular',
        params: { limit },
      }),
      transformResponse: (response: ApiResponseWrapper<FrontendArticle[]>) =>
        unwrapData(response),
      providesTags: [{ type: 'Article', id: 'POPULAR' }],
    }),

    /**
     * Get related articles
     * GET /api/v1/frontend/blog/articles/:id/related
     */
    getRelatedArticles: builder.query<FrontendArticle[], { articleId: string; limit?: number }>({
      query: ({ articleId, limit = 5 }) => ({
        url: `/api/v1/frontend/blog/articles/${articleId}/related`,
        params: { limit },
      }),
      transformResponse: (response: ApiResponseWrapper<FrontendArticle[]>) =>
        unwrapData(response),
      providesTags: (_result, _error, { articleId }) => [
        { type: 'Article', id: `RELATED_${articleId}` },
      ],
    }),

    /**
     * Search articles
     * GET /api/v1/frontend/blog/search
     */
    searchArticles: builder.query<FrontendPaginatedResponse<FrontendArticle>, SearchParams>({
      query: ({ q, page, pageSize }) => ({
        url: '/api/v1/frontend/blog/search',
        params: { q, page, pageSize },
      }),
      transformResponse: (response: ApiResponseWrapper<FrontendPaginatedResponse<FrontendArticle>>) =>
        unwrapData(response),
      providesTags: (result) =>
        result
          ? [
              ...result.items.map(({ id }) => ({ type: 'Article' as const, id })),
              { type: 'Article', id: 'SEARCH' },
            ]
          : [{ type: 'Article', id: 'SEARCH' }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetArticlesQuery,
  useGetFeaturedArticlesQuery,
  useGetArticleBySlugQuery,
  useGetPopularArticlesQuery,
  useGetRelatedArticlesQuery,
  useSearchArticlesQuery,
  useLazyGetArticlesQuery,
  useLazySearchArticlesQuery,
} = articleApi;
