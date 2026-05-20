/**
 * VideoPlayer — Encapsulated video player with always-mounted <Video>
 *
 * Renders the <Video> component ALWAYS when article.hasVideo is true
 * (not conditionally on play press). This ensures ExoPlayer (Android)
 * initialises its codecs during idle scrolling, eliminating the first-play
 * HLS race condition where AAC audio codecs aren't ready yet.
 *
 * Features:
 * - Always-mounted Video, starts paused
 * - Poster overlay (AppImage with blurhash)
 * - Play / pause / error button overlay
 * - Auto-pause coordination: only one video plays at a time across FlatList
 * - HLS → MP4 fallback on error (delegated to useVideoPlayback)
 *
 * Usage:
 * ```tsx
 * <VideoPlayer article={article} priority={priority} />
 * ```
 */

import React, { useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import Video, { SelectedTrackType } from 'react-native-video';
import type { VideoRef } from 'react-native-video';
import { useVideoPlayback } from '@/lib/hooks/useVideoPlayback';
import { AppImage } from '@/components/core/AppImage';
import { isVideoUrl } from '@/lib/utils/image';
import type { FrontendArticle } from '@/types/frontend-blog';

interface VideoPlayerProps {
  article: FrontendArticle;
  /** Priority for image loading (LCP optimisation) */
  priority?: boolean;
}

export function VideoPlayer({ article, priority = false }: VideoPlayerProps) {
  const videoRef = useRef<VideoRef>(null);

  const {
    hasVideo,
    videoPlaying,
    videoPaused,
    videoUri,
    videoFailed,
    videoLoaded,
    audioDisabled,
    posterUrl,
    handlePlayPress,
    handleVideoLoadStart,
    handleVideoLoad,
    handleVideoError,
    handleVideoEnd,
  } = useVideoPlayback(article);

  // NOTE: Playback is controlled exclusively via the declarative `paused` prop.
  // Do NOT imperatively call videoRef.current?.resume() — it conflicts with
  // the paused prop and can prevent playback from starting.

  if (!hasVideo) return null;

  return (
    <View style={styles.container}>
      {/* Video — always mounted, starts paused.
          ExoPlayer codecs initialise during idle scrolling.
          Only rendered when videoUri is non-null: during LATM retry the uri is
          briefly set to null to force ExoPlayer teardown — skip rendering then. */}
      {videoUri != null && (
        <Video
          ref={videoRef}
          source={{ uri: videoUri }}
          style={styles.video}
          resizeMode="contain"
          controls={false}
          paused={!videoPlaying || videoPaused}
          onLoadStart={handleVideoLoadStart}
          onLoad={handleVideoLoad}
          onError={handleVideoError}
          onEnd={handleVideoEnd}
          selectedAudioTrack={
            audioDisabled ? { type: SelectedTrackType.DISABLED } : undefined
          }
        />
      )}

      {/* Poster overlay — independent AppImage covering the video container.
          Visible when:
          - Not playing yet (initial state)
          - Playing but video source still loading (covers black frame)
          - Video permanently failed (shows poster instead of blank/✕)
          Hidden once video source has loaded successfully. */}
      {(!videoPlaying || !videoLoaded || videoFailed) && (
        <View style={StyleSheet.absoluteFill}>
          <AppImage
            uri={posterUrl}
            images={article.meta?.images}
            coverImage={
              article.coverImage && isVideoUrl(article.coverImage)
                ? undefined
                : article.coverImage
            }
            blurhash={article.meta?.images?.blurhash ?? article.meta?.blurhash}
            style={styles.video}
            priority={priority}
          />
        </View>
      )}

      {/* Tap overlay: play when idle, pause/resume when playing. */}
      <TouchableOpacity
        style={styles.playButtonOverlay}
        activeOpacity={0.7}
        onPress={handlePlayPress}
        accessibilityRole="button"
        accessibilityLabel={
          videoPlaying && !videoPaused ? 'Pause video' : 'Play video'
        }
      >
        {/* Loading spinner: video started but HLS not yet buffered.
            Replaces the ▶ so user knows something is happening. */}
        {videoPlaying && !videoLoaded && !videoFailed && (
          <View style={[StyleSheet.absoluteFill, styles.playButtonCenter]}>
            <ActivityIndicator size="large" color="#FFFFFF" />
          </View>
        )}

        {/* Show ▶ when idle (not started) or when explicitly paused */}
        {(!videoPlaying || videoPaused) && !videoFailed && (
          <View style={[StyleSheet.absoluteFill, styles.playButtonCenter]}>
            <View style={styles.playButtonCircle}>
              <Text style={styles.playButtonIcon}>▶</Text>
            </View>
          </View>
        )}

        {/* Show error indicator when video permanently failed */}
        {videoFailed && (
          <View style={[StyleSheet.absoluteFill, styles.playButtonCenter]}>
            <View style={styles.errorOverlay}>
              <Text style={styles.errorIcon}>⚠</Text>
              <Text style={styles.errorText}>Video unavailable</Text>
            </View>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  playButtonOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  playButtonCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButtonCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButtonIcon: {
    fontSize: 22,
    color: '#FFFFFF',
    marginLeft: 4,
  },
  errorOverlay: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorIcon: {
    fontSize: 28,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  errorText: {
    fontSize: 11,
    color: '#FFFFFF',
    marginTop: 4,
    fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});
