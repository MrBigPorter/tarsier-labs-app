/**
 * Navigation type definitions
 *
 * Defines the param lists for all navigators in the app.
 * This ensures type safety when navigating between screens.
 *
 * Architecture:
 * - RootStack: BottomTab + stack screens that overlay tabs
 * - MainTabs: Bottom tab navigator (Home, Tags, Categories, Bookmarks, About)
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
  ArticleDetail: { slug: string; locale?: string; articleId?: string };
  /** Full-screen search */
  Search: undefined;
  /** Auth screen (login/register) */
  Auth: undefined;
  /** Archive screen (articles by year/month) */
  Archive: undefined;
  /** Settings screen */
  Settings: undefined;
  /** Stats screen (blog statistics) */
  Stats: undefined;
  /** Privacy policy screen */
  PrivacyPolicy: undefined;
};

// ─── Main Tab Navigator ──────────────────────────────────────────────────────

export type MainTabParamList = {
  /** Home tab */
  HomeTab: NavigatorScreenParams<HomeStackParamList>;
  /** Tags tab */
  TagsTab: NavigatorScreenParams<TagsStackParamList>;
  /** Categories tab */
  CategoriesTab: NavigatorScreenParams<CategoriesStackParamList>;
  /** Bookmarks tab */
  BookmarksTab: NavigatorScreenParams<BookmarksStackParamList>;
  /** About tab */
  AboutTab: NavigatorScreenParams<AboutStackParamList>;
};

// ─── Home Stack ──────────────────────────────────────────────────────────────

export type HomeStackParamList = {
  Home: undefined;
  ArticleList: { categorySlug?: string; tagSlug?: string } | undefined;
};

// ─── Tags Stack ──────────────────────────────────────────────────────────────

export type TagsStackParamList = {
  TagList: undefined;
  TagArticles: { tagSlug: string; tagName: string };
};

// ─── Categories Stack ────────────────────────────────────────────────────────

export type CategoriesStackParamList = {
  CategoryList: undefined;
  CategoryArticles: { categorySlug: string; categoryName: string };
};

// ─── Bookmarks Stack ─────────────────────────────────────────────────────────

export type BookmarksStackParamList = {
  Bookmarks: undefined;
};

// ─── About Stack ─────────────────────────────────────────────────────────────

export type AboutStackParamList = {
  About: undefined;
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

export type TagsTabScreenProps<T extends keyof TagsStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<TagsStackParamList, T>,
    BottomTabScreenProps<MainTabParamList>
  >;

export type CategoriesTabScreenProps<T extends keyof CategoriesStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<CategoriesStackParamList, T>,
    BottomTabScreenProps<MainTabParamList>
  >;

export type BookmarksTabScreenProps<T extends keyof BookmarksStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<BookmarksStackParamList, T>,
    BottomTabScreenProps<MainTabParamList>
  >;

export type AboutTabScreenProps<T extends keyof AboutStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<AboutStackParamList, T>,
    BottomTabScreenProps<MainTabParamList>
  >;

// ─── Navigation Helpers ──────────────────────────────────────────────────────

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
