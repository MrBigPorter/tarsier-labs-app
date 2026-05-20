/**
 * Image and media utility functions
 *
 * Ported from web's `cloudflareImageLoader.ts` and `media.ts`.
 *
 * Key capabilities:
 * - `getOptimizedImageUrl()` — Transforms image URLs through Cloudflare Image Resizing
 *   (`/cdn-cgi/image/width=...,quality=...,f=auto,fit=scale-down/`).
 *   Works in React Native because `<Image source={{ uri: x }}>` sends HTTP requests
 *   that Cloudflare edge nodes process before returning optimized images.
 * - `getArticleImageUrl()` — Selects best available image URL from article meta (multi-size)
 * - `isVideoUrl()` — Detects video URLs by file extension
 */

// ─── Constants ────────────────────────────────────────────────────────────

/** Default quality for Cloudflare image optimization */
const DEFAULT_QUALITY = 75;

/** Default width for Cloudflare image optimization (480px = good for mobile cards at ~90vw on 375-430px screens) */
const DEFAULT_WIDTH = 480;

/** Video file extensions to skip for Cloudflare Image Resizing */
const VIDEO_EXTENSIONS = /\.(mp4|webm|ogg|mov|avi|mkv|m3u8|ts)(\?|#|$)/i;

/** Non-optimizable URL prefixes */
const SKIP_PREFIXES = ['data:', 'blob:', 'file://'];

// ─── Types ────────────────────────────────────────────────────────────────

export interface OptimizeOptions {
  /** Source image URL */
  src: string;
  /** Desired width in pixels (default: 640) */
  width?: number;
  /** Image quality 1-100 (default: 75) */
  quality?: number;
}

export interface ArticleImageOptions {
  /** Multi-size images from article meta */
  images?: {
    original: string;
    large: { webp: string; jpg: string };
    medium: { webp: string; jpg: string };
    thumbnail: { webp: string; jpg: string };
  } | null;
  /** Fallback cover image URL */
  coverImage?: string | null;
  /** Image size tier based on network quality */
  size?: 'thumbnail' | 'medium' | 'large' | 'original';
}

// ─── Core Functions ───────────────────────────────────────────────────────

/**
 * Transform an image URL through Cloudflare Image Resizing.
 *
 * How it works:
 * 1. Checks URL is on our CDN domain (`img.joyminis.com`)
 * 2. Builds `/cdn-cgi/image/width=...,quality=...,f=auto,fit=scale-down/` URL
 * 3. Cloudflare edge nodes handle format conversion (AVIF > WebP > JPEG)
 *    and resizing — no native modules needed
 *
 * Skips:
 * - Non-http(s) URLs (data URIs, blobs)
 * - SVG files
 * - Video file extensions (Cloudflare Image Resizing only supports images)
 * - Non-CDN URLs
 * - Already-optimized URLs (double-processing guard)
 *
 * @param src    - Original image URL (must be on img.joyminis.com)
 * @param width  - Desired width in pixels (default: 640)
 * @param quality - Image quality 1-100 (default: 75)
 * @returns Transformed CDN URL, or original `src` if not applicable
 *
 * @example
 * ```ts
 * getOptimizedImageUrl({ src: 'https://img.joyminis.com/photo.jpg', width: 480 })
 * // => 'https://img.joyminis.com/cdn-cgi/image/width=480,quality=75,f=auto,fit=scale-down/photo.jpg'
 * ```
 */
export function getOptimizedImageUrl({
  src,
  width = DEFAULT_WIDTH,
  quality = DEFAULT_QUALITY,
}: OptimizeOptions): string {
  // Skip non-http(s) URLs
  if (SKIP_PREFIXES.some(prefix => src.startsWith(prefix))) {
    return src;
  }

  // Skip SVG files
  if (src.endsWith('.svg')) {
    return src;
  }

  // Skip video file extensions — Cloudflare Image Resizing only supports images.
  // Video URLs would return 415 Unsupported Media Type.
  if (VIDEO_EXTENSIONS.test(src)) {
    return src;
  }

  try {
    const url = new URL(src);

    // Only apply Cloudflare transforms to our own CDN domain
    if (url.hostname !== 'img.joyminis.com') {
      return src;
    }

    // Avoid double-processing if already a /cdn-cgi/image/ URL
    if (url.pathname.startsWith('/cdn-cgi/image/')) {
      return src;
    }

    // Assemble Cloudflare Image Resizing parameters
    // - width: requested width in pixels
    // - quality: 75 (default, accepted by CDN)
    // - f=auto: automatic format selection (AVIF > WebP > JPEG)
    // - fit=scale-down: scale down only (preserve aspect ratio, no cropping)
    const cfParams = `width=${width},quality=${quality},f=auto,fit=scale-down`;

    return `${url.protocol}//${url.host}/cdn-cgi/image/${cfParams}${url.pathname}`;
  } catch {
    // Fallback: return original source if URL parsing fails
    return src;
  }
}

/**
 * Select the best available image URL from article metadata.
 *
 * Priority (when images exist):
 * 1. `images[requestedSize][requestedFormat]` — exact match
 * 2. `images[fallbackSize][requestedFormat]` — fallback size
 * 3. `images.original` — original full-size
 * 4. `coverImage` — fallback cover
 * 5. `null` — no image available
 *
 * When images is null/undefined:
 * - Returns `coverImage` directly (or null)
 *
 * @param options - Image selection options
 * @returns Selected image URL or null
 *
 * @example
 * ```ts
 * getArticleImageUrl({
 *   images: article.meta?.images,
 *   coverImage: article.coverImage,
 *   size: 'medium',
 * })
 * // => 'https://img.joyminis.com/cdn-cgi/image/.../medium.webp'
 * ```
 */
export function getArticleImageUrl({
  images,
  coverImage,
  size = 'medium',
}: ArticleImageOptions): string | null {
  if (!images && !coverImage) return null;

  if (images) {
    // Sizes in priority order: requested → original → fallback to coverImage
    const sizeMap: Record<string, { webp: string; jpg: string } | undefined> = {
      thumbnail: images.thumbnail,
      medium: images.medium,
      large: images.large,
      original: undefined, // will fall through to images.original
    };

    // Try requested size first
    if (size !== 'original' && sizeMap[size]) {
      return sizeMap[size]!.webp || sizeMap[size]!.jpg || null;
    }

    // Fallback to original if available
    if (images.original) {
      return images.original;
    }

    // Last resort: any available size, prefer webp
    return (
      images.large?.webp ||
      images.large?.jpg ||
      images.medium?.webp ||
      images.medium?.jpg ||
      images.thumbnail?.webp ||
      images.thumbnail?.jpg ||
      null
    );
  }

  // Fallback to coverImage
  return coverImage ?? null;
}

// ─── Video Detection ──────────────────────────────────────────────────────

/**
 * Video file extensions supported by the app
 */
const VIDEO_EXTENSIONS_LIST = [
  '.mp4',
  '.webm',
  '.mov',
  '.avi',
  '.mkv',
  '.ogv',
  '.m4v',
  '.m3u8',
];

/**
 * Check if a URL points to a video file.
 *
 * Parses the URL's pathname to check against known video extensions.
 * Falls back to string check if URL parsing fails.
 *
 * @param url - URL to check
 * @returns Whether the URL is a video
 *
 * @example
 * ```ts
 * isVideoUrl('https://example.com/video.mp4')   // => true
 * isVideoUrl('https://example.com/photo.jpg')    // => false
 * isVideoUrl(null)                                // => false
 * ```
 */
export function isVideoUrl(url: string | null | undefined): boolean {
  if (!url) return false;

  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return VIDEO_EXTENSIONS_LIST.some(ext => pathname.endsWith(ext));
  } catch {
    // If URL parsing fails (e.g., relative path), check string directly
    const urlLower = url.toLowerCase();
    return VIDEO_EXTENSIONS_LIST.some(ext => urlLower.endsWith(ext));
  }
}
