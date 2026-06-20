/**
 * useNetworkQuality — Adaptive network quality hook (singleton pattern)
 *
 * Provides adaptive image quality settings based on network conditions.
 * Uses a **module-level singleton** to ensure only ONE NetInfo subscription
 * exists across the entire app, preventing cascading re-renders when
 * multiple components (e.g., ArticleCard × 8) all call this hook.
 *
 * Key optimizations:
 * - Singleton: single NetInfo subscription shared across all consumers
 * - Sync PixelRatio: reads PixelRatio.get() synchronously for initial state
 * - Change detection: uses ref to skip setQuality when values haven't changed
 * - All consumers share the same state object reference
 * - Debounce: 5s minimum interval between NetInfo events to reduce network
 * - startTransition: state updates are deferred to avoid competing with animations
 *
 * For consumers inside Reanimated animated trees, use the context hook from
 * NetworkQualityContext.tsx instead.
 */

import { useState, useEffect, useRef, startTransition } from 'react';
import { PixelRatio } from 'react-native';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Minimum interval (ms) between NetInfo events to throttle network checks */
const MIN_NETINFO_INTERVAL_MS = 5000;

// ─── Types ────────────────────────────────────────────────────────────────

export interface NetworkQuality {
  /** 0-100 quality score */
  quality: number;
  /** Preferred image format */
  imageFormat: 'webp' | 'jpg';
  /** Image size tier: 'thumbnail' | 'medium' | 'large' | 'original' */
  imageSize: 'thumbnail' | 'medium' | 'large' | 'original';
  /** Whether to show blurhash placeholder */
  showBlurhash: boolean;
  /** Connection type */
  connectionType: string | null;
  /** Is connected */
  isConnected: boolean;
  /** Device pixel ratio hint */
  pixelRatio: number;
}

// ─── Singleton state (module-level) ──────────────────────────────────────
//
// All callers of useNetworkQuality share these variables. Only the first
// caller triggers the NetInfo subscription. Subsequent callers read the
// already-initialized sharedState and get the same object reference.

let sharedState: NetworkQuality | null = null;
let listeners: Set<(quality: NetworkQuality) => void> = new Set();
let unsubscribeNetInfo: (() => void) | null = null;
let subscriptionInitialized = false;
let lastNetInfoEventTime = 0;

// ─── Quality calculation ─────────────────────────────────────────────────

function getQualityFromNetInfo(
  state: NetInfoState,
): Omit<NetworkQuality, 'pixelRatio'> {
  const { type, isConnected, isInternetReachable } = state;
  const connected = isConnected && isInternetReachable !== false;

  if (!connected) {
    return {
      quality: 0,
      imageFormat: 'jpg',
      imageSize: 'thumbnail',
      showBlurhash: true,
      connectionType: type,
      isConnected: false,
    };
  }

  switch (type) {
    case 'wifi':
    case 'ethernet':
      return {
        quality: 100,
        imageFormat: 'webp',
        imageSize: 'original',
        showBlurhash: false,
        connectionType: type,
        isConnected: true,
      };
    case 'cellular': {
      const cellularGeneration = state.details?.cellularGeneration;
      if (cellularGeneration === '4g' || cellularGeneration === '5g') {
        return {
          quality: 75,
          imageFormat: 'webp',
          imageSize: 'large',
          showBlurhash: false,
          connectionType: `${type}_${cellularGeneration}g`,
          isConnected: true,
        };
      }
      if (cellularGeneration === '3g') {
        return {
          quality: 45,
          imageFormat: 'webp',
          imageSize: 'medium',
          showBlurhash: true,
          connectionType: `${type}_${cellularGeneration}g`,
          isConnected: true,
        };
      }
      // 2G or unknown
      return {
        quality: 20,
        imageFormat: 'jpg',
        imageSize: 'thumbnail',
        showBlurhash: true,
        connectionType: `${type}_${cellularGeneration ?? 'unknown'}g`,
        isConnected: true,
      };
    }
    default:
      return {
        quality: 50,
        imageFormat: 'webp',
        imageSize: 'medium',
        showBlurhash: true,
        connectionType: type,
        isConnected: true,
      };
  }
}

/** Compare two quality objects for equality (ignoring pixelRatio which is stable) */
function qualityEquals(a: NetworkQuality, b: NetworkQuality): boolean {
  return (
    a.quality === b.quality &&
    a.imageFormat === b.imageFormat &&
    a.imageSize === b.imageSize &&
    a.showBlurhash === b.showBlurhash &&
    a.connectionType === b.connectionType &&
    a.isConnected === b.isConnected
  );
}

