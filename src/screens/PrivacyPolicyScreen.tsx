/**
 * PrivacyPolicyScreen — In-app privacy policy with MarkdownRenderer
 *
 * Displays the full privacy policy in a scrollable, themed view.
 * Uses MarkdownRenderer for consistent typography with article content.
 * Content is automatically selected based on the current i18n locale,
 * falling back to English for unsupported languages.
 * Accessible from Settings → Privacy Policy.
 */
import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme, spacing } from '@/lib/theme';
import { front, TokensLight } from '@/lib/theme/design_tokens.g';
import { MarkdownRenderer } from '@/components/blog/MarkdownRenderer';
import SvgIcon from '@/components/core/SvgIcon';
import { getPrivacyPolicyContent } from '@/lib/privacy/privacyContent';
import type { RootStackScreenProps } from '@/navigation/types';

const PrivacyPolicyScreen: React.FC<RootStackScreenProps<'PrivacyPolicy'>> = ({
  navigation,
}) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t, i18n } = useTranslation();
  const content = React.useMemo(
    () => getPrivacyPolicyContent(i18n.language),
    [i18n.language],
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.bgMobilePrimary ?? colors.background }]}>
      {/* Custom header with back button */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + spacing.md,
            backgroundColor: colors.background,
            borderBottomColor: colors.borderSecondary,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <SvgIcon
            name="arrow-left"
            size={24}
            color={colors.textPrimary}
          />
        </TouchableOpacity>
        <Text
          style={[
            styles.headerTitle,
            { color: colors.textPrimary },
          ]}
        >
          {t('settings.privacyPolicy')}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Effective date badge */}
        <View
          style={[
            styles.dateBadge,
            { backgroundColor: (colors.utilityBrand500 ?? TokensLight.utilityBrand500) + '12' },
          ]}
        >
          <SvgIcon
            name="clock"
            size={14}
            color={colors.utilityBrand500 ?? TokensLight.utilityBrand500}
          />
          <Text
            style={[
              styles.dateBadgeText,
              { color: colors.utilityBrand500 ?? TokensLight.utilityBrand500 },
            ]}
          >
            {t('privacy.lastUpdated', 'Last updated: May 2026')}
          </Text>
        </View>

        {/* Markdown content */}
        <View style={styles.markdownWrapper}>
          <MarkdownRenderer content={content} />
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  headerTitle: {
    flex: 1,
    fontSize: front.textLg ?? 18,
    fontWeight: '600',
    lineHeight: front.leadingLg ?? 28,
  },
  headerSpacer: {
    width: 40,
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: front.radiusFull ?? 9999,
    marginBottom: spacing.xl,
    gap: spacing.xs,
  },
  dateBadgeText: {
    fontSize: front.textXs ?? 12,
    fontWeight: '500',
    lineHeight: front.leadingXs ?? 18,
  },
  markdownWrapper: {
    paddingBottom: spacing.xl,
  },
});

export default PrivacyPolicyScreen;
