import { blogApi, ApiResponseWrapper } from '@/api/baseApi';
import type {
  FrontendTag,
  FrontendTagWithArticles,
} from '@/types/frontend-blog';

function unwrapData<T>(response: ApiResponseWrapper<T>): T {
  return response.data;
}

interface TagBySlugParams {
  slug: string;
  page?: number;
  pageSize?: number;
  lang?: string;
}

export const tagApi = blogApi.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * Get all tags
     * GET /api/v1/frontend/blog/tags
     */
    getTags: builder.query<FrontendTag[], string | void>({
      query: (lang) => ({
        url: '/api/v1/frontend/blog/tags',
        params: lang ? { lang } : {},
      }),
      transformResponse: (response: ApiResponseWrapper<FrontendTag[]>) =>
        unwrapData(response),
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'Tag' as const, id })),
              { type: 'Tag', id: 'LIST' },
            ]
          : [{ type: 'Tag', id: 'LIST' }],
    }),

    /**
     * Get tag detail with paginated articles
     * GET /api/v1/frontend/blog/tags/:slug
     */
    getTagBySlug: builder.query<FrontendTagWithArticles, TagBySlugParams>({
      query: ({ slug, page, pageSize, lang }) => ({
        url: `/api/v1/frontend/blog/tags/${slug}`,
        params: { page, pageSize, lang },
      }),
      transformResponse: (response: ApiResponseWrapper<FrontendTagWithArticles>) =>
        unwrapData(response),
      providesTags: (result, _error, { slug }) =>
        result
          ? [
              { type: 'Tag', id: slug },
              { type: 'Article', id: `TAG_${slug}` },
            ]
          : [{ type: 'Tag', id: slug }],
    }),

    /**
     * Get popular tags
     * GET /api/v1/frontend/blog/tags/popular
     */
    getPopularTags: builder.query<
      FrontendTag[],
      { limit?: number; lang?: string } | void
    >({
      query: (params) => {
        const { limit = 20, lang } = params || {};
        return {
          url: '/api/v1/frontend/blog/tags/popular',
          params: { limit, ...(lang ? { lang } : {}) },
        };
      },
      transformResponse: (response: ApiResponseWrapper<FrontendTag[]>) =>
        unwrapData(response),
      providesTags: [{ type: 'Tag', id: 'POPULAR' }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetTagsQuery,
  useGetTagBySlugQuery,
  useGetPopularTagsQuery,
  useLazyGetTagsQuery,
  useLazyGetTagBySlugQuery,
} = tagApi;
