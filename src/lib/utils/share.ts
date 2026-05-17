/**
 * Share utility — shares article content with optional cover image
 *
 * Uses react-native-share to provide a native share sheet with image attachment.
 * Falls back to text+URL only if image download fails or no cover image available.
 */
import RNShare from 'react-native-share';
import RNFS from 'react-native-fs';
import { Platform } from 'react-native';
import { env } from '@/lib/env';
import type { FrontendArticle } from '@/types/frontend-blog';
import { getArticleImageUrl, isVideoUrl } from '@/lib/utils/image';

/**
 * Get the best cover image URL for an article (non-video only).
 */
function getShareImageUrl(article: FrontendArticle): string | null {
  if (article.coverImage && isVideoUrl(article.coverImage)) return null;
  return getArticleImageUrl({
    images: article.meta?.images,
    coverImage: article.coverImage,
    size: 'medium',
  }) || article.coverImage || null;
}

/**
 * Download a remote image to a temporary local file path.
 * Returns the local file URI, or null on failure.
 */
async function downloadImageToTemp(imageUrl: string): Promise<string | null> {
  try {
    const ext = imageUrl.split('.').pop()?.split('?')[0] || 'jpg';
    const fileName = `share_${Date.now()}.${ext}`;
    const destPath = `${RNFS.CachesDirectoryPath}/${fileName}`;

    const result = await RNFS.downloadFile({
      fromUrl: imageUrl,
      toFile: destPath,
    }).promise;

    if (result.statusCode === 200) {
      // On iOS, we need file:// prefix for local files
      return Platform.OS === 'ios' ? destPath : `file://${destPath}`;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Share an article with cover image (if available) via the native share sheet.
 *
 * Behavior:
 * 1. Downloads the cover image to a temp file (if cover image exists)
 * 2. Opens native share sheet with: image + URL + title
 * 3. Falls back to text + URL only if image download fails
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
  const imageUrl = getShareImageUrl(article);

  // If there's a cover image, try to share with image
  if (imageUrl) {
    const localImagePath = await downloadImageToTemp(imageUrl);

    if (localImagePath) {
      try {
        await RNShare.open({
          title: article.title,
          message: `${article.title}\n\n${article.excerpt || ''}\n\n${shareUrl}`,
          url: localImagePath,
          type: 'image/jpeg',
          subject: article.title,
          showAppsToView: true,
        });
        return; // Success — don't fall through to text-only
      } catch {
        // User cancelled or share failed — fall through to text-only fallback
      }
    }
  }

  // Fallback: share text + URL only (no image)
  try {
    await RNShare.open({
      title: article.title,
      message: `${article.title}\n\n${article.excerpt || ''}\n\n${shareUrl}`,
      url: shareUrl,
      subject: article.title,
      showAppsToView: true,
    });
  } catch {
    // User cancelled share
  }
}
