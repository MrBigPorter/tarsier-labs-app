# iOS New Architecture Build Fix Plan

## Problem Summary

Two compilation errors when building iOS with New Architecture enabled:

1. **`non-modular-include-in-framework-module`** — Triggered by `react-native-reanimated`, `react-native-svg`, and `react-native-keychain` C++ headers in Fabric/TurboModules context.
2. **Hermes header file missing** — `ReanimatedHermesRuntime.cpp` cannot find `hermes/inspector/RuntimeAdapter.h`.

### Root Causes

| Cause | Detail |
|-------|--------|
| Project on external SSD (`/Volumes/MySSD/`) | Xcode resolves symlinks to absolute paths on external drives, causing header "out-of-bounds" errors |
| `CLANG_ALLOW_NON_MODULAR_INCLUDES` not set in Podfile | Xcode restricts non-modular headers in framework modules; Reanimated C++ code triggers this |
| No explicit `RCT_NEW_ARCH_ENABLED=1` on iOS | Relies on RN 0.85.3 auto-detection which can be unreliable on external drives |
| DerivedData / Pod cache corruption | Stale cache from previous builds references incorrect paths |

### Environment

| Key | Value |
|-----|-------|
| Project path (old) | `/Volumes/MySSD/work/frontend-blog-mobile` |
| Project path (new) | `~/Projects/frontend-blog-mobile` |
| React Native | `0.85.3` |
| New Architecture | `enabled` |
| react-native-reanimated | `^3.x` |
| react-native-svg | `^15.x` |
| react-native-keychain | `^9.x` |
| Hermes engine | `250829098.0.10` |

---

## Fix Steps (in order)

### Step 1 — Copy project to Mac internal drive

```bash
# Create Projects directory if not exists
mkdir -p ~/Projects

# Copy entire project (preserves all files, git history, etc.)
cp -R /Volumes/MySSD/work/frontend-blog-mobile ~/Projects/frontend-blog-mobile

# Verify copy succeeded
ls -la ~/Projects/frontend-blog-mobile/package.json

# Open new location in VS Code
cd ~/Projects/frontend-blog-mobile
code .
```

> **Note:** After copying, continue all work from `~/Projects/frontend-blog-mobile`. The old path at `/Volumes/MySSD/` can be kept as backup or deleted later.

### Step 2 — Reinstall JS dependencies

```bash
cd ~/Projects/frontend-blog-mobile

# Remove old node_modules to get clean slate
rm -rf node_modules

# Install with yarn
yarn install
```

### Step 3 — Update `ios/Podfile` `post_install` hook

**Target:** [`ios/Podfile:26`](ios/Podfile)

Replace the current minimal `post_install` block with:

```ruby
post_install do |installer|
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      # Core fix: allow non-modular includes in framework modules
      config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'

      # Fix header search path inheritance
      config.build_settings['HEADER_SEARCH_PATHS'] ||= ['$(inherited)']

      # Suppress non-modular include errors for known problematic pods
      if ['RNReanimated', 'RNSVG', 'RNKeychain'].include?(target.name)
        config.build_settings['OTHER_CFLAGS'] ||= ['$(inherited)']
        config.build_settings['OTHER_CFLAGS'] << '-Wno-error=non-modular-include-in-framework-module'
      end
    end
  end

  react_native_post_install(
    installer,
    config[:reactNativePath],
    :mac_catalyst_enabled => false,
  )
end
```

### Step 4 — Add explicit `RCT_NEW_ARCH_ENABLED=1` to Podfile

Add this line **before** the `target` block in [`ios/Podfile:17`](ios/Podfile):

```ruby
# Explicitly enable New Architecture for iOS
ENV['RCT_NEW_ARCH_ENABLED'] = '1'
```

### Step 5 — Clean DerivedData

```bash
rm -rf ~/Library/Developer/Xcode/DerivedData/FrontendBlogMobile-*
```

Additionally, in Xcode:
1. **File → Workspace Settings**
2. Click the arrow next to **Derived Data** path to open in Finder
3. Manually delete all related cache folders
4. **Product → Clean Build Folder** (hold Option key while clicking)

### Step 6 — Full CocoaPods reinstall

```bash
cd ~/Projects/frontend-blog-mobile/ios
rm -rf Pods Podfile.lock
export RCT_NEW_ARCH_ENABLED=1
bundle exec pod install --repo-update
```

### Step 7 — Build with Xcode

1. Open [`ios/FrontendBlogMobile.xcworkspace`](ios/FrontendBlogMobile.xcworkspace) in Xcode
2. Select **iOS Simulator** as target
3. **Product → Build** (⌘B)
4. If successful, **Product → Run** (⌘R) to verify app launches

### Step 8 — Update paths in scripts (if needed)

Check if any scripts reference absolute SSD paths:

```bash
grep -r "/Volumes/MySSD" ~/Projects/frontend-blog-mobile --include="*.sh" --include="Makefile" --include="*.json" --include="*.yml" --include="*.yaml"
```

---

## Verification Checklist

| Check | Command / Action |
|-------|-----------------|
| Project copied | `ls ~/Projects/frontend-blog-mobile/package.json` |
| node_modules installed | `ls ~/Projects/frontend-blog-mobile/node_modules/react-native` |
| Podfile syntax valid | `cd ios && bundle exec pod install` succeeds |
| DerivedData cleaned | No `FrontendBlogMobile-*` entries in DerivedData |
| Xcode build succeeds | ⌘B in Xcode completes without errors |
| App launches | ⌘R in Xcode shows app on simulator |
| No SSD paths remain | `grep -r "/Volumes/MySSD" .` returns nothing |

---

## Fallback

If build still fails after moving to internal drive + Podfile fixes:

1. **Double-check Xcode version** — New Architecture is more stable on Xcode 16+
2. **Temporarily disable New Arch for iOS** (not recommended):
   - Set `ENV['RCT_NEW_ARCH_ENABLED'] = '0'` in Podfile
3. **Open a discussion** with the specific Xcode error output
