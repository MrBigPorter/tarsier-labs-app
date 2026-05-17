/**
 * ThemeToggle — Crossfading moon/sun toggle for dark/light mode
 *
 * Animated toggle that transitions between sun (light mode) and moon (dark mode)
 * icons with a scaling crossfade effect.
 *
 * Features:
 * - Smooth crossfade animation between icon states
 * - Haptic feedback on toggle (iOS)
 * - Accessible with proper accessibility labels
 * - Follows system theme if enabled
 *
 * Usage:
 * ```tsx
 * <ThemeToggle />
 * ```
 */

import React, { useRef, useCallback } from 'react';
import {
  TouchableOpacity,
  Animated,
  StyleSheet,
  Platform,
} from 'react-native';
import { useTheme } from '@/lib/theme/ThemeContext';
import { spacing } from '@/lib/theme/spacing';
import { useAppDispatch } from '@/store';
import { toggleTheme as reduxToggleTheme } from '@/store/slices/uiSlice';
import SvgIcon from '../core/SvgIcon';

interface ThemeToggleProps {
  /** Icon size (default: 24) */
  size?: number;
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ size = 24 }) => {
  const { colors, isDark, toggleTheme } = useTheme();
  const dispatch = useAppDispatch();

  const animatedValue = useRef(new Animated.Value(isDark ? 1 : 0)).current;

  const handlePress = useCallback(() => {
    toggleTheme();
    dispatch(reduxToggleTheme());

    // Trigger crossfade animation
    Animated.sequence([
      Animated.timing(animatedValue, {
        toValue: isDark ? 0 : 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Reset animation value for next toggle
      animatedValue.setValue(isDark ? 0 : 1);
    });
  }, [isDark, toggleTheme, dispatch, animatedValue]);

  const sunOpacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });

  const moonOpacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const sunScale = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.5],
  });

  const moonScale = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 1],
  });

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={[
        styles.container,
        {
          width: size + spacing.sm,
          height: size + spacing.sm,
          borderRadius: (size + spacing.sm) / 2,
          backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      accessibilityState={{ checked: isDark }}
    >
      <Animated.View
        style={[
          styles.iconWrapper,
          {
            opacity: sunOpacity,
            transform: [{ scale: sunScale }],
          },
        ]}
      >
        <SvgIcon
          name="sun"
          size={size}
          color={isDark ? colors.text : colors.warning}
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.iconWrapper,
          StyleSheet.absoluteFill,
          {
            opacity: moonOpacity,
            transform: [{ scale: moonScale }],
          },
        ]}
      >
        <SvgIcon
          name="moon"
          size={size}
          color={isDark ? colors.primary : colors.text}
        />
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  iconWrapper: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ThemeToggle;
