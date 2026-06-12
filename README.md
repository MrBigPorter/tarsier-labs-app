# 🐵 Tarsier — React Native Blog App

[![App Store](https://img.shields.io/badge/App_Store-000000?logo=apple&logoColor=white)](https://apps.apple.com/app/id6775716781)
[![Google Play](https://img.shields.io/badge/Google_Play-414141?logo=google-play&logoColor=white)]()
[![React Native](https://img.shields.io/badge/React_Native-0.85-61DAFB?logo=react)](https://reactnative.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript)](https://www.typescriptlang.org)
[![Redux Toolkit](https://img.shields.io/badge/Redux_Toolkit-2.x-764ABC?logo=redux)](https://redux-toolkit.js.org)
[![Reanimated](https://img.shields.io/badge/Reanimated-4.x-000000?logo=react)](https://docs.swmansion.com/react-native-reanimated/)
[![React Navigation](https://img.shields.io/badge/Navigation-7.x-6B52AE?logo=react)](https://reactnavigation.org)
[![i18next](https://img.shields.io/badge/i18n-i18next-26A69C?logo=i18next)](https://www.i18next.com)
[![Sentry](https://img.shields.io/badge/Sentry-362D59?logo=sentry)](https://sentry.io)
[![Jest](https://img.shields.io/badge/Jest-C21325?logo=jest)](https://jestjs.io)
[![CodePush](https://img.shields.io/badge/CodePush-1A1A1A?logo=microsoft)](https://learn.microsoft.com/en-us/appcenter/distribution/codepush/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

A production-grade **React Native** mobile blog application featuring clean architecture, Redux Toolkit with RTK Query caching, smooth Reanimated animations, OTA hot updates via self-hosted CodePush, and full internationalization across 6 languages.

> Available on [App Store](https://apps.apple.com/app/id6775716781) · [Google Play]() _(pending review)_ · [Web](https://tarsierlabs.app)

---

## ✨ Technical Highlights

Key engineering challenges solved during development:

- **Multi-language API cache consistency** — RTK Query cache invalidation tied to language changes via `lang` tag, ensuring translated content is always fresh without redundant requests
- **UI thread animations** — Tab bar transitions, theme toggles, and scroll-driven UI visibility powered by Reanimated `useSharedValue` + `withSpring`, achieving 60fps with zero frame drops
- **Self-hosted CodePush infrastructure** — Full OTA hot update system built on a self-hosted CodePush server and `react-native-code-push` v9, enabling JS bundle updates without app store review, with automated CI/CD pipeline
- **Optimistic updates with offline resilience** — Bookmarks and likes use RTK Query optimistic updates for instant UI feedback, with automatic rollback on failure and persisted Redux state via MMKV
- **Real-time comments via SSE** — Server-Sent Events connection using `react-native-sse` for live comment push, with automatic reconnection and scroll-to-new-comment UX
- **Design token system** — Complete theme architecture with typed design tokens, dark/light mode with animated transitions, and MMKV-persisted preference

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

### Deep Linking

| URL Pattern                | Screen         |
| -------------------------- | -------------- |
| `tarsier://article/{slug}` | ArticleDetail  |
| `tarsier://search`         | Search         |
| `tarsier://auth`           | Auth           |
| `tarsier://bookmarks`      | Bookmarks      |
| `https://tarsier.app/*`    | Universal link |

---

## 🧪 Tech Stack

| Category             | Technology                                                           |
| -------------------- | -------------------------------------------------------------------- |
| **Framework**        | React Native 0.85 (New Architecture ready)                           |
| **Language**         | TypeScript 5.x (strict mode)                                         |
| **State Management** | Redux Toolkit 2.x + RTK Query (normalized cache, optimistic updates) |
| **Navigation**       | React Navigation 7.x (Stack + Bottom Tabs)                           |
| **Animations**       | React Native Reanimated 4.x (UI thread animations)                   |
| **Gestures**         | react-native-gesture-handler                                         |
| **i18n**             | i18next + react-i18next (6 languages: EN, ZH, JA, KO, FR, DE)        |
| **Local Storage**    | MMKV 3.x (high-performance key-value storage)                        |
| **Icons**            | react-native-svg (custom icon set)                                   |
| **HTTP & Cache**     | RTK Query with auth token injection, retry, & cache invalidation     |
| **Auth**             | OAuth 2.0 (Google, GitHub, Apple) + JWT refresh                      |
| **Hot Updates**      | Self-hosted CodePush (OTA JS bundle updates)                         |
| **Push**             | Firebase Cloud Messaging                                             |
| **Monitoring**       | Sentry (crash reporting + performance tracing)                       |
| **Testing**          | Jest + React Native Testing Library + Detox (E2E)                    |
| **CI/CD**            | GitHub Actions (automated build, test, deploy)                       |

---

## ✨ Features

- **📱 Cross-platform** — iOS & Android from a single codebase
- **🌐 Multi-language** — 6 languages with i18next, persisted preference
- **🎨 Theming** — Dark/light mode with animated toggle, design token system
- **📖 Article browsing** — Paginated lists, infinite scroll, pull-to-refresh with Reanimated
- **🔍 Search** — Debounced search with MMKV-persisted recent queries
- **🔖 Bookmarks** — Optimistic updates, offline cache, Redux sync
- **💬 Comments** — Inline replies with real-time SSE push notifications
- **🔐 Authentication** — OAuth2 (Google, GitHub, Apple) with JWT refresh flow
- **🎬 Animations** — Spring-based tab bar, scroll-driven UI visibility, theme transitions
- **📊 Performance monitor** — Custom render timing & API call profiling
- **⚡ Hot updates** — Self-hosted CodePush for instant bug fixes without app store review

---

## 🚀 Getting Started

### Prerequisites

- Node.js >= 22.11.0
- Yarn 4.x (Berry)
- React Native CLI dev environment (Xcode 16+ / Android Studio)
- CocoaPods (iOS)

### Installation

```sh
yarn install
cd ios && pod install && cd ..
cp .env.development .env
```

### Development

```sh
yarn start          # Start Metro bundler
yarn ios            # Run on iOS simulator
yarn android        # Run on Android emulator
```

### Testing & Linting

```sh
yarn test           # Jest unit tests
yarn lint           # ESLint with TypeScript rules
```

---

## 📊 Quality & Testing

| Metric             | Status                                                                    |
| ------------------ | ------------------------------------------------------------------------- |
| **Unit Tests**     | Jest + React Native Testing Library (custom render hooks)                 |
| **E2E Tests**      | Detox for critical user flows (auth, article browsing, bookmarks)         |
| **Crash Tracking** | Sentry with source maps, breadcrumbs, and user context                    |
| **Performance**    | Reanimated UI thread animations, image prefetching, render timing monitor |
| **CI Pipeline**    | GitHub Actions: lint → test → build (Android AAB + iOS archive)           |

---

## 📁 Project Structure

```
├── App.tsx                    # Root component with all providers
├── src/
│   ├── api/                   # RTK Query API definitions
│   │   ├── baseApi.ts         # Base query (auth injection, retry, locale)
│   │   └── endpoints/         # 7 endpoint files (articles, auth, comments, etc.)
│   ├── components/
│   │   ├── blog/              # ArticleCard, CommentItem, CategoryFilter, etc.
│   │   ├── core/              # ErrorBoundary, Skeleton, AppImage, EmptyState
│   │   ├── features/          # ThemeToggle, LanguageSwitcher, VideoPlayer
│   │   └── layout/            # TabBar, Header, SearchBar, BottomSheet
│   ├── lib/
│   │   ├── hooks/             # Custom hooks (OAuth, SSE, PaginatedQuery, etc.)
│   │   ├── i18n/              # i18next config (6 locales)
│   │   ├── theme/             # Design tokens, colors, spacing, typography
│   │   ├── perf/              # Performance monitoring (render timing, API timing)
│   │   └── storage.ts         # MMKV storage wrapper
│   ├── messages/              # Translation JSON files (6 languages)
│   ├── navigation/            # Type-safe navigation structure
│   ├── screens/               # 14 screen components
│   └── store/                 # Redux slices (auth, ui, bookmarks, likes)
├── android/                   # Android native project
├── ios/                       # iOS native project
├── assets/                    # Logo, bootsplash, design tokens
└── docs/                      # Deployment guides & architecture docs
```

---

## 🔥 Hot Updates (CodePush)

Over-the-air updates via **self-hosted CodePush**, allowing JS bundle updates without app store review.

```
Developer pushes bundle → Self-hosted CodePush server → App checks on resume → Installs on next restart
```

| Environment    | Deployment Slot | CI Automation                                        |
| -------------- | --------------- | ---------------------------------------------------- |
| **Staging**    | `Staging`       | Auto on `test` branch push                           |
| **Production** | `Production`    | Auto on `hotfix` branch push (with lint + test gate) |

> ⚠️ CodePush only updates the JS bundle — native code changes still require an app store release.
>
> 📖 Full guide: [`docs/self-hosted-codepush-flow.md`](docs/self-hosted-codepush-flow.md)

---

## 🚢 CI/CD Pipeline

The pipeline automates testing, building, and deployment for each push.

| Trigger         | Flavor     | What Gets Built                      | Auto Deploy                     |
| --------------- | ---------- | ------------------------------------ | ------------------------------- |
| `test` branch   | Staging    | APK + iOS archive + CodePush         | ✅ CodePush to Staging          |
| `hotfix` branch | Production | CodePush only (JS bundle, no native) | ✅ CodePush to Production       |
| `v*` tag        | Production | Android AAB + iOS archive            | ✅ Google Play Internal Testing |
| Manual dispatch | User pick  | Selected build                       | Depends on selection            |

> 📖 Full setup guide: [`docs/ci-cd-setup-guide.md`](docs/ci-cd-setup-guide.md)
>
> 📖 Google Play release workflow: [`docs/android-google-play-complete-flow.md`](docs/android-google-play-complete-flow.md)

---

## 👨‍💻 About the Developer

Built by **Porter** — a Full Stack Engineer specializing in React Native, TypeScript, and scalable mobile architectures.

|              |                                                                                                            |
| ------------ | ---------------------------------------------------------------------------------------------------------- |
| **GitHub**   | [MrBigPorter](https://github.com/MrBigPorter)                                                              |
| **Email**    | mrporterdev@gmail.com                                                                                      |
| **Backend**  | [JoyMini_Nest_Monorepo](https://github.com/MrBigPorter/JoyMini_Nest_Monorepo/tree/main/apps/frontend-blog) |
| **Live App** | [tarsierlabs.app](https://tarsierlabs.app/)                                                                |

**Key competencies demonstrated in this project:**

- **React Native** — Cross-platform development with New Architecture, native module integration, BootSplash, OAuth callbacks
- **Redux Toolkit / RTK Query** — Normalized caching, optimistic updates, middleware-driven auth injection & retry
- **TypeScript** — Strict mode, type-safe navigation, generics for custom hooks
- **Reanimated** — UI thread animations, shared values, spring-based transitions
- **Self-hosted infrastructure** — CodePush server, CI/CD pipeline, Google Play automated uploads
- **Internationalization** — Full i18n with 6 languages, locale-aware API requests
- **Performance Engineering** — Image prefetching, render timing analysis, bundle size optimization
- **Clean Architecture** — Separation of concerns, reusable hooks & components, organized by domain

---

## 📄 License

MIT © 2026 Porter
