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

import React, { useEffect, useRef, useCallback } from 'react';

// ─── Dev-only: why-did-you-render ──────────────────────────────────────
// MUST be initialized before any React component renders.
// Uses require() (not import) so it's tree-shaken in production builds.
if (__DEV__) {
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
import { StatusBar, StyleSheet, LogBox, AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider as ReduxProvider } from 'react-redux';
import { NavigationContainer } from '@react-navigation/native';
import type { NavigationState } from '@react-navigation/native';
import { navigationRef } from '@/lib/navigationRef';
import { ThemeProvider, useTheme } from '@/lib/theme/ThemeContext';
import { store } from '@/store';
import { restoreSession } from '@/store/slices/authSlice';
import '@/lib/i18n/index';
import RootNavigator, { linking } from '@/navigation/RootNavigator';
import { logger } from '@/lib/logger';
import {
  initSentry,
  captureException,
  addBreadcrumb,
  reactNavigationIntegration,
} from '@/lib/sentry';
import { NetworkQualityProvider } from '@/lib/hooks/NetworkQualityContext';
import {
  startColdStartSpan,
  endColdStartSpan,
  recordAppBackground,
  recordAppForeground,
} from '@/lib/monitoring';
import { PerfProvider, PerfMonitor, usePerfMonitor } from '@/lib/perf';
import BootSplash from 'react-native-bootsplash';
import codePush from 'react-native-code-push';

// process.env.APP_ENV is inlined at build time by
// babel-plugin-transform-inline-environment-variables.
// This declaration satisfies TypeScript without installing @types/node
// (which would conflict with React Native's global types).
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      APP_ENV?: 'staging' | 'production' | 'development';
    }
  }
  interface Process {
    env: NodeJS.ProcessEnv;
  }

  var process: Process;
}

// Suppress known non-critical warnings in development
if (__DEV__) {
  LogBox.ignoreLogs([
    'Non-serializable values were found in the navigation state',
    // Sentry Native touch tracker fires this when tapping native-only components
    // (e.g. react-native-video's <Video> uses ExoPlayer/AVPlayer, bypassing RN touch system).
    // Completely harmless — Sentry just can't record a breadcrumb for that tap.
    'Unable to find click target',
  ]);
}

/**
 * Inner app content that has access to theme context and performance monitor.
 * This is separated to access the theme for StatusBar styling.
 */
