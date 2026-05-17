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

const initialLanguage = getPersistedLanguage() || defaultLocale;

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
 * Use this instead of getCurrentLanguage() in React components to ensure
 * components re-render and API queries re-fetch with the new language.
 *
 * @example
 * const lang = useCurrentLanguage();
 * const { data } = useGetArticlesQuery({ lang, page: 1, pageSize: 10 });
 */
export function useCurrentLanguage(): string {
  const { i18n: i18nInstance } = useTranslation();
  return i18nInstance.language;
}

export default i18n;
