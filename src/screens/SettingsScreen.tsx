/**
 * SettingsScreen — App settings
 *
 * Sections:
 * 1. Appearance (theme toggle, language selection)
 * 2. Reading (font size, line spacing)
 * 3. Notifications (push notification toggles)
 * 4. Data (clear cache, export data)
 * 5. Account (sign out, delete account)
 * 6. About link
 *
 * Each setting item is a row with label, value, and action.
 * Uses BottomSheet for selection (language, theme).
 *
 * Edge cases:
 * - Not logged in: hide account section items
 * - Confirm dialog for destructive actions (clear cache, sign out)
 */
import React, { useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../lib/theme/ThemeContext';
import { spacing } from '../lib/theme/spacing';
import { typography } from '../lib/theme/typography';
import { storage } from '../lib/storage';
import { useAppSelector, useAppDispatch } from '../store';
import { logout } from '../store/slices/authSlice';
import { clearCache } from '../store/slices/bookmarksSlice';
import { changeLanguage, getCurrentLanguage } from '../lib/i18n';
import Header from '../components/layout/Header';
import BottomSheet from '../components/layout/BottomSheet';
import SvgIcon from '../components/core/SvgIcon';
import type { ProfileTabScreenProps } from '../navigation/types';

interface SettingRowProps {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  destructive?: boolean;
}

const SettingRow: React.FC<SettingRowProps> = ({
  icon,
  label,
  value,
  onPress,
  rightElement,
  destructive = false,
}) => {
  const { theme } = useTheme();
  const colors = theme.colors;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress && !rightElement}
      style={[
        styles.settingRow,
        { borderBottomColor: colors.border },
      ]}
      activeOpacity={onPress ? 0.6 : 1}
    >
      <View style={styles.settingLeft}>
        <SvgIcon
          name={icon as any}
          size={20}
          color={destructive ? '#EF4444' : colors.textSecondary}
        />
        <Text
          style={[
            styles.settingLabel,
            {
              color: destructive ? '#EF4444' : colors.text,
            },
          ]}
        >
          {label}
        </Text>
      </View>
      <View style={styles.settingRight}>
        {value && (
          <Text
            style={[
              styles.settingValue,
              { color: colors.textSecondary },
            ]}
          >
            {value}
          </Text>
        )}
        {rightElement}
        {onPress && !rightElement && (
          <SvgIcon
            name="chevron-right"
            size={16}
            color={colors.textSecondary}
          />
        )}
      </View>
    </TouchableOpacity>
  );
};

interface SectionHeaderProps {
  title: string;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ title }) => {
  const { theme } = useTheme();
  const colors = theme.colors;

  return (
    <Text
      style={[
        styles.sectionHeader,
        { color: colors.textSecondary },
      ]}
    >
      {title.toUpperCase()}
    </Text>
  );
};

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'zh', label: '中文' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
];

