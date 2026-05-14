/**
 * LanguageSwitcher — i18n language selection component
 *
 * Renders a list of available locales from the i18n config.
 * Supports two variants:
 * - `inline`: Row of language buttons (for Header or quick-access)
 * - `bottomSheet`: Full list with check marks (for SettingsScreen)
 *
 * On language selection:
 * 1. Calls `changeLanguage()` from i18n
 * 2. Dispatches `setLanguage()` to Redux for persistent UI state
 * 3. Invokes optional `onChange` callback
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../lib/theme/ThemeContext';
import { spacing, borderRadius } from '../../lib/theme/spacing';
import { typography } from '../../lib/theme/typography';
import {
  LOCALES_METADATA,
  getEnabledLocales,
  type Locale,
} from '../../lib/i18n/config';
import { changeLanguage } from '../../lib/i18n/index';
import { useAppDispatch } from '../../store';
import { setLanguage } from '../../store/slices/uiSlice';
import SvgIcon from '../core/SvgIcon';

type LanguageSwitcherVariant = 'inline' | 'bottomSheet';

interface LanguageSwitcherProps {
  /** Visual variant */
  variant?: LanguageSwitcherVariant;
  /** Current active locale */
  currentLocale?: Locale;
  /** Callback when language changes */
  onChange?: (locale: Locale) => void;
  /** Max inline items shown before "+N more" (ignored for bottomSheet) */
  maxInlineItems?: number;
}

function getLocaleFlag(locale: Locale): string {
  const flags: Record<Locale, string> = {
    en: '🇺🇸',
    zh: '🇨🇳',
    ja: '🇯🇵',
    ko: '🇰🇷',
    fr: '🇫🇷',
    de: '🇩🇪',
  };
  return flags[locale] ?? '🌐';
}

const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  variant = 'inline',
  currentLocale,
  onChange,
  maxInlineItems = 5,
}) => {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const colors = theme.colors;
  const dispatch = useAppDispatch();

  const activeLocale: Locale =
    currentLocale ?? (i18n.language as Locale) ?? 'en';
  const enabledLocales = getEnabledLocales();

  const handleSelect = useCallback(
    async (locale: Locale) => {
      await changeLanguage(locale);
      dispatch(setLanguage(locale));
      onChange?.(locale);
    },
    [dispatch, onChange],
  );

  /** Inline variant — horizontal row of compact pill buttons */
  if (variant === 'inline') {
    const visibleLocales = enabledLocales.slice(0, maxInlineItems);
    const hiddenCount = enabledLocales.length - visibleLocales.length;

    return (
      <View style={styles.inlineContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.inlineScrollContent}
        >
          {visibleLocales.map(locale => {
            const meta = LOCALES_METADATA[locale];
            const isActive = locale === activeLocale;
            return (
              <TouchableOpacity
                key={locale}
                style={[
                  styles.inlinePill,
                  {
                    backgroundColor: isActive
                      ? colors.primary
                      : colors.surfaceVariant,
                    borderColor: isActive ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => handleSelect(locale)}
                accessibilityRole="button"
                accessibilityLabel={`Switch language to ${meta.name}`}
                accessibilityState={{ selected: isActive }}
              >
                <Text style={styles.inlineFlag}>{getLocaleFlag(locale)}</Text>
                <Text
                  style={[
                    styles.inlineLabel,
                    {
                      color: isActive ? colors.white : colors.text,
                    },
                  ]}
                >
                  {meta.nativeName}
                </Text>
              </TouchableOpacity>
            );
          })}
          {hiddenCount > 0 && (
            <TouchableOpacity
              style={[
                styles.inlinePill,
                {
                  backgroundColor: colors.surfaceVariant,
                  borderColor: colors.border,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`${hiddenCount} more languages`}
            >
              <Text
                style={[styles.inlineLabel, { color: colors.textSecondary }]}
              >
                +{hiddenCount}
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    );
  }

  /** bottomSheet variant — full list with check marks */
  return (
    <View style={styles.bottomSheetContainer}>
      <Text
        style={[
          styles.bottomSheetTitle,
          { color: colors.text },
        ]}
      >
        {t('settings.language', 'Choose Language')}
      </Text>
      {enabledLocales.map(locale => {
        const meta = LOCALES_METADATA[locale];
        const isActive = locale === activeLocale;
        return (
          <TouchableOpacity
            key={locale}
            style={[
              styles.bottomSheetRow,
              {
                backgroundColor: isActive
                  ? colors.primaryLight
                  : colors.surface,
                borderBottomColor: colors.borderLight,
              },
            ]}
            onPress={() => handleSelect(locale)}
            accessibilityRole="button"
            accessibilityLabel={`Select ${meta.name}`}
            accessibilityState={{ selected: isActive }}
          >
            <View style={styles.bottomSheetRowLeft}>
              <Text style={styles.rowFlag}>{getLocaleFlag(locale)}</Text>
              <View>
                <Text
                  style={[
                    styles.rowNativeName,
                    {
                      color: isActive ? colors.primary : colors.text,
                      fontFamily: isActive
                        ? typography.fontFamilyBold
                        : typography.fontFamily,
                    },
                  ]}
                >
                  {meta.nativeName}
                </Text>
                <Text
                  style={[
                    styles.rowEnglishName,
                    { color: colors.textTertiary },
                  ]}
                >
                  {meta.name}
                </Text>
              </View>
            </View>
            {isActive && (
              <SvgIcon
                name="check"
                size={20}
                color={colors.primary}
                strokeWidth={3}
              />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  /* Inline variant */
  inlineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inlineScrollContent: {
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  inlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    gap: spacing.xs,
  },
  inlineFlag: {
    fontSize: 16,
  },
  inlineLabel: {
    fontSize: typography.fontSizeSm,
    fontFamily: typography.fontFamilyMedium,
  },
  /* bottomSheet variant */
  bottomSheetContainer: {
    paddingTop: spacing.md,
  },
  bottomSheetTitle: {
    fontSize: typography.fontSizeLg,
    fontFamily: typography.fontFamilyBold,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  bottomSheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  bottomSheetRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rowFlag: {
    fontSize: 28,
  },
  rowNativeName: {
    fontSize: typography.fontSizeMd,
    fontFamily: typography.fontFamily,
  },
  rowEnglishName: {
    fontSize: typography.fontSizeXs,
    fontFamily: typography.fontFamily,
    marginTop: 2,
  },
});

export default LanguageSwitcher;
