/**
 * RootNavigator — Main navigation structure
 *
 * Architecture:
 * ```
 * RootStack (NativeStack)
 * ├── MainTabs (BottomTab)
 * │   ├── HomeTab (NativeStack)
 * │   │   ├── Home
 * │   │   └── ArticleList
 * │   ├── TagsTab (NativeStack)
 * │   │   ├── TagList
 * │   │   └── TagArticles
 * │   ├── CategoriesTab (NativeStack)
 * │   │   ├── CategoryList
 * │   │   └── CategoryArticles
 * │   ├── BookmarksTab (NativeStack)
 * │   │   └── Bookmarks
 * │   └── AboutTab (NativeStack)
 * │       └── About
 * ├── ArticleDetail (overlays tabs)
 * ├── Search
 * ├── Auth (login/register)
 * ├── Archive (articles by year/month)
 * ├── Settings
 * └── Stats (blog statistics)
 * ```
 *
 * Deep linking:
 * - https://blog.joyminis.com/{locale}/articles/{slug} → ArticleDetail
 * - tarsier://article/{slug} → ArticleDetail (legacy)
 * - tarsier://search → Search
 * - tarsier://auth → Auth
 * - tarsier://bookmarks → BookmarksTab > Bookmarks
 * - tarsier://archive → Archive
 * - tarsier://settings → Settings
 * - tarsier://stats → Stats
 *
 * Scroll-driven TabBar:
 * - TabBar is wrapped in Animated.View with translateY driven by tabBarTranslateY
 * - Uses react-native-reanimated useAnimatedStyle for UI-thread safe animation
 * - Shared with HomeScreen via ScrollContext
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  type RootStackParamList,
  type MainTabParamList,
  type HomeStackParamList,
  type TagsStackParamList,
  type CategoriesStackParamList,
  type BookmarksStackParamList,
  type AboutStackParamList,
} from './types';
import { useModeColors } from '@/lib/theme';
import { env } from '@/lib/env';
import { ScrollProvider, useScrollContext } from '@/lib/ScrollContext';
import { useTranslation } from 'react-i18next';

// Screens
import HomeScreen from '@/screens/HomeScreen';
import ArticleListScreen from '@/screens/ArticleListScreen';
import ArticleDetailScreen from '@/screens/ArticleDetailScreen';
import TagListScreen from '@/screens/TagListScreen';
import TagArticlesScreen from '@/screens/TagArticlesScreen';
import CategoryListScreen from '@/screens/CategoryListScreen';
import CategoryArticlesScreen from '@/screens/CategoryArticlesScreen';
import SearchScreen from '@/screens/SearchScreen';
import BookmarksScreen from '@/screens/BookmarksScreen';
import AboutScreen from '@/screens/AboutScreen';
import AuthScreen from '@/screens/AuthScreen';
import ArchiveScreen from '@/screens/ArchiveScreen';
import SettingsScreen from '@/screens/SettingsScreen';
import StatsScreen from '@/screens/StatsScreen';
import PrivacyPolicyScreen from '@/screens/PrivacyPolicyScreen';

// Components
import TabBar, { type TabItem } from '@/components/layout/TabBar';
import type { IconName } from '@/components/core/SvgIcon';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const MainTab = createBottomTabNavigator<MainTabParamList>();

// Nested stack navigators per tab
const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const TagsStack = createNativeStackNavigator<TagsStackParamList>();
const CategoriesStack = createNativeStackNavigator<CategoriesStackParamList>();
const BookmarksStack = createNativeStackNavigator<BookmarksStackParamList>();
const AboutStack = createNativeStackNavigator<AboutStackParamList>();

/** Home Tab Stack */
const HomeStackNavigator = React.memo(
  function HomeStackNavigator(): React.JSX.Element {
    const colors = useModeColors();

    return (
      <HomeStack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <HomeStack.Screen name="Home" component={HomeScreen} />
        <HomeStack.Screen name="ArticleList" component={ArticleListScreen} />
      </HomeStack.Navigator>
    );
  },
);

/** Tags Tab Stack */
const TagsStackNavigator = React.memo(
  function TagsStackNavigator(): React.JSX.Element {
    const colors = useModeColors();

    return (
      <TagsStack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <TagsStack.Screen name="TagList" component={TagListScreen} />
        <TagsStack.Screen name="TagArticles" component={TagArticlesScreen} />
      </TagsStack.Navigator>
    );
  },
);

/** Categories Tab Stack */
const CategoriesStackNavigator = React.memo(
  function CategoriesStackNavigator(): React.JSX.Element {
    const colors = useModeColors();

    return (
      <CategoriesStack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <CategoriesStack.Screen
          name="CategoryList"
          component={CategoryListScreen}
        />
        <CategoriesStack.Screen
          name="CategoryArticles"
          component={CategoryArticlesScreen}
        />
      </CategoriesStack.Navigator>
    );
  },
);

