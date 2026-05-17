/**
 * OAuth configuration for Google / Facebook / Apple login.
 *
 * Uses the backend's redirect-based OAuth flow (same as Web).
 * The backend handles all OAuth provider interaction — no client IDs or
 * native SDK configuration needed in the app.
 *
 * Flow:
 *   1. Open the backend's authorization URL in an in-app browser session
 *   2. Backend proxies to Google/Facebook/Apple
 *   3. User authenticates
 *   4. Backend redirects to the app's custom scheme URL with tokens
 *   5. AppAuth intercepts the callback and returns the full URL
 *   6. Parse token + refreshToken and dispatch setCredentials
 */

import { Platform } from 'react-native';
import { env } from '@/lib/env';

export type OAuthProvider = 'google' | 'facebook' | 'apple';

/** The custom scheme URL the backend redirects to after auth */
export const CALLBACK_URL = 'tarsier://oauth/callback';

/**
 * Build the full backend OAuth initiation URL for a given provider.
 *
 * Matches the Web's mobile flow (see page.client.tsx):
 *   params.set('callback', callback);   // custom scheme URL
 *   params.set('platform', platform);   // 'ios' or 'android'
 *   params.set('client', 'mobile');
 */
function buildAuthorizationUrl(provider: string): string {
  const params = new URLSearchParams({
    callback: CALLBACK_URL,
    platform: Platform.OS,
    client: 'mobile',
  });
  return `${env.API_URL}/auth/${provider}/login?${params.toString()}`;
}

export const oauthProviders: Record<OAuthProvider, { getAuthorizationUrl: () => string }> = {
  google: {
    getAuthorizationUrl: () => buildAuthorizationUrl('google'),
  },
  facebook: {
    getAuthorizationUrl: () => buildAuthorizationUrl('facebook'),
  },
  apple: {
    getAuthorizationUrl: () => buildAuthorizationUrl('apple'),
  },
};
