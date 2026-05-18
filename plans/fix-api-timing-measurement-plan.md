# Fix: Accurate API Timing Measurement

## Problem

[`baseApi.ts`](../src/api/baseApi.ts) uses wall-clock timing to measure API call duration. In React Native's single-threaded architecture, this includes JS thread queueing delay, making the measured time appear much larger than the actual network latency.

## Final State

**The fix is intentionally minimal:** We cannot accurately separate JS thread queueing time from network time using JavaScript-only techniques (see "Why Not Measure JS Contention?" below).

### Changes Made

1. **`Date.now()` → `performance.now()`** in [`baseApi.ts`](../src/api/baseApi.ts:70)
   - `performance.now()` is **monotonic** (immune to system clock adjustments)
   - Provides **sub-millisecond precision**
   - Better accuracy for relative timing measurements

2. **Warning message clarified** in [`baseApi.ts:152-157`](../src/api/baseApi.ts:152-157)
   - Now labels the value as `wall` (wall-clock time)
   - Comment explains the measurement includes JS thread queueing
   - Suggests using DevTools Network tab for true server timing

3. **`ApiCallRecord.duration` JSDoc updated** in [`types.ts`](../src/lib/perf/types.ts:28)
   - Documents that duration is wall-clock time from JS thread

### Warning Output

**Before:**

```
⚠️ Slow API: GET /api/v1/.../related — 2049ms (threshold: 1000ms)
```

**After** (identical format, same behavior):

```
⚠️ Slow API: GET /api/v1/.../related — 2049ms wall (threshold: 1000ms)
```

The value is the same because **both `Date.now()` and `performance.now()` measure wall-clock time** from the JS thread. The improvement is in the underlying precision and monotonicity, plus clearer documentation.

## Why Not Measure JS Contention?

We attempted to measure JS thread queueing via `await Promise.resolve()` after the fetch resolves. This **does not work** due to a fundamental JavaScript limitation:

### The Microtask Timing Trap

When we do:

```typescript
const result = await rawBaseQuery(args, api, extraOptions);
await Promise.resolve(); // ❌ This always resolves instantly
```

The timeline is:

```
t0: code runs, await rawBaseQuery → JS thread yields
    → JS thread FREE → processes microtasks (including our Promise.resolve().then())
    → JS thread starts RENDERING (this is when the fetch callback gets blocked)
    → at t0+376ms: response arrives at native layer
    → JS thread still rendering until t0+1673ms
    → rendering completes → fetch callback runs → our code resumes
    → we measure jsContention: ~0ms ❌
```

**Why it fails**: The `Promise.resolve().then()` microtask runs in the FIRST free window (t0+ε), NOT during the critical window when the fetch callback is blocked. By the time our measurement code executes, the JS thread is already free.

### True Network Time is Inaccessible from JS

The actual network round-trip time (measured by the native networking stack) is only available at the native layer (OkHttp on Android, NSURLSession on iOS). React Native's JS engine cannot access this timing information without a custom native module.

## Practical Advice

| Symptom                      | What to check                             |
| ---------------------------- | ----------------------------------------- |
| High `wall` time + smooth UI | Server may be slow — check curl/DevTools  |
| High `wall` time + janky UI  | JS thread contention — optimize rendering |
| Both high                    | Both issues                               |

To get true network timing:

- **DevTools Network tab** shows actual server round-trip time
- **`curl` command** provides DNS, connect, SSL, and server timing
