/**
 * Navigation type definitions
 *
 * Defines the param lists for all navigators in the app.
 * This ensures type safety when navigating between screens.
 *
 * Architecture:
 * - RootStack: BottomTab + stack screens that overlay tabs
 * - MainTabs: Bottom tab navigator (Home, Articles, Categories, Profile)
 * - Each tab has its own nested stack for screen transitions
 */
import type { NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';

// ─── Root Stack ──────────────────────────────────────────────────────────────

export type RootStackParamList = {
  /** Main tab navigator */
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  /** Article detail (overlays tabs) */
  ArticleDetail: { slug: string; articleId?: string };
  /** Full-screen search */
  Search: undefined;
  /** Auth screen (login/register) */
  Auth: undefined;
};

// ─── Main Tab Navigator ──────────────────────────────────────────────────────

export type MainTabParamList = {
  /** Home tab */
  HomeTab: NavigatorScreenParams<HomeStackParamList>;
  /** Articles tab */
  ArticlesTab: NavigatorScreenParams<ArticlesStackParamList>;
  /** Categories tab */
  CategoriesTab: NavigatorScreenParams<CategoriesStackParamList>;
  /** Profile tab */
  ProfileTab: NavigatorScreenParams<ProfileStackParamList>;
};

// ─── Home Stack ──────────────────────────────────────────────────────────────

export type HomeStackParamList = {
  Home: undefined;
};

// ─── Articles Stack ──────────────────────────────────────────────────────────

export type ArticlesStackParamList = {
  ArticleList: { categorySlug?: string; tagSlug?: string } | undefined;
  CategoryArticles: { categorySlug: string; categoryName: string };
  TagArticles: { tagSlug: string; tagName: string };
};

// ─── Categories Stack ────────────────────────────────────────────────────────

export type CategoriesStackParamList = {
  CategoryList: undefined;
  TagList: undefined;
};

// ─── Profile Stack ───────────────────────────────────────────────────────────

export type ProfileStackParamList = {
  Profile: undefined;
  Bookmarks: undefined;
  Settings: undefined;
  About: undefined;
  Archive: undefined;
  Stats: undefined;
};

// ─── Screen Props ────────────────────────────────────────────────────────────

// Root stack screen props
export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

// Tab screen props with composite navigation
export type HomeTabScreenProps<T extends keyof HomeStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<HomeStackParamList, T>,
    BottomTabScreenProps<MainTabParamList>
  >;

export type ArticlesTabScreenProps<T extends keyof ArticlesStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<ArticlesStackParamList, T>,
    BottomTabScreenProps<MainTabParamList>
  >;

export type CategoriesTabScreenProps<T extends keyof CategoriesStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<CategoriesStackParamList, T>,
    BottomTabScreenProps<MainTabParamList>
  >;

export type ProfileTabScreenProps<T extends keyof ProfileStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<ProfileStackParamList, T>,
    BottomTabScreenProps<MainTabParamList>
  >;

// ─── Navigation Helpers ──────────────────────────────────────────────────────

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
