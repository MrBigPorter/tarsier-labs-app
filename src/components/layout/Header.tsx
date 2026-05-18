/**
 * Header — App navigation header bar
 *
 * Features:
 * - App logo + brand name (when no back) or back button (when nested)
 * - Settings icon → navigates to SettingsScreen
 * - Search icon → navigates to SearchScreen
 *
 * Architecture:
 * - Uses React Navigation's useNavigation for screen transitions
 * - Reads auth state from Redux for user avatar display
 * - Uses theme context for styling
 * - SafeArea-aware for notch/island devices
 *
 * Web reference:
 * - Logo + brand on left, Settings + Search on right (only 2 icons)
 * - Language/theme/user live in SettingsScreen
 */
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  StatusBar,
  Image,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/lib/theme/ThemeContext';
import { spacing } from '@/lib/theme/spacing';
import { typography } from '@/lib/theme/typography';
import SvgIcon from '../core/SvgIcon';

interface HeaderProps {
  /** Optional title override (defaults to "Tarsier") */
  title?: string;
  /** Whether to show the back button (auto-detected from navigation state) */
  showBack?: boolean;
  /** Callback when back is pressed (defaults to navigation.goBack) */
  onBackPress?: () => void;
  /** Hide the search icon */
  hideSearch?: boolean;
  /** Hide the settings gear icon */
  hideSettings?: boolean;
  /** Right-side action slot */
  rightAction?: React.ReactNode;
}

const Header: React.FC<HeaderProps> = ({
  title = 'Tarsier',
  showBack: showBackProp,
  onBackPress,
  hideSearch = false,
  hideSettings = false,
  rightAction,
}) => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { colors, isDark } = useTheme();

  // ─── Navigation helpers ───────────────────────────────────────────────

  const canGoBack = navigation.canGoBack();
  const showBack = showBackProp !== undefined ? showBackProp : canGoBack;

  // Calculate header height (without safe area)
  const headerHeight = Platform.OS === 'ios' ? 44 : 56;

  const handleBack = () => {
    if (onBackPress) {
      onBackPress();
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  const handleSearch = () => {
    navigation.navigate('Search');
  };

  const handleSettings = () => {
    navigation.navigate('Settings');
  };

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top,
          backgroundColor: colors.background,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />
      <View style={[styles.inner, { height: headerHeight }]}>
        {/* Left section: Logo + Brand or Back arrow */}
        <View style={styles.leftSection}>
          {showBack ? (
            <TouchableOpacity
              onPress={handleBack}
              style={styles.iconButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Go back"
              accessibilityRole="button"
            >
              <SvgIcon name="chevron-left" size={24} color={colors.text} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => navigation.navigate('Home')}
              style={styles.brandButton}
              activeOpacity={0.7}
              accessibilityLabel="Home"
              accessibilityRole="button"
            >
              <Image
                source={require('@assets/logo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
              <Text
                style={[
                  styles.brandText,
                  {
                    color: colors.text,
                    fontFamily: typography.h4.fontFamily,
                    fontSize: typography.h4.fontSize,
                    fontWeight: typography.h4.fontWeight,
                  },
                ]}
                numberOfLines={1}
              >
                Tarsier
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Center: Title (only shown when back button is visible) */}
        <View style={styles.centerSection}>
          {showBack && (
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
              numberOfLines={1}
              accessibilityRole="header"
            >
              {title}
            </Text>
          )}
        </View>

        {/* Right section: Actions */}
        <View style={styles.rightSection}>
          {rightAction}

          {!hideSettings && (
            <TouchableOpacity
              onPress={handleSettings}
              style={styles.iconButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Settings"
              accessibilityRole="button"
            >
              <SvgIcon name="settings" size={20} color={colors.text} />
            </TouchableOpacity>
          )}

          {!hideSearch && (
            <TouchableOpacity
              onPress={handleSearch}
              style={styles.iconButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Search articles"
              accessibilityRole="button"
            >
              <SvgIcon name="search" size={20} color={colors.text} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: 100,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  leftSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  centerSection: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  title: {
    textAlign: 'center',
  },
  iconButton: {
    padding: spacing.xs,
  },
  // ─── Brand / Logo styles ────────────────────────────────────────────
  brandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  logo: {
    width: 28,
    height: 28,
    borderRadius: 6,
  },
  brandText: {
    letterSpacing: -0.3,
  },
});

export default Header;
