/**
 * useVideoPlayback — Video playback state and logic
 *
 * Extracts video-related state and callbacks into a reusable hook.
 * Handles:
 * - Video detection (HLS URL or MP4 coverImage)
 * - Play/pause toggle
 * - HLS → MP4 fallback on error
 * - Retry HLS once on audio/mp4a-latm codec mapping error (Android ExoPlayer)
 * - End-of-video cleanup
 * - Auto-pause other videos when a new one starts (module-level registry)
 *
 * Usage:
 * ```tsx
 * const {
 *   hasVideo, videoPlaying, videoPaused, videoUri, videoFailed,
 *   handlePlayPress, handleVideoLoad, handleVideoError, handleVideoEnd,
 * } = useVideoPlayback(article);
 * ```
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { logger } from '@/lib/logger';
import type { FrontendArticle } from '@/types/frontend-blog';

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
  /** True once the video source has successfully loaded and is ready to play */
  videoLoaded: boolean;
  /** Primary HLS URL (from article meta) */
  hlsUrl: string | null;
  /** Fallback MP4 URL (from coverImage) */
  mp4Url: string | null;
  /** Poster frame URL for video placeholder */
  posterUrl: string | null;
  /** Whether audio has been disabled for this video (LATM codec workaround) */
  audioDisabled: boolean;
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
  if (!e) {
    return { raw: 'unknown' };
  }

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
 * Detect whether the error is the Android-specific ExoPlayer HLS
 * `SampleQueueMappingException` for `audio/mp4a-latm` (AAC-LATM format).
 *
 * ExoPlayer cannot bind a sample queue to an HLS audio track with MIME type
 * `audio/mp4a-latm`. This is a codec-level incompatibility in the HLS stream.
 * Retrying with a fresh ExoPlayer instance (by toggling `videoUri`) sometimes
 * resolves the codec initialization race condition.
 *
 * NOTE: The `SampleQueueMappingException` is typically only present in the
 * `errorStackTrace` field (as a Caused-by chain), NOT in the top-level
 * `errorException` or `errorString`. All three fields are checked.
 */
function isAudioLatmError(e: any): boolean {
  if (!e) {
    return false;
  }
  const nativeEvent = e.nativeEvent ?? e;
  const err = nativeEvent.error ?? {};
  const exceptionStr = String(err.errorException ?? '');
  const errorStr = String(err.errorString ?? '');
  const stackTraceStr = String(err.errorStackTrace ?? '');
  const hasSampleQueueMapping =
    exceptionStr.includes('SampleQueueMappingException') ||
    stackTraceStr.includes('SampleQueueMappingException');
  const hasLatmCodec =
    exceptionStr.includes('audio/mp4a-latm') ||
    errorStr.includes('audio/mp4a-latm') ||
    stackTraceStr.includes('audio/mp4a-latm');
  return hasSampleQueueMapping && hasLatmCodec;
}

// ─── Module-level pause callback registry ──────────────────────────
//
// Each useVideoPlayback instance registers a pause function keyed by
// article ID. When handlePlayPress starts a new video, it calls all
// registered pause functions for OTHER articles, ensuring only one
// video plays at a time across the entire HomeScreen FlatList.

const videoPauseCallbacks: Record<string, () => void> = {};

