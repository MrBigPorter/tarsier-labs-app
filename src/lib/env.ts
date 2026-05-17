/**
 * Environment configuration
 *
 * For Bare React Native (not Expo), environment is selected via the Metro
 * global __DEV__. This avoids any dependency on native modules like
 * react-native-config.
 *
 * To change environments:
 *   Development:  __DEV__ == true (Metro default when running `yarn start`)
 *   Production:   __DEV__ == false (release build)
 *
 * Usage:
 *   import { env } from '../../lib/env';
 *   const baseUrl = env.API_URL;
 */

interface EnvConfig {
  API_URL: string;
  WEB_URL: string;
  SENTRY_DSN: string;
  DEFAULT_LOCALE: string;
  ENABLE_ANALYTICS: boolean;
  LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';
  OAUTH_GOOGLE_CLIENT_ID: string;
  OAUTH_APPLE_CLIENT_ID: string;
}

// ─── Environment definitions ───────────────────────────────────────────

const DEV_CONFIG: EnvConfig = {
  API_URL: 'https://dev-api.joyminis.com',
  WEB_URL: 'https://blog-dev.joyminis.com',
  SENTRY_DSN: '',
  DEFAULT_LOCALE: 'en',
  ENABLE_ANALYTICS: false,
  LOG_LEVEL: 'debug',
  OAUTH_GOOGLE_CLIENT_ID: '',
  OAUTH_APPLE_CLIENT_ID: '',
};

const PROD_CONFIG: EnvConfig = {
  API_URL: 'https://api.joyminis.com',
  WEB_URL: 'https://blog.joyminis.com',
  SENTRY_DSN: '',
  DEFAULT_LOCALE: 'en',
  ENABLE_ANALYTICS: true,
  LOG_LEVEL: 'warn',
  OAUTH_GOOGLE_CLIENT_ID: '',
  OAUTH_APPLE_CLIENT_ID: '',
};

// ─── Environment detection ────────────────────────────────────────────

/**
 * Returns true when running via Metro dev server (yarn start).
 * __DEV__ is a React Native global boolean injected by Metro.
 * In release builds (both iOS Archive and Android bundle), __DEV__ is false.
 */
function isDevMode(): boolean {
  try {
    return typeof __DEV__ !== 'undefined' ? __DEV__ : false;
  } catch {
    // __DEV__ not available (e.g. test environment)
    return false;
  }
}

function selectConfig(): EnvConfig {
  return isDevMode() ? { ...DEV_CONFIG } : { ...PROD_CONFIG };
}

// ─── Exported config ──────────────────────────────────────────────────

const config = selectConfig();

export const env = {
  /** API base URL (without trailing slash), e.g. http://localhost:3001 or https://api.tarsier.app */
  API_URL: config.API_URL,

  /** Web frontend URL (without trailing slash), used for sharing links and deep linking */
  WEB_URL: config.WEB_URL,

  /** Sentry DSN (optional) */
  SENTRY_DSN: config.SENTRY_DSN,

  /** Default locale for i18n */
  DEFAULT_LOCALE: config.DEFAULT_LOCALE,

  /** Whether to enable analytics */
  ENABLE_ANALYTICS: config.ENABLE_ANALYTICS,

  /** Log level */
  LOG_LEVEL: config.LOG_LEVEL,

  /** OAuth client ID for Google Sign-In (optional) */
  OAUTH_GOOGLE_CLIENT_ID: config.OAUTH_GOOGLE_CLIENT_ID,

  /** OAuth client ID for Apple Sign-In (optional) */
  OAUTH_APPLE_CLIENT_ID: config.OAUTH_APPLE_CLIENT_ID,

  /** Current build variant */
  BUILD_VARIANT: isDevMode() ? 'development' : 'production',

  /** Whether to enable Sentry crash reporting */
  get SENTRY_ENABLED(): boolean {
    return !isDevMode() && !!this.SENTRY_DSN;
  },
} as const;

/** Check if running in development mode */
export const isDev = isDevMode();

/** Check if running in production build */
export const isProd = !isDevMode();

/** Get the API base URL (no trailing slash — fetchBaseQuery concatenates correctly without one) */
export function getApiBaseUrl(): string {
  return env.API_URL;
}
