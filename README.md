# 🐵 Tarsier — React Native Blog App

[![React Native](https://img.shields.io/badge/React_Native-0.85-61DAFB?logo=react)](https://reactnative.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript)](https://www.typescriptlang.org)
[![Redux Toolkit](https://img.shields.io/badge/Redux_Toolkit-2.x-764ABC?logo=redux)](https://redux-toolkit.js.org)
[![RTK Query](https://img.shields.io/badge/RTK_Query-2.x-764ABC?logo=redux)](https://redux-toolkit.js.org/rtk-query)
[![Reanimated](https://img.shields.io/badge/Reanimated-4.x-000000?logo=react)](https://docs.swmansion.com/react-native-reanimated/)
[![React Navigation](https://img.shields.io/badge/Navigation-7.x-6B52AE?logo=react)](https://reactnavigation.org)
[![i18next](https://img.shields.io/badge/i18n-i18next-26A69C?logo=i18next)](https://www.i18next.com)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

A full-featured **React Native** mobile blog application showcasing modern mobile development practices — clean architecture, type safety, Redux state management with RTK Query caching, smooth animations via Reanimated, and 6-language i18n support.

> Built as a portfolio project to demonstrate full-stack mobile development skills.

---

## ✨ Features

- **📱 Cross-platform**: iOS & Android (React Native 0.85, New Architecture ready)
- **🌐 Multi-language**: 6 languages (EN/ZH/JA/KO/FR/DE) via i18next + react-i18next
- **🎨 Theming**: Dark/light mode with animated toggle, design token system
- **📖 Article browsing**: Paginated lists, infinite scroll, pull-to-refresh, image prefetching
- **🔍 Search**: Debounced search with recent searches (MMKV-persisted)
- **🔖 Bookmarks**: Optimistic updates, offline cache, Redux sync
- **💬 Comments**: Inline comment system with reply support & real-time SSE updates
- **🔐 Authentication**: Login/register with OAuth2 (Google, GitHub, Apple) & form validation
- **🔗 Deep linking**: Custom URL scheme + universal links
- **📊 Performance monitoring**: Sentry crash reporting, custom perf monitor
- **🎬 Animations**: Reanimated shared values, spring-based tab bar, scroll-based UI visibility

---

## 🏗️ Architecture

```
App.tsx (Providers)
├── GestureHandlerRootView
├── SafeAreaProvider
├── ReduxProvider (store)
│   ├── authSlice             — Authentication state
│   ├── uiSlice               — Theme, language, UI state
│   ├── bookmarksSlice        — Bookmark management
│   └── likesSlice            — Like/unlike management
├── ThemeProvider (light/dark via MMKV)
├── i18n (i18next + react-i18next)
├── NavigationContainer
└── RootNavigator
    ├── MainTabs (Animated BottomTab)
    │   ├── HomeTab → HomeScreen
    │   ├── ArticlesTab → ArticleList, CategoryArticles, TagArticles
    │   ├── CategoriesTab → CategoryList, TagList
    │   └── ProfileTab → Bookmarks, Settings, About, Archive
    ├── ArticleDetail
    ├── Search
    └── Auth
```

### Data Flow

```
Screen → RTK Query Hook → baseApi (auth/retry middleware) → API Server
                               ↓
                         Redux Store (normalized cache)
                               ↓
                     Screen re-renders with cached data
```

---

## 🧪 Tech Stack

| Category             | Technology                                                  |
| -------------------- | ----------------------------------------------------------- |
| **Framework**        | React Native 0.85                                           |
| **Language**         | TypeScript 5.x                                              |
| **State Management** | Redux Toolkit 2.x + RTK Query (API caching)                 |
| **Navigation**       | React Navigation 7.x (Stack + Bottom Tabs)                  |
| **Animations**       | React Native Reanimated 4.x (UI thread animations)          |
| **Gestures**         | react-native-gesture-handler                                |
| **i18n**             | i18next + react-i18next (6 languages)                       |
| **Local Storage**    | MMKV 3.x (fast key-value storage)                           |
| **Icons**            | react-native-svg (custom icon set)                          |
| **HTTP**             | RTK Query with automatic auth token injection & retry logic |
| **Auth**             | OAuth 2.0 (Google, GitHub, Apple) + JWT refresh             |
| **Push**             | Firebase Cloud Messaging                                    |
| **Monitoring**       | Sentry (crash reporting + performance tracing)              |
| **Testing**          | Jest + custom render hook test utilities                    |
| **CI/CD**            | GitHub Actions                                              |

---

## 📸 Screenshots

<!-- TODO: Add screenshots from simulator -->
<!--
| Home Feed | Article Detail | Search |
|-----------|---------------|--------|
| ![Home](screenshots/home.png) | ![Article](screenshots/article.png) | ![Search](screenshots/search.png) |
| **Categories** | **Bookmarks** | **Auth** |
| ![Categories](screenshots/categories.png) | ![Bookmarks](screenshots/bookmarks.png) | ![Auth](screenshots/auth.png) |
-->

---

## 👨‍💻 About the Developer

Built by **Porter** — a Full Stack Developer passionate about building elegant mobile and web experiences.

- **GitHub**: [MrBigPorter](https://github.com/MrBigPorter)
- **App Repo**: [tarsier-labs-app](https://github.com/MrBigPorter/tarsier-labs-app)
- **Backend Repo**: [JoyMini_Nest_Monorepo](https://github.com/MrBigPorter/JoyMini_Nest_Monorepo/tree/main/apps/frontend-blog)
- **Live Web**: [blog.joyminis.com](https://blog.joyminis.com/)
- **Email**: mrporterdev@gmail.com

Key skills demonstrated in this project:

- **React Native** — Cross-platform mobile development with New Architecture support
- **Redux Toolkit / RTK Query** — Predictable state management with automatic API caching
- **TypeScript** — Type-safe code with strict configuration
- **Reanimated** — High-performance UI thread animations
- **React Navigation** — Complex navigation structure with type-safe routing
- **i18n** — Full internationalization with 6 languages
- **Clean Architecture** — Separation of concerns, reusable components, custom hooks
- **Performance** — Image prefetching, scroll-based animations, Sentry monitoring

---

## 🚀 Getting Started

### Prerequisites

- Node.js >= 22.11.0
- Yarn 4.x (Berry)
- React Native CLI development environment
  - Xcode 16+ (iOS)
  - Android Studio (Android)
- CocoaPods (iOS)

### Installation

```sh
# 1. Install dependencies
yarn install

# 2. Install iOS pods
cd ios && pod install && cd ..

# 3. Copy environment files
cp .env.development .env
```

### Development

```sh
# Start Metro bundler
yarn start

# Run on iOS
yarn ios

# Run on Android
yarn android
```

### Testing & Linting

```sh
# Run unit tests
yarn test

# Run linting
yarn lint
```

### Building

```sh
# iOS Release
yarn ios --mode Release

# Android Release
cd android && ./gradlew assembleRelease
```

---

## 📁 Project Structure

```
├── App.tsx                    # Root component with all providers
├── index.js                   # Entry point
├── src/
│   ├── api/
│   │   ├── baseApi.ts         # RTK Query base (auth injection, retry, locale)
│   │   └── endpoints/         # API endpoint definitions (7 endpoints)
│   ├── components/
│   │   ├── blog/              # Blog-specific components (ArticleCard, CommentItem, etc.)
│   │   ├── core/              # Reusable UI primitives (SvgIcon, ErrorBoundary, Skeleton)
│   │   ├── features/          # Feature components (ThemeToggle, LanguageSwitcher)
│   │   └── layout/            # Layout components (TabBar, Header, SearchBar, BottomSheet)
│   ├── lib/
│   │   ├── env.ts             # Environment configuration
│   │   ├── logger.ts          # Console logging utility
│   │   ├── storage.ts         # MMKV storage wrapper
│   │   ├── theme/             # Design tokens, colors, spacing, typography
│   │   ├── i18n/              # i18n config (6 locales)
│   │   ├── hooks/             # Custom hooks (OAuth, SSE, Network, Image Prefetch)
│   │   └── perf/              # Performance monitoring (render timing, API timing)
│   ├── messages/              # i18n translation files (6 languages)
│   ├── navigation/            # Type-safe navigation structure
│   ├── screens/               # 14 screen components
│   └── store/                 # Redux store + slices (auth, ui, bookmarks, likes)
├── android/                   # Android native project
├── ios/                       # iOS native project (BootSplash, OAuth, etc.)
├── assets/                    # Logo, design tokens, bootsplash resources
└── .github/workflows/         # CI/CD pipelines
```

---

## 🔧 Configuration

### Environment Variables

| Variable   | Description          | Default               |
| ---------- | -------------------- | --------------------- |
| API_URL    | Backend API base URL | http://localhost:3001 |
| SENTRY_DSN | Error tracking       | (optional)            |

### Deep Linking

| URL Pattern                | Screen         |
| -------------------------- | -------------- |
| `tarsier://article/{slug}` | ArticleDetail  |
| `tarsier://search`         | Search         |
| `tarsier://auth`           | Auth           |
| `tarsier://bookmarks`      | Bookmarks      |
| `https://tarsier.app/*`    | Universal link |

---

## 🔥 Hot Updates with CodePush

This project uses **react-native-code-push** v9.0.1 for over-the-air JavaScript bundle updates, allowing you to push new features and bug fixes to users without going through the app store review process.

> ⚠️ CodePush only updates the JS bundle and assets — native code changes (native modules, build configs) still require a full app store release.

### How It Works

```
Developer pushes bundle → App Center CDN → App checks on resume → Downloads silently → Installs on next restart
```

### App Center Setup

| Environment        | App Center App (Android) | App Center App (iOS) | Deployment Slots |
| ------------------ | ------------------------ | -------------------- | ---------------- |
| **Staging (Test)** | `TarsierTest` (Android)  | `TarsierTest` (iOS)  | `Staging`        |
| **Production**     | `Tarsier` (Android)      | `Tarsier` (iOS)      | `Production`     |

**Prerequisites:**

1. Create apps in [App Center](https://appcenter.ms)
2. Generate an API token (`App Center → Settings → API Tokens`)
3. Add token to GitHub Secrets as `APPCENTER_ACCESS_TOKEN`
4. Copy deployment keys from each app's `Distribute → CodePush → Deployments`

### Deployment Key Configuration

#### Android — per-flavor `resValue` in [`android/app/build.gradle`](android/app/build.gradle:137)

```groovy
staging {
    resValue "string", "CodePushDeploymentKey", "<STAGING_KEY>"
}
production {
    resValue "string", "CodePushDeploymentKey", "<PRODUCTION_KEY>"
}
```

The resource name must be `CodePushDeploymentKey` — this matches what the autolinking-generated [`PackageList.java`](android/app/build/generated/autolinking/src/main/java/com/facebook/react/PackageList.java:69) expects. The actual key value is resolved at build time from the selected flavor variant.

#### iOS — per-flavor `CODEPUSH_DEPLOYMENT_KEY` in xcconfig

| File                                                     | Key Reference                                          |
| -------------------------------------------------------- | ------------------------------------------------------ |
| [`ios/Config/Test.xcconfig`](ios/Config/Test.xcconfig:6) | `CODEPUSH_DEPLOYMENT_KEY = $(CODEPUSH_KEY_TEST)`       |
| [`ios/Config/Prod.xcconfig`](ios/Config/Prod.xcconfig:6) | `CODEPUSH_DEPLOYMENT_KEY = $(CODEPUSH_KEY_PRODUCTION)` |

The `Info.plist` reads `$(CODEPUSH_DEPLOYMENT_KEY)` via the [`CodePushDeploymentKey`](ios/FrontendBlogMobile/Info.plist:76) key. The actual values must be set in Xcode's build settings or passed as environment variables in CI.

### CodePush HOC in App.tsx

The app is wrapped with the CodePush HOC in [`App.tsx:183`](App.tsx:183):

```typescript
const codePushOptions = {
  checkFrequency: codePush.CheckFrequency.ON_APP_RESUME, // Check when app resumes
  installMode: codePush.InstallMode.ON_NEXT_RESTART, // Install on next cold start
};
const App = codePush(codePushOptions)(AppComponent);
```

- **Check frequency**: `ON_APP_RESUME` — checks for updates every time the app comes to the foreground
- **Install mode**: `ON_NEXT_RESTART` — downloaded updates are applied on the next app cold start (no UI interruption)

### Making a Manual Hot Update

```sh
# Android Staging
npx code-push release-react TarsierTest android -d Staging

# iOS Staging
npx code-push release-react TarsierTest ios -d Staging

# Android Production
npx code-push release-react Tarsier android -d Production

# iOS Production
npx code-push release-react Tarsier ios -d Production
```

### Automated Hot Updates via CI/CD

The [`codepush-test` job in `.github/workflows/deploy.yml:191`](.github/workflows/deploy.yml:191) runs automatically on `test` branch pushes:

```yaml
codepush-test:
  if: ${{ needs.resolve-flavor.outputs.flavor == 'test' }}
  steps:
    - run: npx code-push release-react TarsierTest android -d Staging
    - run: npx code-push release-react TarsierTest ios -d Staging
```

> Production CodePush releases are manual — run the CLI commands above with the production app names and deployment slot (`Production`).

### Viewing Deployment History

```sh
npx code-push deployment history TarsierTest Staging
npx code-push deployment history Tarsier Production
```

### Rollback

If a hot update causes issues:

```sh
# Rollback Staging to previous release
npx code-push rollback TarsierTest Staging

# Rollback Production to a specific label (e.g., v3)
npx code-push rollback Tarsier Production --targetRelease v3
```

---

## 🚢 Production Release Workflow

### Build Variants Matrix

| Variant            | Android Gradle Task       | iOS Scheme                | Bundle ID               | App Name      | CodePush Key |
| ------------------ | ------------------------- | ------------------------- | ----------------------- | ------------- | ------------ |
| **Staging (Test)** | `assembleStagingRelease`  | `FrontendBlogMobile-Test` | `com.tarsier.labs.test` | Tarsier(Test) | Staging      |
| **Production**     | `bundleProductionRelease` | `FrontendBlogMobile`      | `com.tarsier.labs`      | Tarsier       | Production   |

### Prerequisites

- [ ] App Center apps created with deployment keys configured
- [ ] GitHub Secrets configured (`APPCENTER_ACCESS_TOKEN`, signing keys, match config)
- [ ] Android upload keystore at [`android/app/release-upload-key.keystore`](android/app/release-upload-key.keystore)
- [ ] [`keystore.properties`](android/app/keystore.properties) with correct paths
- [ ] iOS certificates and provisioning profiles (Apple Developer account)

### Local Build & Test

```sh
# ── Full clean ──
make clean

# ── Android Staging APK (for testing) ──
make build-test-android
# Output: android/app/build/outputs/apk/staging/release/app-staging-release.apk

# ── Android Production AAB (for Play Store) ──
make build-prod-aab
# Output: android/app/build/outputs/bundle/productionRelease/app-production-release.aab

# ── iOS Staging Archive (unsigned, for testing) ──
make build-test-ios
# Output: ios/build/Test.xcarchive

# ── iOS Production Archive (unsigned, for App Store) ──
make build-prod-ios
# Output: ios/build/Prod.xcarchive

# ── Run on device/simulator ──
make run-test-android   # Staging Android on emulator
make run-prod-android   # Production Android on emulator
```

### CI/CD Pipeline

The deployment pipeline is defined in [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).

For a **complete step-by-step setup guide** (App Center apps, API tokens, deployment keys, GitHub Secrets, keystore, environments), see [`docs/ci-cd-setup-guide.md`](docs/ci-cd-setup-guide.md).

#### Triggers

| Event                      | Flavor      | Action                                                |
| -------------------------- | ----------- | ----------------------------------------------------- |
| Push to `test` branch      | Test        | Build Android APK + iOS archive + CodePush hot update |
| Push to `main` branch      | Production  | Build Android AAB + iOS archive                       |
| Tag `v*`                   | Production  | Build Android AAB + iOS archive                       |
| Manual `workflow_dispatch` | User choice | Build + optional CodePush                             |

#### Pipeline Steps

```
[Push / Tag / Manual Trigger]
         │
         ▼
[resolve-flavor] — determines Test or Production based on branch/tag
         │
         ├──► [build-android] — assembleStagingRelease or bundleProductionRelease
         │         │
         │         └── Upload APK/AAB as artifact
         │
         ├──► [build-ios] — xcodebuild archive with correct scheme/config
         │         │
         │         └── Upload .xcarchive as artifact
         │
         └──► [codepush-test] — only on test branch
                   │
                   └── code-push release-react for Android + iOS
```

#### Required GitHub Configuration

##### GitHub Secrets

Set these in **Settings → Secrets and variables → Actions**:

| Secret                    | Purpose                                                            | Where It's Used                                                  |
| ------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------- |
| `APPCENTER_ACCESS_TOKEN`  | App Center API token for CodePush                                  | [`deploy.yml:214`](.github/workflows/deploy.yml:214)             |
| `KEYSTORE_FILE`           | Android keystore filename (e.g. `app/release-upload-key.keystore`) | [`build.gradle:120`](android/app/build.gradle:120) via `-P` flag |
| `KEYSTORE_PASSWORD`       | Android keystore password                                          | [`build.gradle:122`](android/app/build.gradle:122)               |
| `KEY_ALIAS`               | Android signing key alias                                          | [`build.gradle:123`](android/app/build.gradle:123)               |
| `KEY_PASSWORD`            | Android signing key password                                       | [`build.gradle:124`](android/app/build.gradle:124)               |
| `CODEPUSH_KEY_TEST`       | iOS CodePush deployment key (Test flavor)                          | [`Test.xcconfig:6`](ios/Config/Test.xcconfig:6)                  |
| `CODEPUSH_KEY_PRODUCTION` | iOS CodePush deployment key (Production flavor)                    | [`Prod.xcconfig:6`](ios/Config/Prod.xcconfig:6)                  |

> ⚠️ **Keystore file:** The actual `release-upload-key.keystore` must also be accessible to the CI runner.
> Options:
>
> - **Recommended:** Base64-encode the file → store as a secret → decode in CI step before building
> - **Alternative:** Commit the `.keystore` file to the repo (less secure)
>
> The local `keystore.properties` file is ignored by [`.gitignore`](.gitignore) and is **not** used in CI — all signing config comes from GitHub Secrets via `-P` Gradle flags.

##### GitHub Environments

The pipeline references [GitHub Environments](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment) for deployment targeting.
Create these in **Settings → Environments**:

| Environment  | Used by Job(s)                                | Notes                                           |
| ------------ | --------------------------------------------- | ----------------------------------------------- |
| `test`       | `build-android`, `build-ios`, `codepush-test` | CodePush hot updates run under this environment |
| `production` | `build-android`, `build-ios`                  | Production build artifacts                      |

### Google Play Store Release

1. **Build production AAB:**

   ```sh
   make build-prod-aab
   # or: cd android && ./gradlew bundleProductionRelease
   ```

2. **Locate the AAB:**

   ```
   android/app/build/outputs/bundle/productionRelease/app-production-release.aab
   ```

3. **Upload to Google Play Console:**
   - Go to `Google Play Console → Production → Create new release`
   - Upload the `.aab` file
   - Fill in release notes
   - Review and roll out

4. **Tag the release:**
   ```sh
   git tag v1.0.0
   git push origin v1.0.0
   ```

### Apple App Store Release

1. **Build production archive:**

   ```sh
   make build-prod-ios
   # or: cd ios && xcodebuild -workspace FrontendBlogMobile.xcworkspace \
   #   -scheme FrontendBlogMobile -configuration Release \
   #   -archivePath ./build/Prod.xcarchive archive
   ```

2. **Distribute via Xcode Organizer:**
   - Open the generated `.xcarchive` in Xcode
   - `Window → Organizer → Select archive → Distribute App`
   - Choose `App Store Connect` → Upload

3. **Or use the command line with Apple ID credentials:**

   ```sh
   xcodebuild -exportArchive \
     -archivePath ios/build/Prod.xcarchive \
     -exportPath ios/build/Prod.ipa \
     -exportOptionsPlist ios/ExportOptions.plist
   ```

4. **Submit via App Store Connect:**
   - Wait for processing
   - Set up in-app purchases, subscriptions if needed
   - Submit for review

### End-to-End Release Checklist

```markdown
## Pre-Release Checklist

### Code Push (Hot Update — fast path)

- [ ] Feature/bugfix is JS-only (no native module changes)
- [ ] CodePush keys configured for both platforms
- [ ] Test on staging via `code-push release-react TarsierTest Staging`
- [ ] Monitor for crashes via Sentry

### Full App Store Release

- [ ] Version bump in `build.gradle` (versionCode + versionName) and iOS `Info.plist`
- [ ] Changelog updated
- [ ] All tests pass: `yarn test`
- [ ] Lint passes: `yarn lint`
- [ ] Android production AAB builds: `make build-prod-aab`
- [ ] iOS production archive builds: `make build-prod-ios`
- [ ] Signed with correct certificates (Apple Developer)
- [ ] Screenshots updated (if UI changed)
- [ ] Privacy policy updated (if data handling changed)
```

---

## 📄 License

MIT © 2026 Porter
