/**
 * SettingsScreen — App settings (Premium Redesign with i18n)
 *
 * Sections:
 * 1. Profile Header (user avatar, name, email or sign-in prompt)
 * 2. Appearance (theme toggle, language selection)
 * 3. Reading (font size, line spacing)
 * 4. Notifications (push notification toggles)
 * 5. Data (clear cache, export data)
 * 6. Account (sign out, delete account) — with destructive styling
 * 7. Info (about, privacy policy)
 *
 * Design tokens: uses the full design_tokens.g.ts system.
 * Brand accent: utilityBrand500 (#d68a29 gold).
 * i18n: fully translated via react-i18next (6 languages).
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
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useTheme, spacing, borderRadius } from '@/lib/theme';
import { front, TokensLight } from '@/lib/theme/design_tokens.g';
import { useAppSelector, useAppDispatch } from '@/store';
import { logout } from '@/store/slices/authSlice';
import { changeLanguage, getCurrentLanguage } from '@/lib/i18n';
import { clearAppCache } from '@/lib/cache/clearAppCache';
import Header from '@/components/layout/Header';
import BottomSheet from '@/components/layout/BottomSheet';
import SvgIcon from '@/components/core/SvgIcon';
import type { RootStackScreenProps } from '@/navigation/types';

// ─── Constants ──────────────────────────────────────────────────────────────

const APP_VERSION = '1.0.0';
const ICON_CIRCLE_SIZE = 36;
const PROFILE_AVATAR_SIZE = 56;

type SettingRowKind = 'navigation' | 'toggle' | 'destructive' | 'display';

interface SettingRowProps {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  destructive?: boolean;
  kind?: SettingRowKind;
}

// ─── Sub-components ─────────────────────────────────────────────────────────

/**
 * ProfileHeaderCard — top card showing user avatar + name + email,
 * or a sign-in prompt when not authenticated.
 */
const ProfileHeaderCard: React.FC = () => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const user = useAppSelector(state => state.auth.user);
  const isAuthenticated = useAppSelector(state => state.auth.isAuthenticated);

  const handleSignIn = useCallback(() => {
    navigation.navigate('Auth');
  }, [navigation]);

  const initial = user?.nickname?.charAt(0)?.toUpperCase() || '?';

  return (
    <TouchableOpacity
      activeOpacity={isAuthenticated ? 0.7 : 0.6}
      onPress={isAuthenticated ? undefined : handleSignIn}
      style={[
        styles.profileCard,
        {
          backgroundColor: colors.bgPrimary,
          borderLeftColor: colors.utilityBrand500 ?? TokensLight.utilityBrand500,
        },
        Platform.select({
          ios: {
            shadowColor: colors.utilityBrand500 ?? TokensLight.utilityBrand500,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08,
            shadowRadius: 8,
          },
          android: {
            elevation: 3,
          },
        }),
      ]}
    >
      {isAuthenticated && user ? (
        <>
          <View
            style={[
              styles.profileAvatar,
              {
                backgroundColor: colors.bgBrandPrimary,
                borderColor: colors.utilityBrand200 ?? TokensLight.utilityBrand200,
              },
            ]}
          >
            <Text
              style={[
                styles.profileAvatarText,
                { color: colors.utilityBrand600 ?? TokensLight.utilityBrand600 },
              ]}
            >
              {initial}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text
              style={[
                styles.profileName,
                { color: colors.textPrimary },
              ]}
              numberOfLines={1}
            >
              {user.nickname}
            </Text>
            <Text
              style={[
                styles.profileEmail,
                { color: colors.textSecondary },
              ]}
              numberOfLines={1}
            >
              {user.email}
            </Text>
          </View>
          <SvgIcon
            name="chevron-right"
            size={18}
            color={colors.textQuaternary ?? TokensLight.textQuaternary}
          />
        </>
      ) : (
        <>
          <View
            style={[
              styles.profileAvatar,
              {
                backgroundColor: colors.bgSecondary,
                borderColor: colors.borderSecondary,
              },
            ]}
          >
            <SvgIcon
              name="user"
              size={24}
              color={colors.textSecondary}
            />
          </View>
          <View style={styles.profileInfo}>
            <Text
              style={[
                styles.profileName,
                { color: colors.textPrimary },
              ]}
            >
              {t('settings.profile.signIn')}
            </Text>
            <Text
              style={[
                styles.profileEmail,
                { color: colors.textSecondary },
              ]}
            >
              {t('settings.profile.subtitle')}
            </Text>
          </View>
          <View
            style={[
              styles.signInBadge,
              { backgroundColor: colors.bgBrandSolid ?? TokensLight.bgBrandSolid },
            ]}
          >
            <Text style={styles.signInBadgeText}>{t('settings.profile.signInBadge')}</Text>
          </View>
        </>
      )}
    </TouchableOpacity>
  );
};

