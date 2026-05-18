import { Platform, NativeModules } from 'react-native';
import i18n from 'i18next';
import { initReactI18next, useTranslation } from 'react-i18next';
import { Locale, getEnabledLocales, getLocaleToFileMap } from './config';
import { storage } from '@/lib/storage';

export type { Locale };

// Import all translation files
import zh from '@/messages/zh.json';
import en from '@/messages/en.json';
import ja from '@/messages/ja.json';
import ko from '@/messages/ko.json';
import fr from '@/messages/fr.json';
import de from '@/messages/de.json';

const resources: Record<string, { translation: Record<string, unknown> }> = {
  zh: { translation: zh },
  en: { translation: en },
  ja: { translation: ja },
  ko: { translation: ko },
  fr: { translation: fr },
  de: { translation: de },
};

const enabledLocales = getEnabledLocales();
const defaultLocale = 'en';

/** MMKV key for persisting the user's language choice */
const LANGUAGE_STORAGE_KEY = 'app_language';

/**
 * Read the persisted language from MMKV.
 * Returns the saved locale code if valid, otherwise null.
 */
function getPersistedLanguage(): string | null {
  try {
    const saved = storage.getString(LANGUAGE_STORAGE_KEY);
    if (saved && enabledLocales.includes(saved as Locale)) {
      return saved;
    }
  } catch {
    // Ignore storage read errors
  }
  return null;
}

/**
 * Read the system language/locale from the device.
 * iOS: SettingsManager.settings.AppleLocale (or AppleLanguages[0])
 * Android: I18nManager.localeIdentifier
 *
 * Returns the two-letter language code (e.g. 'zh', 'en', 'ja'),
 * or null if it can't be determined.
 */
function getSystemLanguage(): string | null {
  try {
    let locale: string | undefined;

    if (Platform.OS === 'ios') {
      // iOS exposes the locale via SettingsManager
      const settings = NativeModules.SettingsManager?.settings;
      locale = settings?.AppleLocale ?? settings?.AppleLanguages?.[0];
    } else {
      // Android exposes via I18nManager
      const I18nManager = require('react-native').I18nManager;
      locale = I18nManager.localeIdentifier;
    }

    if (!locale) return null;

    // Extract the language code from locale strings like 'zh-Hans', 'en-US', 'ja-JP'
    const langCode = locale.split('-')[0].toLowerCase();
    return langCode;
  } catch {
    return null;
  }
}

/**
 * Determine the initial language:
 * 1. Persisted user choice (MMKV) — highest priority
 * 2. System language — if it matches a supported locale
 * 3. Default 'en' — fallback
 */
function getInitialLanguage(): string {
  // 1. Check persisted preference
  const persisted = getPersistedLanguage();
  if (persisted) return persisted;

  // 2. Try system language
  const systemLang = getSystemLanguage();
  if (systemLang && enabledLocales.includes(systemLang as Locale)) {
    return systemLang;
  }

  // 3. Fallback to English
  return defaultLocale;
}

const initialLanguage = getInitialLanguage();

i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage,
  fallbackLng: 'en',
  supportedLngs: enabledLocales,
  interpolation: {
    escapeValue: false, // React Native doesn't need escaping
  },
  compatibilityJSON: 'v4',
});

export const changeLanguage = async (locale: string): Promise<void> => {
  await i18n.changeLanguage(locale);
  // Persist the user's language choice
  storage.set(LANGUAGE_STORAGE_KEY, locale);
};

export const getCurrentLanguage = (): string => {
  return i18n.language || defaultLocale;
};

/**
 * Reactive language hook — triggers re-render when i18n language changes.
 *
 * Delegates to `useTranslation()` from react-i18next, which uses React 18's
 * `useSyncExternalStore` for reliable external store subscriptions.
 * This is more robust than the custom `useState` + `i18n.on` subscription
 * pattern, as confirmed by TabBar labels that correctly update via
 * `useTranslation()` on both iOS and Android.
 *
 * @example
 * const lang = useAppLanguage();
 * const { data } = useGetArticlesQuery({ lang, page: 1, pageSize: 10 });
 */
export function useAppLanguage(): string {
  const { i18n: i18nInstance } = useTranslation();
  return i18nInstance.language;
}

/**
 * @deprecated Use `useAppLanguage()` instead — it's more reliable on Android.
 * Kept as a backward-compatible alias.
 */
export const useCurrentLanguage = useAppLanguage;

export default i18n;
