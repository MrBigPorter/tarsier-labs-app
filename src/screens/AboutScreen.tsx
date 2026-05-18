/**
 * AboutScreen — Redesigned matching Web version
 *
 * Sections:
 * 1. Hero: App logo + title + subtitle
 * 2. Founder Profile: Avatar, stats, name, role, bio, skills, contact
 * 3. Vision + Core Values: Vision text + 2x2 value cards
 * 4. Tech Stack: 9 categorized groups with emoji icon cards
 * 5. Footer: Logo + "Made with love" + Copyright
 */
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useModeColors, spacing, typography } from '@/lib/theme';
import Header from '@/components/layout/Header';
import SvgIcon from '@/components/core/SvgIcon';
import { AppImage } from '@/components/core/AppImage';
import type { AboutTabScreenProps } from '@/navigation/types';

// ─── Data ──────────────────────────────────────────────────────────────────

const teamMembers = [
  {
    name: 'Porter',
    role: 'Full Stack Developer',
    avatar:
      'https://img.joyminis.com/Gemini_Generated_Image_l8u1b7l8u1b7l8u1.png',
    github: 'https://github.com/MrBigPorter',
    skills: [
      'TypeScript',
      'React',
      'React Native',
      'Node.js',
      'Flutter',
      'DevOps',
    ],
  },
];

interface TechItem {
  name: string;
  icon: string;
  description: string;
  descKey?: string;
}

interface TechGroup {
  category: string;
  title: string;
  description: string;
  items: TechItem[];
}

