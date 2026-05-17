# AboutScreen i18n Implementation Plan

## Problem

[`AboutScreen.tsx`](src/screens/AboutScreen.tsx) has extensive hardcoded English text across 5 sub-components (`HeroSection`, `FounderSection`, `VisionSection`, `TechStackSection`, `FooterSection`), but **never imports or uses `useTranslation()`** from `react-i18next`. The `about` namespace keys exist in all 6 JSON files with proper translations, but are never referenced.

## Root Cause

The screen was rewritten with a new design (matching web version) but the i18n integration was not carried over. The sub-components receive only `{ colors }` as props and have no access to the `t()` function.

## Solution

1. Add `import { useTranslation } from 'react-i18next';` to imports
2. Add `const { t } = useTranslation();` in the main `AboutScreen` component
3. Pass `t` as a prop to all sub-components
4. Replace all hardcoded strings with `t()` calls

## Changes by Section

### Imports (line 11)
Add `import { useTranslation } from 'react-i18next';` after the existing React import.

### Main Component (lines 477-500)
- Add `const { t } = useTranslation();` after `const { colors } = useTheme();`
- Pass `t` prop to all sub-components: `<HeroSection colors={colors} t={t} />` etc.
- Replace `Header title="About"` with `Header title={t('about.title')}`

### HeroSection (lines 170-190)
- Add `t` to props: `function HeroSection({ colors, t }: { colors: Record<string, string>; t: (key: string) => string })`
- Line 182: `"About Tarsier Labs"` → `{t('about.title')}`
- Lines 184-186: `"Building the next-generation..."` → `{t('about.subtitle')}`

### FounderSection (lines 193-332)
- Add `t` to props
- Lines 210-211: `"Founder Profile"` → `{t('about.founderTitle')}`
- Lines 214-216: `"Creator and core developer..."` → `{t('about.founderDescription')}`
- Line 236: `"Years"` → `{t('about.founderStatYears')}`
- Line 240: `"Projects"` → `{t('about.founderStatProjects')}`
- Line 244: `"Stacks"` → `{t('about.founderStatStacks')}`
- Line 257: `{founder.role}` → `{t('about.teamRoleFullStack')}`
- Lines 262-264: `"Creating elegant solutions..."` → `{t('about.founderBio')}`
- Lines 267-269: `"Expertise"` → `{t('about.founderExpertise')}`
- Lines 291-293: `"Connect"` → `{t('about.founderConnect')}`
- Lines 307-309: `"GitHub"` → `{t('about.github')}`
- Lines 323-325: `"Email"` → `{t('about.email')}`

### VisionSection (lines 335-386)
- Add `t` to props
- Lines 345-347: `"Our Vision"` → `{t('about.visionTitle')}`
- Lines 349-356: vision description text → `{t('about.visionDescription')}`
  - NOTE: JSON stores this as a single string with `\n`, but the code splits across 2 `<Text>` components. Replace both with `{t('about.visionDescription')}`. The `\n` will render naturally.
- Lines 361-363: `"Core Values"` → `{t('about.coreValuesTitle')}`
- Line 373: `{value.title}` → `{t(\`about.coreValue${value.key}Title\`)}`
- Line 377: `{value.desc}` → `{t(\`about.coreValue${value.key}Desc\`)}`

### TechStackSection (lines 389-449)
- Add `t` to props
- Lines 398-400: `"Tech Stack"` → `{t('about.techStackTitle')}`
- Lines 402-405: description text → `{t('about.techStackDescription')}`
- Line 411: `{group.title}` → `{t(\`about.techCategory${group.category.charAt(0).toUpperCase() + group.category.slice(1)}\`)}`
  - Maps: 'frontend' → 'techCategoryFrontend', 'mobile' → 'techCategoryMobile', etc.
- Line 414: `{group.description}` → `{t(\`about.techCategory${group.category.charAt(0).toUpperCase() + group.category.slice(1)}Desc\`)}`
- Line 433: `{tech.name}` → keep as-is (product names don't need translation)
- Line 439: `{tech.description}` → Add a `descKey` field to each tech item in the data array, then use `{t(tech.descKey)}`

### FooterSection (lines 452-473)
- Add `t` to props
- Line 462: `"Tarsier Labs"` → keep as-is (brand name)
- Lines 465-467: `"Made with ❤️ in the Philippines"` → `{t('about.madeWithLove')}`
- Lines 468-470: copyright → `{t('about.copyright')}`

### Data Array Modifications

#### techStackGroups items — add `descKey` field
Each tech item needs a `descKey` referencing the i18n key for its description:

| Item | descKey |
|------|---------|
| Next.js 15 | `about.techNextjs` |
| React 19 | `about.techReact` |
| TypeScript | `about.techTypescript` |
| Tailwind CSS | `about.techTailwind` |
| Flutter | `about.techFlutter` |
| Shorebird | `about.techShorebird` |
| Capacitor | `about.techCapacitor` |
| sembast | `about.techSembast` |
| NestJS | `about.techNestjs` |
| Prisma | `about.techPrisma` |
| PostgreSQL | `about.techPostgresql` |
| Redis | `about.techRedis` |
| SQLite | `about.techSqlite` |
| BullMQ | `about.techBullmq` |
| AWS Rekognition | `about.techAwsRekognition` |
| Google Vertex AI | `about.techVertexAi` |
| AI Agent | `about.techAiAgent` |
| Docker | `about.techDocker` |
| GitHub Actions | `about.techGithubActions` |
| Cloudflare Workers | `about.techCloudflare` |
| Vite | `about.techVite` |
| Sentry | `about.techSentry` |
| Playwright | `about.techPlaywright` |
| Jest/Vitest | `about.techJestVitest` |
| WebSocket | `about.techWebsocket` |
| Socket.IO | `about.techSocketIo` |
| FCM | `about.techFcm` |
| OAuth2 | `about.techOauth` |
| Figma | `about.techFigma` |
| Figma Token | `about.techFigmaToken` |
| SEO | `about.techSeo` |
| next-intl | `about.techNextIntl` |

Then in TSX: `<Text>{t(tech.descKey)}</Text>` instead of `{tech.description}`

## Implementation Order

1. Add `useTranslation` import
2. Add `t()` hook and pass `t` prop to sub-components
3. Replace `Header title` with `t('about.title')`
4. Update `HeroSection` — 2 replacements
5. Update `FounderSection` — 11 replacements
6. Update `VisionSection` — 5 replacements (title, desc, coreValuesTitle, value.title, value.desc)
7. Update `techStackGroups` data — add `descKey` to all 33 items
8. Update `TechStackSection` — 5 replacements (title, desc, group.title, group.desc, tech.desc)
9. Update `FooterSection` — 2 replacements
10. TypeScript compilation verification

## Files to Modify

- [`src/screens/AboutScreen.tsx`](src/screens/AboutScreen.tsx) — Only this file (JSON files already have all keys)
