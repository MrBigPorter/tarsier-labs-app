/**
 * autoProfile — Automated Hermes CPU Profiler trigger
 *
 * When PerfMonitor detects a frame-rate drop (FPS < 25 sustained for ~1s),
 * this module automatically starts Hermes Sampling Profiler, captures 3
 * seconds of CPU trace, and saves the .cpuprofile to device cache.
 *
 * The developer is notified via Toast (Android) / console.warn (iOS) and
 * can later export the file using pull-perf-data.sh.
 *
 * Usage:
 *   import { triggerJankProfile, isProfilingActive } from './autoProfile';
 *
 *   // Called from PerfContext FPS loop:
 *   if (fps < 25 && consecutiveLowFps > 3) triggerJankProfile();
 *
 * Only active in __DEV__ mode with Hermes engine.
 */

import { Platform, ToastAndroid } from 'react-native';

// ── HermesInternal helper ──────────────────────────────────────────────────
// HermesInternal is a global provided by Hermes engine at runtime.
// RN's TypeScript defs don't include it, so we use (globalThis as any)
// to avoid TS2451 (redeclare) / TS2339 (missing property) errors.

function getHermes():
  | {
      getRuntimeProperties: () => Record<string, string>;
      enableSamplingProfiler?: () => void;
      getSampledTrace?: (
        callback: (err: unknown, data: unknown) => void,
      ) => void;
    }
  | undefined {
  return (globalThis as any).HermesInternal as
    | {
        getRuntimeProperties: () => Record<string, string>;
        enableSamplingProfiler?: () => void;
        getSampledTrace?: (
          callback: (err: unknown, data: unknown) => void,
        ) => void;
      }
    | undefined;
}

// ── State ──────────────────────────────────────────────────────────────────

let _isProfiling = false;
let _profileTimer: ReturnType<typeof setTimeout> | null = null;
let _lastProfileTimestamp = 0;

/** Minimum interval between auto-profiles in ms (throttle to once per 30s) */
const PROFILE_THROTTLE_MS = 30_000;

/** How long to sample in ms */
const SAMPLE_DURATION_MS = 3_000;

/** Profile file prefix */
const FILE_PREFIX = 'perf-jank';

// ── Hermes Profiler API detection ──────────────────────────────────────────

/**
 * Check if Hermes Sampling Profiler is available.
 * Returns true only if running on Hermes engine in __DEV__ mode.
 */
function canUseHermesProfiler(): boolean {
  if (!__DEV__) {
    return false;
  }
  const hi = getHermes();
  if (!hi || typeof hi.getRuntimeProperties !== 'function') {
    return false;
  }
  return true;
}

// ── File persistence ───────────────────────────────────────────────────────

/**
 * Save profile data to the device cache directory using RNFS.
 * Falls back to react-native-fs if available, otherwise logs to console.
 */
async function saveProfileToDisk(profileData: unknown): Promise<string | null> {
  const timestamp = Date.now();
  const filename = `${FILE_PREFIX}-${timestamp}.cpuprofile`;

  try {
    // Try react-native-fs first
    const RNFS = require('react-native-fs') as {
      CachesDirectoryPath: string;
      writeFile: (path: string, content: string) => Promise<void>;
    };
    const path = `${RNFS.CachesDirectoryPath}/${filename}`;
    await RNFS.writeFile(path, JSON.stringify(profileData, null, 2));
    return path;
  } catch {
    // If react-native-fs is not installed, try react-native-blob-util
    try {
      const BlobUtil = require('react-native-blob-util') as {
        fs: {
          dirs: { CacheDir: string };
          createFile: (
            path: string,
            data: string,
            encoding: string,
          ) => Promise<void>;
        };
      };
      const path = `${BlobUtil.fs.dirs.CacheDir}/${filename}`;
      await BlobUtil.fs.createFile(
        path,
        JSON.stringify(profileData, null, 2),
        'utf8',
      );
      return path;
    } catch {
      // No file system module available — fallback to console
      console.log(
        '[PerfMonitor] 📄 Profile data (install react-native-fs for file save):',
      );
      console.log(JSON.stringify(profileData, null, 2).slice(0, 500) + '...');
      return null;
    }
  }
}

// ── Notification ───────────────────────────────────────────────────────────

function notifyUser(message: string): void {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.LONG);
  }
  // On iOS, just use console — there's no native toast without a library
  console.log(`[PerfMonitor] ${message}`);
}

// ── Core API ───────────────────────────────────────────────────────────────

/**
 * Start Hermes Sampling Profiler.
 * No-op if already profiling or if Hermes API is unavailable.
 */
function startProfiler(): boolean {
  if (_isProfiling) {
    return false;
  }
  if (!canUseHermesProfiler()) {
    console.log(
      '[PerfMonitor] Hermes Profiler not available (expected in Release build)',
    );
    return false;
  }

  try {
    const hi = getHermes();
    hi?.enableSamplingProfiler?.();
    _isProfiling = true;
    return true;
  } catch (e) {
    console.warn('[PerfMonitor] Failed to start Hermes Profiler:', e);
    return false;
  }
}

/**
 * Stop Hermes Sampling Profiler and retrieve the trace data.
 */
async function stopAndRetrieveTrace(): Promise<unknown | null> {
  if (!_isProfiling) {
    return null;
  }

  try {
    const trace = await new Promise<unknown>((resolve, reject) => {
      const hi = getHermes();
      hi?.getSampledTrace?.((err: unknown, data: unknown) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });
    return trace;
  } catch (e) {
    console.warn('[PerfMonitor] Failed to retrieve Hermes trace:', e);
    return null;
  } finally {
    _isProfiling = false;
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Trigger an automatic jank profile.
 *
 * Starts Hermes Sampling Profiler, waits SAMPLE_DURATION_MS, then stops
 * and saves the profile to disk. Throttled to once per PROFILE_THROTTLE_MS.
 *
 * Safe to call frequently — will no-op if:
 * - Already profiling
 * - Hermes API not available
 * - Throttle interval not elapsed
 * - Not in __DEV__ mode
 */
export function triggerJankProfile(): void {
  if (!__DEV__) {
    return;
  }
  if (_isProfiling) {
    return;
  }

  // Throttle: don't profile more than once per 30s
  const now = Date.now();
  if (now - _lastProfileTimestamp < PROFILE_THROTTLE_MS) {
    return;
  }

  if (!startProfiler()) {
    return;
  }

  _lastProfileTimestamp = now;
  notifyUser('🚨 检测到帧率过低，正在采集 CPU Profile (3s)...');

  _profileTimer = setTimeout(async () => {
    const trace = await stopAndRetrieveTrace();
    if (trace) {
      const path = await saveProfileToDisk(trace);
      if (path) {
        notifyUser(`✅ CPU Profile 已保存: ${path}`);
        console.log(`[PerfMonitor] ✅ Profile saved to: ${path}`);
      } else {
        notifyUser('✅ CPU Profile 已采集 (查看终端输出)');
      }
    } else {
      notifyUser('⚠️ CPU Profile 采集失败');
    }
    _profileTimer = null;
  }, SAMPLE_DURATION_MS);
}

/**
 * Cancel an ongoing profile (if the component unmounts, for example).
 */
export function cancelJankProfile(): void {
  if (_profileTimer) {
    clearTimeout(_profileTimer);
    _profileTimer = null;
  }
  _isProfiling = false;
}

/**
 * Whether a profile is currently being captured.
 */
export function isProfilingActive(): boolean {
  return _isProfiling;
}

/**
 * Get the timestamp of the last profile trigger.
 */
export function getLastProfileTimestamp(): number {
  return _lastProfileTimestamp;
}