function AppContent(): React.JSX.Element {
  const { colors, isDark } = useTheme();
  const { recordNav } = usePerfMonitor();
  const prevRouteRef = useRef<string>('unknown');
  const prevTimestampRef = useRef<number>(Date.now());

  const handleStateChange = useCallback(
    (state: NavigationState | undefined) => {
      if (!state) {
        return;
      }
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
function AppComponent(): React.JSX.Element {
  const coldStartSpanRef = useRef<ReturnType<typeof startColdStartSpan>>(null);

  useEffect(() => {
    // Initialize app-level services
    const init = async () => {
      try {
        // Start cold start trace span (20% sampled)
        coldStartSpanRef.current = startColdStartSpan();

        // Restore auth session from MMKV (survives hot reloads)
        store.dispatch(restoreSession());

        // i18n is initialized via import at the top level
        // Defer Sentry initialization until after the first screen is fully
        // rendered and all navigation animations have settled. This prevents
        // the Sentry SDK (~30-50KB native overhead) from competing for CPU
        // time during the critical startup path (LCP / first paint).
        // Note: setTimeout(0) is used instead of the deprecated InteractionManager.
        setTimeout(() => {
          // Register navigation container BEFORE initSentry so Sentry's
          // afterAllSetup callback can create the initial navigation span.
          // IMPORTANT: This must be called after NavigationContainer mounts,
          // otherwise navigationRef.current is null and Sentry silently drops
          // all navigation listeners → zero Tracing data.
          reactNavigationIntegration.registerNavigationContainer(navigationRef);
          initSentry();
        }, 0);

        logger.info('[App] App initialization complete');
        addBreadcrumb('App initialized', 'app');

        // End cold start span — captures total init duration
        endColdStartSpan(coldStartSpanRef.current);
      } catch (error) {
        logger.error('[App] Initialization failed', error);
        if (error instanceof Error) {
          captureException(error, { context: 'App.init' });
        }
      } finally {
        // Hide native splash screen with fade animation
        BootSplash.hide({ fade: true });
      }
    };
    init();
  }, []);

  // Track app lifecycle state transitions (background/foreground)
  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (nextState: string) => {
        if (nextState === 'background') {
          recordAppBackground();
        } else if (nextState === 'active') {
          recordAppForeground();
        }
      },
    );
    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ReduxProvider store={store}>
          <ThemeProvider>
            <KeyboardProvider>
              <NetworkQualityProvider>
                <AppContentWithPerf />
              </NetworkQualityProvider>
            </KeyboardProvider>
          </ThemeProvider>
        </ReduxProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Safe CodePush wrapper — replaces the default HOC to prevent Release-mode
 * crashes from unhandled promise rejections.
 *
 * The default HOC (codePush() at CodePush.js:562) calls CodePush.sync()
 * without .catch(), causing unhandled promise rejections that crash the app
 * in Release mode (Hermes treats unhandled rejections as fatal errors).
 *
 * This wrapper:
 * 1. Calls codePush.notifyAppReady() to mark the current bundle as good
 * 2. Calls codePush.sync() with .catch() to handle network/API errors gracefully
 * 3. Uses a small startup delay so sync doesn't compete with critical init
 *
 * CodePush is still disabled in __DEV__ because:
 * - The Metro dev server serves the JS bundle, making OTA updates meaningless
 * - The self-hosted server (cp.hyperpush.org) behind Cloudflare returns
 *   JS Challenge pages that can't be parsed, causing network errors
 * - See: plans/codepush-login-blocking-fix.md
 */
function CodePushSafeWrapper({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Skip CodePush sync in two scenarios:
    //  1. __DEV__ (local dev via Metro)
    //  2. APP_ENV=staging (staging/local builds via make deploy-test-ios)
    //     This prevents the app from downloading an older CodePush Staging
    //     release and overriding the local build on the next resume.
    if (__DEV__ || process.env.APP_ENV === 'staging') {
      return;
    }

    let cancelled = false;

    // Defer notifyAppReady past first paint using requestAnimationFrame.
    // The previous code called notifyAppReady() synchronously on mount,
    // which could POST to cp.hyperpush.org (observed ~1.24s in Sentry traces)
    // and block the JS thread during the critical first-paint window.
    // By deferring to after the next animation frame, the home screen can
    // render before CodePush startup work begins.
    requestAnimationFrame(() => {
      if (cancelled) {
        return;
      }

      codePush
        .notifyAppReady()
        .then(() => {
          logger.info('[CodePush] App ready notified');
        })
        .catch((err: unknown) => {
          logger.warn('[CodePush] notifyAppReady failed (non-fatal):', err);
        });
    });

    // Defer sync to avoid blocking critical startup path (Sentry, auth restore).
    // CodePush sync makes HTTP requests to the self-hosted server which may
    // be slow or blocked by Cloudflare JS challenges — don't let that delay
    // the first paint.
    const syncTimer = setTimeout(() => {
      if (cancelled) {
        return;
      }

      codePush
        .sync({
          installMode: codePush.InstallMode.ON_NEXT_RESUME,
          // Install on next app resume — user goes to background and comes back
          mandatoryInstallMode: codePush.InstallMode.ON_NEXT_RESUME,
        })
        .then(() => {
          logger.info('[CodePush] Sync completed');
        })
        .catch((err: unknown) => {
          logger.warn('[CodePush] Sync failed (non-fatal):', err);
          if (err instanceof Error) {
            addBreadcrumb('[CodePush] Sync failed: ' + err.message, 'error');
          }
        });
    }, 1000); // 1s delay — let first paint complete, then check for updates

    return () => {
      cancelled = true;
      clearTimeout(syncTimer);
    };
  }, []);

  return <>{children}</>;
}

/**
 * CodePush-enabled root — wraps AppComponent with CodePush in non-__DEV__ mode.
 * In __DEV__ mode, CodePush is skipped and AppComponent renders directly.
 */
function AppWithCodePush(): React.JSX.Element {
  if (__DEV__) {
    return <AppComponent />;
  }

  return (
    <CodePushSafeWrapper>
      <AppComponent />
    </CodePushSafeWrapper>
  );
}

const App = AppWithCodePush;

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});

export default App;
