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
 */

import { useState, useEffect, useRef } from 'react';
import { PixelRatio } from 'react-native';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

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
 */
function ensureSubscriptionInitialized(): void {
  if (subscriptionInitialized) return;
  subscriptionInitialized = true;

  // Initialize with defaults + real PixelRatio
  sharedState = getDefaultQuality();

  // Subscribe to NetInfo — fires immediately with current state
  unsubscribeNetInfo = NetInfo.addEventListener(state => {
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
      if (qualityEquals(prev, newQuality)) return;
      currentRef.current = newQuality;
      setQuality(newQuality);
    };

    listeners.add(listener);

    // If sharedState was already initialized after our useState initializer
    // ran (race condition on first mount), sync now
    if (sharedState && !qualityEquals(currentRef.current, sharedState)) {
      currentRef.current = sharedState;
      setQuality(sharedState);
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
