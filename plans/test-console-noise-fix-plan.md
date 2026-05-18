# Test Console Noise Fix Plan

## Problem

`__tests__/App.test.tsx` **passes** but produces excessive console noise:

```
ReferenceError: You are trying to access a property or method of the Jest environment after it has been torn down.  (×14)

An update to VirtualizedList inside a test was not wrapped in act(...).

An update to PerfProviderInner inside a test was not wrapped in act(...).

Jest did not exit one second after the test run has completed.
```

## Root Cause Analysis

### Cause 1: Real FlatList/ScrollView in reanimated mock

[`jest-setup.js:79-80`](jest-setup.js:79) uses real `require('react-native').FlatList` and `require('react-native').ScrollView` in the `react-native-reanimated` mock. Real `FlatList` wraps `VirtualizedList`, which has:

- Internal timers for scroll debouncing and lazy-loading
- Async state updates that fire after the initial `act()` block completes
- `setState` calls that reference the Jest environment after it's torn down

**Fix**: Replace with minimal mock View components that have no timers or async behavior.

### Cause 2: PerfProvider FPS requestAnimationFrame loop

[`src/lib/perf/PerfContext.tsx:107-167`](src/lib/perf/PerfContext.tsx:107) uses `requestAnimationFrame` recursively to track FPS:

```typescript
useEffect(() => {
  const tick = now => {
    // ... calculates FPS, calls setFps(...) ...
    rafIdRef.current = requestAnimationFrame(tick); // recursive
  };
  rafIdRef.current = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(rafIdRef.current);
}, [isActive]);
```

`@react-native/jest-preset`'s [`setup.js`](node_modules/@react-native/jest-preset/jest/setup.js:60) sets `requestAnimationFrame` to `setTimeout(callback, 0)`, creating an infinite `setTimeout(tick, 0)` loop that continues after test teardown.

**Fix**: Override `global.requestAnimationFrame` in [`jest-setup.js`](jest-setup.js) to be a no-op `jest.fn()`, preventing the FPS loop from starting.

## Fix Items

### Fix 1: Replace FlatList/ScrollView in reanimated mock

**File**: [`jest-setup.js:69-143`](jest-setup.js:69)

Change the `default` object to use mock View components instead of real RN ones:

```diff
- ScrollView: require('react-native').ScrollView,
- FlatList: require('react-native').FlatList,
+ ScrollView: React.forwardRef(({ children, ...props }, ref) =>
+   React.createElement(View, { ...props, ref }, children)
+ ),
+ FlatList: React.forwardRef(({ data, renderItem, ...props }, ref) =>
+   React.createElement(View, { ...props, ref, testID: 'mock-flatlist' })
+ ),
```

This prevents `VirtualizedList` from ever mounting, eliminating all timer-based warnings.

### Fix 2: Override requestAnimationFrame to stop FPS loop

**File**: [`jest-setup.js`](jest-setup.js) — append at end of file

```javascript
// Override requestAnimationFrame to prevent PerfProvider's FPS loop
// from running in tests. The RN preset sets it to setTimeout(callback, 0)
// which creates an infinite setTimeout loop via requestAnimationFrame(tick) recursion.
global.requestAnimationFrame = jest.fn().mockReturnValue(0);
global.cancelAnimationFrame = jest.fn();
```

This prevents [`PerfProviderInner`](src/lib/perf/PerfContext.tsx:107) from ever scheduling its `tick` function, eliminating the "PerfProviderInner not wrapped in act" and remaining "environment torn down" errors.

### Fix 3: Clean up jest.config.js

**File**: [`jest.config.js`](jest.config.js)

```diff
module.exports = {
   preset: '@react-native/jest-preset',
   setupFiles: ['./jest-setup.js'],
+  clearMocks: true,
+  forceExit: true,
   testPathIgnorePatterns: ['/node_modules/', '/e2e/'],
   transformIgnorePatterns: [...],
};
```

- `clearMocks: true` — auto-clear mock state between tests (clean slate)
- `forceExit: true` — safety net to force Jest to exit even if handles remain open

## Verification

After applying all fixes, run:

```bash
npx jest __tests__/App.test.tsx --no-cache
```

Expected output:

- **No** "environment torn down" errors
- **No** "not wrapped in act" warnings
- **No** "Jest did not exit" warning
- **PASS** `__tests__/App.test.tsx`

Then run full test suite with coverage:

```bash
yarn test --coverage
```
