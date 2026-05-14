import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { Locale, getEnabledLocales, getLocaleToFileMap } from './config';

export type { Locale };

// Import all translation files
import zh from '../../messages/zh.json';
import en from '../../messages/en.json';
import ja from '../../messages/ja.json';
import ko from '../../messages/ko.json';
import fr from '../../messages/fr.json';
import de from '../../messages/de.json';

const resources: Record<string, { translation: Record<string, string> }> = {
  zh: { translation: zh },
  en: { translation: en },
  ja: { translation: ja },
  ko: { translation: ko },
  fr: { translation: fr },
  de: { translation: de },
};

const enabledLocales = getEnabledLocales();
const defaultLocale = 'en';

i18n.use(initReactI18next).init({
  resources,
  lng: defaultLocale,
  fallbackLng: 'en',
  supportedLngs: enabledLocales,
  interpolation: {
    escapeValue: false, // React Native doesn't need escaping
  },
  compatibilityJSON: 'v4',
});

export const changeLanguage = async (locale: string): Promise<void> => {
  await i18n.changeLanguage(locale);
};

export const getCurrentLanguage = (): string => {
  return i18n.language || defaultLocale;
};

export default i18n;
