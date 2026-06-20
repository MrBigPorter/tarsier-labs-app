/**
 * NetworkQualityContext — React Context for network quality state.
 *
 * The provider lives in App.tsx ABOVE any animated components (HomeScreen),
 * ensuring the React state (useState inside useNetworkQuality) lives in a
 * component that does NOT participate in Reanimated animations.
 *
 * This prevents the NetInfo generate_204 callback from competing with
 * Reanimated's animation frame pipeline — the root cause of image load
 * failures on warm start in high-latency regions (Philippines).
 *
 * Usage:
 *   // App.tsx — wrap above animated content
 *   <NetworkQualityProvider>
 *     <AppComponent />
 *   </NetworkQualityProvider>
 *
 *   // HomeScreen.tsx — read quality without owning useState
 *   const quality = useNetworkQualityContext();
 */

import React, { createContext, useContext } from 'react';
import { PixelRatio } from 'react-native';
import { NetworkQuality, useNetworkQuality } from './useNetworkQuality';

// ─── Context ─────────────────────────────────────────────────────────────

const NetworkQualityContext = createContext<NetworkQuality>({
  quality: 75,
  imageFormat: 'webp',
  imageSize: 'large',
  showBlurhash: false,
  connectionType: 'unknown',
  isConnected: true,
  pixelRatio: PixelRatio.get(),
});

// ─── Provider ────────────────────────────────────────────────────────────

/**
 * Provider component — wraps the app above animated content.
 * Internally calls useNetworkQuality() (which owns the useState + singleton
 * NetInfo subscription) and distributes the value via React Context.
 */
export function NetworkQualityProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const quality = useNetworkQuality();
  return (
    <NetworkQualityContext.Provider value={quality}>
      {children}
    </NetworkQualityContext.Provider>
  );
}

// ─── Consumer Hook ───────────────────────────────────────────────────────

/**
 * Context consumer hook — for components that are in an animated tree
 * (e.g., HomeScreen uses Reanimated) and should NOT own the useState.
 *
 * Use this instead of useNetworkQuality() when the consumer lives inside
 * a Reanimated animated component tree, to prevent state updates from
 * competing with animation frames.
 */
export function useNetworkQualityContext(): NetworkQuality {
  return useContext(NetworkQualityContext);
}
