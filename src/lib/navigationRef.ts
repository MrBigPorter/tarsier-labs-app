/**
 * Shared navigation reference for use outside React components.
 *
 * React Navigation's `createNavigationContainerRef` creates a ref that can be
 * passed to `<NavigationContainer ref={...}>` from a module-level variable,
 * allowing navigation calls from Redux middleware, base API queries, and other
 * non-component code.
 *
 * Usage:
 * ```ts
 * import { navigateToAuth } from '@/lib/navigationRef';
 *
 * // Navigate to Auth screen (safe to call even before NavigationContainer mounts)
 * navigateToAuth();
 * ```
 */
import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from '@/navigation/types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

/**
 * Navigate to the Auth/login screen.
 *
 * Safe to call at any time — checks `isReady()` first to avoid errors when
 * the NavigationContainer hasn't mounted yet (e.g. during app initialization).
 */
export function navigateToAuth(): void {
  if (navigationRef.isReady()) {
    navigationRef.navigate('Auth');
  }
}
