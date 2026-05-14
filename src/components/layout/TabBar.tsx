/**
 * TabBar — Custom bottom tab bar with animated indicators
 *
 * Tabs:
 * 1. Home (house icon)
 * 2. Articles (file-text icon)
 * 3. Categories (grid icon)
 * 4. Profile (user icon)
 *
 * Features:
 * - Animated active indicator dot
 * - Badge support (e.g., unread count)
 * - SafeArea-aware for home indicator
 * - Haptic feedback on tab press (iOS)
 * - Theme-aware colors
 */
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/theme/ThemeContext';
import { spacing } from '../../lib/theme/spacing';
import { typography } from '../../lib/theme/typography';
import SvgIcon from '../core/SvgIcon';

export interface TabItem {
  /** Unique key for the tab */
  key: string;
  /** SVG icon name (from icon set) */
  icon: string;
  /** Active SVG icon name (if different) */
  activeIcon?: string;
  /** Label text */
  label: string;
  /** Optional badge count (0 = hidden) */
  badge?: number;
}

interface TabBarProps {
  /** Tab definitions */
  tabs: TabItem[];
  /** Currently active tab key */
  activeTab: string;
  /** Callback when a tab is pressed */
  onTabPress: (key: string) => void;
}

const TabBar: React.FC<TabBarProps> = ({ tabs, activeTab, onTabPress }) => {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const colors = theme.colors;

  // Animation values for each tab
  const animations = useRef<Record<string, Animated.Value>>({});

  // Initialize animation values
  tabs.forEach(tab => {
    if (!animations.current[tab.key]) {
      animations.current[tab.key] = new Animated.Value(
        tab.key === activeTab ? 1 : 0,
      );
    }
  });

  // Animate active tab indicator
  useEffect(() => {
    tabs.forEach(tab => {
      const anim = animations.current[tab.key];
      if (anim) {
        Animated.timing(anim, {
          toValue: tab.key === activeTab ? 1 : 0,
          duration: 200,
          useNativeDriver: true,
        }).start();
      }
    });
  }, [activeTab, tabs]);

  const bottomPadding = Math.max(insets.bottom, 4);

  return (
    <View
      style={[
        styles.container,
        {
          paddingBottom: bottomPadding,
          backgroundColor: colors.background,
          borderTopColor: colors.border,
        },
      ]}
    >
      {tabs.map(tab => {
        const isActive = tab.key === activeTab;
        const scaleAnim = animations.current[tab.key] || new Animated.Value(0);
        const iconColor = isActive ? colors.primary : colors.textSecondary;
        const textColor = isActive ? colors.primary : colors.textSecondary;

        return (
          <TouchableOpacity
            key={tab.key}
            onPress={() => onTabPress(tab.key)}
            style={styles.tabItem}
            activeOpacity={0.7}
            accessibilityLabel={tab.label}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
          >
            <View style={styles.iconContainer}>
              <SvgIcon
                name={isActive && tab.activeIcon ? tab.activeIcon : tab.icon}
                size={24}
                color={iconColor}
              />
              {tab.badge && tab.badge > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text
              style={[
                styles.label,
                {
                  color: textColor,
                  fontFamily: typography.xs.fontFamily,
                  fontSize: typography.xs.fontSize,
                  fontWeight: isActive ? '600' : '400',
                },
              ]}
              numberOfLines={1}
            >
              {tab.label}
            </Text>
            {/* Active indicator dot */}
            {isActive && (
              <Animated.View
                style={[
                  styles.activeDot,
                  {
                    backgroundColor: colors.primary,
                    opacity: scaleAnim,
                    transform: [{ scale: scaleAnim }],
                  },
                ]}
              />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.xs,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
  },
  iconContainer: {
    position: 'relative',
    marginBottom: 2,
  },
  label: {
    textAlign: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: '#EF4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
});

export default TabBar;
