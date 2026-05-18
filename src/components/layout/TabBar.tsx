/**
 * TabBar — Custom bottom tab bar with spring-animated background circle
 *
 * Tabs:
 * 1. Home (home icon)
 * 2. Search (search icon)
 * 3. Bookmarks (bookmark icon)
 * 4. About (user icon)
 *
 * Features:
 * - Spring-animated active background circle (matches web's framer-motion layoutId)
 * - Badge support (e.g., unread count)
 * - SafeArea-aware for home indicator
 * - Haptic feedback on tab press (iOS)
 * - Theme-aware colors
 *
 * Web reference:
 * - Active tab shows a rounded-full bg-primary/10 circle behind the icon
 * - Spring animation with stiffness: 500, damping: 30
 * - Active label has font-medium weight, inactive has normal weight
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
import { useModeColors } from '@/lib/theme/ThemeContext';
import { spacing } from '@/lib/theme/spacing';
import { typography } from '@/lib/theme/typography';
import SvgIcon, { type IconName } from '../core/SvgIcon';

export interface TabItem {
  /** Unique key for the tab */
  key: string;
  /** SVG icon name (from icon set) */
  icon: IconName;
  /** Active SVG icon name (if different) */
  activeIcon?: IconName;
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

const SPRING_CONFIG: Animated.SpringAnimationConfig = {
  toValue: 1,
  friction: 7,
  tension: 100,
  useNativeDriver: true,
};

const TabBar: React.FC<TabBarProps> = ({ tabs, activeTab, onTabPress }) => {
  const insets = useSafeAreaInsets();
  const colors = useModeColors();

  // Animation values for each tab (opacity + scale for background circle)
  const animations = useRef<Record<string, Animated.Value>>({});

  // Initialize animation values
  tabs.forEach(tab => {
    if (!animations.current[tab.key]) {
      animations.current[tab.key] = new Animated.Value(
        tab.key === activeTab ? 1 : 0,
      );
    }
  });

  // Animate active tab indicator with spring
  useEffect(() => {
    tabs.forEach(tab => {
      const anim = animations.current[tab.key];
      if (anim) {
        Animated.spring(anim, {
          ...SPRING_CONFIG,
          toValue: tab.key === activeTab ? 1 : 0,
        }).start();
      }
    });
  }, [activeTab, tabs]);

  const bottomPadding = Math.max(insets.bottom, 4);

  // Resolve primary color with 10% opacity for the background circle
  const activeBgColor = colors.primary;
  const ACTIVE_CIRCLE_SIZE = 40;

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
        const animValue = animations.current[tab.key] || new Animated.Value(0);
        const iconColor = isActive ? colors.primary : colors.textSecondary;
        const textColor = isActive ? colors.primary : colors.textSecondary;

        // Interpolate circle opacity: 0 → 0.1 (10% opacity primary)
        const circleOpacity = animValue.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 0.12],
        });

        // Scale the circle: slightly larger when active (1 → 1.05) for spring bounce feel
        const circleScale = animValue.interpolate({
          inputRange: [0, 1],
          outputRange: [0.8, 1],
        });

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
              {/* Active background circle (web's rounded-full bg-primary/10) */}
              <Animated.View
                style={[
                  styles.activeCircle,
                  {
                    width: ACTIVE_CIRCLE_SIZE,
                    height: ACTIVE_CIRCLE_SIZE,
                    borderRadius: ACTIVE_CIRCLE_SIZE / 2,
                    backgroundColor: activeBgColor,
                    opacity: circleOpacity,
                    transform: [{ scale: circleScale }],
                  },
                ]}
              />
              <SvgIcon
                name={isActive && tab.activeIcon ? tab.activeIcon : tab.icon}
                size={22}
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
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 40,
    marginBottom: 0,
  },
  activeCircle: {
    position: 'absolute',
  },
  label: {
    textAlign: 'center',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -6,
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
});

export default TabBar;