/**
 * SettingRow — individual setting item with icon-in-circle design.
 *
 * Three visual kinds:
 * - navigation: grey icon circle + chevron right
 * - toggle: brand-tinted icon circle + Switch
 * - destructive: error-tinted icon circle + red label
 * - display: grey icon circle, no right action (info row)
 */
const SettingRow: React.FC<SettingRowProps> = ({
  icon,
  label,
  value,
  onPress,
  rightElement,
  destructive = false,
  kind = 'navigation',
}) => {
  const { colors } = useTheme();

  const resolvedKind: SettingRowKind = destructive
    ? 'destructive'
    : rightElement
      ? 'toggle'
      : kind;

  // Determine icon circle background color
  const iconBgColor =
    resolvedKind === 'destructive'
      ? colors.bgErrorSecondary ?? '#fee4e2'
      : resolvedKind === 'toggle'
        ? colors.bgBrandPrimary ?? '#fbf7eb'
        : colors.bgSecondary;

  // Determine icon color
  const iconColor =
    resolvedKind === 'destructive'
      ? colors.textErrorPrimary ?? '#d92d20'
      : colors.utilityBrand500 ?? colors.primary;

  // Determine label color
  const labelColor =
    resolvedKind === 'destructive'
      ? colors.textErrorPrimary ?? '#d92d20'
      : colors.textPrimary;

  const isDisabled = !onPress && !rightElement;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      style={[
        styles.settingRow,
        { borderBottomColor: colors.borderSecondary },
      ]}
      activeOpacity={onPress ? 0.6 : 1}
    >
      {/* Icon circle */}
      <View
        style={[
          styles.iconCircle,
          { backgroundColor: iconBgColor },
        ]}
      >
        <SvgIcon
          name={icon as any}
          size={18}
          color={iconColor}
        />
      </View>

      {/* Label */}
      <View style={styles.settingLabelContainer}>
        <Text
          style={[
            styles.settingLabel,
            { color: labelColor },
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>

      {/* Right side: value / switch / chevron */}
      <View style={styles.settingRight}>
        {value && (
          <Text
            style={[
              styles.settingValue,
              { color: colors.textTertiary ?? colors.textSecondary },
            ]}
            numberOfLines={1}
          >
            {value}
          </Text>
        )}
        {rightElement}
        {onPress && !rightElement && (
          <SvgIcon
            name="chevron-right"
            size={18}
            color={colors.textQuaternary ?? colors.textSecondary}
          />
        )}
      </View>
    </TouchableOpacity>
  );
};

/**
 * SectionHeader — section label with left brand accent bar.
 */
interface SectionHeaderProps {
  title: string;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ title }) => {
  const { colors } = useTheme();

  return (
    <View style={styles.sectionHeaderRow}>
      <View
        style={[
          styles.sectionHeaderAccent,
          { backgroundColor: colors.utilityBrand500 ?? TokensLight.utilityBrand500 },
        ]}
      />
      <Text
        style={[
          styles.sectionHeaderText,
          { color: colors.textTertiary ?? colors.textSecondary },
        ]}
      >
        {title.toUpperCase()}
      </Text>
    </View>
  );
};

/**
 * SectionCard — wraps a group of SettingRows.
 * Can take a `destructive` prop to add red left accent border.
 */
const SectionCard: React.FC<{
  children: React.ReactNode;
  destructive?: boolean;
}> = ({ children, destructive = false }) => {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.section,
        {
          backgroundColor: colors.bgPrimary,
          borderLeftColor: destructive
            ? colors.textErrorPrimary ?? '#d92d20'
            : 'transparent',
        },
        Platform.select({
          ios: {
            shadowColor: destructive ? '#d92d20' : '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: destructive ? 0.06 : 0.05,
            shadowRadius: 6,
          },
          android: {
            elevation: destructive ? 4 : 2,
          },
        }),
      ]}
    >
      {children}
    </View>
  );
};

// ─── Language options ───────────────────────────────────────────────────────

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'zh', label: '中文' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
];

// ─── Main Screen ────────────────────────────────────────────────────────────

