/**
 * useArticlePrefetch — Prefetch article detail + first page of comments
 *
 * Called on `onPressIn` in ArticleCard so that by the time the user
 * completes the tap and the navigation transition finishes (~250-350ms),
 * the network requests are already in-flight (or even resolved).
 *
 * Uses RTK Query's `util.prefetch` thunk:
 *   - ifOlderThan: 60 → reuses cached data if it's less than 60 seconds old
 *   - Comments are delayed 150ms so the article request gets priority
 *
 * IMPORTANT: accepts a FrontendArticle object (not just a slug string) so the
 * RTK Query cache keys match exactly what ArticleDetailScreen queries with,
 * i.e. `{ slug: 'article-slug', lang: 'en' }`.  Passing the whole article
 * object as the slug parameter would produce a wrong key and always miss.
 *
 * Usage:
 *   const prefetchArticle = useArticlePrefetch();
 *   <ArticleCard onPrefetch={prefetchArticle} />
 */

import { useCallback } from 'react';
import { useAppDispatch } from '@/store';
import { useAppLanguage } from '@/lib/i18n';
import { articleApi } from '@/api/endpoints/articles';
import { commentApi } from '@/api/endpoints/comments';
import type { FrontendArticle } from '@/types/frontend-blog';

export function useArticlePrefetch() {
  const dispatch = useAppDispatch();
  const lang = useAppLanguage();

  return useCallback(
    (article: FrontendArticle) => {
      const slug = article.slug;

      // 1. Article body — highest priority, fire immediately
      dispatch(
        articleApi.util.prefetch(
          'getArticleBySlug',
          { slug, lang },
          { ifOlderThan: 60 },
        ),
      );

      // 2. First page of comments — slight delay so article wins the race
      //    for available bandwidth / server resources
      setTimeout(() => {
        dispatch(
          commentApi.util.prefetch(
            'getComments',
            { articleId: slug, page: 1, pageSize: 20 },
            { ifOlderThan: 30 },
          ),
        );
      }, 150);
    },
    [dispatch, lang],
  );
}
