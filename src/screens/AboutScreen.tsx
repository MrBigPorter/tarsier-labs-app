/**
 * AboutScreen — App information
 *
 * Displays:
 * - App icon and name ("Tarsier")
 * - Version information
 * - Brief description
 * - Links: Website, GitHub, Privacy Policy, Terms
 * - Libraries/licenses used
 *
 * No API calls needed — static content.
 */
import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../lib/theme/ThemeContext';
import { spacing } from '../lib/theme/spacing';
import { typography } from '../lib/theme/typography';
import Header from '../components/layout/Header';
import SvgIcon from '../components/core/SvgIcon';
import type { ProfileTabScreenProps } from '../navigation/types';

interface LinkRowProps {
  icon: string;
  label: string;
  url?: string;
  onPress?: () => void;
}

const LinkRow: React.FC<LinkRowProps> = ({ icon, label, url, onPress }) => {
  const { theme } = useTheme();
  const colors = theme.colors;

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else if (url) {
      Linking.openURL(url).catch(() => {});
    }
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={[styles.linkRow, { borderBottomColor: colors.border }]}
      activeOpacity={0.6}
    >
      <View style={styles.linkLeft}>
        <SvgIcon
          name={icon as any}
          size={18}
          color={colors.textSecondary}
        />
        <Text style={[styles.linkLabel, { color: colors.text }]}>
          {label}
        </Text>
      </View>
      <SvgIcon
        name="external-link"
        size={14}
        color={colors.textSecondary}
      />
    </TouchableOpacity>
  );
};

const AboutScreen: React.FC<ProfileTabScreenProps<'About'>> = () => {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const colors = theme.colors;

  const appVersion = Platform.select({
    ios: '1.0.0',
    default: '1.0.0',
  });

  const buildNumber = Platform.select({
    ios: '1',
    default: '1',
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="About" showBack />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── App Identity ────────────────────────────────────────── */}
        <View style={styles.identitySection}>
          <View
            style={[
              styles.appIcon,
              { backgroundColor: colors.primary },
            ]}
          >
            <Text style={styles.appIconText}>T</Text>
          </View>
          <Text
            style={[
              styles.appName,
              {
                color: colors.text,
                fontFamily: typography.h2.fontFamily,
                fontSize: typography.h2.fontSize,
                fontWeight: typography.h2.fontWeight,
              },
            ]}
          >
            Tarsier
          </Text>
          <Text
            style={[
              styles.tagline,
              { color: colors.textSecondary },
            ]}
          >
            Read thoughtful articles on technology, science, and ideas
          </Text>
          <Text
            style={[
              styles.version,
              { color: colors.textSecondary },
            ]}
          >
            Version {appVersion} (Build {buildNumber})
          </Text>
        </View>

        {/* ─── Links ───────────────────────────────────────────────── */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <LinkRow
            icon="globe"
            label="Website"
            url="https://tarsierlabs.com"
          />
          <LinkRow
            icon="info"
            label="Privacy Policy"
            url="https://tarsierlabs.com/privacy"
          />
          <LinkRow
            icon="file-text"
            label="Terms of Service"
            url="https://tarsierlabs.com/terms"
          />
          <LinkRow
            icon="mail"
            label="Contact Us"
            url="mailto:support@tarsierlabs.com"
          />
        </View>

        {/* ─── Description ─────────────────────────────────────────── */}
        <View style={[styles.descriptionBox, { backgroundColor: colors.surface }]}>
          <Text
            style={[
              styles.descriptionTitle,
              { color: colors.text },
            ]}
          >
            About Tarsier Labs
          </Text>
          <Text
            style={[
              styles.descriptionText,
              { color: colors.textSecondary },
            ]}
          >
            Tarsier Labs is a technology blog and content platform focused on
            delivering high-quality articles about software engineering, system
            design, AI/ML, and emerging technologies. Our mission is to make
            complex technical topics accessible and engaging.
          </Text>
        </View>

        {/* ─── Tech Stack ──────────────────────────────────────────── */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text
            style={[
              styles.sectionTitle,
              {
                color: colors.textSecondary,
                borderBottomColor: colors.border,
              },
            ]}
          >
            TECHNOLOGY
          </Text>
          {[
            { label: 'React Native', value: '0.85' },
            { label: 'Redux Toolkit', value: '2.x' },
            { label: 'TypeScript', value: '5.x' },
            { label: 'React Navigation', value: '7.x' },
            { label: 'MMKV Storage', value: '1.x' },
          ].map(tech => (
            <View
              key={tech.label}
              style={[styles.techRow, { borderBottomColor: colors.border }]}
            >
              <Text style={[styles.techLabel, { color: colors.text }]}>
                {tech.label}
              </Text>
              <Text
                style={[styles.techValue, { color: colors.textSecondary }]}
              >
                {tech.value}
              </Text>
            </View>
          ))}
        </View>

        {/* ─── Copyright ───────────────────────────────────────────── */}
        <Text
          style={[
            styles.copyright,
            { color: colors.textSecondary },
          ]}
        >
          © {new Date().getFullYear()} Tarsier Labs. All rights reserved.
        </Text>
      </ScrollView>
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
  identitySection: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  appIcon: {
    width: 80,
    height: 80,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  appIconText: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '700',
  },
  appName: {
    marginBottom: spacing.sm,
  },
  tagline: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  version: {
    fontSize: 13,
  },
  section: {
    marginHorizontal: spacing.lg,
    borderRadius: 12,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  linkLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  linkLabel: {
    fontSize: 15,
  },
  descriptionBox: {
    marginHorizontal: spacing.lg,
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  descriptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  descriptionText: {
    fontSize: 14,
    lineHeight: 22,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  techRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  techLabel: {
    fontSize: 14,
  },
  techValue: {
    fontSize: 13,
  },
  copyright: {
    textAlign: 'center',
    fontSize: 12,
    marginTop: spacing.md,
  },
});

export default AboutScreen;
