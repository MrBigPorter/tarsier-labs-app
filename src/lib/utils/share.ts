/**
 * Share utility — shares article URL via native share sheet.
 *
 * Uses react-native-share to provide a native share sheet.
 * Only the article URL is shared — social platforms (WhatsApp, Telegram, etc.)
 * will scrape OG tags from the blog's HTML page to show rich link previews.
 */
import RNShare from 'react-native-share';
import { env } from '@/lib/env';
import type { FrontendArticle } from '@/types/frontend-blog';

/**
 * Share an article via the native share sheet.
 *
 * Shares only the article URL. Social platforms will scrape OG tags from
 * the blog's web page to display a rich preview with image and title.
 *
 * @param article - The article to share
 * @param locale - Optional locale code (e.g. 'zh', 'en'). Falls back to DEFAULT_LOCALE.
 */
export async function shareArticle(
  article: FrontendArticle,
  locale?: string,
): Promise<void> {
  const lang = locale || env.DEFAULT_LOCALE;
  const shareUrl = `${env.WEB_URL}/${lang}/articles/${article.slug}`;
  const message = `${article.title}\n\n${article.excerpt || ''}\n\n${shareUrl}`;

  await RNShare.open({
    url: shareUrl,
    title: article.title,
    message,
    subject: article.title,
    showAppsToView: true,
  });
}
