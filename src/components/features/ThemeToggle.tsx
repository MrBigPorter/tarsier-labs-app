/**
 * ThemeToggle — Animated sun/moon theme switch button
 *
 * Provides a pressable icon button that:
 * - Shows a sun icon in light mode, moon icon in dark mode
 * - Animates a 360° rotation on toggle (sun → moon transition)
 * - Applies a subtle scale pulse (1.0 → 1.3 → 1.0 spring) on press
 * - Dispatches toggleTheme from ThemeContext + Redux uiSlice
 *
 * Usage:
 * ```tsx
 * <ThemeToggle size={32} />
 * ```
 *
 * Can be used in Header, Settings, or anywhere theme switching is needed.
 */

import React, { useCallback, useRef } from 'react';
import {
  TouchableOpacity,
  Animated,
  StyleSheet,
} from 'react-native';
import { useTheme } from '../../lib/theme/ThemeContext';
import { spacing } from '../../lib/theme/spacing';
import { useAppDispatch } from '../../store';
import { toggleTheme as reduxToggleTheme } from '../../store/slices/uiSlice';
import SvgIcon from '../core/SvgIcon';

interface ThemeToggleProps {
  /** Icon size in pixels (default: 28) */
  size?: number;
  /** Optional custom onToggle callback */
  onToggle?: () => void;
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({
  size = 28,
  onToggle,
}) => {
  const { theme, toggleTheme } = useTheme();
  const colors = theme.colors;
  const dispatch = useAppDispatch();

  // Animation values
  const rotationAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = useCallback(() => {
    // 1. Scale pulse animation
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 1.3,
        useNativeDriver: true,
        friction: 4,
        tension: 100,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 3,
        tension: 200,
      }),
    ]).start();

    // 2. Rotation animation (full 360° spin)
    Animated.timing(rotationAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start(() => {
      // Reset rotation value for next toggle
      rotationAnim.setValue(0);
    });

    // 3. Toggle theme in both ThemeContext and Redux
    toggleTheme();
    dispatch(reduxToggleTheme());

    // 4. Optional external callback
    onToggle?.();
  }, [toggleTheme, dispatch, onToggle, rotationAnim, scaleAnim]);

  const rotateInterpolation = rotationAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={[
        styles.button,
        {
          width: size + spacing.md,
          height: size + spacing.md,
          borderRadius: (size + spacing.md) / 2,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={
        theme.dark ? 'Switch to light mode' : 'Switch to dark mode'
      }
      accessibilityState={{ checked: theme.dark }}
      activeOpacity={0.7}
    >
      <Animated.View
        style={[
          styles.iconContainer,
          {
            transform: [
              { rotate: rotateInterpolation },
              { scale: scaleAnim },
            ],
          },
        ]}
      >
        <SvgIcon
          name={theme.dark ? 'moon' : 'sun'}
          size={size}
          color={theme.dark ? colors.primary : colors.neutral['700']}
          strokeWidth={2}
        />
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ThemeToggle;
