/**
 * useVideoPlayback — Video playback state and logic
 *
 * Extracts video-related state and callbacks from ArticleCard into a reusable hook.
 * Handles:
 * - Video detection (HLS URL or MP4 coverImage)
 * - Play/pause toggle
 * - HLS → MP4 fallback on error
 * - End-of-video cleanup
 *
 * Usage:
 * ```tsx
 * const {
 *   hasVideo, videoPlaying, videoPaused, videoUri, videoFailed,
 *   handlePlayPress, handleVideoLoad, handleVideoError, handleVideoEnd,
 * } = useVideoPlayback(article);
 * ```
 */

import { useState, useCallback } from 'react';
import { Platform } from 'react-native';
import { logger } from '@/lib/logger';
import type { FrontendArticle } from '@/types/frontend-blog';
import { isVideoUrl } from '@/lib/utils/image';

export interface VideoPlaybackState {
  /** Whether this article has a playable video */
  hasVideo: boolean;
  /** Whether video is currently playing */
  videoPlaying: boolean;
  /** Whether video is paused (toggled by tap while playing) */
  videoPaused: boolean;
  /** Current video source URI (HLS URL or MP4 fallback) */
  videoUri: string | null;
  /** True when both HLS and MP4 fallback have failed */
  videoFailed: boolean;
  /** Primary HLS URL (from article meta) */
  hlsUrl: string | null;
  /** Fallback MP4 URL (from coverImage) */
  mp4Url: string | null;
  /** Poster frame URL for video placeholder */
  posterUrl: string | null;
}

export interface VideoPlaybackActions {
  /** Start/pause/resume video playback */
  handlePlayPress: () => void;
  /** Called when video starts loading */
  handleVideoLoadStart: () => void;
  /** Called when video loads successfully */
  handleVideoLoad: () => void;
  /** Called on video error — handles HLS → MP4 fallback */
  handleVideoError: (e: any) => void;
  /** Called when video playback ends — resets state */
  handleVideoEnd: () => void;
}

/**
 * Extract readable error details from react-native-video error event.
 * On iOS: error.code, error.localizedDescription, error.domain
 * On Android: error.errorString, error.errorCode
 * On Web: error.error, error.code
 */
function extractVideoError(e: any): Record<string, unknown> {
  if (!e) return { raw: 'unknown' };

  // react-native-video wraps error in nativeEvent
  const nativeEvent = e.nativeEvent ?? e;
  const err = nativeEvent.error ?? {};

  return {
    platform: Platform.OS,
    errorString: err.errorString,
    errorCode: err.errorCode,
    errorException: err.errorException,
    errorStackTrace: err.errorStackTrace,
    ios_code: err.code,
    ios_error: err.error,
    ios_domain: err.domain,
    ios_localizedDescription: err.localizedDescription,
    ios_localizedFailureReason: err.localizedFailureReason,
    target: nativeEvent.target,
  };
}

/**
 * Hook that manages video playback state for an article.
 *
 * Detects video availability from:
 * 1. `article.meta?.video?.hlsUrl` — HLS stream (detail API)
 * 2. `article.coverImage.endsWith('.mp4')` — MP4 file (list API)
 *
 * On error, automatically falls back from HLS to MP4 (coverImage).
 *
 * @param article - The article to check for video
 * @returns Video playback state + action handlers
 */
export function useVideoPlayback(
  article: FrontendArticle,
): VideoPlaybackState & VideoPlaybackActions {
  // ─── Derived state ──────────────────────────────────────────────────

  const hlsUrl = article.meta?.video?.hlsUrl ?? null;
  const mp4Url =
    typeof article.coverImage === 'string' &&
    article.coverImage.endsWith('.mp4')
      ? article.coverImage
      : null;

  const hasVideo = Boolean(hlsUrl) || Boolean(mp4Url);

  const posterUrl =
    article.meta?.video?.posterWebp || article.meta?.video?.poster || null;

  // ─── Mutable state ──────────────────────────────────────────────────

  const [videoPlaying, setVideoPlaying] = useState(false);
  const [videoPaused, setVideoPaused] = useState(false);
  // Track current video URI: starts as null, becomes hlsUrl on tap, falls back to MP4 on error
  const [videoUri, setVideoUri] = useState<string | null>(null);
  // True when both HLS and MP4 fallback have failed
  const [videoFailed, setVideoFailed] = useState(false);

  // ─── Actions ────────────────────────────────────────────────────────

  const handlePlayPress = useCallback(() => {
    const src = hlsUrl || mp4Url;
    logger.info(
      `[useVideoPlayback] play pressed id=${article.id?.slice(0, 8)} src="${src}"`,
    );
    if (videoPlaying) {
      // Tap on playing video → toggle pause
      setVideoPaused(p => !p);
    } else {
      // Start fresh: reset failure state and use HLS URL (or MP4 from coverImage)
      setVideoFailed(false);
      setVideoUri(src);
      setVideoPlaying(true);
      setVideoPaused(false);
    }
  }, [article.id, hlsUrl, mp4Url, videoPlaying]);

  const handleVideoLoadStart = useCallback(() => {
    logger.info(
      `[useVideoPlayback] video load start id=${article.id?.slice(0, 8)} uri="${videoUri}"`,
    );
  }, [article.id, videoUri]);

  const handleVideoLoad = useCallback(() => {
    logger.info(
      `[useVideoPlayback] video loaded id=${article.id?.slice(0, 8)} uri="${videoUri}"`,
    );
  }, [article.id, videoUri]);

  const handleVideoError = useCallback(
    (e: any) => {
      // Extract structured error details for better diagnostics
      const errorDetails = extractVideoError(e);
      logger.error(
        `[useVideoPlayback] video error id=${article.id?.slice(0, 8)} uri="${videoUri}"`,
        errorDetails,
      );

      const isCurrentlyHLS = videoUri === hlsUrl;
      // If HLS just failed, try the original MP4 (coverImage)
      if (isCurrentlyHLS && mp4Url && !mp4Url.endsWith('.m3u8')) {
        logger.warn(
          `[useVideoPlayback] HLS failed, falling back to MP4 id=${article.id?.slice(0, 8)} mp4="${mp4Url}"`,
        );
        setVideoUri(mp4Url);
      } else {
        // MP4 also failed (or no fallback available) — show error indicator
        logger.error(
          `[useVideoPlayback] video completely failed, no fallback id=${article.id?.slice(0, 8)} uri="${videoUri}"`,
          errorDetails,
        );
        setVideoFailed(true);
        setVideoPlaying(false);
      }
    },
    [article.id, hlsUrl, mp4Url, videoUri],
  );

  const handleVideoEnd = useCallback(() => {
    logger.info(`[useVideoPlayback] video ended id=${article.id?.slice(0, 8)}`);
    setVideoPlaying(false);
    setVideoPaused(false);
    setVideoUri(null);
  }, [article.id]);

  return {
    // State
    hasVideo,
    videoPlaying,
    videoPaused,
    videoUri,
    videoFailed,
    hlsUrl,
    mp4Url,
    posterUrl,
    // Actions
    handlePlayPress,
    handleVideoLoadStart,
    handleVideoLoad,
    handleVideoError,
    handleVideoEnd,
  };
}
