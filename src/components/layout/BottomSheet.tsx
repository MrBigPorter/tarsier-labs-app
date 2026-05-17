/**
 * BottomSheet — Reusable bottom sheet modal
 *
 * Features:
 * - Smooth slide-up/down animation
 * - Drag handle for gesture-based dismissal
 * - Backdrop overlay with tap-to-dismiss
 * - Optional title and subtitle
 * - Configurable height (default: 40%)
 * - ScrollView content support
 * - SafeArea-aware bottom padding
 * - Theme-aware styling
 *
 * Usage:
 *   <BottomSheet
 *     visible={isVisible}
 *     onClose={handleClose}
 *     title="Select Language"
 *   >
 *     <LanguagePicker />
 *   </BottomSheet>
 */
import React, { useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  PanResponder,
  Dimensions,
  Keyboard,
  Platform,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/lib/theme/ThemeContext';
import { spacing } from '@/lib/theme/spacing';
import { typography } from '@/lib/theme/typography';

interface BottomSheetProps {
  /** Whether the sheet is visible */
  visible: boolean;
  /** Callback when sheet is dismissed */
  onClose: () => void;
  /** Optional title */
  title?: string;
  /** Optional subtitle */
  subtitle?: string;
  /** Sheet height as percentage of screen (0-1, default: 0.4) */
  heightRatio?: number;
  /** Maximum height in pixels (overrides heightRatio if set) */
  maxHeight?: number;
  /** Whether to show the drag handle */
  showHandle?: boolean;
  /** Whether tapping backdrop dismisses (default: true) */
  dismissOnBackdrop?: boolean;
  /** Whether dragging dismisses (default: true) */
  dismissOnDrag?: boolean;
  /** Children content */
  children: React.ReactNode;
  /** Whether to use ScrollView for content */
  scrollable?: boolean;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const DRAG_THRESHOLD = 80; // px to drag down before dismissing
const ANIMATION_DURATION = 250;

const BottomSheet: React.FC<BottomSheetProps> = ({
  visible,
  onClose,
  title,
  subtitle,
  heightRatio = 0.4,
  maxHeight,
  showHandle = true,
  dismissOnBackdrop = true,
  dismissOnDrag = true,
  children,
  scrollable = false,
}) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  // Calculate sheet height
  const calculatedHeight = Math.min(
    maxHeight || SCREEN_HEIGHT * heightRatio,
    SCREEN_HEIGHT * 0.9,
  );

  // Animation values
  const translateY = useRef(new Animated.Value(calculatedHeight)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const dragY = useRef(new Animated.Value(0)).current;

  // Track whether sheet is mounted for cleanup
  const isMounted = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Animate in/out
  useEffect(() => {
    if (visible) {
      Keyboard.dismiss();
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: ANIMATION_DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: ANIMATION_DURATION,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: calculatedHeight,
          duration: ANIMATION_DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: ANIMATION_DURATION,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, calculatedHeight, translateY, backdropOpacity]);

  // Pan responder for drag-to-dismiss
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to downward drag
        return gestureState.dy > 5;
      },
      onPanResponderMove: (_, gestureState) => {
        // Allow drag down only (clamp to 0 upwards)
        const offset = Math.max(0, gestureState.dy);
        dragY.setValue(offset);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (dismissOnDrag && gestureState.dy > DRAG_THRESHOLD) {
          // Dismiss
          Animated.parallel([
            Animated.timing(translateY, {
              toValue: calculatedHeight,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.timing(backdropOpacity, {
              toValue: 0,
              duration: 200,
              useNativeDriver: true,
            }),
          ]).start(() => {
            if (isMounted.current) {
              dragY.setValue(0);
              onClose();
            }
          });
        } else {
          // Snap back
          Animated.spring(dragY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 8,
          }).start();
        }
      },
    }),
  ).current;

  const handleBackdropPress = useCallback(() => {
    if (dismissOnBackdrop) {
      onClose();
    }
  }, [dismissOnBackdrop, onClose]);

  if (!visible) {
    return null;
  }

  const totalTranslateY = Animated.add(translateY, dragY);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Backdrop */}
      <Animated.View
        style={[
          styles.backdrop,
          {
            backgroundColor: isDark
              ? 'rgba(0,0,0,0.6)'
              : 'rgba(0,0,0,0.4)',
            opacity: backdropOpacity,
          },
        ]}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          onPress={handleBackdropPress}
          activeOpacity={1}
          accessibilityLabel="Close"
          accessibilityRole="button"
        />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        style={[
          styles.sheet,
          {
            height: calculatedHeight + insets.bottom,
            backgroundColor: colors.background,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            transform: [{ translateY: totalTranslateY }],
          },
        ]}
      >
        {/* Drag handle */}
        {showHandle && (
          <View
            {...panResponder.panHandlers}
            style={styles.handleArea}
            accessibilityLabel="Drag to dismiss"
            accessibilityRole="adjustable"
          >
            <View
              style={[
                styles.handle,
                { backgroundColor: colors.textSecondary },
              ]}
            />
          </View>
        )}

        {/* Title */}
        {title && (
          <View style={styles.titleContainer}>
            <Text
              style={[
                styles.title,
                {
                  color: colors.text,
                  fontFamily: typography.h4.fontFamily,
                  fontSize: typography.h4.fontSize,
                  fontWeight: typography.h4.fontWeight,
                },
              ]}
              accessibilityRole="header"
            >
              {title}
            </Text>
            {subtitle && (
              <Text
                style={[
                  styles.subtitle,
                  {
                    color: colors.textSecondary,
                    fontFamily: typography.small.fontFamily,
                    fontSize: typography.small.fontSize,
                  },
                ]}
              >
                {subtitle}
              </Text>
            )}
          </View>
        )}

        {/* Content */}
        <View style={styles.contentContainer}>
          {scrollable ? (
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.scrollContent}
            >
              {children}
            </ScrollView>
          ) : (
            children
          )}
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 24,
      },
    }),
  },
  handleArea: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingTop: spacing.sm,
  },
  handle: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
  },
  titleContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: {
    marginBottom: spacing.xs,
  },
  subtitle: {
    lineHeight: 18,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  scrollContent: {
    paddingBottom: spacing.lg,
  },
});

export default BottomSheet;
