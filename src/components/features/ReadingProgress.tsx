/**
 * ReadingProgress — Scroll-linked reading progress bar
 *
 * Renders a thin progress bar at the top of the screen that fills
 * proportionally to the user's scroll position through an article.
 *
 * Two modes of operation:
 * 1. **Animated mode**: Pass a native `Animated.Value` from `scrollY` event
 *    (works with `onScroll={Animated.event(...)}`)
 * 2. **Simple mode**: Pass a numeric `progress` value (0.0 – 1.0)
 *
 * The bar is absolutely positioned at the top of the parent container
 * (typically within the ArticleDetailScreen's scroll view).
 *
 * Usage:
 * ```tsx
 * // With Animated.Value:
 * const scrollY = useRef(new Animated.Value(0)).current;
 * // ...
 * <ReadingProgress scrollY={scrollY} />
 * <Animated.ScrollView onScroll={Animated.event(
 *   [{ nativeEvent: { contentOffset: { y: scrollY } } }],
 *   { useNativeDriver: true }
 * )}>
 *   ...
 * </Animated.ScrollView>
 *
 * // With numeric progress:
 * <ReadingProgress progress={0.45} />
 * ```
 */

import React, { useRef, useEffect } from 'react';
import { Animated, StyleSheet, Dimensions } from 'react-native';
import { useModeColors } from '@/lib/theme/ThemeContext';

interface ReadingProgressProps {
  /** Native animated value from scrollY (alternative to progress) */
  scrollY?: Animated.Value;
  /** Numeric progress 0.0–1.0 (alternative to scrollY) */
  progress?: number;
  /** Bar height in pixels (default: 3) */
  height?: number;
  /** Bar color (default: theme primary) */
  color?: string;
  /** Background track color (default: transparent) */
  trackColor?: string;
}

const SCREEN_WIDTH = Dimensions.get('window').width;

const ReadingProgress: React.FC<ReadingProgressProps> = ({
  scrollY,
  progress,
  height = 3,
  color,
  trackColor,
}) => {
  const colors = useModeColors();

  // Internal animated value for controlled progress mode
  const internalAnim = useRef(new Animated.Value(0)).current;

  const barColor = color ?? colors.primary;
  const barTrackColor = trackColor ?? 'transparent';

  // Sync external progress value → internal animated value
  useEffect(() => {
    if (progress !== undefined) {
      Animated.timing(internalAnim, {
        toValue: Math.min(Math.max(progress, 0), 1),
        duration: 100,
        useNativeDriver: false,
      }).start();
    }
  }, [progress, internalAnim]);

  // Determine the Animated.Value driving the width
  let widthAnim: Animated.Value | Animated.AnimatedInterpolation<number>;

  if (scrollY) {
    // When using Animated.Value from scroll event, we need to interpolate
    // But we don't have content height here, so we interpolate as a fixed
    // fraction. For proper behavior, the parent should provide contentHeight
    // or use the progress mode.
    // We create a pass-through; the parent must handle the interpolation.
    widthAnim = scrollY as unknown as Animated.Value;
  } else {
    widthAnim = internalAnim;
  }

  // If scrollY is provided, we expect the parent to have interpolated it
  // or we use it directly as a progress-like value.
  // For proper usage, the scrollY should be interpolated by the parent:
  // scrollY.interpolate({
  //   inputRange: [0, contentHeight - viewportHeight],
  //   outputRange: [0, 1],
  //   extrapolate: 'clamp',
  // })

  const widthInterpolated =
    scrollY && typeof (scrollY as any).interpolate === 'function'
      ? scrollY.interpolate({
          inputRange: [0, 1],
          outputRange: ['0%', '100%'],
          extrapolate: 'clamp',
        })
      : widthAnim.interpolate({
          inputRange: [0, 1],
          outputRange: ['0%', '100%'],
          extrapolate: 'clamp',
        });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          height,
          backgroundColor: barTrackColor,
          width: SCREEN_WIDTH,
        },
      ]}
      pointerEvents="none"
    >
      <Animated.View
        style={[
          styles.bar,
          {
            height,
            backgroundColor: barColor,
            width: widthInterpolated,
            borderRadius: height / 2,
          },
        ]}
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 100,
  },
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});

export default ReadingProgress;
