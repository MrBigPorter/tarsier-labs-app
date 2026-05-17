# iOS Build Fix — ASAuthSession.m Macro Error (Not libwebp)

## Problem Summary

Running `make dev-ios` failed with exit code 2 during `xcodebuild`. The verbose output showed many `error \=...` lines (Xcode echoing compiler arguments with escaped syntax), but **the actual compilation error was in [`ios/ASAuthSession.m`](ios/ASAuthSession.m:5)** — a React Native native module bridging file for `ASWebAuthenticationSession`.

The **libwebp CocoaPod compiled fine** — the initial assumption that libwebp caused the failure was incorrect.

---

## Root Cause

### Actual Root Cause: Missing `RCT_EXTERN_REMAP_METHOD` Macro in RN 0.85.3

In React Native 0.85.3, the `RCT_EXTERN_REMAP_METHOD` macro **no longer exists**. The file [`ios/ASAuthSession.m`](ios/ASAuthSession.m:5) used this non-existent macro:

```objc
// ❌ BROKEN: RCT_EXTERN_REMAP_METHOD does not exist in RN 0.85.3
RCT_EXTERN_REMAP_METHOD(startAuth,
                        url:(NSString *)url
                        callbackUrlScheme:(NSString *)callbackUrlScheme
                        prefersEphemeralSession:(BOOL)prefersEphemeralSession
                        resolver:(RCTPromiseResolveBlock)resolve
                        rejecter:(RCTPromiseRejectBlock)reject)
```

The preprocessor left `RCT_EXTERN_REMAP_METHOD` unexpanded, causing the compiler to parse it as a function call. This led to syntax errors at the first `(NSString *)` parameter (treated as a C-style cast in a function call context).

### Available Macros in RN 0.85.3

From [`node_modules/react-native/React/Base/RCTBridgeModule.h`](node_modules/react-native/React/Base/RCTBridgeModule.h:310):

| Macro | Purpose | Signature |
|-------|---------|-----------|
| `RCT_EXTERN_METHOD(method)` | Export method to JS (JS name derived from first selector keyword) | `(method)` |
| `RCT_REMAP_METHOD(js_name, method)` | Export with custom JS name (includes inline method declaration) | `(js_name, method)` |
| `RCT_EXTERN_MODULE` / `RCT_EXTERN_REMAP_MODULE` | External module registration | — |

**`RCT_EXTERN_REMAP_METHOD` was removed** and is NOT available.

### What Also Confirmed libwebp Was NOT the Issue

- The `.resp` (response) file at `DerivedData/.../libwebp.build/Objects-normal/arm64/7187679823f38a2a940e0043cdf9d637-common-args.resp` contained **correct content** (proper compiler flags, no stale SSD paths)
- `libwebp` source files compiled successfully once the `ASAuthSession.m` error was fixed
- All `libwebp` xcconfig files had correct paths (no `/Volumes/MySSD/` remnants)

---

## Fix Applied

### Changed [`ios/ASAuthSession.m`](ios/ASAuthSession.m:5)

Replaced the non-existent `RCT_EXTERN_REMAP_METHOD` with `RCT_EXTERN_METHOD` using the correct ObjC selector that matches the Swift implementation.

**Swift method signature** (from [`ios/ASAuthSession.swift`](ios/ASAuthSession.swift:22)):

```swift
@objc func startAuth(
  _ url: String,
  callbackUrlScheme: String,
  prefersEphemeralSession: Bool,
  resolver resolve: @escaping RCTPromiseResolveBlock,
  rejecter reject: @escaping RCTPromiseRejectBlock
)
```

The `@objc` annotation generates the ObjC selector `startAuth:callbackUrlScheme:prefersEphemeralSession:resolver:rejecter:`.

**Fixed code:**

```objc
// ✅ FIXED: Uses RCT_EXTERN_METHOD with correct ObjC selector
RCT_EXTERN_METHOD(startAuth:(NSString *)url
                  callbackUrlScheme:(NSString *)callbackUrlScheme
                  prefersEphemeralSession:(BOOL)prefersEphemeralSession
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
```

The JS method name is automatically derived from the first keyword of the selector (`startAuth`).

---

## Build Verification

| Step | Command | Result |
|------|---------|--------|
| `make clean` | Cleans local build artifacts | ✅ Success |
| Clean DerivedData | `rm -rf ~/Library/Developer/Xcode/DerivedData/FrontendBlogMobile-*` | ✅ Success |
| Direct xcodebuild | `xcodebuild -workspace ... -configuration Debug -scheme FrontendBlogMobile -destination id=...` | ✅ **BUILD SUCCEEDED** |

---

## Key Lessons

1. **Don't trust verbose Xcode "error" output** — lines starting with `error` in verbose mode are often just Xcode echoing compiler arguments with `\=` escaped syntax, NOT actual errors
2. **Always check the actual compilation error** using `xcodebuild` directly (not through `react-native run-ios`) to see real error messages like `file.m:line:col: error: expected ')'`
3. **RN 0.85.3 removed `RCT_EXTERN_REMAP_METHOD`** — use `RCT_EXTERN_METHOD(method)` where the JS name is derived from the first keyword of the ObjC selector
4. **libwebp compiled fine** — the `\=` output and `.resp` file concerns were red herrings
