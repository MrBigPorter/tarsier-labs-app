import { blogApi, ApiResponseWrapper } from '@/api/baseApi';
import type {
  FrontendCategory,
  FrontendCategoryWithArticles,
} from '@/types/frontend-blog';

function unwrapData<T>(response: ApiResponseWrapper<T>): T {
  return response.data;
}

interface CategoryBySlugParams {
  slug: string;
  page?: number;
  pageSize?: number;
  lang?: string;
}

export const categoryApi = blogApi.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * Get all categories
     * GET /api/v1/frontend/blog/categories
     */
    getCategories: builder.query<FrontendCategory[], string | void>({
      query: (lang) => ({
        url: '/api/v1/frontend/blog/categories',
        params: lang ? { lang } : {},
      }),
      transformResponse: (response: ApiResponseWrapper<FrontendCategory[]>) =>
        unwrapData(response),
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'Category' as const, id })),
              { type: 'Category', id: 'LIST' },
            ]
          : [{ type: 'Category', id: 'LIST' }],
    }),

    /**
     * Get category detail with paginated articles
     * GET /api/v1/frontend/blog/categories/:slug
     */
    getCategoryBySlug: builder.query<FrontendCategoryWithArticles, CategoryBySlugParams>({
      query: ({ slug, page, pageSize, lang }) => ({
        url: `/api/v1/frontend/blog/categories/${slug}`,
        params: { page, pageSize, lang },
      }),
      transformResponse: (response: ApiResponseWrapper<FrontendCategoryWithArticles>) =>
        unwrapData(response),
      providesTags: (result, _error, { slug }) =>
        result
          ? [
              { type: 'Category', id: slug },
              { type: 'Article', id: `CATEGORY_${slug}` },
            ]
          : [{ type: 'Category', id: slug }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetCategoriesQuery,
  useGetCategoryBySlugQuery,
  useLazyGetCategoriesQuery,
  useLazyGetCategoryBySlugQuery,
} = categoryApi;
