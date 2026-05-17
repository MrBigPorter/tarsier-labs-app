/**
 * useRenderTiming — Measure component render times via React Profiler
 *
 * Usage:
 *   function MyComponent() {
 *     const onRenderRef = useRenderTiming('MyComponent');
 *     return (
 *       <Profiler id="MyComponent" onRender={onRenderRef.current}>
 *         ...
 *       </Profiler>
 *     );
 *   }
 */
import { useRef, useEffect, type ProfilerOnRenderCallback } from 'react';
import { usePerfMonitor } from './PerfContext';

/**
 * Returns a ref containing an `onRender` callback for React <Profiler>.
 *
 * @param name — Component display name for the metrics record
 */
export function useRenderTiming(
  name: string,
): React.RefObject<ProfilerOnRenderCallback | null> {
  const { recordRender } = usePerfMonitor();
  const callbackRef = useRef<ProfilerOnRenderCallback | null>(null);

  useEffect(() => {
    callbackRef.current = (
      _id: string,
      phase: 'mount' | 'update' | 'nested-update',
      actualDuration: number,
    ) => {
      // Only track actual (mount/update) not nested-update to avoid noise
      if (phase === 'nested-update') return;
      recordRender({
        name,
        duration: Math.round(actualDuration * 100) / 100,
        timestamp: Date.now(),
        phase: phase === 'mount' ? 'mount' : 'update',
      });
    };

    return () => {
      callbackRef.current = null;
    };
  }, [name, recordRender]);

  return callbackRef;
}
