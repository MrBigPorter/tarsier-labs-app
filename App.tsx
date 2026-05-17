/**
 * Tarsier — React Native Blog App
 *
 * Root application component with full provider tree:
 * - GestureHandlerRootView (gesture handling for navigation)
 * - SafeAreaProvider (safe area insets)
 * - ThemeProvider (light/dark theme context)
 * - Redux Provider (state management)
 * - PerfProvider (runtime dev performance monitoring)
 * - i18n initialization (internationalization)
 * - Sentry Performance Monitoring (crash reporting + tracing)
 * - NavigationContainer (React Navigation)
 * - StatusBar
 *
 * Dev tools:
 * - why-did-you-render: logs component re-render reasons to console
 *   (only in __DEV__, selectively marks components with .whyDidYouRender = true)
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';

// ─── Dev-only: why-did-you-render ──────────────────────────────────────
// MUST be initialized before any React component renders.
// Uses require() (not import) so it's tree-shaken in production builds.
if (__DEV__) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const whyDidYouRender = require('@welldone-software/why-did-you-render');
  whyDidYouRender(React, {
    // Track only components explicitly marked with .whyDidYouRender = true
    trackAllPureComponents: false,
    // Log extra function call info for deeper diagnostics
    trackExtraFunctionCalls: false,
    // Default: log to console.group
    logOnDifferentValues: true,
  });
}
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { StatusBar, StyleSheet, LogBox } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider as ReduxProvider } from 'react-redux';
import {
  NavigationContainer,
  type NavigationContainerRef,
} from '@react-navigation/native';
import type { NavigationState } from '@react-navigation/native';
import { ThemeProvider, useTheme } from '@/lib/theme/ThemeContext';
import { store } from '@/store';
import { restoreSession } from '@/store/slices/authSlice';
import '@/lib/i18n/index';
import RootNavigator, { linking } from '@/navigation/RootNavigator';
import { logger } from '@/lib/logger';
import { initSentry, captureException, addBreadcrumb } from '@/lib/sentry';
import { PerfProvider, PerfMonitor, usePerfMonitor } from '@/lib/perf';

// Suppress known non-critical warnings in development
if (__DEV__) {
  LogBox.ignoreLogs([
    'Non-serializable values were found in the navigation state',
  ]);
}

/**
 * Inner app content that has access to theme context and performance monitor.
 * This is separated to access the theme for StatusBar styling.
 */
function AppContent(): React.JSX.Element {
  const { colors, isDark } = useTheme();
  const { recordNav } = usePerfMonitor();
  const navigationRef = useRef<NavigationContainerRef<ReactNavigation.RootParamList>>(null);
  const prevRouteRef = useRef<string>('unknown');
  const prevTimestampRef = useRef<number>(Date.now());

  const handleStateChange = useCallback(
    (state: NavigationState | undefined) => {
      if (!state) return;
      const currentRoute = state.routes[state.index]?.name ?? 'unknown';
      const now = Date.now();
      const duration = now - prevTimestampRef.current;

      if (prevRouteRef.current !== currentRoute) {
        recordNav({
          fromRoute: prevRouteRef.current,
          toRoute: currentRoute,
          duration,
          timestamp: now,
        });
      }

      prevRouteRef.current = currentRoute;
      prevTimestampRef.current = now;
    },
    [recordNav],
  );

  return (
    <>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
        translucent={false}
      />
      <NavigationContainer
        ref={navigationRef}
        linking={linking}
        onReady={() => {
          addBreadcrumb('Navigation ready', 'navigation');
        }}
        onStateChange={handleStateChange}
      >
        <RootNavigator />
      </NavigationContainer>
      <PerfMonitor />
    </>
  );
}

/**
 * Wrapper to inject perf context into navigation-aware AppContent.
 */
function AppContentWithPerf(): React.JSX.Element {
  return (
    <PerfProvider>
      <AppContent />
    </PerfProvider>
  );
}

/**
 * Main App component with all providers
 */
function App(): React.JSX.Element | null {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Initialize app-level services
    const init = async () => {
      try {
        // Restore auth session from MMKV (survives hot reloads)
        store.dispatch(restoreSession());

        // i18n is initialized via import at the top level
        // Initialize Sentry for crash reporting & performance monitoring
        initSentry();

        logger.info('[App] App initialization complete');
        addBreadcrumb('App initialized', 'app');
      } catch (error) {
        logger.error('[App] Initialization failed', error);
        if (error instanceof Error) {
          captureException(error, { context: 'App.init' });
        }
      } finally {
        setIsReady(true);
      }
    };
    init();
  }, []);

  if (!isReady) {
    // Could show a splash screen here
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ReduxProvider store={store}>
          <ThemeProvider>
            <KeyboardProvider>
              <AppContentWithPerf />
            </KeyboardProvider>
          </ThemeProvider>
        </ReduxProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});

export default App;