const techStackGroups: TechGroup[] = [
  {
    category: 'frontend',
    title: 'Frontend Frameworks',
    description: 'Core UI building technologies',
    items: [
      {
        name: 'Next.js 15',
        icon: '⚡',
        description: 'React framework for SSR/SSG',
        descKey: 'about.techNextjs',
      },
      {
        name: 'React 19',
        icon: '⚛️',
        description: 'UI library with concurrent features',
        descKey: 'about.techReact',
      },
      {
        name: 'TypeScript',
        icon: '📘',
        description: 'Type-safe JavaScript',
        descKey: 'about.techTypescript',
      },
      {
        name: 'Tailwind CSS',
        icon: '🎨',
        description: 'Utility-first CSS framework',
        descKey: 'about.techTailwind',
      },
    ],
  },
  {
    category: 'mobile',
    title: 'Mobile Development',
    description: 'Cross-platform mobile development',
    items: [
      // React Native (this project)
      {
        name: 'React Native',
        icon: '📱',
        description: 'Cross-platform mobile framework',
        descKey: 'about.techRn',
      },
      {
        name: 'Redux Toolkit',
        icon: '🔄',
        description: 'Predictable state management',
        descKey: 'about.techRedux',
      },
      {
        name: 'RTK Query',
        icon: '⚡',
        description: 'API caching & data fetching',
        descKey: 'about.techRtkQuery',
      },
      {
        name: 'Reanimated',
        icon: '🎭',
        description: 'High-performance animations on UI thread',
        descKey: 'about.techReanimated',
      },
      {
        name: 'React Navigation',
        icon: '🧭',
        description: 'Declarative navigation & routing',
        descKey: 'about.techReactNavigation',
      },
      {
        name: 'Gesture Handler',
        icon: '👆',
        description: 'Native gesture handling',
        descKey: 'about.techGestureHandler',
      },
      {
        name: 'MMKV',
        icon: '💾',
        description: 'Fast key-value local storage',
        descKey: 'about.techMmkv',
      },
      {
        name: 'i18next',
        icon: '🌐',
        description: 'Multi-language i18n library',
        descKey: 'about.techI18next',
      },
      // Flutter (other projects)
      {
        name: 'Flutter',
        icon: '📱',
        description: 'Cross-platform mobile framework',
        descKey: 'about.techFlutter',
      },
      {
        name: 'Shorebird',
        icon: '🔄',
        description: 'Flutter hot update solution',
        descKey: 'about.techShorebird',
      },
      {
        name: 'Capacitor',
        icon: '🔋',
        description: 'Hybrid app framework',
        descKey: 'about.techCapacitor',
      },
      {
        name: 'sembast',
        icon: '💾',
        description: 'Flutter embedded NoSQL database',
        descKey: 'about.techSembast',
      },
    ],
  },
  {
    category: 'backend',
    title: 'Backend/Database',
    description: 'Server-side and data processing',
    items: [
      {
        name: 'NestJS',
        icon: '🏠',
        description: 'Enterprise Node.js framework',
        descKey: 'about.techNestjs',
      },
      {
        name: 'Prisma',
        icon: '🗄️',
        description: 'Modern ORM tool',
        descKey: 'about.techPrisma',
      },
      {
        name: 'PostgreSQL',
        icon: '🐘',
        description: 'Relational database',
        descKey: 'about.techPostgresql',
      },
      {
        name: 'Redis',
        icon: '🔴',
        description: 'In-memory cache & data store',
        descKey: 'about.techRedis',
      },
      {
        name: 'SQLite',
        icon: '💿',
        description: 'Lightweight embedded database',
        descKey: 'about.techSqlite',
      },
      {
        name: 'BullMQ',
        icon: '📨',
        description: 'Redis-based message queue',
        descKey: 'about.techBullmq',
      },
    ],
  },
  {
    category: 'ai',
    title: 'AI/ML Services',
    description: 'AI and machine learning capabilities',
    items: [
      {
        name: 'AWS Rekognition',
        icon: '🤖',
        description: 'Face recognition & liveness detection',
        descKey: 'about.techAwsRekognition',
      },
      {
        name: 'Google Vertex AI',
        icon: '🧠',
        description: 'ML model service for AI features',
        descKey: 'about.techVertexAi',
      },
      {
        name: 'AI Agent',
        icon: '🤝',
        description: 'AI agent system',
        descKey: 'about.techAiAgent',
      },
    ],
  },
  {
    category: 'devops',
    title: 'DevOps/Infrastructure',
    description: 'Deployment and infrastructure',
    items: [
      {
        name: 'Docker',
        icon: '🐳',
        description: 'Containerized deployment',
        descKey: 'about.techDocker',
      },
      {
        name: 'GitHub Actions',
        icon: '⚙️',
        description: 'CI/CD automation pipeline',
        descKey: 'about.techGithubActions',
      },
      {
        name: 'Cloudflare Workers',
        icon: '☁️',
        description: 'Edge platform with CDN & Serverless',
        descKey: 'about.techCloudflare',
      },
      {
        name: 'Vite',
        icon: '⚡',
        description: 'Fast frontend build tool',
        descKey: 'about.techVite',
      },
    ],
  },
  {
    category: 'monitoring',
    title: 'Monitoring/Testing',
    description: 'Quality assurance and monitoring',
    items: [
      {
        name: 'Sentry',
        icon: '🚨',
        description: 'Performance monitoring & error tracking',
        descKey: 'about.techSentry',
      },
      {
        name: 'Playwright',
        icon: '🎭',
        description: 'E2E automation testing framework',
        descKey: 'about.techPlaywright',
      },
      {
        name: 'Jest/Vitest',
        icon: '🧪',
        description: 'Unit testing framework',
        descKey: 'about.techJestVitest',
      },
    ],
  },
  {
    category: 'communication',
    title: 'Instant Messaging/Push',
    description: 'Real-time messaging and notifications',
    items: [
      {
        name: 'WebSocket',
        icon: '💬',
        description: 'Real-time bidirectional protocol',
        descKey: 'about.techWebsocket',
      },
      {
        name: 'Socket.IO',
        icon: '🔌',
        description: 'Real-time communication library',
        descKey: 'about.techSocketIo',
      },
      {
        name: 'FCM',
        icon: '📲',
        description: 'Cross-platform push notifications',
        descKey: 'about.techFcm',
      },
      {
        name: 'OAuth2',
        icon: '🔑',
        description: 'OAuth2 third-party login',
        descKey: 'about.techOauth',
      },
    ],
  },
  {
    category: 'design',
    title: 'Design/SEO',
    description: 'UX design and search optimization',
    items: [
      {
        name: 'Figma',
        icon: '🎨',
        description: 'Collaborative design tool',
        descKey: 'about.techFigma',
      },
      {
        name: 'Figma Token',
        icon: '🎯',
        description: 'Design system tokens',
        descKey: 'about.techFigmaToken',
      },
      {
        name: 'SEO',
        icon: '🔍',
        description: 'SEO optimization',
        descKey: 'about.techSeo',
      },
    ],
  },
  {
    category: 'i18n',
    title: 'Internationalization',
    description: 'Multi-language localization support',
    items: [
      {
        name: 'next-intl',
        icon: '🌐',
        description: 'Multi-language i18n library',
        descKey: 'about.techNextIntl',
      },
    ],
  },
];

