/**
 * API timing instrumentation — module-level event pattern
 *
 * This module decouples API call recording from React context so that
 * non-React code (e.g. RTK Query baseQuery) can record metrics without
 * needing hooks.
 *
 * Usage:
 *   // In baseApi.ts (non-React):
 *   import { recordApiCall } from '@/lib/perf/apiTiming';
 *   recordApiCall({ endpoint, method, duration, status, timestamp });
 *
 *   // In PerfContext.tsx (React):
 *   import { setApiTimingListener, clearApiTimingListener } from './apiTiming';
 *   useEffect(() => { setApiTimingListener(recordApiCall); return clearApiTimingListener; }, []);
 */
import type { ApiCallRecord } from './types';

type ApiTimingListener = (call: ApiCallRecord) => void;

let listener: ApiTimingListener | null = null;

/** Register a listener to receive API call records (typically from PerfContext) */
export function setApiTimingListener(fn: ApiTimingListener): void {
  listener = fn;
}

/** Remove the registered listener */
export function clearApiTimingListener(): void {
  listener = null;
}

/**
 * Record an API call — safe to call from anywhere, even outside React.
 * If no listener is registered (e.g. in production), this is a no-op.
 */
export function recordApiCall(call: ApiCallRecord): void {
  listener?.(call);
}