/** Bookmarks Tab Stack */
const BookmarksStackNavigator = React.memo(
  function BookmarksStackNavigator(): React.JSX.Element {
    const colors = useModeColors();

    return (
      <BookmarksStack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <BookmarksStack.Screen name="Bookmarks" component={BookmarksScreen} />
      </BookmarksStack.Navigator>
    );
  },
);

/** About Tab Stack */
const AboutStackNavigator = React.memo(
  function AboutStackNavigator(): React.JSX.Element {
    const colors = useModeColors();

    return (
      <AboutStack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <AboutStack.Screen name="About" component={AboutScreen} />
      </AboutStack.Navigator>
    );
  },
);

/** Main Bottom Tab Navigator */
const MainTabNavigator = React.memo(
  function MainTabNavigator(): React.JSX.Element {
    const colors = useModeColors();
    const { tabBarTranslateY } = useScrollContext();
    const { t } = useTranslation();

    const tabBarAnimatedStyle = useAnimatedStyle(() => ({
      maxHeight: Math.max(0, TAB_BAR_HEIGHT + tabBarTranslateY.value),
    }));

    return (
      <MainTab.Navigator
        tabBar={({ state, descriptors, navigation }) => {
          const tabs: TabItem[] = state.routes.map(route => ({
            key: route.key,
            icon: (tabIcons[route.name]?.icon ?? 'home') as IconName,
            activeIcon: tabIcons[route.name]?.activeIcon as
              | IconName
              | undefined,
            label: t(TAB_LABEL_KEYS[route.name] ?? route.name),
          }));
          return (
            <Animated.View
              style={[
                styles.tabBarWrapper,
                { backgroundColor: colors.background },
                tabBarAnimatedStyle,
              ]}
            >
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
            </Animated.View>
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
          name="TagsTab"
          component={TagsStackNavigator}
          options={{ tabBarLabel: 'Tags' }}
        />
        <MainTab.Screen
          name="CategoriesTab"
          component={CategoriesStackNavigator}
          options={{ tabBarLabel: 'Categories' }}
        />
        <MainTab.Screen
          name="BookmarksTab"
          component={BookmarksStackNavigator}
          options={{ tabBarLabel: 'Bookmarks' }}
        />
        <MainTab.Screen
          name="AboutTab"
          component={AboutStackNavigator}
          options={{ tabBarLabel: 'About' }}
        />
      </MainTab.Navigator>
    );
  },
);

/** Linking configuration for deep linking */
export const linking = {
  prefixes: ['tarsier://', env.WEB_URL],
  config: {
    screens: {
      MainTabs: {
        screens: {
          HomeTab: {
            screens: {
              Home: 'home',
              ArticleList: 'articles',
            },
          },
          TagsTab: {
            screens: {
              TagList: 'tags',
              TagArticles: 'tags/:tagSlug',
            },
          },
          CategoriesTab: {
            screens: {
              CategoryList: 'categories',
              CategoryArticles: 'categories/:categorySlug',
            },
          },
          BookmarksTab: {
            screens: {
              Bookmarks: 'bookmarks',
            },
          },
          AboutTab: {
            screens: {
              About: 'about',
            },
          },
        },
      },
      ArticleDetail: {
        path: ':locale/articles/:slug',
        parse: {
          slug: (slug: string) => slug,
          locale: (locale: string) => locale,
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
  const colors = useModeColors();

  return (
    <RootStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
      }}
      initialRouteName="MainTabs"
    >
      <RootStack.Screen name="MainTabs">
        {() => (
          <ScrollProvider>
            <MainTabNavigator />
          </ScrollProvider>
        )}
      </RootStack.Screen>
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
      <RootStack.Screen name="Archive" component={ArchiveScreen} />
      <RootStack.Screen name="Settings" component={SettingsScreen} />
      <RootStack.Screen name="Stats" component={StatsScreen} />
      <RootStack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
    </RootStack.Navigator>
  );
}

/** Maps tab route names to their SvgIcon names */
const tabIcons: Record<string, { icon: string; activeIcon?: string }> = {
  HomeTab: { icon: 'home' },
  TagsTab: { icon: 'tag' },
  CategoriesTab: { icon: 'grid' },
  BookmarksTab: { icon: 'bookmark' },
  AboutTab: { icon: 'user' },
};

/** Maps tab route names to i18n translation keys for TabBar labels */
const TAB_LABEL_KEYS: Record<string, string> = {
  HomeTab: 'common.home',
  TagsTab: 'common.tags',
  CategoriesTab: 'common.categories',
  BookmarksTab: 'common.bookmarks',
  AboutTab: 'common.about',
};

/** Height of the TabBar content (icon row — used for absolute positioning and screen padding) */
export const TAB_BAR_HEIGHT = 80;

const styles = StyleSheet.create({
  tabBarWrapper: {
    overflow: 'hidden',
    zIndex: 100,
  },
});

export default RootNavigator;