/**
 * Hook that manages video playback state for an article.
 *
 * Detects video availability from:
 * 1. `article.meta?.video?.hlsUrl` — HLS stream (detail API)
 * 2. `article.coverImage.endsWith('.mp4')` — MP4 file (list API)
 *
 * The Video component is expected to be ALWAYS MOUNTED (not conditional on
 * videoPlaying). It starts paused and unpauses on play tap. This ensures
 * ExoPlayer (Android) initialises codecs during idle scrolling rather than
 * racing with HLS stream loading on first play.
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
  // Video is ALWAYS mounted — start with the preferred source (HLS, else MP4)
  const [videoUri, setVideoUri] = useState<string | null>(hlsUrl || mp4Url);
  // True when both HLS and MP4 fallback have failed
  const [videoFailed, setVideoFailed] = useState(false);
  // True once the video source has loaded and is ready to play (used to hide poster overlay)
  const [videoLoaded, setVideoLoaded] = useState(false);
  // Whether audio has been disabled for LATM codec workaround
  const [audioDisabled, setAudioDisabled] = useState(false);
  // Retry counter for audio/mp4a-latm HLS errors — max 1 retry to avoid loops
  const videoLatmRetryCount = useRef(0);
  // Debounce guard: timestamp of last handlePlayPress call (ms).
  // Prevents double-fire when two VideoPlayer instances exist for the same article
  // (e.g. FlatList duplicate data) or touch events are dispatched twice.
  const lastPlayPressTimestamp = useRef(0);

  const articleId = article.id;

  // ─── Lifecycle: registration & article change ──────────────────────

  useEffect(() => {
    // Reset state when the article changes (FlatList card recycling)
    setVideoUri(hlsUrl || mp4Url);
    setVideoPlaying(false);
    setVideoPaused(false);
    setVideoFailed(false);
    setVideoLoaded(false);
    setAudioDisabled(false);
    // Reset retry counter for the new article
    videoLatmRetryCount.current = 0;

    // Register a pause function so other hook instances can pause this video
    videoPauseCallbacks[articleId] = () => {
      setVideoPlaying(false);
      setVideoPaused(false);
      // NOTE: Do NOT reset videoLoaded here.
      // The Video is always mounted, so it stays loaded even while paused.
      // Resetting videoLoaded would cause the poster to permanently block the
      // video on next play, because onLoad never fires again for an already-loaded source.
    };

    // Cleanup on unmount or article change
    return () => {
      delete videoPauseCallbacks[articleId];
    };
  }, [articleId, hlsUrl, mp4Url]);

  // ─── Actions ────────────────────────────────────────────────────────

  const handlePlayPress = useCallback(() => {
    // Debounce: ignore presses within 500 ms of the previous one.
    // Guards against double-fire from duplicate list items or touch system quirks.
    const now = Date.now();
    if (now - lastPlayPressTimestamp.current < 500) {
      logger.warn(
        `[useVideoPlayback] play press debounced id=${articleId?.slice(0, 8)} (${now - lastPlayPressTimestamp.current}ms since last)`,
      );
      return;
    }
    lastPlayPressTimestamp.current = now;

    logger.info(
      `[useVideoPlayback] play pressed id=${articleId?.slice(0, 8)} uri="${videoUri}"`,
    );

    if (videoPlaying) {
      if (!videoLoaded) {
        // Video has started but is still buffering — user tapped again thinking
        // nothing happened. Do NOT toggle pause here; the spinner already signals
        // loading. Just log and ignore so we don't accidentally pause mid-buffer.
        logger.info(
          `[useVideoPlayback] play press ignored — buffering id=${articleId?.slice(0, 8)}`,
        );
        return;
      }
      // Video is loaded and playing — tap toggles pause
      setVideoPaused(p => !p);
    } else {
      // Before starting, pause all other videos playing in other cards
      Object.entries(videoPauseCallbacks).forEach(([id, pauseFn]) => {
        if (id !== articleId) {
          pauseFn();
        }
      });

      // Start fresh: reset failure state (source is already set)
      setVideoFailed(false);
      setVideoPlaying(true);
      setVideoPaused(false);
      // Don't reset videoLoaded — video is already loaded from always-mounted background loading.
      // Resetting it would keep the poster visible indefinitely since onLoad won't fire again
      // for an already-loaded source.
    }
  }, [articleId, videoUri, videoPlaying, videoLoaded]);

  const handleVideoLoadStart = useCallback(() => {
    logger.info(
      `[useVideoPlayback] video load start id=${articleId?.slice(0, 8)} uri="${videoUri}"`,
    );
  }, [articleId, videoUri]);

  const handleVideoLoad = useCallback(() => {
    logger.info(
      `[useVideoPlayback] video loaded id=${articleId?.slice(0, 8)} uri="${videoUri}"`,
    );
    setVideoLoaded(true);
  }, [articleId, videoUri]);

  const handleVideoError = useCallback(
    (e: any) => {
      // Extract structured error details for better diagnostics
      const errorDetails = extractVideoError(e);

      // ── Filter: CoreMediaErrorDomain -12642 (kCMBaseObjectError_Invalidated) ──
      // This error fires when the <Video> component unmounts while CoreMedia is
      // still loading (e.g. FlatList card recycled during network-not-ready window).
      // It's a lifecycle artifact, not a real playback failure — the user sees no
      // visible issue because the card is gone. Log at debug level and bail out
      // to avoid noise in Sentry Logs.
      if (
        errorDetails.ios_domain === 'CoreMediaErrorDomain' &&
        errorDetails.ios_code === -12642
      ) {
        logger.debug(
          `[useVideoPlayback] video invalidated on unmount (CoreMedia -12642) id=${articleId?.slice(0, 8)}`,
        );
        return;
      }

      logger.error(
        `[useVideoPlayback] video error id=${articleId?.slice(0, 8)} uri="${videoUri}"`,
        errorDetails,
      );

      const isCurrentlyHLS = videoUri === hlsUrl;

      // Diagnostic: log whether audio/mp4a-latm pattern was detected
      const isLatm = isAudioLatmError(e);
      if (isCurrentlyHLS) {
        logger.info(
          `[useVideoPlayback] HLS error diagnostics id=${articleId?.slice(0, 8)} isLatmError=${isLatm} retryCount=${videoLatmRetryCount.current}`,
          {
            errorFields: {
              errorException: (e?.nativeEvent?.error ?? e?.error)
                ?.errorException,
              errorString: (e?.nativeEvent?.error ?? e?.error)?.errorString,
              hasStackTrace: Boolean(
                (e?.nativeEvent?.error ?? e?.error)?.errorStackTrace,
              ),
            },
          },
        );
      }

      // ── Case 1: audio/mp4a-latm — retry HLS once ─────────────
      // ExoPlayer (Android) fails to bind a sample queue for AAC-LATM audio.
      // Tearing down and recreating the ExoPlayer instance sometimes resolves
      // the codec initialisation race condition.
      if (isCurrentlyHLS && isLatm && videoLatmRetryCount.current < 1) {
        videoLatmRetryCount.current += 1;
        logger.warn(
          `[useVideoPlayback] audio/mp4a-latm detected, retrying HLS (attempt ${videoLatmRetryCount.current}) id=${articleId?.slice(0, 8)} uri="${videoUri}"`,
        );
        // Force ExoPlayer teardown by setting URI to null, then restore
        setVideoUri(null);
        setTimeout(() => {
          setVideoUri(hlsUrl);
          setVideoLoaded(false);
        }, 500);
        return;
      }

      // ── Case 1.5: LATM retry exhausted — try with audio disabled ──
      // If the HLS retry also failed with LATM, try playing without audio.
      // ExoPlayer can handle the video track; only the audio track binding fails.
      if (isCurrentlyHLS && isLatm && !audioDisabled) {
        logger.warn(
          `[useVideoPlayback] LATM retry failed, retrying with audio disabled id=${articleId?.slice(0, 8)} uri="${videoUri}"`,
        );
        videoLatmRetryCount.current = 0; // Reset for the audio-disabled attempt
        setAudioDisabled(true);
        // Tear down ExoPlayer instance and reload
        setVideoUri(null);
        setTimeout(() => {
          setVideoUri(hlsUrl);
          setVideoLoaded(false);
        }, 500);
        return;
      }

      // ── Case 2: HLS failed — try MP4 fallback ────────────────
      if (isCurrentlyHLS && mp4Url && !mp4Url.endsWith('.m3u8')) {
        logger.warn(
          `[useVideoPlayback] HLS failed, falling back to MP4 id=${articleId?.slice(0, 8)} mp4="${mp4Url}"`,
        );
        setVideoUri(mp4Url);
        // Reset loaded state for the fallback MP4 source
        setVideoLoaded(false);
        return;
      }

      // ── Case 3: permanent failure (retry exhausted, no MP4,
      //     or MP4 also failed) ──────────────────────────────────
      logger.error(
        `[useVideoPlayback] video completely failed, no fallback id=${articleId?.slice(0, 8)} uri="${videoUri}"`,
        errorDetails,
      );
      setVideoFailed(true);
      setVideoPlaying(false);
      setVideoLoaded(false);
    },
    [articleId, hlsUrl, mp4Url, videoUri, audioDisabled],
  );

  const handleVideoEnd = useCallback(() => {
    logger.info(`[useVideoPlayback] video ended id=${articleId?.slice(0, 8)}`);
    setVideoPlaying(false);
    setVideoPaused(false);
    setVideoLoaded(false);
    // Keep videoUri — source stays set for replay; Video is always mounted
  }, [articleId]);

  return {
    // State
    hasVideo,
    videoPlaying,
    videoPaused,
    videoUri,
    videoFailed,
    videoLoaded,
    audioDisabled,
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
