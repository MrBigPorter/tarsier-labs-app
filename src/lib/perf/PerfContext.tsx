/**
 * PerfContext — Runtime performance monitoring context
 *
 * Collects real-time metrics during development:
 * - FPS (requestAnimationFrame-based)
 * - Component render timings (React Profiler)
 * - API call latency
 * - Navigation transitions
 *
 * Also triggers automatic Hermes CPU profiling when jank is detected:
 * - FPS < 25 for 3 consecutive readings (~750ms) → autoProfile.triggerJankProfile()
 *
 * Only active when __DEV__ is true. Completely stripped from release builds.
 */
import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import type {
  PerfState,
  PerfActions,
  FrameSample,
  FpsSnapshot,
  ApiCallRecord,
  RenderRecord,
  NavRecord,
} from './types';
import { setApiTimingListener, clearApiTimingListener } from './apiTiming';
import { triggerJankProfile } from './autoProfile';

// ── Constants ─────────────────────────────────────────────────────────────

/** FPS sampling window in ms */
const FPS_WINDOW_MS = 1_000;
/** Max stored API call records */
const MAX_API_RECORDS = 50;
/** Max stored render records */
const MAX_RENDER_RECORDS = 100;
/** Max stored navigation records */
const MAX_NAV_RECORDS = 20;
/** Target frame duration (60 FPS = ~16.67ms) */
const TARGET_FRAME_MS = 16.67;
/** FPS threshold for triggering auto-profile */
const JANK_FPS_THRESHOLD = 25;
/** Consecutive low-FPS readings before triggering (each reading ~250ms apart) */
const JANK_CONSECUTIVE_THRESHOLD = 3;

// ── Context Shape ─────────────────────────────────────────────────────────

interface PerfContextValue {
  state: PerfState;
  actions: PerfActions;
  /** Record an API call (called by api middleware) */
  recordApiCall: (call: ApiCallRecord) => void;
  /** Record a render (called by Profiler) */
  recordRender: (render: RenderRecord) => void;
  /** Record a navigation (called by nav tracker) */
  recordNav: (nav: NavRecord) => void;
}

const PerfContext = createContext<PerfContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────

interface PerfProviderProps {
  children: ReactNode;
}

export function PerfProvider({
  children,
}: PerfProviderProps): React.JSX.Element | null {
  // Only mount in dev mode
  if (!__DEV__) {
    return <>{children}</>;
  }
  return <PerfProviderInner>{children}</PerfProviderInner>;
}

