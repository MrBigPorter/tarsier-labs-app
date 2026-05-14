import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Animated,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useAppSelector, useAppDispatch } from '../../store';
import { setOnlineStatus } from '../../store/slices/uiSlice';
import { useTheme } from '../../lib/theme/ThemeContext';
import { spacing, borderRadius } from '../../lib/theme/spacing';
import { typography } from '../../lib/theme/typography';
import { logger } from '../../lib/logger';

// @react-native-community/netinfo provides network state detection
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

/**
 * Network status indicator bar.
 *
 * Renders a floating bar at the top of the screen when the device goes offline.
 * Automatically hides when connectivity is restored.
 *
 * Usage:
 *   <NetworkStatusBar />
 *
 * Must be placed inside a View that supports absolute positioning,
 * typically at the root of your navigation container.
 */
export function NetworkStatusBar() {
  const dispatch = useAppDispatch();
  const isOnline = useAppSelector((state) => state.ui.isOnline);
  const { colors } = useTheme();
  const slideAnim = useRef(new Animated.Value(isOnline ? -60 : 0)).current;
  const wasOffline = useRef(false);

  // Subscribe to network state changes via NetInfo
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const connected = state.isConnected ?? true;
      const wasConnected = !wasOffline.current;

      if (connected !== wasConnected) {
        logger.info(`[Network] ${connected ? 'Online' : 'Offline'}`);
        dispatch(setOnlineStatus(connected));
      }

      wasOffline.current = !connected;
    });

    return () => unsubscribe();
  }, [dispatch]);

  // Animate the bar in/out based on online status
  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isOnline ? -60 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isOnline, slideAnim]);

  const handleRefresh = () => {
    // Re-check network state manually
    NetInfo.fetch().then((state) => {
      dispatch(setOnlineStatus(state.isConnected ?? true));
    });
  };

  if (isOnline) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: colors.warning,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={styles.content}>
        <Text style={styles.icon}>⚠️</Text>
        <Text style={styles.text}>No internet connection</Text>
        <TouchableOpacity
          onPress={handleRefresh}
          style={[
            styles.refreshButton,
            { backgroundColor: colors.warning + 'CC' },
          ]}
          activeOpacity={0.7}
        >
          <Text style={styles.refreshText}>Retry</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    paddingTop: spacing[2],
    paddingBottom: spacing[2],
    paddingHorizontal: spacing[4],
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
  },
  icon: {
    fontSize: 14,
  },
  text: {
    color: '#FFFFFF',
    fontSize: typography.small.fontSize,
    fontWeight: '600',
    flex: 1,
  },
  refreshButton: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.sm,
  },
  refreshText: {
    color: '#FFFFFF',
    fontSize: typography.xs.fontSize,
    fontWeight: '700',
  },
});
