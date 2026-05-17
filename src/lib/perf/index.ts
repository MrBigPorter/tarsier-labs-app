/**
 * Performance Monitor — barrel export
 *
 * Re-exports all public types, hooks, and components for easy importing.
 *
 * Usage:
 *   import { PerfProvider, PerfMonitor, usePerfMonitor, useRenderTiming, triggerJankProfile } from '@/lib/perf';
 *   import type { FpsSnapshot, ApiCallRecord, RenderRecord, NavRecord } from '@/lib/perf';
 */
export { PerfProvider, usePerfMonitor } from './PerfContext';
export { PerfMonitor } from './PerfMonitor';
export { useRenderTiming } from './useRenderTiming';
export { recordApiCall, setApiTimingListener, clearApiTimingListener } from './apiTiming';
export {
  triggerJankProfile,
  cancelJankProfile,
  isProfilingActive,
  getLastProfileTimestamp,
} from './autoProfile';
export type {
  FrameSample,
  FpsSnapshot,
  ApiCallRecord,
  RenderRecord,
  NavRecord,
  PerfState,
  PerfActions,
} from './types';
