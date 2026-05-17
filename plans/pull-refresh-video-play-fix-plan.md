# Pull-to-Refresh Spinner + Inline Video Playback Fix

## Problem Analysis

### Pull-to-Refresh Spinner Not Showing
**Root cause**: `refetch()` starts an async network request, but `isFetching` may already be `true` (from auto-refetch on mount/param change). This prevents the `isFetching`-based useEffect from properly detecting the transition and keeping `refreshing=true` long enough for the spinner to render.

**Fix**: Replace `useEffect(isFetching)` pattern with `setTimeout(0)` + `refetch().finally()`:
1. `setRefreshing(true)` — queued state update
2. `setTimeout(() => refetch().finally(() => setRefreshing(false)), 0)` — deferred until after the `refreshing=true` state is committed by React
3. RefreshControl renders with `refreshing=true` → spinner visible
4. Network completes → `.finally()` → `setRefreshing(false)` → spinner hides

This applies to all 3 screens: HomeScreen, TagListScreen, CategoryListScreen.

### Inline Video Playback in ArticleCard
**Root cause**: Currently clicking a video article navigates to ArticleDetailScreen. User wants video to play INLINE in the card.

**Fix**: 
1. Add `useState(false)` for video playing state
2. Import `Video` from `react-native-video`
3. When play button is tapped: replace `Image` with `Video` component (same aspect ratio)
4. Add centered play button overlay (▶ icon in a semi-transparent circle)
5. When video is playing, show a simple Video component (no controls, auto-play)

## Files to Modify

### 1. `src/screens/HomeScreen.tsx`
**Changes**:
- Remove `useEffect` that sets `refreshing(false)` based on `isFetching`
- Change `onRefresh` to use `setTimeout(0)` + `refetch().finally(() => setRefreshing(false))`

**Code**:
```tsx
const onRefresh = useCallback(() => {
    setRefreshing(true);
    setPage(1);
    // Defer refetch to after React commits the refreshing=true state
    // This guarantees the RefreshControl spinner renders immediately
    setTimeout(() => {
        refetch().finally(() => {
            setRefreshing(false);
        });
    }, 0);
}, [refetch]);
```

### 2. `src/screens/TagListScreen.tsx`
**Changes**:
- Same pattern: remove `isFetching` useEffect, use `setTimeout(0)` + `refetch().finally()`

**Code**:
```tsx
const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
        refetch().finally(() => {
            setRefreshing(false);
        });
    }, 0);
}, [refetch]);
```

### 3. `src/screens/CategoryListScreen.tsx`
**Changes**: Same as TagListScreen.

### 4. `src/components/blog/ArticleCard.tsx`
**Changes**:
- Add `import Video from 'react-native-video'`
- Add `useState(false)` for `videoPlaying`
- In image section: if `hasVideo && videoPlaying`, render `<Video>` instead of `<Image>`
- Add play button overlay (▶ icon) when `hasVideo && !videoPlaying`
- Add play button `TouchableOpacity` → `setVideoPlaying(true)`

**Code structure**:
```tsx
import Video from 'react-native-video';

// Inside component:
const [videoPlaying, setVideoPlaying] = useState(false);

// In image container:
{imageUrl && (
  <View style={[styles.imageContainer, ...]}>
    {videoPlaying && hasVideo ? (
      <Video
        source={{ uri: article.meta!.video!.hlsUrl }}
        style={[styles.image, ...]}
        resizeMode="cover"
        paused={false}
        controls={false}
        repeat={false}
      />
    ) : (
      <Image source={{ uri: imageUrl }} style={[...]} resizeMode="cover" />
    )}

    {/* Play button overlay */}
    {hasVideo && !videoPlaying && (
      <TouchableOpacity
        style={styles.playButton}
        onPress={() => setVideoPlaying(true)}
        activeOpacity={0.7}
      >
        <View style={styles.playButtonCircle}>
          <Text style={styles.playButtonIcon}>▶</Text>
        </View>
      </TouchableOpacity>
    )}

    {/* Video badge */}
    {hasVideo && (
      <View style={styles.videoBadge}>
        <Text style={styles.videoBadgeText}>🎬</Text>
      </View>
    )}

    {/* Category badge */}
    {article.category && (...)}
  </View>
)}
```

**Styles to add**:
```ts
playButton: {
  position: 'absolute',
  top: 0, left: 0, right: 0, bottom: 0,
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
  color: '#fff',
  marginLeft: 4, // visual centering for ▶
},
```

## Execution Order

1. Modify `HomeScreen.tsx` — fix onRefresh with setTimeout
2. Modify `TagListScreen.tsx` — fix onRefresh with setTimeout
3. Modify `CategoryListScreen.tsx` — fix onRefresh with setTimeout
4. Modify `ArticleCard.tsx` — inline video playback with play button
5. Run `npx tsc --noEmit` to verify
6. Test on device

## Verification

- Pull down on Home, Tags, Categories → spinner shows during network request
- Video article card → shows poster + ▶ play button overlay
- Tap play button → video plays inline (poster replaced by Video component)
- Tab switch → no flash, data visible immediately from cache
