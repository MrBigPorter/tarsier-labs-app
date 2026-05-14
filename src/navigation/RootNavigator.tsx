/**
 * RootNavigator — Main navigation structure
 *
 * Architecture:
 * ```
 * RootStack (NativeStack)
 * ├── MainTabs (BottomTab)
 * │   ├── HomeTab (NativeStack)
 * │   │   └── Home
 * │   ├── ArticlesTab (NativeStack)
 * │   │   ├── ArticleList
 * │   │   ├── CategoryArticles
 * │   │   └── TagArticles
 * │   ├── CategoriesTab (NativeStack)
 * │   │   ├── CategoryList
 * │   │   └── TagList
 * │   └── ProfileTab (NativeStack)
 * │       ├── Profile (placeholder — redirects to Auth if not logged in)
 * │       ├── Bookmarks
 * │       ├── Settings
 * │       ├── About
 * │       ├── Archive
 * │       └── Stats
 * ├── ArticleDetail (overlays tabs)
 * ├── Search
 * └── Auth (login/register)
 * ```
 *
 * Deep linking:
 * - tarsier://article/{slug} → ArticleDetail
 * - tarsier://search → Search
 * - tarsier://auth → Auth
 * - tarsier://bookmarks → ProfileTab > Bookmarks
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  type RootStackParamList,
  type MainTabParamList,
  type HomeStackParamList,
  type ArticlesStackParamList,
  type CategoriesStackParamList,
  type ProfileStackParamList,
} from './types';
import { useTheme } from '../lib/theme/ThemeContext';
import { typography } from '../lib/theme/typography';

// Screens
import HomeScreen from '../screens/HomeScreen';
import ArticleListScreen from '../screens/ArticleListScreen';
import ArticleDetailScreen from '../screens/ArticleDetailScreen';
import CategoryListScreen from '../screens/CategoryListScreen';
import TagListScreen from '../screens/TagListScreen';
import CategoryArticlesScreen from '../screens/CategoryArticlesScreen';
import TagArticlesScreen from '../screens/TagArticlesScreen';
import SearchScreen from '../screens/SearchScreen';
import BookmarksScreen from '../screens/BookmarksScreen';
import ArchiveScreen from '../screens/ArchiveScreen';
import StatsScreen from '../screens/StatsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import AboutScreen from '../screens/AboutScreen';
import AuthScreen from '../screens/AuthScreen';

// Components
import TabBar, { type TabItem } from '../components/layout/TabBar';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const MainTab = createBottomTabNavigator<MainTabParamList>();

// Nested stack navigators per tab
const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const ArticlesStack = createNativeStackNavigator<ArticlesStackParamList>();
const CategoriesStack = createNativeStackNavigator<CategoriesStackParamList>();
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();

/** Home Tab Stack */
function HomeStackNavigator(): React.JSX.Element {
  const { theme } = useTheme();
  const colors = theme.colors;

  return (
    <HomeStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <HomeStack.Screen name="Home" component={HomeScreen} />
    </HomeStack.Navigator>
  );
}

/** Articles Tab Stack */
function ArticlesStackNavigator(): React.JSX.Element {
  const { theme } = useTheme();
  const colors = theme.colors;

  return (
    <ArticlesStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <ArticlesStack.Screen name="ArticleList" component={ArticleListScreen} />
      <ArticlesStack.Screen
        name="CategoryArticles"
        component={CategoryArticlesScreen}
      />
      <ArticlesStack.Screen
        name="TagArticles"
        component={TagArticlesScreen}
      />
    </ArticlesStack.Navigator>
  );
}

/** Categories Tab Stack */
function CategoriesStackNavigator(): React.JSX.Element {
  const { theme } = useTheme();
  const colors = theme.colors;

  return (
    <CategoriesStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <CategoriesStack.Screen name="CategoryList" component={CategoryListScreen} />
      <CategoriesStack.Screen name="TagList" component={TagListScreen} />
    </CategoriesStack.Navigator>
  );
}

