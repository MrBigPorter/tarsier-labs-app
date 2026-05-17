/**
 * PerfMonitor — Performance monitor component
 *
 * Previously rendered a floating HUD panel. Now acts as a no-op placeholder
 * since all monitoring is fully automated (background FPS tracking,
 * auto-trigger Hermes CPU profiling, API timing recording).
 *
 * The component is kept in the tree to maintain API compatibility with
 * existing imports. It renders nothing.
 *
 * See PerfContext.tsx for the automated monitoring logic.
 * See autoProfile.ts for the Hermes Profiler auto-trigger.
 */
import React from 'react';

export function PerfMonitor(): React.JSX.Element | null {
  // All monitoring is handled automatically by PerfContext (FPS tracking,
  // API timing recording, auto-trigger Hermes CPU profile on jank).
  // This component is a no-op placeholder for API compatibility.
  return null;
}
