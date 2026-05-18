/**
 * PullToRefreshWrapper — Cross-platform pull-to-refresh via native RefreshControl
 *
 * ## Architecture
 * - Both iOS and Android: Injects a native `<RefreshControl>` into the child
 *   FlatList/ScrollView via `React.cloneElement`.
 *   - iOS: UIRefreshControl — native "stay pulled during refresh" + bounce.
 *   - Android: SwipeRefreshLayout — native circular spinner that stays visible
 *     until `refreshing` becomes false.
 *
 * ## Why not custom Android gesture?
 * A custom Pan gesture + Reanimated translateY approach is fundamentally
 * incompatible with FlatList's internal scroll gesture. The FlatList consumes
 * pointer events before the external PanGesture can activate, resulting in
 * the wrapper never translating. Native RefreshControl avoids this entirely
 * because it is integrated at the native scroll view level.
 *
 * ## Usage
 * ```tsx
 * <PullToRefreshWrapper
 *   refreshing={isManualRefreshing}
 *   onRefresh={handleRefresh}
 *   spinnerColor={colors.primary}
 * >
 *   <Animated.FlatList onScroll={scrollHandler} ... />
 * </PullToRefreshWrapper>
 * ```
 */
import React from 'react';
import {
  RefreshControl,
  View,
  ActivityIndicator,
  Platform,
  StyleSheet,
} from 'react-native';
import { BlurView } from '@react-native-community/blur';
import { useAnimatedReaction, runOnJS } from 'react-native-reanimated';

// ─── Props ──────────────────────────────────────────────────────────────────

export interface PullToRefreshWrapperProps {
  /** Whether a refresh is currently in progress */
  refreshing: boolean;
  /** Callback triggered when the user pulls past the threshold and releases */
  onRefresh: () => void;
  /**
   * Optional SharedValue for scroll offset.
   * Kept for API compatibility with existing call-sites (e.g. HomeScreen).
   * Not used internally — the native RefreshControl handles gesture detection.
   */
  scrollOffset?: import('react-native-reanimated').SharedValue<number>;
  /** Pull distance threshold in points — kept for API compatibility, unused */
  pullThreshold?: number;
  /**
   * Vertical offset for the spinner pill (iOS custom pill only).
   * Defaults to 0 — pill appears at the top of the wrapper.
   * Pass `insets.top + CONTENT_TOP` on screens with absolute overlays (e.g. HomeScreen).
   */
  spinnerOffset?: number;
  /** Spinner / tint color (default: '#007AFF') */
  spinnerColor?: string;
  /** Background color — kept for API compatibility, unused */
  backgroundColor?: string;
  /** The scrollable content (FlatList, ScrollView, etc.) */
  children: React.ReactNode;
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** Diameter of the spinner pill — matches native UIRefreshControl visual size */
const SPINNER_PILL_SIZE = 36;
/**
 * Extra offset so the pill sits in the centre of the pull zone (~50 pt gap)
 * rather than right at the overlay bottom edge.
 */
const SPINNER_ZONE_INSET = 8;

// ─── Main Component ──────────────────────────────────────────────────────────

/**
 * Injects a native `<RefreshControl>` into the direct child scrollable element.
 * Works identically on iOS and Android.
 */
const PullToRefreshWrapper: React.FC<PullToRefreshWrapperProps> = ({
  refreshing,
  onRefresh,
  spinnerColor = '#007AFF',
  spinnerOffset,
  scrollOffset,
  children,
}) => {
  // ── Pull-phase detection ─────────────────────────────────────────────
  // On iOS with spinnerOffset (HomeScreen), detect negative scroll offset to
  // show the custom spinner as soon as the user starts pulling — matching the
  // native UIRefreshControl progressive-reveal behaviour on other screens.
  // Called unconditionally (hooks rules); no-ops when scrollOffset is absent.
  const [isPulling, setIsPulling] = React.useState(false);
  const setIsPullingTrue = React.useCallback(() => setIsPulling(true), []);
  const setIsPullingFalse = React.useCallback(() => setIsPulling(false), []);

  useAnimatedReaction(
    () => (scrollOffset != null ? scrollOffset.value : 0),
    value => {
      'worklet';
      if (value < -10) {
        runOnJS(setIsPullingTrue)();
      } else {
        runOnJS(setIsPullingFalse)();
      }
    },
  );

  if (!React.isValidElement(children)) {
    return <>{children}</>;
  }

  // iOS: always use custom BlurView pill for visual consistency across all screens.
  // Android: use native progressViewOffset to push the circular spinner below any overlays.
  const useCustomSpinner = Platform.OS === 'ios';

  // Show as soon as the user pulls (isPulling) — not just after onRefresh fires.
  const showCustomSpinner = useCustomSpinner && (isPulling || refreshing);

  const pillTop = (spinnerOffset ?? 0) + SPINNER_ZONE_INSET;

  const child = React.cloneElement(children as React.ReactElement<any>, {
    refreshControl: (
      <RefreshControl
        refreshing={refreshing}
        onRefresh={onRefresh}
        tintColor={useCustomSpinner ? 'transparent' : spinnerColor}
        colors={[spinnerColor]}
        progressViewOffset={
          Platform.OS === 'android' && spinnerOffset != null
            ? spinnerOffset
            : undefined
        }
      />
    ),
  });

  return (
    <View style={styles.container}>
      {child}
      {showCustomSpinner && (
        <BlurView
          blurType="regular"
          blurAmount={20}
          reducedTransparencyFallbackColor="white"
          pointerEvents="none"
          style={[styles.spinnerPill, { top: pillTop }]}
        >
          <ActivityIndicator size="small" color={spinnerColor} />
        </BlurView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  spinnerPill: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 999,
    width: SPINNER_PILL_SIZE,
    height: SPINNER_PILL_SIZE,
    borderRadius: SPINNER_PILL_SIZE / 2,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default PullToRefreshWrapper;
