# iOS Build Fix — Final Cleanup Plan

## Current Situation

The Podfile's post_install hook has been fully configured to:

1. **React-hermes & React-RuntimeHermes** — Inject `HERMES_ENABLE_DEBUGGER=1 HERMES_V1_ENABLED=1` into xcconfig
2. **RNReanimated** — Strip `HERMES_ENABLE_DEBUGGER=1`, inject only `HERMES_V1_ENABLED=1` (both xcconfig + Pods.xcodeproj target-level)
3. **Pods.xcodeproj target-level** — Remove `HERMES_ENABLE_DEBUGGER=1` from RNReanimated target build configurations

Despite these configuration fixes being correct, **the same errors keep returning** after Xcode rebuilds.

---

## Root Cause Analysis

### Problem 1: Stale Xcode DerivedData (Primary Culprit)

Xcode caches compiled `.o` files in `~/Library/Developer/Xcode/DerivedData/`. When build settings change:

- Xcode's incremental build detection may **miss files that need recompilation**
- Old `.o` files compiled with `HERMES_ENABLE_DEBUGGER=1` for RNReanimated get reused
- This explains the "Build succeeded ✅ then same errors" pattern — partial rebuilds skip files that appear up-to-date

**Evidence:** The user reported "Build succeeded ✅" after an earlier fix iteration, but the same 3 ReanimatedHermesRuntime.h errors returned on the next build. This is classic stale DerivedData behavior.

### Problem 2: react-native-reanimated 3.19.5 Incompatible with RN 0.85.3

Two distinct incompatibilities in version `3.19.5`:

| File | Line | Issue | Why |
|------|------|-------|-----|
| [`ReanimatedHermesRuntime.h`](node_modules/react-native-reanimated/Common/cpp/worklets/WorkletRuntime/ReanimatedHermesRuntime.h:19) | 19 | `#if HERMES_ENABLE_DEBUGGER` — no `!defined(HERMES_V1_ENABLED)` check | Registration.h skips declarations when V1 is defined, but ReanimatedHermesRuntime.h still tries to use `inspector_modern` types → `Expected namespace name`, `Undeclared identifier 'chrome'` |
| [`REASwizzledUIManager.mm`](node_modules/react-native-reanimated/apple/reanimated/apple/LayoutReanimation/REASwizzledUIManager.mm:225) | 225 | `rootView.intrinsicContentSize = contentSize` — assign to readonly property | In RN 0.85 New Architecture (Fabric), `RCTRootView.intrinsicContentSize` is readonly. Older Reanimated tries to swizzle it. |

---

## Fix Strategy

### Option A: Upgrade react-native-reanimated (Recommended)

Upgrade to the latest `react-native-reanimated` version that supports:
- Hermes V1 (`HERMES_V1_ENABLED`) properly
- RN 0.85 / New Architecture (Fabric) UIManager APIs

**Steps:**
1. Run `yarn add react-native-reanimated@latest`
2. Run `cd ios && pod install`
3. Clean DerivedData (see below)
4. Clean build in Xcode

**Risk:** May introduce breaking API changes if a major version upgrade is needed.

### Option B: Patch node_modules + Clean DerivedData (Safer Workaround)

Keep `react-native-reanimated@3.19.5` but patch the two problematic files, then add patches to [`package.json`](package.json:70)'s `patch-package` workflow.

#### Patch 1: [`ReanimatedHermesRuntime.h`](node_modules/react-native-reanimated/Common/cpp/worklets/WorkletRuntime/ReanimatedHermesRuntime.h:19)

Change the guard from:
```cpp
#if HERMES_ENABLE_DEBUGGER
```
to:
```cpp
#if defined(HERMES_ENABLE_DEBUGGER) && !defined(HERMES_V1_ENABLED)
```

This matches [`Registration.h`](node_modules/react-native/ReactCommon/hermes/inspector-modern/chrome/Registration.h:10)'s guard exactly.

#### Patch 2: [`REASwizzledUIManager.mm`](node_modules/react-native-reanimated/apple/reanimated/apple/LayoutReanimation/REASwizzledUIManager.mm:225)

Change the readonly property assignment. The simplest fix is to add a `respondsToSelector:` check or use `setValue:forKey:` with the ivar directly. However, since `intrinsicContentSize` is readonly in Fabric, the swizzled method needs to skip this assignment when the property is readonly.

A targeted approach:
```objc
if ([rootView isKindOfClass:[RCTRootView class]]) {
  // In New Architecture (Fabric), intrinsicContentSize is readonly
  // Only assign if the property is writable
  rootView.intrinsicContentSize = contentSize;
}
```

