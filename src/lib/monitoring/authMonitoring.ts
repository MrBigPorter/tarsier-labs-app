/**
 * Auth Monitoring — Sentry instrumentation for authentication flows.
 *
 * Tracks login, register, OAuth, and logout events with success/failure
 * breakdowns per authentication method.
 *
 * Usage:
 *   import { recordLogin, recordRegister, recordOAuth, recordLogout } from '@/lib/monitoring/authMonitoring';
 *
 *   recordLogin(true, 'password');
 *   recordOAuth('google', true);
 *   recordLogout();
 */
import * as Sentry from '@sentry/react-native';
import {
  getPlatformAttr,
  AUTH_LOGIN,
  AUTH_REGISTER,
  AUTH_LOGOUT,
  AUTH_OAUTH,
  AUTH_OAUTH_TIMEOUT,
  AUTH_SEND_EMAIL_CODE,
} from './types';

export type AuthMethod = 'password' | 'email_code' | 'oauth';
export type OAuthProvider = 'google' | 'apple' | 'facebook';

/**
 * Record a login attempt.
 *
 * @param success — Whether authentication succeeded
 * @param method — The authentication method used
 */
export function recordLogin(success: boolean, method: AuthMethod): void {
  Sentry.metrics.count(AUTH_LOGIN, 1, {
    attributes: {
      success: String(success),
      method,
      platform: getPlatformAttr(),
    },
  });

  if (!success) {
    Sentry.addBreadcrumb({
      category: 'auth',
      message: `Login failed: ${method}`,
      level: 'warning',
    });
  }
}

/**
 * Record a registration attempt.
 *
 * @param success — Whether registration succeeded
 */
export function recordRegister(success: boolean): void {
  Sentry.metrics.count(AUTH_REGISTER, 1, {
    attributes: {
      success: String(success),
      platform: getPlatformAttr(),
    },
  });

  if (!success) {
    Sentry.addBreadcrumb({
      category: 'auth',
      message: 'Registration failed',
      level: 'warning',
    });
  }
}

/**
 * Record an OAuth login attempt.
 *
 * @param provider — The OAuth provider (google, apple, facebook)
 * @param success — Whether the OAuth flow succeeded
 */
export function recordOAuth(provider: OAuthProvider, success: boolean): void {
  Sentry.metrics.count(AUTH_OAUTH, 1, {
    attributes: {
      provider,
      success: String(success),
      platform: getPlatformAttr(),
    },
  });

  if (!success) {
    Sentry.addBreadcrumb({
      category: 'auth',
      message: `OAuth failed: ${provider}`,
      level: 'warning',
    });
  }
}

/**
 * Record an OAuth flow timeout (user took longer than 120s).
 *
 * @param provider — The OAuth provider that timed out
 */
export function recordOAuthTimeout(provider: OAuthProvider): void {
  Sentry.addBreadcrumb({
    category: 'auth',
    message: `OAuth timeout: ${provider}`,
    level: 'warning',
  });
  Sentry.metrics.count(AUTH_OAUTH_TIMEOUT, 1, {
    attributes: {
      provider,
      platform: getPlatformAttr(),
    },
  });
}

/**
 * Record a logout event.
 */
export function recordLogout(): void {
  Sentry.addBreadcrumb({
    category: 'auth',
    message: 'User logged out',
    level: 'info',
  });
  Sentry.metrics.count(AUTH_LOGOUT, 1, {
    attributes: { platform: getPlatformAttr() },
  });
}

/**
 * Record an email verification code being sent.
 *
 * @param success — Whether the email was sent successfully
 */
export function recordSendEmailCode(success: boolean): void {
  Sentry.metrics.count(AUTH_SEND_EMAIL_CODE, 1, {
    attributes: {
      success: String(success),
      platform: getPlatformAttr(),
    },
  });

  if (!success) {
    Sentry.addBreadcrumb({
      category: 'auth',
      message: 'Failed to send email verification code',
      level: 'warning',
    });
  }
}
