/**
 * Network Monitoring — Sentry instrumentation for network connectivity.
 *
 * Tracks network quality changes (fast/medium/slow/unknown) and
 * offline/online transitions.
 *
 * Usage:
 *   import { recordNetworkQualityChange, recordOffline, recordOnline } from '@/lib/monitoring/networkMonitoring';
 *
 *   recordNetworkQualityChange('fast', 'slow');
 *   recordOffline();
 *   recordOnline();
 */
import * as Sentry from '@sentry/react-native';
import {
  getPlatformAttr,
  NETWORK_QUALITY_CHANGE,
  NETWORK_OFFLINE,
  NETWORK_ONLINE,
} from './types';

/**
 * Record a network quality transition.
 *
 * @param from — Previous quality level ('unknown' | 'fast' | 'medium' | 'slow')
 * @param to — New quality level ('unknown' | 'fast' | 'medium' | 'slow')
 */
export function recordNetworkQualityChange(from: string, to: string): void {
  Sentry.addBreadcrumb({
    category: 'network',
    message: `Network quality: ${from} → ${to}`,
    level: 'info',
  });
  Sentry.metrics.count(NETWORK_QUALITY_CHANGE, 1, {
    attributes: {
      from,
      to,
      platform: getPlatformAttr(),
    },
  });
}

/**
 * Record that the device went offline.
 */
export function recordOffline(): void {
  Sentry.addBreadcrumb({
    category: 'network',
    message: 'Device went offline',
    level: 'warning',
  });
  Sentry.metrics.count(NETWORK_OFFLINE, 1, {
    attributes: { platform: getPlatformAttr() },
  });
}

/**
 * Record that the device came back online.
 */
export function recordOnline(): void {
  Sentry.addBreadcrumb({
    category: 'network',
    message: 'Device came back online',
    level: 'info',
  });
  Sentry.metrics.count(NETWORK_ONLINE, 1, {
    attributes: { platform: getPlatformAttr() },
  });
}
