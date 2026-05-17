# 🐵 Tarsier — React Native Blog App

A full-featured enterprise-grade React Native mobile blog application with i18n, dark/light theme, Redux state management, and offline support.

## ✨ Features

- **📱 Cross-platform**: iOS & Android (React Native 0.85)
- **🌐 Multi-language**: 6 languages (EN/ZH/JA/KO/FR/DE) via i18next
- **🎨 Theming**: Light/dark mode with animated toggle
- **📖 Article browsing**: Paginated lists, infinite scroll, pull-to-refresh
- **🔍 Search**: Debounced search with recent searches (MMKV-persisted)
- **🔖 Bookmarks**: Optimistic updates, offline cache, Redux sync
- **📊 Statistics**: Article/category/tag counts with trend data
- **📅 Archive**: Year/month grouped article archive
- **🏷️ Categories & Tags**: Filtered article lists by category/tag
- **💬 Comments**: Inline comment system with reply support
- **🔐 Authentication**: Login/register with form validation
- **🔗 Deep linking**: `tarsier://article/{slug}`, universal links

## 🏗️ Architecture

```
App.tsx (Providers)
├── GestureHandlerRootView
├── SafeAreaProvider
├── ReduxProvider (store)
│   ├── authSlice      — Authentication state
│   ├── uiSlice        — Theme, language, UI state
│   └── bookmarksSlice — Bookmark management
├── ThemeProvider (light/dark)
├── i18n (i18next)
├── NavigationContainer
└── RootNavigator
    ├── MainTabs (BottomTab)
    │   ├── HomeTab → HomeScreen
    │   ├── ArticlesTab → ArticleList, CategoryArticles, TagArticles
    │   ├── CategoriesTab → CategoryList, TagList
    │   └── ProfileTab → Bookmarks, Settings, About, Archive, Stats
    ├── ArticleDetail
    ├── Search
    └── Auth
```

### Data Flow

```
Screen → RTK Query Hook → baseApi → HTTP Request → API Server
                              ↓
                        Redux Store (cache)
                              ↓
                    Screen re-renders with data
```

### Component Tree

```
components/
├── core/          — SvgIcon, ErrorBoundary, Skeleton, EmptyState, NetworkStatusBar
├── layout/        — Header, TabBar, SearchBar, BottomSheet
├── features/      — LanguageSwitcher, ThemeToggle, ReadingProgress
└── blog/          — ArticleCard, CategoryCard, TagChip, CommentItem, MarkdownRenderer
```

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

### Testing

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

## 📁 Project Structure

```
├── App.tsx                    # Root component with providers
├── index.js                   # Entry point
├── src/
│   ├── api/
│   │   ├── baseApi.ts         # RTK Query base configuration
│   │   └── endpoints/         # API endpoint definitions
│   │       ├── articles.ts    # Article CRUD endpoints
│   │       ├── categories.ts  # Category endpoints
│   │       ├── tags.ts        # Tag endpoints
│   │       ├── comments.ts    # Comment endpoints
│   │       └── bookmarks.ts   # Bookmark endpoints
│   ├── components/
│   │   ├── blog/              # Blog-specific components
│   │   ├── core/              # Reusable UI primitives
│   │   ├── features/          # Feature-specific components
│   │   └── layout/            # App layout components
│   ├── lib/
│   │   ├── env.ts             # Environment config
│   │   ├── logger.ts          # Logging utility
│   │   ├── storage.ts         # MMKV storage wrapper
│   │   ├── theme/             # Theme system (colors, spacing, typography, context)
│   │   ├── i18n/              # i18n configuration
│   │   └── hooks/             # Custom hooks
│   ├── navigation/
│   │   ├── types.ts           # Navigation type definitions
│   │   └── RootNavigator.tsx  # Navigation structure
│   ├── screens/               # Screen components (14 screens)
│   ├── store/
│   │   ├── index.ts           # Redux store configuration
│   │   └── slices/            # Redux slices (auth, ui, bookmarks)
│   └── types/                 # TypeScript type definitions
├── android/                   # Android native project
├── ios/                       # iOS native project
└── .github/workflows/         # CI/CD pipelines
```

## 🔧 Configuration

### Environment Variables

| Variable     | Description          | Default               |
|-------------|----------------------|-----------------------|
| API_URL     | Backend API base URL | http://localhost:3001  |
| SENTRY_DSN  | Error tracking       | (optional)            |

### Deep Linking

| URL Pattern                | Screen         |
|---------------------------|----------------|
| `tarsier://article/{slug}` | ArticleDetail  |
| `tarsier://search`         | Search         |
| `tarsier://auth`           | Auth           |
| `tarsier://bookmarks`      | Bookmarks      |
| `https://tarsier.app/*`    | Universal link |

## 🧪 Tech Stack

| Category       | Technology                         |
|----------------|------------------------------------|
| Framework      | React Native 0.85                  |
| Language       | TypeScript 5.x                     |
| State Mgmt     | Redux Toolkit 2.x + RTK Query      |
| Navigation     | React Navigation 7.x               |
| i18n           | i18next + react-i18next            |
| Storage        | MMKV 3.x                           |
| Icons          | react-native-svg (custom set)      |
| Gestures       | react-native-gesture-handler       |
| Animations     | React Native Animated API          |

## 📄 License

Copyright © 2024 Tarsier Labs. All rights reserved.
# tarsier-labs-app
