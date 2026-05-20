/**
 * SearchBar — Animated search input with debounced callback
 *
 * Features:
 * - Auto-focus input on mount (controlled via autoFocus prop)
 * - Clear button when text is present
 * - Debounced onChangeText (default 300ms)
 * - Animated placeholder fade-in/out
 * - Backdrop overlay when focused (for full-screen search UX)
 * - Cancel/dismiss button
 * - Theme-aware styling
 *
 * Usage:
 *   <SearchBar
 *     value={query}
 *     onChangeText={setQuery}
 *     onSubmit={handleSearch}
 *     placeholder="Search articles..."
 *   />
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  Animated,
  Keyboard,
} from 'react-native';
import { useTheme } from '@/lib/theme/ThemeContext';
import { spacing } from '@/lib/theme/spacing';
import { typography } from '@/lib/theme/typography';
import SvgIcon from '../core/SvgIcon';

interface SearchBarProps {
  /** Current search query value */
  value: string;
  /** Callback when text changes (debounced) */
  onChangeText?: (text: string) => void;
  /** Callback when search is submitted */
  onSubmit?: (text: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Debounce delay in milliseconds (default: 300) */
  debounceMs?: number;
  /** Auto-focus the input on mount */
  autoFocus?: boolean;
  /** Show cancel button */
  showCancel?: boolean;
  /** Cancel button text */
  cancelText?: string;
  /** Callback when cancel/dismiss is pressed */
  onCancel?: () => void;
  /** Whether to show a backdrop overlay */
  showBackdrop?: boolean;
  /** Callback when backdrop is pressed */
  onBackdropPress?: () => void;
}

const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChangeText,
  onSubmit,
  placeholder = 'Search...',
  debounceMs = 300,
  autoFocus = false,
  showCancel = false,
  cancelText = 'Cancel',
  onCancel,
  showBackdrop = false,
  onBackdropPress,
}) => {
  const { colors, isDark } = useTheme();
  const inputRef = useRef<TextInput>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [localValue, setLocalValue] = useState(value);
  const [isFocused, setIsFocused] = useState(false);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const borderColorAnim = useRef(new Animated.Value(0)).current;

  // Sync external value changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Animate backdrop when visibility changes
  useEffect(() => {
    Animated.timing(backdropOpacity, {
      toValue: showBackdrop && isFocused ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [showBackdrop, isFocused, backdropOpacity]);

  // Animate border color on focus
  useEffect(() => {
    Animated.timing(borderColorAnim, {
      toValue: isFocused ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [isFocused, borderColorAnim]);

  const handleChangeText = useCallback(
    (text: string) => {
      setLocalValue(text);
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      debounceTimer.current = setTimeout(() => {
        onChangeText?.(text);
      }, debounceMs);
    },
    [onChangeText, debounceMs],
  );

  const handleClear = useCallback(() => {
    setLocalValue('');
    onChangeText?.('');
    inputRef.current?.focus();
  }, [onChangeText]);

  const handleSubmitEditing = useCallback(() => {
    onSubmit?.(localValue);
    Keyboard.dismiss();
  }, [onSubmit, localValue]);

  const handleCancel = useCallback(() => {
    Keyboard.dismiss();
    setLocalValue('');
    onChangeText?.('');
    onCancel?.();
  }, [onCancel, onChangeText]);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
  }, []);

  const handleBackdropPress = useCallback(() => {
    Keyboard.dismiss();
    onBackdropPress?.();
  }, [onBackdropPress]);

  // Interpolate border color
  const borderColor = borderColorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.border, colors.primary],
  });

  return (
    <View style={styles.wrapper}>
      {/* Backdrop overlay */}
      {showBackdrop && (
        <Animated.View
          style={[
            styles.backdrop,
            // eslint-disable-next-line react-native/no-inline-styles
            {
              backgroundColor: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.3)',
              opacity: backdropOpacity,
            },
          ]}
          pointerEvents={showBackdrop && isFocused ? 'auto' : 'none'}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={handleBackdropPress}
            activeOpacity={1}
          />
        </Animated.View>
      )}

      {/* Search bar container */}
      <View style={styles.container}>
        <View style={styles.row}>
          {/* Search input */}
          <Animated.View
            style={[
              styles.inputContainer,
              {
                backgroundColor: colors.surface,
                borderColor,
              },
            ]}
          >
            <SvgIcon name="search" size={20} color={colors.textSecondary} />
            <TextInput
              ref={inputRef}
              style={[
                styles.input,
                {
                  color: colors.text,
                  fontFamily: typography.base.fontFamily,
                  fontSize: typography.base.fontSize,
                },
              ]}
              value={localValue}
              onChangeText={handleChangeText}
              onSubmitEditing={handleSubmitEditing}
              onFocus={handleFocus}
              onBlur={handleBlur}
              placeholder={placeholder}
              placeholderTextColor={colors.textSecondary}
              returnKeyType="search"
              autoFocus={autoFocus}
              autoCorrect={false}
              autoCapitalize="none"
              clearButtonMode="never"
              accessibilityLabel="Search input"
              accessibilityRole="search"
            />
            {localValue.length > 0 && (
              <TouchableOpacity
                onPress={handleClear}
                style={styles.clearButton}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel="Clear search"
                accessibilityRole="button"
              >
                <SvgIcon name="x" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </Animated.View>

          {/* Cancel button */}
          {showCancel && isFocused && (
            <TouchableOpacity
              onPress={handleCancel}
              style={styles.cancelButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Cancel search"
              accessibilityRole="button"
            >
              <Text
                style={[
                  styles.cancelText,
                  {
                    color: colors.primary,
                    fontFamily: typography.base.fontFamily,
                    fontSize: typography.base.fontSize,
                  },
                ]}
              >
                {cancelText}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    zIndex: 100,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    zIndex: 98,
  },
  container: {
    zIndex: 99,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    height: 44,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  input: {
    flex: 1,
    marginLeft: spacing.xs,
    paddingVertical: 0,
    height: '100%',
  },
  clearButton: {
    padding: 4,
    marginLeft: spacing.xs,
  },
  cancelButton: {
    marginLeft: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  cancelText: {
    fontWeight: '500',
  },
});

export default SearchBar;