/**
 * Compute the default quality for synchronous initialization.
 * PixelRatio.get() is synchronous and always available.
 */
function getDefaultQuality(): NetworkQuality {
  return {
    quality: 75,
    imageFormat: 'webp',
    imageSize: 'large',
    showBlurhash: false,
    connectionType: 'unknown',
    isConnected: true,
    pixelRatio: PixelRatio.get(),
  };
}

/**
 * Singleton initializer — runs once to set up the NetInfo subscription.
 * Subsequent calls are no-ops.
 *
 * Includes a debounce guard (MIN_NETINFO_INTERVAL_MS) to prevent the
 * uncacheable HEAD requests (?_=timestamp) from flooding the network
 * during rapid connectivity state changes.
 */
function ensureSubscriptionInitialized(): void {
  if (subscriptionInitialized) {
    return;
  }
  subscriptionInitialized = true;

  // Initialize with defaults + real PixelRatio
  sharedState = getDefaultQuality();

  // Subscribe to NetInfo — fires immediately with current state
  unsubscribeNetInfo = NetInfo.addEventListener(state => {
    // ── Debounce guard ──────────────────────────────────────────────────
    // NetInfo fires a HEAD request to clients3.google.com/generate_204 with
    // a cache-busting timestamp (?_=timestamp) on EVERY event. In regions
    // with high latency (e.g., Philippines, ~45ms average), these add up.
    // Throttle to MIN_NETINFO_INTERVAL_MS to reduce network pressure.
    const now = Date.now();
    if (now - lastNetInfoEventTime < MIN_NETINFO_INTERVAL_MS) {
      return; // Skip — too frequent
    }
    lastNetInfoEventTime = now;

    const netQuality = getQualityFromNetInfo(state);
    const newQuality: NetworkQuality = {
      ...netQuality,
      pixelRatio: PixelRatio.get(),
    };

    // Skip if nothing changed — prevents unnecessary re-renders
    if (sharedState && qualityEquals(sharedState, newQuality)) {
      return;
    }

    sharedState = newQuality;

    // Notify all active consumers
    listeners.forEach(listener => {
      listener(sharedState!);
    });
  });
}

// ─── Hook ─────────────────────────────────────────────────────────────────

/**
 * useNetworkQuality — Returns adaptive network quality settings.
 *
 * Uses a module-level singleton: only ONE NetInfo subscription exists
 * regardless of how many components call this hook. All consumers share
 * the same state and update simultaneously.
 *
 * NOTE: For components inside a Reanimated animated tree, prefer
 * useNetworkQualityContext() from NetworkQualityContext.tsx instead —
 * it reads from a React Context whose provider lives outside the
 * animated tree, preventing state updates from competing with
 * animation frames.
 */
export function useNetworkQuality(): NetworkQuality {
  // Initialize with shared state if available, otherwise defaults
  const [quality, setQuality] = useState<NetworkQuality>(
    () => sharedState ?? getDefaultQuality(),
  );

  // Ref to track current value — prevents redundant setQuality
  const currentRef = useRef(quality);

  useEffect(() => {
    // Ensure the singleton subscription exists
    ensureSubscriptionInitialized();

    // Register this component as a listener
    const listener = (newQuality: NetworkQuality) => {
      const prev = currentRef.current;
      // Skip React state update if values are effectively the same
      // (defensive check — the singleton already does this, but guards
      //  against edge cases where sharedState is set outside listener)
      if (qualityEquals(prev, newQuality)) {
        return;
      }
      currentRef.current = newQuality;
      // Use startTransition to defer the state update — this prevents
      // the React re-render from competing with Reanimated's animation
      // frame processing (the root cause of the JS thread contention
      // observed in Sentry profiles).
      startTransition(() => {
        setQuality(newQuality);
      });
    };

    listeners.add(listener);

    // If sharedState was already initialized after our useState initializer
    // ran (race condition on first mount), sync now
    if (sharedState && !qualityEquals(currentRef.current, sharedState)) {
      currentRef.current = sharedState;
      startTransition(() => {
        setQuality(sharedState!);
      });
    }

    return () => {
      listeners.delete(listener);
      // Cleanup: if no more listeners, tear down the subscription
      if (listeners.size === 0 && unsubscribeNetInfo) {
        unsubscribeNetInfo();
        unsubscribeNetInfo = null;
        subscriptionInitialized = false;
      }
    };
  }, []);

  return quality;
}
