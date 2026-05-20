# iOS Build Fix: Missing `RCTAppDependencyProvider.h`

## Problem

iOS build fails with:

```
The file "RCTAppDependencyProvider.h" couldn't be opened because there is no such file.
(in target 'ReactAppDependencyProvider' from project 'Pods')
```

## Root Cause Analysis

### What is `RCTAppDependencyProvider.h`?

- A **codegen-generated file** created by React Native's codegen system
- Generated during `pod install` by [`generateAppDependencyProvider.js`](node_modules/react-native/scripts/codegen/generate-artifacts-executor/generateAppDependencyProvider.js:32)
- Expected at: `ios/build/generated/ios/ReactAppDependencyProvider/RCTAppDependencyProvider.h`
- Referenced by the [`ReactAppDependencyProvider`](node_modules/react-native/scripts/react_native_pods.rb:221) pod

### Why it's missing

The `ios/build/generated/` directory is **empty** — the codegen step either:

1. **Failed** during the last `pod install` (silent error in Node.js script)
2. Was **skipped** (no `RCT_SKIP_CODEGEN` env var found in any `.env` file)
3. Generated files were **deleted** by a `make clean` or manual cleanup

### Build Flow

1. `make dev-ios-device` → [`scripts/deploy-ios-device.sh`](scripts/deploy-ios-device.sh:317) → `npx react-native run-ios --device <UDID>`
2. `react-native run-ios` triggers `xcodebuild`
3. xcodebuild finds [`ReactAppDependencyProvider`](node_modules/react-native/scripts/react_native_pods.rb:221) pod at `build/generated/ios/ReactAppDependencyProvider/`
4. The pod's [umbrella header](ios/Pods/Target Support Files/ReactAppDependencyProvider/ReactAppDependencyProvider-umbrella.h:13) imports `#import "RCTAppDependencyProvider.h"`
5. The file doesn't exist → **compilation error**

### Codegen Invocation Flow (during `pod install`)

```
react_native_pods.rb:224  →  run_codegen!()
  → codegen_utils.rb:55   →  node generate-codegen-artifacts.js -p <app_path> -o <ios_dir> -t ios
    → index.js:63         →  execute()
      → index.js:166      →  generateAppDependencyProvider(ios/build/generated/ios/ReactAppDependencyProvider)
        → generateAppDependencyProvider.js:32  →  writes RCTAppDependencyProvider.{h,mm}
```

## Fix Plan

### Step 1 — Clean stale build artifacts & Pods

- Run `make clean` to clear `ios/build/`, DerivedData, Metro caches
- Run `cd ios && rm -rf Pods Podfile.lock` to force a fresh `pod install`

### Step 2 — Reinstall Pods with codegen

- Run `cd ios && USE_FRAMEWORKS=static pod install`
- Watch for codegen output: look for `[Codegen] Generating RCTAppDependencyProvider`
- If codegen fails: check error output for Node.js/script issues

### Step 3 — Verify codegen output

- Confirm `ios/build/generated/ios/ReactAppDependencyProvider/RCTAppDependencyProvider.h` exists
- Confirm `ios/build/generated/ios/ReactAppDependencyProvider/RCTAppDependencyProvider.mm` exists
- Confirm `ios/build/generated/ios/ReactAppDependencyProvider/ReactAppDependencyProvider.podspec` exists

### Step 4 — Build

- Run `make dev-ios-device` again to test
- Or run `npx react-native run-ios --device <UDID>` directly

### Step 5 — If codegen still fails

- Run the codegen script manually to see error output:
  ```bash
  node node_modules/react-native/scripts/generate-codegen-artifacts.js \
    -p $(pwd) \
    -o ios \
    -t ios
  ```
- Check Node.js version compatibility (`node -v` should be >= 22.11.0)

## Makefile Targets Available

| Target                | Description                                        |
| --------------------- | -------------------------------------------------- |
| `make doctor`         | Run diagnostics to check codegen files, Pods, etc. |
| `make clean`          | Clean build artifacts + caches                     |
| `make reset-ios`      | Clean + reinstall Pods (full reset)                |
| `make install`        | Fresh install: yarn + pod install                  |
| `make dev-ios-device` | Build & deploy to connected iOS device             |
