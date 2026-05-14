import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { colors } from './colors';

type ThemeMode = 'light' | 'dark';

interface ThemeContextValue {
  mode: ThemeMode;
  isDark: boolean;
  colors: typeof colors.light;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}

const lightColors = {
  ...colors,
  background: colors.white,
  surface: colors.neutral[50],
  surfaceVariant: colors.neutral[100],
  text: colors.neutral[900],
  textSecondary: colors.neutral[600],
  textTertiary: colors.neutral[400],
  border: colors.neutral[200],
  borderLight: colors.neutral[100],
  primary: colors.primary[500],
  primaryDark: colors.primary[700],
  primaryLight: colors.primary[100],
};

const darkColors: typeof lightColors = {
  ...colors,
  background: colors.neutral[900],
  surface: colors.neutral[800],
  surfaceVariant: colors.neutral[700],
  text: colors.neutral[50],
  textSecondary: colors.neutral[300],
  textTertiary: colors.neutral[500],
  border: colors.neutral[700],
  borderLight: colors.neutral[800],
  primary: colors.primary[400],
  primaryDark: colors.primary[300],
  primaryLight: colors.primary[900],
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>(systemScheme ?? 'light');

  const toggleTheme = useCallback(() => {
    setMode(prev => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const setTheme = useCallback((newMode: ThemeMode) => {
    setMode(newMode);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      isDark: mode === 'dark',
      colors: mode === 'dark' ? darkColors : lightColors,
      toggleTheme,
      setTheme,
    }),
    [mode, toggleTheme, setTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