interface CoreValue {
  icon: string;
  key: string;
  title: string;
  desc: string;
}

const coreValues: CoreValue[] = [
  {
    icon: '🚀',
    key: 'Innovation',
    title: 'Innovation Driven',
    desc: 'Explore new tech for better UX',
  },
  {
    icon: '🛡️',
    key: 'Security',
    title: 'Safe and Reliable',
    desc: 'Data security and system stability',
  },
  {
    icon: '⚡',
    key: 'Performance',
    title: 'High Performance',
    desc: 'Optimized code for fast response',
  },
  {
    icon: '✨',
    key: 'UserExperience',
    title: 'User Experience',
    desc: 'Simple and elegant interfaces',
  },
];

// ─── Sub-Components ─────────────────────────────────────────────────────────

/** Hero Section: logo + title + subtitle */
function HeroSection({
  colors,
  t,
}: {
  colors: Record<string, string>;
  t: (key: string) => string;
}) {
  return (
    <View
      style={[styles.heroSection, { backgroundColor: colors.primary + '10' }]}
    >
      <View style={styles.heroContent}>
        <View
          style={[
            styles.heroIconContainer,
            { backgroundColor: colors.primary + '18' },
          ]}
        >
          <Image
            source={require('@assets/logo.png')}
            style={styles.heroLogo}
            resizeMode="contain"
          />
        </View>
        <Text style={[styles.heroTitle, { color: colors.text }]}>
          {t('about.title')}
        </Text>
        <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
          {t('about.subtitle')}
        </Text>
      </View>
    </View>
  );
}