const SettingsScreen: React.FC<ProfileTabScreenProps<'Settings'>> = ({
  navigation,
}) => {
  const insets = useSafeAreaInsets();
  const { theme, toggleTheme } = useTheme();
  const colors = theme.colors;
  const dispatch = useAppDispatch();

  const isAuthenticated = useAppSelector(state => state.auth.isAuthenticated);
  const user = useAppSelector(state => state.auth.user);

  // Local state
  const [showLanguageSheet, setShowLanguageSheet] = useState(false);
  const [currentLang, setCurrentLang] = useState(getCurrentLanguage());

  // Sync language from i18n on mount
  useEffect(() => {
    setCurrentLang(getCurrentLanguage());
  }, []);

  // ─── Handlers ───────────────────────────────────────────────────────

  const handleClearCache = useCallback(() => {
    Alert.alert(
      'Clear Cache',
      'This will clear all cached data including bookmarks. You can re-download it anytime.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            storage.clearAll?.();
            dispatch(clearCache());
          },
        },
      ],
    );
  }, [dispatch]);

  const handleSignOut = useCallback(() => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out? Your bookmarks will be saved locally.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => dispatch(logout()),
        },
      ],
    );
  }, [dispatch]);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      'Delete Account',
      'This action is irreversible. All your data will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            // TODO: API call to delete account
            dispatch(logout());
          },
        },
      ],
    );
  }, [dispatch]);

  const handleLanguageSelect = useCallback(
    (langCode: string) => {
      setCurrentLang(langCode);
      setShowLanguageSheet(false);
      changeLanguage(langCode);
    },
    [],
  );

  const handleNavigateTo = useCallback(
    (screen: string) => {
      (navigation.getParent() as any)?.navigate(screen);
    },
    [navigation],
  );

  // ─── Main render ────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="Settings" showBack />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Appearance ──────────────────────────────────────────── */}
        <SectionHeader title="Appearance" />
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <SettingRow
            icon={theme.isDark ? 'moon' : 'sun'}
            label="Dark Mode"
            rightElement={
              <Switch
                value={theme.isDark}
                onValueChange={toggleTheme}
                trackColor={{
                  false: colors.border,
                  true: colors.primary + '60',
                }}
                thumbColor={theme.isDark ? colors.primary : '#f4f3f4'}
              />
            }
          />
          <SettingRow
            icon="globe"
            label="Language"
            value={LANGUAGES.find(l => l.code === currentLang)?.label || 'English'}
            onPress={() => setShowLanguageSheet(true)}
          />
        </View>

        {/* ─── Reading ─────────────────────────────────────────────── */}
        <SectionHeader title="Reading" />
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <SettingRow
            icon="file-text"
            label="Font Size"
            value="Default"
          />
        </View>

        {/* ─── Notifications ───────────────────────────────────────── */}
        <SectionHeader title="Notifications" />
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <SettingRow
            icon="bell"
            label="Push Notifications"
            rightElement={
              <Switch
                value={false}
                trackColor={{
                  false: colors.border,
                  true: colors.primary + '60',
                }}
                thumbColor={colors.primary}
              />
            }
          />
        </View>

        {/* ─── Data ────────────────────────────────────────────────── */}
        <SectionHeader title="Data" />
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <SettingRow
            icon="refresh-cw"
            label="Clear Cache"
            onPress={handleClearCache}
          />
        </View>

        {/* ─── Account ─────────────────────────────────────────────── */}
        {isAuthenticated && (
          <>
            <SectionHeader title="Account" />
            <View style={[styles.section, { backgroundColor: colors.surface }]}>
              {user && (
                <SettingRow
                  icon="user"
                  label={`Signed in as ${user.nickname}`}
                  value={user.email}
                />
              )}
              <SettingRow
                icon="x"
                label="Sign Out"
                onPress={handleSignOut}
                destructive
              />
              <SettingRow
                icon="alert-circle"
                label="Delete Account"
                onPress={handleDeleteAccount}
                destructive
              />
            </View>
          </>
        )}

        {/* ─── Info ────────────────────────────────────────────────── */}
        <SectionHeader title="Info" />
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <SettingRow
            icon="info"
            label="About Tarsier"
            onPress={() => handleNavigateTo('About')}
          />
          <SettingRow
            icon="external-link"
            label="Privacy Policy"
            onPress={() => {
              // TODO: Open privacy policy URL
            }}
          />
        </View>
      </ScrollView>

      {/* ─── Language Bottom Sheet ─────────────────────────────────── */}
      <BottomSheet
        visible={showLanguageSheet}
        onClose={() => setShowLanguageSheet(false)}
        title="Select Language"
        heightRatio={0.5}
      >
        {LANGUAGES.map(lang => {
          const isSelected = lang.code === currentLang;
          return (
            <TouchableOpacity
              key={lang.code}
              onPress={() => handleLanguageSelect(lang.code)}
              style={[
                styles.langItem,
                { borderBottomColor: colors.border },
              ]}
            >
              <Text
                style={[
                  styles.langText,
                  {
                    color: isSelected ? colors.primary : colors.text,
                    fontWeight: isSelected ? '600' : '400',
                  },
                ]}
              >
                {lang.label}
              </Text>
              {isSelected && (
                <SvgIcon
                  name="check"
                  size={20}
                  color={colors.primary}
                />
              )}
            </TouchableOpacity>
          );
        })}
      </BottomSheet>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  section: {
    marginHorizontal: spacing.lg,
    borderRadius: 12,
    marginBottom: spacing.md,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  sectionHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  settingLabel: {
    fontSize: 15,
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  settingValue: {
    fontSize: 14,
  },
  langItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  langText: {
    fontSize: 16,
  },
});

export default SettingsScreen;
