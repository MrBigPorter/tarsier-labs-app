# Hermes `Registration.h` Header Not Found Fix Plan

## Problem

iOS build fails with:
```
Registration.h:16:10 'hermes/inspector/RuntimeAdapter.h' file not found
```

## Root Cause Analysis

### Include Chain

[`HermesInstance.cpp`](node_modules/react-native/ReactCommon/react/runtime/hermes/HermesInstance.cpp:16) (React-RuntimeHermes pod):
```cpp
#ifdef HERMES_ENABLE_DEBUGGER
#include <hermes/inspector-modern/chrome/Registration.h>  // line 16

#ifndef HERMES_V1_ENABLED
#include <hermes/inspector/RuntimeAdapter.h>               // line 19
#endif
```

[`Registration.h`](node_modules/react-native/ReactCommon/hermes/inspector-modern/chrome/Registration.h:10) (React-hermes pod):
```cpp
#if defined(HERMES_ENABLE_DEBUGGER) && !defined(HERMES_V1_ENABLED)
...
#include <hermes/inspector/RuntimeAdapter.h>  // line 16 — ERROR HERE
...
#endif
```

When `HERMES_V1_ENABLED=1` is **defined**, the guard evaluates to `false` and the include is skipped. When `HERMES_V1_ENABLED` is **not defined**, the guard evaluates to `true` and `RuntimeAdapter.h` is needed — but it doesn't exist in the Hermes V1 prebuilt distribution.

### Why the Guard Fails

1. The [`hermes-engine` podspec](node_modules/react-native/sdks/hermes-engine/hermes-engine.podspec:144) only ships `inspector/` headers when `RCT_HERMES_V1_ENABLED == "0"` (legacy mode):
   ```ruby
   if ENV['RCT_HERMES_V1_ENABLED'] == "0"
     spec.subspec 'inspector' do |ss|
       ss.source_files = ''
       ss.public_header_files = 'API/hermes/inspector/*.h'
       ss.header_dir = 'hermes/inspector'
     end
   end
   ```
   For Hermes V1, `inspector/RuntimeAdapter.h` is **not included** in the pod.

2. Both [`React-hermes`](ios/Pods/Pods.xcodeproj/project.pbxproj:132) and [`React-RuntimeHermes`](ios/Pods/Pods.xcodeproj/project.pbxproj:42) targets are `PBXAggregateTarget` — they have **no build phases** and don't compile source files. Their source (`.cpp`) files are precompiled into the `React.xcframework` inside `React-Core-prebuilt`.

3. The `GCC_PREPROCESSOR_DEFINITIONS` in the xcconfig files for both targets only set `COCOAPODS=1`:
   - [`React-hermes.debug.xcconfig`](ios/Pods/Target Support Files/React-hermes/React-hermes.debug.xcconfig:5): `GCC_PREPROCESSOR_DEFINITIONS = $(inherited) COCOAPODS=1`
   - [`React-RuntimeHermes.debug.xcconfig`](ios/Pods/Target Support Files/React-RuntimeHermes/React-RuntimeHermes.debug.xcconfig:5): `GCC_PREPROCESSOR_DEFINITIONS = $(inherited) COCOAPODS=1`

4. While `HERMES_V1_ENABLED=1` and `HERMES_ENABLE_DEBUGGER=1` ARE set at the **target configuration level** in [`project.pbxproj`](ios/Pods/Pods.xcodeproj/project.pbxproj:39799-39822), because the targets are aggregate (don't compile anything), these settings **never affect any actual compilation unit**.

5. The `HEADER_SEARCH_PATHS` in [`React-hermes.debug.xcconfig`](ios/Pods/Target Support Files/React-hermes/React-hermes.debug.xcconfig:7) includes `"$(PODS_TARGET_SRCROOT)/.."` which resolves to `node_modules/react-native/ReactCommon/`. This means `Registration.h` at `ReactCommon/hermes/inspector-modern/chrome/Registration.h` is **findable by any target** with these search paths.

6. The VFS overlay (`-ivfsoverlay React-VFS.yaml`) only covers React-Core headers, **not** React-hermes headers like `Registration.h`.

### Why It Happens Now

When any Pods project target compiles source code that transitively includes `Registration.h` — or when Xcode indexes headers for code intelligence — the compiler finds `Registration.h` via the source search paths. If `HERMES_V1_ENABLED` is not defined in that compilation context, the guard fails and the compiler tries to include the nonexistent `RuntimeAdapter.h`.

## Fix Approach

### Option A (Recommended): Add Hermes defines to xcconfig files via Podfile `post_install`

Modify the [`ios/Podfile`](ios/Podfile) `post_install` hook to inject `HERMES_ENABLE_DEBUGGER=1` and `HERMES_V1_ENABLED=1` into the xcconfig files for `React-hermes` and `React-RuntimeHermes`.

**Pros:**
- Fixes the root cause at the configuration level
- All targets that include these headers will get the correct defines
- Survives `pod install` re-runs
- No source code modification needed

**Cons:**
- Requires running `pod install` after the change
- More complex configuration change

### Option B (Simpler): Patch `Registration.h` to provide stub

Create a patch (via patch-package or CocoaPods) to modify `Registration.h` so it defines a forward declaration or stub when `HERMES_V1_ENABLED` is defined, or simply remove the `#include <hermes/inspector/RuntimeAdapter.h>` line since the prebuilt framework already handles this.

**Pros:**
- Quick and surgical fix
- No Podfile changes needed

**Cons:**
- Modifying `node_modules` code is fragile
- May conflict with future RN upgrades
- Only fixes `Registration.h` — other files could have similar issues

## Implementation Plan

### Step 1 — Modify `ios/Podfile`

Add the following to the `post_install` hook:

```ruby
post_install do |installer|
  # ... existing code ...
  
  # Ensure Hermes V1 defines propagate to all targets
  installer.pods_project.targets.each do |target|
    if target.name == 'React-hermes' || target.name == 'React-RuntimeHermes'
      target.build_configurations.each do |config|
        config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] ||= ['$(inherited)']
        config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] << 'HERMES_ENABLE_DEBUGGER=1'
        config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] << 'HERMES_V1_ENABLED=1'
      end
    end
  end
end
```

### Step 2 — Clean and reinstall CocoaPods

```bash
cd ios
pod deintegrate
pod install
```

### Step 3 — Clean DerivedData and rebuild

```bash
rm -rf ~/Library/Developer/Xcode/DerivedData
cd ..
npx react-native run-ios
```

## Validation

1. Build should complete without `Registration.h:16` error
2. `make doctor` should still pass all checks
3. App should launch on iOS simulator/device
4. Hermes debugger should still work (if applicable)

## Rollback

If the fix causes issues:
1. Revert the Podfile changes
2. Run `cd ios && pod deintegrate && pod install`
3. Clean DerivedData and rebuild
