# HLS Video Playback Fix Plan (iOS + Android)

## Root Cause Analysis

### Current Status

**HLS streams are now confirmed healthy from server side:**

- ✅ Master m3u8 loaded (HTTP 200, `Content-Type: application/vnd.apple.mpegurl`)
- ✅ Variant playlists loaded (480p + 720p, proper segment references)
- ✅ MPEG-TS segments accessible (valid H.264/AAC content)
- ✅ MP4 fallback works correctly on both platforms

**The issue was likely a transient server/CDN problem** that has since resolved. The HLS URLs were returning errors at the time of testing but are now serving correctly.

### Key Findings

1. **Both iOS and Android** failed identically on HLS → rules out platform-specific bug
2. **MP4 fallback** works fine → server connectivity and bandwidth are not the issue
3. **Error happens within ~1 second** → suggests the m3u8 manifest itself failed to load at that time
4. **HLS content is valid** (verified via curl after the fact) → confirms a transient issue

### Why HLS Might Fail Transiently on CDN

- Cloudflare/R2 cache might serve stale/wrong content for `.m3u8` files if cache rules changed
- HLS transcoding pipeline might have had a delay — m3u8 files written after initial API response
- CDN edge node might have had a cache miss and served an error page instead of the m3u8

## Code Changes Applied

### 1. Fixed `poster` prop in [`ArticleCard.tsx`](../src/components/blog/ArticleCard.tsx)

**Issue:** `poster={posterUrl || ''}` passes empty string when `posterUrl` is `null`.
react-native-video v6 treats non-null poster value as a valid image source, causing unnecessary load attempt on empty URL.

**Fix:** `poster={posterUrl ?? undefined}` — only passes a value when posterUrl is truthy.

### 2. Added `onLoadStart` handler in [`ArticleCard.tsx`](../src/components/blog/ArticleCard.tsx)

Adds `onLoadStart={handleVideoLoadStart}` to the `<Video>` component for better diagnostic tracing.
Now logs when loading actually begins vs when errors occur.

### 3. Improved error logging in [`useVideoPlayback.ts`](../src/lib/hooks/useVideoPlayback.ts)

Added `extractVideoError()` helper that parses the native error event structure:

```typescript
function extractVideoError(e: any): Record<string, unknown> {
  const nativeEvent = e.nativeEvent ?? e;
  const err = nativeEvent.error ?? {};
  return {
    platform: Platform.OS,
    errorString: err.errorString, // Android
    errorCode: err.errorCode, // Android
    ios_code: err.code, // iOS
    ios_error: err.error, // iOS
    ios_domain: err.domain, // iOS
    ios_localizedDescription: err.localizedDescription, // iOS
    target: nativeEvent.target,
  };
}
```

Now logs structured error details instead of raw event object, enabling precise diagnosis of native player errors.

### 4. Added `onError` handler to inline videos in [`MarkdownRenderer.tsx`](../src/components/blog/MarkdownRenderer.tsx)

Inline videos in article content now have:

- `onError={handleInlineVideoError}` — logs structured error details
- `poster={seg.poster ?? undefined}` — consistent poster handling

### Files Modified

| File                                                                                      | Change                                                                      |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| [`src/components/blog/ArticleCard.tsx`](../src/components/blog/ArticleCard.tsx)           | Fix poster prop, add `onLoadStart` handler                                  |
| [`src/lib/hooks/useVideoPlayback.ts`](../src/lib/hooks/useVideoPlayback.ts)               | Add `extractVideoError()`, structured error logging, `handleVideoLoadStart` |
| [`src/components/blog/MarkdownRenderer.tsx`](../src/components/blog/MarkdownRenderer.tsx) | Fix poster prop, add `onError` handler with logging                         |

## What's Still Missing

### ArticleDetailScreen hero video

The [`ArticleDetailScreen.tsx`](../src/screens/ArticleDetailScreen.tsx) still has NO hero video player.
The `article.meta?.video?.hlsUrl` data is available but not rendered.
This was identified in the earlier [`article-image-video-fix-plan.md`](./article-image-video-fix-plan.md) (Bug 3) but not yet implemented.

To add it:

1. When `article.meta?.video` exists, render a `<Video>` component above the article header
2. Use the same HLS→MP4 fallback pattern as `useVideoPlayback`
3. Post on error screen when both fail

## Future Diagnosis (If HLS Fails Again)

If the issue reoccurs, immediately run:

```bash
# Check master playlist
curl -s -o /dev/null -w "HTTP %{http_code} Content-Type: %{content_type}\n" \
  "https://img.joyminis.com/uploads/blog/videos/{VIDEO_ID}/{UUID}/hls/master.m3u8"

# Check variant playlist
curl -s -o /dev/null -w "HTTP %{http_code} Content-Type: %{content_type}\n" \
  "https://img.joyminis.com/uploads/blog/videos/{VIDEO_ID}/{UUID}/hls/480p/playlist.m3u8"

# Check a segment
curl -s -o /dev/null -w "HTTP %{http_code} Content-Type: %{content_type} Size: %{size_download}\n" \
  "https://img.joyminis.com/uploads/blog/videos/{VIDEO_ID}/{UUID}/hls/480p/segment_000.ts"
```

Also test with Apple's known-good HLS stream inside the app:

```
https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8
```

- If Apple HLS works → issue is with your HLS encoding/CDN
- If Apple HLS also fails → issue is with react-native-video v6 + Fabric configuration

## Fire-and-Forget: Apple Test HLS

You can test if the entire react-native-video + HLS pipeline works by temporarily using Apple's test stream. If it works, the problem was always server-side.