/** Profile Tab Stack */
function ProfileStackNavigator(): React.JSX.Element {
  const { theme } = useTheme();
  const colors = theme.colors;

  return (
    <ProfileStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <ProfileStack.Screen name="Bookmarks" component={BookmarksScreen} />
      <ProfileStack.Screen name="Settings" component={SettingsScreen} />
      <ProfileStack.Screen name="About" component={AboutScreen} />
      <ProfileStack.Screen name="Archive" component={ArchiveScreen} />
      <ProfileStack.Screen name="Stats" component={StatsScreen} />
    </ProfileStack.Navigator>
  );
}

/** Main Bottom Tab Navigator */
function MainTabNavigator(): React.JSX.Element {
  const { theme } = useTheme();
  const colors = theme.colors;

  return (
    <MainTab.Navigator
      tabBar={({ state, descriptors, navigation }) => {
        const tabs: TabItem[] = state.routes.map(route => ({
          key: route.key,
          icon: tabIcons[route.name]?.icon ?? 'home',
          activeIcon: tabIcons[route.name]?.activeIcon,
          label: descriptors[route.key]?.options?.tabBarLabel as string ?? route.name,
        }));
        return (
          <TabBar
            tabs={tabs}
            activeTab={state.routes[state.index].key}
            onTabPress={(key: string) => {
              const route = state.routes.find(r => r.key === key);
              if (route) {
                navigation.navigate(route.name);
              }
            }}
          />
        );
      }}
      screenOptions={{
        headerShown: false,
      }}
      initialRouteName="HomeTab"
    >
      <MainTab.Screen
        name="HomeTab"
        component={HomeStackNavigator}
        options={{ tabBarLabel: 'Home' }}
      />
      <MainTab.Screen
        name="ArticlesTab"
        component={ArticlesStackNavigator}
        options={{ tabBarLabel: 'Articles' }}
      />
      <MainTab.Screen
        name="CategoriesTab"
        component={CategoriesStackNavigator}
        options={{ tabBarLabel: 'Categories' }}
      />
      <MainTab.Screen
        name="ProfileTab"
        component={ProfileStackNavigator}
        options={{ tabBarLabel: 'Profile' }}
      />
    </MainTab.Navigator>
  );
}

/** Linking configuration for deep linking */
export const linking = {
  prefixes: ['tarsier://', 'https://tarsier.app'],
  config: {
    screens: {
      MainTabs: {
        screens: {
          HomeTab: {
            screens: {
              Home: 'home',
            },
          },
          ArticlesTab: {
            screens: {
              ArticleList: 'articles',
              CategoryArticles: 'articles/category/:categorySlug',
              TagArticles: 'articles/tag/:tagSlug',
            },
          },
          CategoriesTab: {
            screens: {
              CategoryList: 'categories',
              TagList: 'tags',
            },
          },
          ProfileTab: {
            screens: {
              Bookmarks: 'bookmarks',
              Settings: 'settings',
              About: 'about',
              Archive: 'archive',
              Stats: 'stats',
            },
          },
        },
      },
      ArticleDetail: {
        path: 'article/:slug',
        parse: {
          slug: (slug: string) => slug,
        },
      },
      Search: 'search',
      Auth: 'auth',
    },
  },
};

/**
 * Root navigator — wraps tab navigator and overlay screens
 */
function RootNavigator(): React.JSX.Element {
  const { theme } = useTheme();
  const colors = theme.colors;

  return (
    <RootStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
      }}
      initialRouteName="MainTabs"
    >
      <RootStack.Screen name="MainTabs" component={MainTabNavigator} />
      <RootStack.Screen name="ArticleDetail" component={ArticleDetailScreen} />
      <RootStack.Screen
        name="Search"
        component={SearchScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <RootStack.Screen
        name="Auth"
        component={AuthScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
    </RootStack.Navigator>
  );
}

/** Maps tab route names to their SvgIcon names */
const tabIcons: Record<string, { icon: string; activeIcon?: string }> = {
  HomeTab: { icon: 'home' },
  ArticlesTab: { icon: 'file-text' },
  CategoriesTab: { icon: 'grid' },
  ProfileTab: { icon: 'user' },
};

export default RootNavigator;