function PerfProviderInner({ children }: PerfProviderProps): React.JSX.Element {
  const [isVisible, setIsVisible] = useState(false);
  const [isActive] = useState(true);

  // ── FPS tracking ─────────────────────────────────────────────────────
  const frameSamplesRef = useRef<FrameSample[]>([]);
  const rafIdRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(Date.now());
  const droppedRef = useRef<number>(0);
  const consecutiveLowFpsRef = useRef<number>(0);

  const [fps, setFps] = useState<FpsSnapshot>({
    current: 60,
    min: 60,
    avg: 60,
    droppedFrames: 0,
  });

  // ── History ──────────────────────────────────────────────────────────
  const [recentApiCalls, setRecentApiCalls] = useState<ApiCallRecord[]>([]);
  const [recentRenders, setRecentRenders] = useState<RenderRecord[]>([]);
  const [recentNavs, setRecentNavs] = useState<NavRecord[]>([]);

  // ── FPS loop ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isActive) {
      return;
    }

    const samples: FrameSample[] = [];

    const tick = (now: number) => {
      const delta = now - lastFrameTimeRef.current;
      lastFrameTimeRef.current = now;

      const sample: FrameSample = { timestamp: now, duration: delta };
      samples.push(sample);

      // Count dropped frames (> ~16.67ms per frame = below 60 FPS)
      if (delta > TARGET_FRAME_MS * 1.5) {
        droppedRef.current += 1;
      }

      // Prune samples older than FPS_WINDOW_MS
      const cutoff = now - FPS_WINDOW_MS;
      while (samples.length > 0 && samples[0]!.timestamp < cutoff) {
        samples.shift();
      }

      // Update FPS every ~250ms (every 15 frames at 60fps)
      if (samples.length > 0 && samples.length % 15 === 0) {
        const totalDuration = samples.reduce((sum, s) => sum + s.duration, 0);
        const avgDuration = totalDuration / samples.length;
        const currentFps =
          avgDuration > 0 ? Math.round(1000 / avgDuration) : 60;
        const durations = samples.map(s => s.duration);
        const minDuration = Math.max(...durations); // Max duration = worst frame
        const minFps = minDuration > 0 ? Math.round(1000 / minDuration) : 60;

        setFps(prev => ({
          current: Math.min(currentFps, 60),
          min: Math.min(minFps, prev.min),
          avg: Math.round(prev.avg * 0.7 + currentFps * 0.3),
          droppedFrames: droppedRef.current,
        }));

        // ── Auto-trigger Hermes CPU Profile on sustained jank ─────
        if (currentFps < JANK_FPS_THRESHOLD) {
          consecutiveLowFpsRef.current += 1;
          if (consecutiveLowFpsRef.current >= JANK_CONSECUTIVE_THRESHOLD) {
            triggerJankProfile();
            consecutiveLowFpsRef.current = 0; // Reset after triggering
          }
        } else {
          consecutiveLowFpsRef.current = 0; // Healthy FPS → reset counter
        }
      }

      frameSamplesRef.current = samples;
      rafIdRef.current = requestAnimationFrame(tick);
    };

    rafIdRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafIdRef.current);
    };
  }, [isActive]);

  // ── Record helpers ───────────────────────────────────────────────────

  const recordApiCall = useCallback((call: ApiCallRecord) => {
    setRecentApiCalls(prev => {
      const next = [call, ...prev];
      return next.slice(0, MAX_API_RECORDS);
    });
  }, []);

  // ── Wire up apiTiming listener (must be after recordApiCall declaration) ──
  useEffect(() => {
    setApiTimingListener(recordApiCall);
    return () => clearApiTimingListener();
  }, [recordApiCall]);

  const recordRender = useCallback((render: RenderRecord) => {
    setRecentRenders(prev => {
      const next = [render, ...prev];
      return next.slice(0, MAX_RENDER_RECORDS);
    });
  }, []);

  const recordNav = useCallback((nav: NavRecord) => {
    setRecentNavs(prev => {
      const next = [nav, ...prev];
      return next.slice(0, MAX_NAV_RECORDS);
    });
  }, []);

  // ── Slow API → render correlation ─────────────────────────────────
  // When an API call exceeds the slow threshold, check recent render
  // records for any component that took more than SLOW_RENDER_THRESHOLD_MS.
  // This helps pinpoint rendering bottlenecks that inflate API wall-clock
  // measurements (e.g., MarkdownRenderer blocking the JS thread).
  const SLOW_API_MS = 1_000;
  const SLOW_RENDER_MS = 500;
  const lastWarnedCallRef = useRef<number>(0);

  useEffect(() => {
    const slowCall = recentApiCalls[0];
    if (!slowCall || slowCall.duration <= SLOW_API_MS) {
      return;
    }

    // Dedup: only warn once per API call (compare by timestamp).
    // Prevents spamming when recentRenders keeps updating after the same call.
    if (slowCall.timestamp === lastWarnedCallRef.current) {
      return;
    }
    lastWarnedCallRef.current = slowCall.timestamp;

    const suspects = recentRenders
      .filter(r => r.duration > SLOW_RENDER_MS)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 3);

    if (suspects.length > 0) {
      const suspectLines = suspects
        .map(r => `   🔍 Suspect: ${r.name} — ${r.duration}ms (${r.phase})`)
        .join('\n');

      console.warn(
        '[PerfMonitor] 🧩 Render correlation for slow API:\n' +
          `${suspectLines}`,
      );
    }
  }, [recentApiCalls, recentRenders]);

  // ── Actions ──────────────────────────────────────────────────────────

  const toggleVisibility = useCallback(() => setIsVisible(v => !v), []);
  const show = useCallback(() => setIsVisible(true), []);
  const hide = useCallback(() => setIsVisible(false), []);
  const reset = useCallback(() => {
    frameSamplesRef.current = [];
    droppedRef.current = 0;
    setFps({ current: 60, min: 60, avg: 60, droppedFrames: 0 });
    setRecentApiCalls([]);
    setRecentRenders([]);
    setRecentNavs([]);
  }, []);

  const exportMetrics = useCallback((): string => {
    const payload = {
      timestamp: new Date().toISOString(),
      fps,
      apiCalls: recentApiCalls.slice(0, 10),
      renders: recentRenders.slice(0, 10),
      navs: recentNavs.slice(0, 10),
    };
    return JSON.stringify(payload, null, 2);
  }, [fps, recentApiCalls, recentRenders, recentNavs]);

  // ── Context value ────────────────────────────────────────────────────

  const value = useMemo<PerfContextValue>(
    () => ({
      state: {
        fps,
        recentApiCalls,
        recentRenders,
        recentNavs,
        isVisible,
        isActive,
      },
      actions: { toggleVisibility, show, hide, reset, exportMetrics },
      recordApiCall,
      recordRender,
      recordNav,
    }),
    [
      fps,
      recentApiCalls,
      recentRenders,
      recentNavs,
      isVisible,
      isActive,
      toggleVisibility,
      show,
      hide,
      reset,
      exportMetrics,
      recordApiCall,
      recordRender,
      recordNav,
    ],
  );

  return <PerfContext.Provider value={value}>{children}</PerfContext.Provider>;
}

// ── Hook ──────────────────────────────────────────────────────────────────

export function usePerfMonitor(): PerfContextValue {
  const ctx = useContext(PerfContext);
  if (!ctx) {
    // Return a no-op stub in production or outside provider
    return {
      state: {
        fps: { current: 60, min: 60, avg: 60, droppedFrames: 0 },
        recentApiCalls: [],
        recentRenders: [],
        recentNavs: [],
        isVisible: false,
        isActive: false,
      },
      actions: {
        toggleVisibility: () => {},
        show: () => {},
        hide: () => {},
        reset: () => {},
        exportMetrics: () => '',
      },
      recordApiCall: () => {},
      recordRender: () => {},
      recordNav: () => {},
    };
  }
  return ctx;
}
