# OAuth "cannot read property startAuth" — Xcode Native Module Registration Fix

## Root Cause

The files [`ios/ASAuthSession.swift`](ios/ASAuthSession.swift) and [`ios/ASAuthSession.m`](ios/ASAuthSession.m) exist on disk with **correct implementations**, but are **not registered in the Xcode project file** (`project.pbxproj`). This means they are never compiled into the app bundle, so `NativeModules.ASAuthSession` is `undefined` at runtime.

### Evidence

In `project.pbxproj`:

| Section | Currently Includes | Missing |
|---------|-------------------|---------|
| **PBXBuildFile** (line 9-15) | Only `AppDelegate.swift`, `Images.xcassets`, `PrivacyInfo.xcprivacy`, `LaunchScreen.storyboard` | `ASAuthSession.swift`, `ASAuthSession.m` |
| **PBXFileReference** (line 17-28) | Only `AppDelegate.swift`, `Images.xcassets`, `Info.plist`, `PrivacyInfo.xcprivacy`, `LaunchScreen.storyboard` | `ASAuthSession.swift`, `ASAuthSession.m` |
| **PBXGroup > FrontendBlogMobile** (line 42-53) | Only `Images.xcassets`, `AppDelegate.swift`, `Info.plist`, `LaunchScreen.storyboard`, `PrivacyInfo.xcprivacy` | `ASAuthSession.swift`, `ASAuthSession.m` |
| **PBXSourcesBuildPhase** (line 244-252) | Only `AppDelegate.swift` | `ASAuthSession.swift`, `ASAuthSession.m` |

### Call Chain

1. User taps Google/Facebook button in [`src/screens/AuthScreen.tsx`](src/screens/AuthScreen.tsx) → calls `loginGoogle()` / `loginFacebook()`
2. [`src/lib/hooks/useOAuth.ts`](src/lib/hooks/useOAuth.ts) → calls `NativeModules.ASAuthSession.startAuth(url, 'tarsier', true)`
3. `NativeModules.ASAuthSession` is `undefined` → `TypeError: Cannot read property 'startAuth'`
4. Why it's `undefined`: The `.swift`/`.m` files are **never compiled** because they're not in `project.pbxproj`

## Fix Plan

### Task 1: Edit `project.pbxproj` — Add 4 entries

Add the following to the `objects` dictionary in [`ios/FrontendBlogMobile.xcodeproj/project.pbxproj`](ios/FrontendBlogMobile.xcodeproj/project.pbxproj):

#### 1a. PBXBuildFile section (after line 14)

```
AABBCCDD3CA45674006654EE /* ASAuthSession.swift in Sources */ = {isa = PBXBuildFile; fileRef = AABBCCDD2CA45674006654EE /* ASAuthSession.swift */; };
AABBCCDD5CA45674006654EE /* ASAuthSession.m in Sources */ = {isa = PBXBuildFile; fileRef = AABBCCDD4CA45674006654EE /* ASAuthSession.m */; };
```

#### 1b. PBXFileReference section (after line 26)

```
AABBCCDD2CA45674006654EE /* ASAuthSession.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ASAuthSession.swift; sourceTree = "<group>"; };
AABBCCDD4CA45674006654EE /* ASAuthSession.m */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.c.objc; path = ASAuthSession.m; sourceTree = "<group>"; };
```

#### 1c. PBXGroup > FrontendBlogMobile children (line 44-50)

Add `AABBCCDD2CA45674006654EE /* ASAuthSession.swift */` and `AABBCCDD4CA45674006654EE /* ASAuthSession.m */` to the children array.

#### 1d. PBXSourcesBuildPhase files (line 248-250)

Add `AABBCCDD3CA45674006654EE /* ASAuthSession.swift in Sources */` and `AABBCCDD5CA45674006654EE /* ASAuthSession.m in Sources */` to the files array.

### Task 2: Verify by rebuilding

1. `cd ios && pod install` (to ensure Podfile is synced)
2. Build and run on iOS simulator/device
3. `NativeModules.ASAuthSession` will now be available and `startAuth()` will work

## Files Modified

| File | Change |
|------|--------|
| `ios/FrontendBlogMobile.xcodeproj/project.pbxproj` | Add PBXBuildFile, PBXFileReference, PBXGroup children, PBXSourcesBuildPhase entries for both `.swift` and `.m` files |

## Files NOT Modified (already correct)

| File | Status |
|------|--------|
| `ios/ASAuthSession.swift` | ✅ Already correct — native module class with `startAuth` method |
| `ios/ASAuthSession.m` | ✅ Already correct — ObjC bridging header with `RCT_EXTERN_MODULE`/`RCT_EXTERN_METHOD` |
| `src/lib/hooks/useOAuth.ts` | ✅ Already correct — calls `NativeModules.ASAuthSession.startAuth()` |
| `src/screens/AuthScreen.tsx` | ✅ Already correct — calls `loginGoogle()`, `loginFacebook()`, `loginApple()` |
