# Android Crash Fix: `react-native-screens` FabricUIManager NullPointerException

## Problem

The Android app crashes on launch with the following error:

```
Exception in HostObject::get for prop 'RNSModule': java.lang.NullPointerException:
null cannot be cast to non-null type com.facebook.react.fabric.FabricUIManager

    at com.swmansion.rnscreens.ScreensModule.setupFabric(ScreensModule.kt:59)
    at com.swmansion.rnscreens.ScreensModule.initialize(ScreensModule.kt:54)
```

This crash prevents the app from rendering any navigation, with the downstream error:

```
TypeError: Cannot read property 'ScreenStack' of undefined
```

## Root Cause

The bug is in `react-native-screens@4.25.0` at:

[`node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/ScreensModule.kt:57-63`](../node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/ScreensModule.kt:57)

```kotlin
private fun setupFabric() {
    val fabricUIManager =
        UIManagerHelper.getUIManager(reactContext, UIManagerType.FABRIC) as FabricUIManager
    proxy?.apply {
        nativeAddMutationsListener(fabricUIManager)
    }
}
```

### Why it crashes

1. `setupFabric()` is called from `initialize()` (line 54) during TurboModule initialization.
2. At this point in the boot sequence, the `FabricUIManager` has **not yet been set up** in the `ReactContext`.
3. `UIManagerHelper.getUIManager(reactContext, UIManagerType.FABRIC)` returns `null`.
4. Kotlin's `as FabricUIManager` is an **unsafe non-null cast** — it throws `NullPointerException` when the value is null.

### Additional call site

`setupFabric()` is **also** called from `onHostResume()` (line 142), which is the correct lifecycle point when FabricUIManager should already be available. The `initialize()` call is the problematic one — it fires too early.

## Environment

| Setting              | Value                                                      |
| -------------------- | ---------------------------------------------------------- |
| React Native         | `0.85.3`                                                   |
| New Architecture     | Enabled (`newArchEnabled=true`)                            |
| react-native-screens | `4.25.0`                                                   |
| Patch tool           | `patch-package` (already configured, has existing patches) |

## Fix Strategy

Apply a **patch via `patch-package`** to fix the unsafe cast in `ScreensModule.kt`. The project already uses `patch-package` (see `postinstall` script in `package.json` and existing patch at `patches/@react-native-community+netinfo+11.5.2.patch`).

### The Fix

Change the unsafe cast to a safe cast and guard the mutation listener call:

```kotlin
private fun setupFabric() {
    val fabricUIManager =
        UIManagerHelper.getUIManager(reactContext, UIManagerType.FABRIC) as? FabricUIManager
    proxy?.apply {
        fabricUIManager?.let { nativeAddMutationsListener(it) }
    }
}
```

**What this does:**

- Uses Kotlin safe-cast operator `as?` which returns `null` instead of throwing when the cast fails.
- Uses `fabricUIManager?.let { ... }` to only call `nativeAddMutationsListener` when the UIManager is available.
- When called during `onHostResume()` (after Fabric is ready), it works correctly.
- When called during `initialize()` (before Fabric is ready), it's a no-op — which is safe because `onHostResume()` will be called again later when Fabric IS ready.

### Why NOT upgrade

`react-native-screens@4.25.0` is the latest version in the 4.x line. There's no newer patch release available that fixes this. Upgrading to a potentially future version could introduce other breaking changes.

## Steps to Implement

### Step 1: Edit `ScreensModule.kt`

**File**: `node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/ScreensModule.kt`

**Changes:**

**Change #1** — Safe cast on line 59:

```diff
-            UIManagerHelper.getUIManager(reactContext, UIManagerType.FABRIC) as FabricUIManager
+            UIManagerHelper.getUIManager(reactContext, UIManagerType.FABRIC) as? FabricUIManager
```

**Change #2** — Guard the call on lines 60-62:

```diff
-        proxy?.apply {
-            nativeAddMutationsListener(fabricUIManager)
-        }
+        proxy?.apply {
+            fabricUIManager?.let { nativeAddMutationsListener(it) }
+        }
```

### Step 2: Generate the patch file

```bash
npx patch-package react-native-screens
```

This creates `patches/react-native-screens+4.25.0.patch`.

### Step 3: Verify the patch applies cleanly

```bash
# Remove node_modules/react-native-screens and reinstall to test
rm -rf node_modules/react-native-screens
yarn install
# The postinstall script will run patch-package automatically
```

### Step 4: Rebuild and test on Android

```bash
npx react-native run-android
```

### Step 5: Commit

Commit both:

- The edited `ScreensModule.kt` (if still present in node_modules — though usually patches are standalone)
- The generated `patches/react-native-screens+4.25.0.patch` file

## Verification

After applying the fix, the app should no longer crash with:

- `NullPointerException: null cannot be cast to non-null type com.facebook.react.fabric.FabricUIManager`
- `TypeError: Cannot read property 'ScreenStack' of undefined`

The navigation (NativeStack, BottomTabs) should render correctly on Android.
