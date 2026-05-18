# Android Build Fix Plan

## Root Cause Analysis

### Error 1: `react-native-worklets:mergeDebugNativeLibs`

```
Cannot access output property 'outputDir' of task ':react-native-worklets:mergeDebugNativeLibs'.
Accessing unreadable inputs or outputs is not supported.
java.nio.file.NoSuchFileException: .../react-native-worklets/android/build/intermediates/merged_native_libs/debug/mergeDebugNativeLibs/out/lib/x86
```

- **Library:** [`react-native-worklets`](node_modules/react-native-worklets/android/build.gradle) v0.8
- **Cause:** Gradle 9.3.1 enforces strict state tracking. The `mergeDebugNativeLibs` task references an output path that doesn't exist yet (native libs weren't built for x86).
- **Secondary cause:** The native `.so` files were never generated because the CMake build failed (Error 2), leaving the merge task with no inputs.

### Error 2: `:app:configureCMakeDebug[armeabi-v7a]`

```
ninja: error: unknown target 'cmTC_71eef'
The C compiler "/.../ndk/27.1.12297006/toolchains/llvm/prebuilt/darwin-x86_64/bin/clang"
is not able to compile a simple test program.
```

- **Cause:** NDK 27.1.12297006 is incompatible with CMake 3.22.1 (the only version installed in the Android SDK at `/Users/porter/Android/sdk/cmake/3.22.1/`).
- **Known CMake bug:** CMake 3.20–3.26 generates test targets with a format (`cmTC_<hash>`) that the bundled ninja cannot recognize. This was **fixed in CMake 3.27+**.
- **Impact:** The C compiler test fails → CMake configure fails → no native libraries are built → cascade to Error 1.

### Environment Summary

| Component                                                                                              | Current Version     | Issue                          |
| ------------------------------------------------------------------------------------------------------ | ------------------- | ------------------------------ |
| [`android/gradle/wrapper/gradle-wrapper.properties`](android/gradle/wrapper/gradle-wrapper.properties) | Gradle 9.3.1        | Too new for some RN libraries  |
| [`android/build.gradle`](android/build.gradle)                                                         | NDK 27.1.12297006   | Incompatible with CMake 3.22.1 |
| `$ANDROID_SDK/cmake/`                                                                                  | CMake 3.22.1 (only) | Too old for NDK 27.x           |

## Solution

Two independent fixes are needed. They can be applied in any order, but **fixing CMake first addresses the root cause** of the cascade.

### Fix 1: Install CMake 3.27+ via Android SDK Manager

**Why:** CMake 3.27+ fixed the ninja target bug. NDK 27.x needs a newer CMake.

**Steps:**

1. Install CMake 3.27+ using `sdkmanager`:

   ```bash
   /Users/porter/Android/sdk/tools/bin/sdkmanager "cmake;3.31.6"
   ```

   (or the latest available 3.27+ version)

2. Verify installation:

   ```bash
   ls /Users/porter/Android/sdk/cmake/
   # Expected: 3.22.1  3.31.6
   ```

3. No code changes needed — the build.gradle uses `version = System.getenv("CMAKE_VERSION") ?: "3.22.1"`, but Android Gradle Plugin will auto-detect the newest CMake version installed. If it doesn't, set the environment variable:
   ```bash
   export CMAKE_VERSION=3.31.6
   ```

### Fix 2: Downgrade Gradle to 8.x

**Why:** Gradle 9.x has breaking changes in task state tracking (`doNotTrackState()`) that break libraries like `react-native-worklets`. React Native 0.85 is tested with Gradle 8.10–8.12.

**Steps:**

1. Update [`android/gradle/wrapper/gradle-wrapper.properties`](android/gradle/wrapper/gradle-wrapper.properties):

   ```properties
   distributionUrl=https\://services.gradle.org/distributions/gradle-8.12-bin.zip
   ```

2. Update the Gradle wrapper:

   ```bash
   cd android && ./gradlew wrapper --gradle-version 8.12
   ```

3. Verify no deprecated API warnings in build output.

### Alternative to Fix 2: Patch react-native-worklets only

If you prefer to stay on Gradle 9.x, create a patch for [`react-native-worklets`](node_modules/react-native-worklets/android/build.gradle) to add `doNotTrackState()` to the merge task. However, **downgrading Gradle is safer** because other libraries may also have Gradle 9.x compatibility issues.

## Testing

After applying fixes, run:

```bash
make clean           # Clean all build artifacts
make dev-android     # Build and run (or dev-android-device for USB)
```

Expected outcome: `BUILD SUCCESSFUL`

## Rollback

If issues persist:

1. Reset Gradle wrapper: `cd android && ./gradlew wrapper --gradle-version 9.3.1`
2. Remove installed CMake: `sdkmanager --uninstall "cmake;3.31.6"`