const SettingsScreen: React.FC<RootStackScreenProps<'Settings'>> = ({
  navigation,
}) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark, toggleTheme } = useTheme();
  const { t } = useTranslation();
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
      t('settings.clearCache.confirm'),
      t('settings.clearCache.message'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.clearCache.action'),
          style: 'destructive',
          onPress: () => {
            clearAppCache();
          },
        },
      ],
    );
  }, [t]);

  const handleSignOut = useCallback(() => {
    Alert.alert(
      t('settings.signOut.confirm'),
      t('settings.signOut.message'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.signOut.name'),
          style: 'destructive',
          onPress: () => dispatch(logout()),
        },
      ],
    );
  }, [dispatch, t]);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      t('settings.deleteAccount.confirm'),
      t('settings.deleteAccount.message'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.deleteAccount.action'),
          style: 'destructive',
          onPress: () => {
            // TODO: API call to delete account
            dispatch(logout());
          },
        },
      ],
    );
  }, [dispatch, t]);

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
      (navigation as any).navigate(screen);
    },
    [navigation],
  );

  // ─── Main render ────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: colors.bgMobilePrimary ?? colors.background }]}>
      <Header title={t('settings.title')} showBack hideSearch hideSettings />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Profile Header ───────────────────────────────────────── */}
        <ProfileHeaderCard />

        {/* ─── Appearance ───────────────────────────────────────────── */}
        <SectionHeader title={t('settings.appearance')} />
        <SectionCard>
          <SettingRow
            icon={isDark ? 'moon' : 'sun'}
            label={t('settings.theme.dark')}
            kind="toggle"
            rightElement={
              <Switch
                value={isDark}
                onValueChange={toggleTheme}
                trackColor={{
                  false: colors.borderSecondary,
                  true: (colors.utilityBrand500 ?? TokensLight.utilityBrand500) + 'CC',
                }}
                thumbColor={isDark ? (colors.utilityBrand500 ?? TokensLight.utilityBrand500) : '#f4f3f4'}
                ios_backgroundColor={colors.borderSecondary}
              />
            }
          />
          <SettingRow
            icon="globe"
            label={t('settings.language.name')}
            value={t(`settings.language.${currentLang}` as any, { defaultValue: 'English' })}
            onPress={() => setShowLanguageSheet(true)}
          />
        </SectionCard>

        {/* ─── Notifications ────────────────────────────────────────── */}
        <SectionHeader title={t('settings.notifications')} />
        <SectionCard>
          <SettingRow
            icon="bell"
            label={t('settings.pushNotifications')}
            kind="toggle"
            rightElement={
              <Switch
                value={false}
                trackColor={{
                  false: colors.borderSecondary,
                  true: (colors.utilityBrand500 ?? TokensLight.utilityBrand500) + 'CC',
                }}
                thumbColor={colors.utilityBrand500 ?? TokensLight.utilityBrand500}
                ios_backgroundColor={colors.borderSecondary}
              />
            }
          />
        </SectionCard>

        {/* ─── Data ─────────────────────────────────────────────────── */}
        <SectionHeader title={t('settings.data')} />
        <SectionCard>
          <SettingRow
            icon="refresh-cw"
            label={t('settings.clearCache.name')}
            onPress={handleClearCache}
          />
        </SectionCard>

        {/* ─── Account ──────────────────────────────────────────────── */}
        {isAuthenticated && (
          <>
            <SectionHeader title={t('settings.account')} />
            <SectionCard destructive>
              {user && (
                <SettingRow
                  icon="user"
                  label={t('settings.profile.signedInAs', { name: user.nickname })}
                  value={user.email}
                  kind="display"
                />
              )}
              <SettingRow
                icon="x"
                label={t('settings.signOut.name')}
                onPress={handleSignOut}
                destructive
              />
              <SettingRow
                icon="alert-circle"
                label={t('settings.deleteAccount.name')}
                onPress={handleDeleteAccount}
                destructive
              />
            </SectionCard>
          </>
        )}

        {/* ─── Info ─────────────────────────────────────────────────── */}
        <SectionHeader title={t('settings.info')} />
        <SectionCard>
          <SettingRow
            icon="info"
            label={t('settings.aboutTarsier')}
            onPress={() =>
              (navigation as any).navigate('MainTabs', {
                screen: 'AboutTab',
                params: { screen: 'About' },
              })
            }
          />
          <SettingRow
            icon="external-link"
            label={t('settings.privacyPolicy')}
            onPress={() => (navigation as any).navigate('PrivacyPolicy')}
          />
        </SectionCard>

        {/* ─── Footer ───────────────────────────────────────────────── */}
        <View style={styles.footer}>
          <Text
            style={[
              styles.footerText,
              { color: colors.textQuaternary ?? colors.textDisabled },
            ]}
          >
            {t('settings.version')}
          </Text>
        </View>
      </ScrollView>

      {/* ─── Language Bottom Sheet ──────────────────────────────────── */}
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
                {
                  borderBottomColor: colors.borderSecondary,
                  backgroundColor: isSelected
                    ? (colors.bgBrandPrimary ?? '#fbf7eb')
                    : 'transparent',
                },
              ]}
            >
              <View style={styles.langItemLeft}>
                <Text
                  style={[
                    styles.langText,
                    {
                      color: isSelected
                        ? (colors.utilityBrand600 ?? '#ba6b20')
                        : colors.textPrimary,
                      fontWeight: isSelected ? '600' : '400',
                    },
                  ]}
                >
                  {lang.label}
                </Text>
              </View>
              {isSelected && (
                <View
                  style={[
                    styles.langCheckCircle,
                    { backgroundColor: colors.bgBrandSolid ?? '#d68a29' },
                  ]}
                >
                  <SvgIcon
                    name="check"
                    size={14}
                    color="#ffffff"
                  />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </BottomSheet>
    </View>
  );
};

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: spacing.sm,
  },

  // ── Profile Card ────────────────────────────────────
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.xl,
    marginBottom: spacing.xl,
    padding: spacing.lg,
    borderRadius: borderRadius.xl ?? 16,
    borderLeftWidth: 3,
    borderLeftColor: '#d68a29',
  },
  profileAvatar: {
    width: PROFILE_AVATAR_SIZE,
    height: PROFILE_AVATAR_SIZE,
    borderRadius: PROFILE_AVATAR_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  profileAvatarText: {
    fontSize: front.displayXs ?? 24,
    fontWeight: '700',
  },
  profileInfo: {
    flex: 1,
    marginLeft: spacing.lg,
    marginRight: spacing.sm,
  },
  profileName: {
    fontSize: front.textLg ?? 18,
    fontWeight: '600',
    lineHeight: front.leadingLg ?? 28,
  },
  profileEmail: {
    fontSize: front.textSm ?? 14,
    fontWeight: '400',
    lineHeight: front.leadingSm ?? 20,
    marginTop: 2,
  },
  signInBadge: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full ?? 9999,
  },
  signInBadgeText: {
    color: '#ffffff',
    fontSize: front.textXs ?? 12,
    fontWeight: '600',
  },

  // ── Section Header ──────────────────────────────────
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  sectionHeaderAccent: {
    width: 3,
    height: 14,
    borderRadius: 2,
  },
  sectionHeaderText: {
    fontSize: front.textXs ?? 12,
    fontWeight: '700',
    letterSpacing: 0.8,
  },

  // ── Section Card ────────────────────────────────────
  section: {
    marginHorizontal: spacing.xl,
    borderRadius: borderRadius.xl ?? 16,
    marginBottom: spacing.sm + 4,
    overflow: 'hidden',
    borderLeftWidth: 0,
  },

  // ── Setting Row ─────────────────────────────────────
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconCircle: {
    width: ICON_CIRCLE_SIZE,
    height: ICON_CIRCLE_SIZE,
    borderRadius: ICON_CIRCLE_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingLabelContainer: {
    flex: 1,
    marginLeft: spacing.lg,
    marginRight: spacing.sm,
  },
  settingLabel: {
    fontSize: front.textMd ?? 16,
    fontWeight: '500',
    lineHeight: front.leadingMd ?? 24,
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexShrink: 0,
  },
  settingValue: {
    fontSize: front.textSm ?? 14,
    fontWeight: '400',
    lineHeight: front.leadingSm ?? 20,
  },

  // ── Bottom Sheet ────────────────────────────────────
  langItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.xl,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRadius: borderRadius.sm ?? 6,
    marginHorizontal: spacing.md,
    marginVertical: 2,
  },
  langItemLeft: {
    flex: 1,
  },
  langText: {
    fontSize: front.textMd ?? 16,
    lineHeight: front.leadingMd ?? 24,
  },

  langCheckCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Footer ──────────────────────────────────────────
  footer: {
    alignItems: 'center',
    paddingTop: spacing.xl + 4,
    paddingBottom: spacing.sm,
  },
  footerText: {
    fontSize: front.textXs ?? 12,
    fontWeight: '400',
    lineHeight: front.leadingXs ?? 18,
  },
});

export default SettingsScreen;
