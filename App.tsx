/**
 * Tarsier — React Native Blog App
 *
 * Root application component with full provider tree:
 * - GestureHandlerRootView (gesture handling for navigation)
 * - SafeAreaProvider (safe area insets)
 * - ThemeProvider (light/dark theme context)
 * - Redux Provider (state management)
 * - i18n initialization (internationalization)
 * - NavigationContainer (React Navigation)
 * - StatusBar
 */

import React, { useEffect, useState } from 'react';
import { StatusBar, StyleSheet, LogBox } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider as ReduxProvider } from 'react-redux';
import { NavigationContainer } from '@react-navigation/native';
import { ThemeProvider, useTheme } from './src/lib/theme/ThemeContext';
import { store } from './src/store';
import './src/lib/i18n/index';
import RootNavigator from './src/navigation/RootNavigator';
import { logger } from './src/lib/logger';

// Suppress known non-critical warnings in development
if (__DEV__) {
  LogBox.ignoreLogs([
    'Non-serializable values were found in the navigation state',
  ]);
}

/**
 * Inner app content that has access to theme context
 * This is separated to access the theme for StatusBar styling
 */
function AppContent(): React.JSX.Element {
  const { theme, isDark } = useTheme();

  return (
    <>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.colors.background}
        translucent={false}
      />
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </>
  );
}

/**
 * Main App component with all providers
 */
function App(): React.JSX.Element {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Initialize app-level services
    const init = async () => {
      try {
        // i18n is initialized via import at the top level
        // Add any async initialization here (e.g., MMKV migration, analytics)
        logger.info('[App] App initialization complete');
      } catch (error) {
        logger.error('[App] Initialization failed', error);
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
            <AppContent />
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
