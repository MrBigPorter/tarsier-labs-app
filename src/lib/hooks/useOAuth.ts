/**
 * OAuth login hook — opens the backend's OAuth URL in an in-app browser
 * session (ASWebAuthenticationSession on iOS, Chrome Custom Tabs on Android),
 * intercepts the callback, fetches the user profile, and dispatches
 * setCredentials to Redux.
 *
 * Platform differences:
 *   - iOS:   Uses a custom Swift native module (ASAuthSession) that wraps
 *            ASWebAuthenticationSession (iOS 12+). Returns the callback URL
 *            string via a promise.
 *   - Android: Uses React Native's built-in Linking API to open the URL
 *             (Chrome Custom Tabs) and listen for the callback via the
 *             tarsier:// intent filter.
 */

import { useCallback } from 'react';
import { Platform, NativeModules, Linking } from 'react-native';
import { useAppDispatch } from '@/store';
import { setCredentials } from '@/store/slices/authSlice';
import { env } from '@/lib/env';
import {
  oauthProviders,
  CALLBACK_URL,
  OAuthProvider,
} from '@/lib/oauth/config';

// ─── Helpers ────────────────────────────────────────────────────────────

/**
 * Parse query-string parameters from a URL.
 * Handles standard query params after `?`.
 *
 * IMPORTANT: Strips any URL fragment (`#...`) before parsing, because
 * some OAuth providers (e.g. Google) append `#_` or `#_=_` to the redirect
 * URL. If the fragment is not removed, `URLSearchParams` treats `#_` as
 * part of the last parameter value, corrupting the token (e.g.
 * refreshToken = "yyy#_" instead of "yyy").
 */
function parseQueryParams(url: string): Record<string, string> {
  // Strip URL fragment (#...) before parsing query params
  const fragmentStart = url.indexOf('#');
  const cleanUrl = fragmentStart !== -1 ? url.slice(0, fragmentStart) : url;

  const queryStart = cleanUrl.indexOf('?');
  if (queryStart === -1) {
    return {};
  }
  const params: Record<string, string> = {};
  new URLSearchParams(cleanUrl.slice(queryStart)).forEach((value, key) => {
    params[key] = value;
  });
  return params;
}

/**
 * Fetch the current user's profile using the access token.
 * This is called directly via `fetch` (not through RTK Query) because the
 * token is not yet in the Redux store when we need to make this call.
 *
 * Expected response shape (from ApiResponseWrapper<AuthTokens['user']>):
 * ```json
 * {
 *   "code": 200,
 *   "data": {
 *     "id": "...",
 *     "email": "...",
 *     "nickname": "...",
 *     "avatar": "..."
 *   },
 *   "message": "success"
 * }
 * ```
 */
async function fetchProfile(accessToken: string) {
  const response = await fetch(`${env.API_URL}/api/v1/auth/profile`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch profile: ${response.status}`);
  }
  const json = await response.json();
  // The API wraps responses in { code, data, message }
  return json.data ?? json;
}

/**
 * Open the OAuth URL on Android using React Native's Linking API.
 *
 * On Android, `Linking.openURL()` launches Chrome Custom Tabs (an in-app
 * browser overlay). After the user authenticates, the backend redirects to
 * `tarsier://oauth/callback?...`. The Android intent filter in
 * AndroidManifest.xml catches this custom scheme URL and returns it to the
 * app via `Linking.addEventListener('url', ...)`.
 *
 * Returns a promise that resolves with the full callback URL string.
 */
function openAuthSessionAndroid(authUrl: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    // Timeout after 2 minutes
    const timeout = setTimeout(() => {
      subscription.remove();
      reject(new Error('OAuth timed out'));
    }, 120_000);

    const subscription = Linking.addEventListener('url', ({ url }) => {
      if (url.startsWith(CALLBACK_URL)) {
        clearTimeout(timeout);
        subscription.remove();
        resolve(url);
      }
    });

    Linking.openURL(authUrl).catch((err: Error) => {
      clearTimeout(timeout);
      subscription.remove();
      reject(err);
    });
  });
}

// ─── Hook ───────────────────────────────────────────────────────────────

export function useOAuth() {
  const dispatch = useAppDispatch();

  /**
   * Open the backend OAuth URL for the given provider, wait for the callback,
   * extract tokens, fetch the user profile, and dispatch setCredentials.
   */
  const loginWithProvider = useCallback(
    async (provider: OAuthProvider) => {
      const config = oauthProviders[provider];
      const authUrl = config.getAuthorizationUrl();

      let callbackUrl: string;

      if (Platform.OS === 'ios') {
        // iOS: Use native ASWebAuthenticationSession via the custom Swift module
        callbackUrl = await NativeModules.ASAuthSession.startAuth(
          authUrl,
          'tarsier',
          true, // prefersEphemeralSession — doesn't share cookies with Safari
        );
      } else {
        // Android: Use Chrome Custom Tabs via Linking API
        callbackUrl = await openAuthSessionAndroid(authUrl);
      }

      // Parse tokens from the callback URL
      const params = parseQueryParams(callbackUrl);
      const accessToken = params.token;
      const refreshToken = params.refreshToken;

      if (!accessToken || !refreshToken) {
        throw new Error('Invalid OAuth response — missing tokens');
      }

      // Fetch user profile using the access token
      const user = await fetchProfile(accessToken);

      // Persist to Redux + MMKV
      dispatch(setCredentials({ user, accessToken, refreshToken }));
    },
    [dispatch],
  );

  const loginGoogle = useCallback(
    () => loginWithProvider('google'),
    [loginWithProvider],
  );

  const loginFacebook = useCallback(
    () => loginWithProvider('facebook'),
    [loginWithProvider],
  );

  const loginApple = useCallback(
    () => loginWithProvider('apple'),
    [loginWithProvider],
  );

  return { loginGoogle, loginFacebook, loginApple };
}
