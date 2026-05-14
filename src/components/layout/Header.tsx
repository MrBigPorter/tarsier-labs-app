/**
 * Header — App navigation header bar
 *
 * Features:
 * - App logo/title with navigation back button (on nested screens)
 * - Search icon → navigates to SearchScreen
 * - Notification bell (unread count badge)
 * - User avatar (or login prompt)
 * - Language/theme quick-access icons
 *
 * Architecture:
 * - Uses React Navigation's useNavigation for screen transitions
 * - Reads auth state from Redux for user avatar display
 * - Uses theme context for styling
 * - SafeArea-aware for notch/island devices
 */
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  StatusBar,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/theme/ThemeContext';
import { spacing } from '../../lib/theme/spacing';
import { typography } from '../../lib/theme/typography';
import { useAppSelector } from '../../store';
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
  /** Hide the user avatar */
  hideAvatar?: boolean;
  /** Right-side action slot */
  rightAction?: React.ReactNode;
}

const Header: React.FC<HeaderProps> = ({
  title = 'Tarsier',
  showBack: showBackProp,
  onBackPress,
  hideSearch = false,
  hideAvatar = false,
  rightAction,
}) => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { theme } = useTheme();
  const colors = theme.colors;
  const user = useAppSelector(state => state.auth.user);

  // Auto-detect if we should show back button (not on main screens)
  const canGoBack = navigation.canGoBack();
  const showBack = showBackProp !== undefined ? showBackProp : canGoBack;

  const handleBack = () => {
    if (onBackPress) {
      onBackPress();
    } else {
      navigation.goBack();
    }
  };

  const handleSearch = () => {
    navigation.navigate('Search');
  };

  const handleAvatar = () => {
    if (user) {
      navigation.navigate('Profile');
    } else {
      navigation.navigate('Auth');
    }
  };

  const headerHeight = Platform.OS === 'ios' ? 44 : 56;

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
        barStyle={theme.dark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />
      <View style={[styles.inner, { height: headerHeight }]}>
        {/* Left section: Back or Spacer */}
        <View style={styles.leftSection}>
          {showBack ? (
            <TouchableOpacity
              onPress={handleBack}
              style={styles.iconButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Go back"
              accessibilityRole="button"
            >
              <SvgIcon
                name="chevron-left"
                size={24}
                color={colors.text}
              />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Center: Title or Logo */}
        <View style={styles.centerSection}>
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
        </View>

        {/* Right section: Actions */}
        <View style={styles.rightSection}>
          {rightAction}

          {!hideSearch && (
            <TouchableOpacity
              onPress={handleSearch}
              style={styles.iconButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Search articles"
              accessibilityRole="button"
            >
              <SvgIcon
                name="search"
                size={22}
                color={colors.text}
              />
            </TouchableOpacity>
          )}

          {!hideAvatar && (
            <TouchableOpacity
              onPress={handleAvatar}
              style={styles.avatarButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel={user ? 'View profile' : 'Sign in'}
              accessibilityRole="button"
            >
              {user?.avatar ? (
                <View
                  style={[
                    styles.avatar,
                    { borderColor: colors.border },
                  ]}
                >
                  <Text style={[styles.avatarPlaceholder, { color: colors.textSecondary }]}>
                    {user.nickname?.charAt(0)?.toUpperCase() || '?'}
                  </Text>
                </View>
              ) : (
                <SvgIcon
                  name="user"
                  size={22}
                  color={colors.text}
                />
              )}
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
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  leftSection: {
    width: 48,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  centerSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  avatarButton: {
    padding: spacing.xs,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlaceholder: {
    fontSize: 13,
    fontWeight: '600',
  },
});

export default Header;
