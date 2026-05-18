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

## 📄 License

MIT © 2026 Porter
