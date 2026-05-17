/**
 * Performance monitoring type definitions
 */

/** Single frame timing sample */
export interface FrameSample {
  timestamp: number;
  /** Duration of this frame in ms */
  duration: number;
}

/** Snapshot of current FPS stats */
export interface FpsSnapshot {
  /** Current FPS (rolling 1s window) */
  current: number;
  /** Min FPS in last 5s */
  min: number;
  /** Average FPS in last 5s */
  avg: number;
  /** Total frames dropped (over ~16ms threshold) */
  droppedFrames: number;
}

/** Single API call record */
export interface ApiCallRecord {
  endpoint: string;
  method: string;
  /** Duration in ms */
  duration: number;
  /** HTTP status code (0 = error) */
  status: number;
  timestamp: number;
}

/** Component render measurement */
export interface RenderRecord {
  /** Component display name or `id` prop */
  name: string;
  /** Render duration in ms */
  duration: number;
  /** Timestamp of commit */
  timestamp: number;
  /** "actual" = mount/update, "phase" from Profiler */
  phase: 'mount' | 'update';
}

/** Navigation timing record */
export interface NavRecord {
  fromRoute: string;
  toRoute: string;
  /** Time for the screen to appear after navigation */
  duration: number;
  timestamp: number;
}

/** Aggregated state exposed by PerfContext */
export interface PerfState {
  fps: FpsSnapshot;
  recentApiCalls: ApiCallRecord[];
  recentRenders: RenderRecord[];
  recentNavs: NavRecord[];
  /** Whether the overlay is visible */
  isVisible: boolean;
  /** Whether monitoring is actively collecting data */
  isActive: boolean;
}

/** Actions to control the perf monitor */
export interface PerfActions {
  toggleVisibility: () => void;
  show: () => void;
  hide: () => void;
  reset: () => void;
  /** Export metrics to clipboard / console */
  exportMetrics: () => string;
}