/** Founder Profile: avatar, stats, name, role, bio, skills, contact */
function FounderSection({
  colors,
  t,
}: {
  colors: Record<string, string>;
  t: (key: string) => string;
}) {
  const founder = teamMembers[0];

  const handleGithub = useCallback(() => {
    Linking.openURL(founder.github).catch(() => {});
  }, [founder.github]);

  const handleEmail = useCallback(() => {
    Linking.openURL('mailto:mrsuperporter@gmail.com').catch(() => {});
  }, []);

  return (
    <View style={styles.sectionContainer}>
      <View style={styles.sectionHeader}>
        <View
          style={[
            styles.sectionIconBox,
            { backgroundColor: colors.primary + '18' },
          ]}
        >
          <Text style={styles.sectionIcon}>✨</Text>
        </View>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {t('about.founderTitle')}
        </Text>
      </View>
      <Text
        style={[styles.sectionDescription, { color: colors.textSecondary }]}
      >
        {t('about.founderDescription')}
      </Text>

      <View
        style={[
          styles.profileCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border + '80',
          },
        ]}
      >
        {/* Avatar + Stats */}
        <View style={styles.profileTopRow}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatarGlow} />
            <AppImage
              uri={founder.avatar}
              style={styles.avatarImage}
              containerStyle={styles.avatarWrapper}
              priority
            />
            <View style={styles.onlineDot} />
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View
              style={[styles.statItem, { backgroundColor: colors.bgSecondary }]}
            >
              <Text style={[styles.statValue, { color: colors.primary }]}>
                10+
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                {t('about.founderStatYears')}
              </Text>
            </View>
            <View
              style={[styles.statItem, { backgroundColor: colors.bgSecondary }]}
            >
              <Text style={[styles.statValue, { color: colors.primary }]}>
                50+
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                {t('about.founderStatProjects')}
              </Text>
            </View>
            <View
              style={[styles.statItem, { backgroundColor: colors.bgSecondary }]}
            >
              <Text style={[styles.statValue, { color: colors.primary }]}>
                4
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                {t('about.founderStatStacks')}
              </Text>
            </View>
          </View>
        </View>

        {/* Name + Role */}
        <View style={styles.profileInfoSection}>
          <Text style={[styles.profileName, { color: colors.text }]}>
            {founder.name}
          </Text>
          <View
            style={[
              styles.roleBadge,
              { backgroundColor: colors.primary + '18' },
            ]}
          >
            <Text style={styles.roleIcon}>🚀</Text>
            <Text style={[styles.roleText, { color: colors.primary }]}>
              {t('about.teamRoleFullStack')}
            </Text>
          </View>

          {/* Bio */}
          <Text style={[styles.bioText, { color: colors.textSecondary }]}>
            {t('about.founderBio')}
          </Text>

          {/* Expertise */}
          <Text style={[styles.expertiseTitle, { color: colors.text }]}>
            {t('about.founderExpertise')}
          </Text>
          <View style={styles.skillsRow}>
            {founder.skills.map((skill, index) => (
              <View
                key={index}
                style={[
                  styles.skillChip,
                  {
                    backgroundColor: colors.primary + '15',
                    borderColor: colors.primary + '30',
                  },
                ]}
              >
                <Text style={[styles.skillText, { color: colors.primary }]}>
                  {skill}
                </Text>
              </View>
            ))}
          </View>

          {/* Connect */}
          <View
            style={[
              styles.connectDivider,
              { borderColor: colors.border + '80' },
            ]}
          />
          <Text style={[styles.connectTitle, { color: colors.text }]}>
            {t('about.founderConnect')}
          </Text>
          <View style={styles.connectRow}>
            <TouchableOpacity
              onPress={handleGithub}
              style={[
                styles.connectButton,
                {
                  backgroundColor: colors.primary + '15',
                  borderColor: colors.primary + '30',
                },
              ]}
              activeOpacity={0.7}
            >
              <Text style={styles.connectEmoji}>🐙</Text>
              <Text
                style={[styles.connectButtonText, { color: colors.primary }]}
              >
                {t('about.github')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleEmail}
              style={[
                styles.connectButton,
                {
                  backgroundColor: colors.primary + '15',
                  borderColor: colors.primary + '30',
                },
              ]}
              activeOpacity={0.7}
            >
              <Text style={styles.connectEmoji}>✉️</Text>
              <Text
                style={[styles.connectButtonText, { color: colors.primary }]}
              >
                {t('about.email')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

/** Vision + Core Values */
function VisionSection({
  colors,
  t,
}: {
  colors: Record<string, string>;
  t: (key: string) => string;
}) {
  return (
    <View style={styles.sectionContainer}>
      <View style={styles.visionGrid}>
        {/* Vision Text */}
        <View style={styles.visionTextContainer}>
          <View style={styles.sectionHeader}>
            <View
              style={[
                styles.sectionIconBox,
                { backgroundColor: colors.primary + '18' },
              ]}
            >
              <Text style={styles.sectionIcon}>🚀</Text>
            </View>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {t('about.visionTitle')}
            </Text>
          </View>
          <Text
            style={[styles.visionDescription, { color: colors.textSecondary }]}
          >
            {t('about.visionDescription')}
          </Text>
        </View>

        {/* Core Values */}
        <View
          style={[
            styles.valuesCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border + '80',
            },
          ]}
        >
          <Text style={[styles.valuesTitle, { color: colors.text }]}>
            {t('about.coreValuesTitle')}
          </Text>
          <View style={styles.valuesGrid}>
            {coreValues.map(value => (
              <View
                key={value.key}
                style={[
                  styles.valueItem,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View style={styles.valueHeader}>
                  <Text style={styles.valueIcon}>{value.icon}</Text>
                  <Text style={[styles.valueName, { color: colors.text }]}>
                    {t(`about.coreValue${value.key}Title`)}
                  </Text>
                </View>
                <Text
                  style={[styles.valueDesc, { color: colors.textSecondary }]}
                >
                  {t(`about.coreValue${value.key}Desc`)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

/** Tech Stack: categorized grid */
function TechStackSection({
  colors,
  t,
}: {
  colors: Record<string, string>;
  t: (key: string) => string;
}) {
  return (
    <View
      style={[styles.techStackSection, { backgroundColor: colors.bgSecondary }]}
    >
      <View style={styles.sectionContainer}>
        <View style={styles.techStackHeader}>
          <View style={styles.sectionHeader}>
            <View
              style={[
                styles.sectionIconBox,
                { backgroundColor: colors.primary + '18' },
              ]}
            >
              <Text style={styles.sectionIcon}>💻</Text>
            </View>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {t('about.techStackTitle')}
            </Text>
          </View>
          <Text
            style={[styles.sectionDescription, { color: colors.textSecondary }]}
          >
            {t('about.techStackDescription')}
          </Text>
        </View>

        {techStackGroups.map(group => {
          const categoryKey =
            group.category.charAt(0).toUpperCase() + group.category.slice(1);
          return (
            <View key={group.category} style={styles.techGroup}>
              <Text style={[styles.techGroupTitle, { color: colors.text }]}>
                {t(`about.techCategory${categoryKey}`)}
              </Text>
              <Text
                style={[styles.techGroupDesc, { color: colors.textSecondary }]}
              >
                {t(`about.techCategory${categoryKey}Desc`)}
              </Text>
              <View style={styles.techGrid}>
                {group.items.map(tech => (
                  <View
                    key={tech.name}
                    style={[
                      styles.techCard,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Text style={styles.techIcon}>{tech.icon}</Text>
                    <Text
                      style={[styles.techName, { color: colors.text }]}
                      numberOfLines={1}
                    >
                      {tech.name}
                    </Text>
                    <Text
                      style={[styles.techDesc, { color: colors.textSecondary }]}
                      numberOfLines={2}
                    >
                      {t((tech as any).descKey)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** Footer */
function FooterSection({
  colors,
  t,
}: {
  colors: Record<string, string>;
  t: (key: string) => string;
}) {
  return (
    <View style={[styles.footer, { borderTopColor: colors.border }]}>
      <View style={styles.footerLogoRow}>
        <Image
          source={require('@assets/logo.png')}
          style={styles.footerLogo}
          resizeMode="contain"
        />
        <Text style={[styles.footerBrand, { color: colors.text }]}>Porter</Text>
      </View>
      <Text style={[styles.footerLove, { color: colors.textSecondary }]}>
        {t('about.madeWithLove')}
      </Text>
      <Text style={[styles.footerCopyright, { color: colors.textSecondary }]}>
        {t('about.copyright')}
      </Text>
    </View>
  );
}

// ─── Main Screen ────────────────────────────────────────────────────────────

const AboutScreen: React.FC<AboutTabScreenProps<'About'>> = () => {
  const insets = useSafeAreaInsets();
  const colors = useModeColors();
  const { t } = useTranslation();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title={t('about.title')} showBack hideSearch />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <HeroSection colors={colors} t={t} />
        <FounderSection colors={colors} t={t} />
        <VisionSection colors={colors} t={t} />
        <TechStackSection colors={colors} t={t} />
        <FooterSection colors={colors} t={t} />
      </ScrollView>
    </View>
  );
};

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },

  // ── Hero ────────────────────────────────────────────────────────────────
  heroSection: {
    paddingVertical: spacing.xl * 1.5,
    paddingHorizontal: spacing.lg,
  },
  heroContent: {
    alignItems: 'center',
  },
  heroIconContainer: {
    width: 88,
    height: 88,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  heroLogo: {
    width: 56,
    height: 56,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  heroSubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 300,
  },

  // ── Section Common ──────────────────────────────────────────────────────
  sectionContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  sectionIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionIcon: {
    fontSize: 18,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  sectionDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.md,
    marginLeft: 44,
  },

  // ── Founder Profile ─────────────────────────────────────────────────────
  profileCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: spacing.lg,
    marginTop: spacing.sm,
  },
  profileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  avatarContainer: {
    position: 'relative',
    width: 120,
    height: 120,
  },
  avatarGlow: {
    position: 'absolute',
    inset: -8,
    borderRadius: 68,
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
  },
  avatarWrapper: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  avatarImage: {
    width: 120,
    height: 120,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#22C55E',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  statsRow: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: 10,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  profileInfoSection: {
    marginTop: spacing.lg,
  },
  profileName: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: 20,
  },
  roleIcon: {
    fontSize: 14,
  },
  roleText: {
    fontSize: 13,
    fontWeight: '600',
  },
  bioText: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: spacing.md,
  },
  expertiseTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  skillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  skillChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: 20,
    borderWidth: 1,
  },
  skillText: {
    fontSize: 13,
    fontWeight: '500',
  },
  connectDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  connectTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  connectRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  connectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: 12,
    borderWidth: 1,
  },
  connectEmoji: {
    fontSize: 18,
  },
  connectButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // ── Vision + Values ─────────────────────────────────────────────────────
  visionGrid: {
    gap: spacing.xl,
  },
  visionTextContainer: {},
  visionDescription: {
    fontSize: 15,
    lineHeight: 24,
    marginLeft: 44,
  },
  valuesCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: spacing.lg,
  },
  valuesTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  valuesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  valueItem: {
    width: '48%',
    borderRadius: 12,
    borderWidth: 1,
    padding: spacing.md,
  },
  valueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  valueIcon: {
    fontSize: 20,
  },
  valueName: {
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
  },
  valueDesc: {
    fontSize: 12,
    lineHeight: 17,
  },

  // ── Tech Stack ──────────────────────────────────────────────────────────
  techStackSection: {
    marginTop: spacing.xl,
    paddingVertical: spacing.xl,
  },
  techStackHeader: {
    marginBottom: spacing.lg,
  },
  techGroup: {
    marginBottom: spacing.xl,
  },
  techGroupTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  techGroupDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  techGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  techCard: {
    width: '47%',
    borderRadius: 12,
    borderWidth: 1,
    padding: spacing.md,
  },
  techIcon: {
    fontSize: 28,
    marginBottom: spacing.sm,
  },
  techName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  techDesc: {
    fontSize: 12,
    lineHeight: 16,
  },

  // ── Footer ──────────────────────────────────────────────────────────────
  footer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: spacing.xl,
  },
  footerLogoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  footerLogo: {
    width: 22,
    height: 22,
  },
  footerBrand: {
    fontSize: 18,
    fontWeight: '700',
  },
  footerLove: {
    fontSize: 13,
    marginBottom: spacing.xs,
  },
  footerCopyright: {
    fontSize: 12,
  },
});

export default AboutScreen;
