/**
 * ScrollContext — Shared animated values for scroll-driven UI
 *
 * Provides:
 * - tabBarTranslateY: SharedValue for TabBar hide/show on scroll (UI thread safe)
 * - lastScrollY: SharedValue tracking last scroll position for direction detection
 *
 * Uses react-native-reanimated SharedValue for UI-thread-safe access
 * from useAnimatedScrollHandler worklets.
 *
 * Used by:
 * - RootNavigator: wraps TabBar with Animated.View using tabBarTranslateY
 * - HomeScreen: updates tabBarTranslateY via useAnimatedScrollHandler
 */
import React, { createContext, useContext, useMemo } from 'react';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';

interface ScrollContextValue {
  /** Shared value for TabBar translateY transform (0 = visible, TAB_BAR_HIDE_OFFSET = hidden) */
  tabBarTranslateY: SharedValue<number>;
  /** Last scroll Y position for scroll direction detection (UI-thread safe) */
  lastScrollY: SharedValue<number>;
}

const ScrollContext = createContext<ScrollContextValue | null>(null);

export function ScrollProvider({ children }: { children: React.ReactNode }) {
  const tabBarTranslateY = useSharedValue(0);
  const lastScrollY = useSharedValue(0);

  // Memoize context value to prevent cascading re-renders of all consumers
  // (e.g. HomeScreen) when ScrollProvider's parent re-renders.
  // useSharedValue returns stable references, so this is effectively constant.
  const value = useMemo(
    () => ({ tabBarTranslateY, lastScrollY }),
    [tabBarTranslateY, lastScrollY],
  );

  return (
    <ScrollContext.Provider value={value}>
      {children}
    </ScrollContext.Provider>
  );
}

export function useScrollContext(): ScrollContextValue {
  const ctx = useContext(ScrollContext);
  if (!ctx) {
    throw new Error('useScrollContext must be used within a ScrollProvider');
  }
  return ctx;
}