Actually this won't compile either since the compiler checks at compile time. A better approach:
```objc
[rootView setValue:[NSValue valueWithCGSize:contentSize] forKey:@"intrinsicContentSize"];
```

Or patch using `respondsToSelector:`:
```objc
if ([rootView respondsToSelector:@selector(setIntrinsicContentSize:)]) {
  rootView.intrinsicContentSize = contentSize;
}
```

Wait, `respondsToSelector:` wouldn't help since the selector exists (property is declared), it's just readonly. The KVC approach with `setValue:forKey:` won't work either for readonly properties.

Actually the correct fix would be to surround with `#if !TARGET_OS_IOS` or check the RN version. Let me reconsider...

**Simplest fix:** Comment out the assignment since it's only used for root view intrinsic content size updates, which is not critical for layout animations:
```objc
// In Fabric (New Architecture), intrinsicContentSize is readonly
// This assignment is handled differently; skip to avoid compilation error
// rootView.intrinsicContentSize = contentSize;
```

Or better, wrap it in a runtime check that accounts for Fabric:
```objc
// In New Architecture, RCTRootView's intrinsicContentSize is readonly.
// We need to check if the property is writable at runtime.
static BOOL isFabric = NO;
static dispatch_once_t onceToken;
dispatch_once(&onceToken, ^{
  isFabric = [rootView respondsToSelector:@selector(setIntrinsicContentSize:)];
});
if (!isFabric) {
  rootView.intrinsicContentSize = contentSize;
}
```

Hmm, actually `respondsToSelector:` checks if the setter method exists, which it does for both old and new architecture — it's just declared `readonly` in the header (which is a compile-time check, not runtime). So this won't help.

Let me think about this differently. The real fix is to check whether we're on Fabric or not. In Fabric:
```objc
if (![rootView isKindOfClass:[RCTRootView class]]) {
  // In Fabric, intrinsicContentSize is not writable
  // The layout update is handled by the shadow tree
} else {
  rootView.intrinsicContentSize = contentSize;
}
```

Actually, looking at the RN 0.85 source, `RCTRootView` itself hasn't changed. The issue is more nuanced. Let me just suggest the simplest approach: use `#ifdef RCT_NEW_ARCH_ENABLED`:

```objc
#ifndef RCT_NEW_ARCH_ENABLED
  rootView.intrinsicContentSize = contentSize;
#endif
```

This is clean and idiomatic — it disables the pre-Fabric workaround when building with New Architecture.

### Patch Creation

After patching the files, run:
```
yarn patch-package react-native-reanimated
```

This creates a patch file in the [`patches/`](patches/) directory (project already uses `patch-package` via `postinstall` script).

### DerivedData Cleanup (Required for ALL options)

```bash
# 1. Stop Metro / watchman
watchman watch-del-all

# 2. Delete DerivedData (removes ALL cached .o files)
rm -rf ~/Library/Developer/Xcode/DerivedData/*

# 3. Delete iOS build artifacts
rm -rf ios/build

# 4. Clean CocoaPods cache (optional but thorough)
rm -rf ios/Pods
cd ios && pod install

# 5. In Xcode: Product > Clean Build Folder (Shift+Cmd+K)
# 6. Then rebuild (Cmd+B)
```

---

## Recommended Plan of Action

| Step | Action | Why |
|------|--------|-----|
| 1 | Clean DerivedData (commands above) | Ensures no stale .o files from old builds |
| 2 | Patch [`ReanimatedHermesRuntime.h`](node_modules/react-native-reanimated/Common/cpp/worklets/WorkletRuntime/ReanimatedHermesRuntime.h:19) guard with `!defined(HERMES_V1_ENABLED)` | Fixes the header guard mismatch — this is the core Hermes V1 fix for RNReanimated |
| 3 | Patch [`REASwizzledUIManager.mm`](node_modules/react-native-reanimated/apple/reanimated/apple/LayoutReanimation/REASwizzledUIManager.mm:225) with `#ifndef RCT_NEW_ARCH_ENABLED` guard | Fixes readonly property assignment in New Architecture |
| 4 | Run `yarn patch-package react-native-reanimated` | Creates a persistent patch so fixes survive `yarn install` |
| 5 | Run `cd ios && pod install` | Regenerates xcconfigs with correct settings |
| 6 | Open Xcode, Clean Build Folder, Rebuild | Fresh build with no stale cache + correct settings |

**Note:** Options 2+3 can be done as `patch-package` patches in Code mode, or we could attempt upgrading react-native-reanimated (Option A). Please advise which approach you prefer.
