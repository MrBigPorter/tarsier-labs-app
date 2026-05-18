# Slow Related API Analysis (Final)

## Warning Observed

```
[PerfMonitor] ⚠️ Slow API: GET /api/v1/frontend/blog/articles/cmotio5lh005umi8zi6dl3jh9/related — 2284ms (threshold: 1000ms)
```

## Root Cause (Confirmed)

**Hermes Sampling Profiler / React DevTools Profiler was left running during development.**

When the Hermes Sampling Profiler or React DevTools Profiler is active, the JS thread is occupied with profiling overhead, causing `Promise` resolution (including `fetch()` callbacks) to be delayed in the event queue.

### How the timing measurement is affected

In [`baseApi.ts:61-132`](../src/api/baseApi.ts:61-132):

```typescript
const startTime = Date.now();
// fetch starts — network response arrives in ~300ms (confirmed via curl)
result = await rawBaseQuery(args, api, extraOptions);
// BUT: Promise callback waits for JS thread to be free
const duration = Date.now() - startTime; // → 2284ms (includes profiling overhead)
```

Even though the server responds in ~329ms, the `await` includes JS thread queueing time.

### Evidence Summary

| Test                     | Result     | Implication                                |
| ------------------------ | ---------- | ------------------------------------------ |
| `curl` popular API       | **280ms**  | Server is fast                             |
| `curl` related API       | **329ms**  | Server is fast                             |
| iOS all APIs             | **Fast**   | Server/network not the issue               |
| Android browser API      | **422ms**  | Android device network is fine             |
| Android React Native API | **2284ms** | Only slow in RN app → JS thread contention |
| Profiler tools running   | **Yes**    | Confirmed by developer                     |

### Why it only affects Android

- The profiler/Hermes profiler was likely enabled via Dev Menu on the **Android device** but not on iOS
- Or the Android device was connected to **Fusebox/React DevTools** with Profiler tab open while iOS was not
- This is a common pitfall in React Native development — always check Dev Menu for active profiler

### Fix

Close the profiler. If profiling is needed, use targeted commands:

```bash
# For Hermes profiling (triggered on demand, not continuously)
# Press ⌘M (Android) / ⌘D (iOS) → Start Hermes Sampling Profiler
# Interact with app → Stop → Profile saved to device
```

Also note: The auto-profile in [`autoProfile.ts`](../src/lib/perf/autoProfile.ts) is throttled (once per 30s) and only runs for 3s at a time, so it's unlikely the primary cause. The issue was the manually triggered profiler being left on.
