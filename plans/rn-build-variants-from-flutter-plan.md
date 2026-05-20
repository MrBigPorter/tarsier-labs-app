# Frontend Blog Mobile — Build Variants & CI/CD Plan

## Objective

Add **two build flavors** (test + production) to this React Native project, mirroring best practices learned from Flutter's flavor system. The setup includes Android productFlavors, iOS xcconfig configurations, environment-aware config, Makefile targets, a GitHub Actions CI/CD pipeline, and CodePush hot updates.

---

## Part 1: Target Architecture

### 1.1 Flavor Matrix (2 Environments)

|                          | **Test**                   | **Production**                         |
| ------------------------ | -------------------------- | -------------------------------------- |
| **Android package**      | `com.tarsier.labs.test`    | `com.tarsier.labs`                     |
| **Android app name**     | Tarsier(Test)              | Tarsier                                |
| **iOS bundle ID**        | `com.tarsier.labs.test`    | `com.tarsier.labs`                     |
| **iOS app name**         | Tarsier(Test)              | Tarsier                                |
| **API base URL**         | dev-api.joyminis.com       | api.joyminis.com                       |
| **Sentry**               | Disabled                   | Enabled                                |
| **Signing**              | debug.keystore             | upload keystore                        |
| **Distribution**         | Firebase App Distribution  | Play Store + App Store                 |
| **Install side-by-side** | ✅ Yes                     | ✅ Yes                                 |
| **Gradle variant names** | `testDebug`, `testRelease` | `productionDebug`, `productionRelease` |

---

### 1.2 Phase 1: Android Product Flavors — Detailed Steps

**File to modify:** [`android/app/build.gradle`](android/app/build.gradle)

#### Step 1.1: Add `flavorDimensions` + `productFlavors` block

Insert **inside** the `android { }` block (line 90), after `namespace` and `defaultConfig`:

```groovy
    flavorDimensions "env"
    productFlavors {
        test {
            dimension "env"
            applicationIdSuffix ".test"
            versionNameSuffix "-test"
            resValue "string", "app_name", "Tarsier(Test)"
        }
        production {
            dimension "env"
            applicationIdSuffix ""
            resValue "string", "app_name", "Tarsier"
        }
    }
```

React Native's Gradle plugin auto-generates build variants: `testDebug`, `testRelease`, `productionDebug`, `productionRelease`.

#### Step 1.2: Update `react { debuggableVariants }` block

Uncomment and update line 32 in [`android/app/build.gradle`](android/app/build.gradle):

```groovy
react {
    // ... existing config ...
    debuggableVariants = ["testDebug", "productionDebug"]
}
```

This tells the RN Gradle plugin which variants should bundle the dev JS (Metro) vs production JS.

#### Step 1.3: Add default `resValue` in `defaultConfig`

The `resValue` in `productFlavors` creates a string resource. Add a default in `defaultConfig` so the resource always exists:

```groovy
defaultConfig {
    applicationId "com.tarsier.labs"
    // ... existing ...
    resValue "string", "app_name", "Tarsier"
}
```

#### Step 1.4: Verify with build command

```bash
# Test build (APK)
cd android && ./gradlew assembleTestRelease

# Production build (APK)
cd android && ./gradlew assembleProductionRelease

# Production build (AAB - Play Store)
cd android && ./gradlew bundleProductionRelease
```

Expected output paths:

- `android/app/build/outputs/apk/test/release/app-test-release.apk`
- `android/app/build/outputs/apk/production/release/app-production-release.apk`
- `android/app/build/outputs/bundle/productionRelease/app-production-release.aab`

#### Step 1.5: Update `AndroidManifest.xml` if needed

Check [`android/app/src/main/AndroidManifest.xml`](android/app/src/main/AndroidManifest.xml) for any hardcoded `android:label`. If it says `@string/app_name`, it will automatically pick up the flavor's `resValue`. If it's hardcoded (e.g., `"Tarsier"`), change it to `@string/app_name`.

---

### 1.3 Phase 2: iOS Build Configurations — Detailed Steps

#### Step 2.1: Create `ios/Config/` directory and xcconfig files

**Create** `ios/Config/Test.xcconfig`:

```xcconfig
// ios/Config/Test.xcconfig
// Test flavor — bundle ID with .test suffix, display name with (Test)

PRODUCT_BUNDLE_IDENTIFIER = com.tarsier.labs.test
DISPLAY_NAME = Tarsier(Test)
```

**Create** `ios/Config/Prod.xcconfig`:

```xcconfig
// ios/Config/Prod.xcconfig
// Production flavor — standard bundle ID and display name

PRODUCT_BUNDLE_IDENTIFIER = com.tarsier.labs
DISPLAY_NAME = Tarsier
```

#### Step 2.2: Add build configurations in Xcode project

Open the project in Xcode:

```bash
open ios/FrontendBlogMobile.xcworkspace
```

Then in Xcode:

1. Select the `FrontendBlogMobile` project in the Project Navigator
2. Select the `FrontendBlogMobile` target → **Info** tab
3. Under **Configurations**, click `+` → **Duplicate "Debug" Configuration** → Name it `Debug-Test`
4. Click `+` → **Duplicate "Release" Configuration** → Name it `Release-Test`
5. Click `+` → **Duplicate "Debug" Configuration** → Name it `Debug-Prod`
6. Click `+` → **Duplicate "Release" Configuration** → Name it `Release-Prod`

Now you should have 6 configurations total:

- Debug (existing)
- Release (existing)
- Debug-Test (new)
- Release-Test (new)
- Debug-Prod (new)
- Release-Prod (new)

For each new config, set its xcconfig file (select the config row, open File Inspector ⌘⌥1, find **Configuration File** dropdown):

| Configuration | xcconfig file              |
| ------------- | -------------------------- |
| Debug-Test    | `ios/Config/Test.xcconfig` |
| Release-Test  | `ios/Config/Test.xcconfig` |
| Debug-Prod    | `ios/Config/Prod.xcconfig` |
| Release-Prod  | `ios/Config/Prod.xcconfig` |

#### Step 2.3: Info.plist — already uses dynamic variables

[`Info.plist`](ios/FrontendBlogMobile/Info.plist) line 9-10 already uses `$(DISPLAY_NAME)`:

```xml
<key>CFBundleDisplayName</key>
<string>$(DISPLAY_NAME)</string>
```

Line 14 uses `$(PRODUCT_BUNDLE_IDENTIFIER)`. No changes needed.

#### Step 2.4: Create Test Xcode scheme

1. In Xcode, go to **Product** → **Scheme** → **Manage Schemes**
2. Select `FrontendBlogMobile` scheme
3. Click the gear icon ⚙ → **Duplicate**
4. Name the new scheme `FrontendBlogMobile-Test`
5. For each action (Build, Run, Test, Profile, Analyze, Archive), change the **Build Configuration**:

| Action  | Build Configuration |
| ------- | ------------------- |
| Build   | Release-Test        |
| Run     | Debug-Test          |
| Test    | Debug-Test          |
| Profile | Release-Test        |
| Analyze | Debug-Test          |
| Archive | Release-Test        |

#### Step 2.5: Verify iOS builds

```bash
# Test archive (use Test scheme) — no codesign since Apple Developer is pending
cd ios && xcodebuild -workspace FrontendBlogMobile.xcworkspace \
    -scheme FrontendBlogMobile-Test \
    -configuration Release-Test \
    -archivePath ./build/Test.xcarchive \
    archive \
    CODE_SIGN_IDENTITY="" CODE_SIGNING_REQUIRED=NO

# Production archive
cd ios && xcodebuild -workspace FrontendBlogMobile.xcworkspace \
    -scheme FrontendBlogMobile \
    -configuration Release \
    -archivePath ./build/Prod.xcarchive \
    archive \
    CODE_SIGN_IDENTITY="" CODE_SIGNING_REQUIRED=NO
```

---

### 1.4 Phase 3: Environment Config — Detailed Steps

**File to modify:** [`src/lib/env.ts`](src/lib/env.ts)

Also create 2 new native module files for flavor detection.

#### Step 3.1: Add `TEST_CONFIG`

Add this after `DEV_CONFIG` (line 39) and before `PROD_CONFIG` (line 41):

```typescript
const TEST_CONFIG: EnvConfig = {
  API_URL: 'https://dev-api.joyminis.com',
  WEB_URL: 'https://blog-dev.joyminis.com',
  SENTRY_DSN: '',
  DEFAULT_LOCALE: 'en',
  ENABLE_ANALYTICS: false,
  LOG_LEVEL: 'debug',
  OAUTH_GOOGLE_CLIENT_ID: '',
  OAUTH_APPLE_CLIENT_ID: '',
};
```

Note: `TEST_CONFIG` has the same values as `DEV_CONFIG` — intentional, since test = local dev.

#### Step 3.2: Add flavor detection logic

Replace the `selectConfig()` function (lines 68-70) with:

```typescript
/**
 * Detects which Android build flavor is active.
 * In iOS, falls back to __DEV__ since iOS lacks a native flavor system.
 *
 * Returns: 'test' | 'production' | 'development'
 */
function detectFlavor(): 'test' | 'production' | 'development' {
  try {
    const BuildConfig = require('react-native').NativeModules.RNBuildConfig;
    if (BuildConfig?.FLAVOR) {
      const flavor = String(BuildConfig.FLAVOR).toLowerCase();
      if (flavor === 'test') return 'test';
      if (flavor === 'production') return 'production';
    }
  } catch {
    // NativeModules not available — likely iOS
  }

  // iOS fallback
  if (!isDevMode()) {
    return 'production';
  }

  return 'development';
}

function selectConfig(): EnvConfig {
  const flavor = detectFlavor();

  switch (flavor) {
    case 'test':
      return { ...TEST_CONFIG };
    case 'production':
      return { ...PROD_CONFIG };
    case 'development':
    default:
      return { ...DEV_CONFIG };
  }
}
```

#### Step 3.3: Create Android Native Module for FLAVOR detection

**Create** `android/app/src/main/java/com/tarsier/labs/RNBuildConfigModule.kt`:

```kotlin
package com.tarsier.labs

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule

class RNBuildConfigModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    override fun getName(): String = "RNBuildConfig"

    override fun getConstants(): Map<String, Any> {
        return mapOf(
            "FLAVOR" to BuildConfig.FLAVOR,
            "DEBUG" to BuildConfig.DEBUG,
            "VERSION_NAME" to BuildConfig.VERSION_NAME,
            "VERSION_CODE" to BuildConfig.VERSION_CODE
        )
    }
}
```

**Create** `android/app/src/main/java/com/tarsier/labs/RNBuildConfigPackage.kt`:

```kotlin
package com.tarsier.labs

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class RNBuildConfigPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(RNBuildConfigModule(reactContext))
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}
```

**Register** the package in [`MainApplication.kt`](android/app/src/main/java/com/tarsier/labs/MainApplication.kt) (line 16-19):

```kotlin
override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
        context = applicationContext,
        packageList =
            PackageList(this).packages.apply {
                add(RNBuildConfigPackage())
            },
    )
}
```

#### Step 3.4: Update exports

Update `BUILD_VARIANT` (line 102):

```typescript
BUILD_VARIANT: detectFlavor(),
```

Add new exports after line 114:

```typescript
/** Current build flavor */
export const buildFlavor = detectFlavor();

/** Check if running in test flavor */
export const isTestFlavor = buildFlavor === 'test';

/** Check if running in production flavor */
export const isProdFlavor = buildFlavor === 'production';
```

---

### 1.5 Phase 4: Makefile — Detailed Steps

**File to modify:** [`Makefile`](Makefile)

#### Step 4.1: Add per-flavor build targets

Add after the existing `build-android` target (line 245):

```makefile
# ── Build per flavor ──────────────────────────────────────────────────

build-test-android: ## Build Android test APK (testRelease)
	@echo "🏗️  Building Android \033[36mtest\033[0m APK..."
	cd android && ./gradlew assembleTestRelease
	@echo "✅ Test APK: android/app/build/outputs/apk/test/release/app-test-release.apk"

build-prod-aab: ## Build Android production AAB (bundleProductionRelease)
	@echo "🏗️  Building Android \033[31mproduction\033[0m AAB..."
	cd android && ./gradlew bundleProductionRelease
	@echo "✅ Production AAB: android/app/build/outputs/bundle/productionRelease/app-production-release.aab"

build-prod-apk: ## Build Android production APK (assembleProductionRelease)
	@echo "🏗️  Building Android \033[31mproduction\033[0m APK..."
	cd android && ./gradlew assembleProductionRelease
	@echo "✅ Production APK: android/app/build/outputs/apk/production/release/app-production-release.apk"

# ── Run per flavor ────────────────────────────────────────────────────

run-test-android: ## Run Android test flavor on emulator
	@echo "🎯 Running Android \033[36mtest\033[0m flavor..."
	yarn android --variant=testDebug

run-prod-android: ## Run Android production flavor on emulator
	@echo "🎯 Running Android \033[31mproduction\033[0m flavor..."
	yarn android --variant=productionDebug

# ── iOS per flavor ────────────────────────────────────────────────────

build-test-ios: ## Build iOS test archive (no codesign)
	@echo "🏗️  Building iOS \033[36mtest\033[0m archive..."
	cd ios && xcodebuild -workspace FrontendBlogMobile.xcworkspace \
		-scheme FrontendBlogMobile-Test \
		-configuration Release-Test \
		-archivePath ./build/Test.xcarchive \
		archive \
		CODE_SIGN_IDENTITY="" CODE_SIGNING_REQUIRED=NO
	@echo "✅ iOS test archive: ios/build/Test.xcarchive"

build-prod-ios: ## Build iOS production archive (no codesign)
	@echo "🏗️  Building iOS \033[31mproduction\033[0m archive..."
	cd ios && xcodebuild -workspace FrontendBlogMobile.xcworkspace \
		-scheme FrontendBlogMobile \
		-configuration Release \
		-archivePath ./build/Prod.xcarchive \
		archive \
		CODE_SIGN_IDENTITY="" CODE_SIGNING_REQUIRED=NO
	@echo "✅ iOS production archive: ios/build/Prod.xcarchive"

# ── Hot Update (CodePush) ─────────────────────────────────────────────

codepush-test: ## Push hot update to test (CodePush Staging)
	@echo "📦 CodePush \033[36mtest\033[0m (Staging)..."
	npx code-push release-react TarsierTest android -d Staging
	npx code-push release-react TarsierTest ios -d Staging
	@echo "✅ CodePush test update sent"

codepush-prod: ## Push hot update to production (CodePush Production)
	@echo "📦 CodePush \033[31mproduction\033[0m..."
	npx code-push release-react TarsierProduction android -d Production
	npx code-push release-react TarsierProduction ios -d Production
	@echo "✅ CodePush production update sent"
```

#### Step 4.2: Update `.PHONY`

Update line 8-16 to include new targets:

```makefile
.PHONY: help dev dev-ios dev-ios-device dev-android dev-android-device staging staging-ios staging-android \
        release release-ios release-android release-android-aab \
        build build-ios build-android \
        build-test-android build-prod-aab build-prod-apk \
        run-test-android run-prod-android \
        build-test-ios build-prod-ios \
        codepush-test codepush-prod \
        install update clean reset lint typecheck test check \
        env-dev env-staging env-prod env-show \
        devtools fusebox logs-ios logs-android profile hermes-profile perf perf-ci check-bundle-size sentry-dashboard xcode \
        fresh reset-android reset-ios studio-android audit \
        doctor rebuild-ios rebuild-android reset-all \
        port-ls port-kill port-kill-metro ports
```

---

### 1.6 Phase 5: CI/CD Pipeline — Detailed Steps

**Create** `.github/workflows/deploy.yml`:

```yaml
name: Tarsier CI/CD

on:
  push:
    branches: [main, test]
    tags: ['v*']
  pull_request:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  # ── Job 1: CI Gate ──────────────────────────────────────────────────
  # Cheap checks that run on EVERY push/PR to catch errors fast.
  ci-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'yarn'

      - name: Install dependencies
        run: yarn install --immutable

      - name: Lint
        run: yarn lint

      - name: TypeScript check
        run: yarn tsc --noEmit

      - name: Unit tests
        run: yarn test --ci

  # ── Job 2: Android Build Matrix ─────────────────────────────────────
  android:
    needs: ci-gate
    if: github.event_name != 'pull_request'
    runs-on: ubuntu-latest
    strategy:
      matrix:
        flavor: [test, production]
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'yarn'

      - name: Install dependencies
        run: yarn install --immutable

      - name: Restore keystore
        run: |
          echo "${{ secrets.KEYSTORE_BASE64 }}" | base64 --decode > android/app/upload-keystore.jks
          echo "${{ secrets.KEYSTORE_PROPERTIES }}" > android/app/keystore.properties

      - name: Build ${{ matrix.flavor }} APK
        run: cd android && ./gradlew assemble${{ matrix.flavor == 'test' && 'Test' || 'Production' }}Release

      - name: Upload APK artifact
        uses: actions/upload-artifact@v4
        with:
          name: app-${{ matrix.flavor }}-release.apk
          path: android/app/build/outputs/apk/${{ matrix.flavor == 'test' && 'test' || 'production' }}/release/app-${{ matrix.flavor == 'test' && 'test' || 'production' }}-release.apk
          retention-days: 30

  # ── Job 3: iOS Build ───────────────────────────────────────────────
  ios:
    needs: ci-gate
    if: github.event_name != 'pull_request'
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'yarn'

      - name: Install dependencies
        run: yarn install --immutable

      - name: Install CocoaPods
        run: cd ios && pod install

      - name: Build iOS (test scheme)
        if: github.ref == 'refs/heads/test'
        run: |
          cd ios && xcodebuild -workspace FrontendBlogMobile.xcworkspace \
            -scheme FrontendBlogMobile-Test \
            -configuration Release-Test \
            -archivePath ./build/Test.xcarchive \
            archive \
            CODE_SIGN_IDENTITY="" CODE_SIGNING_REQUIRED=NO

      - name: Build iOS (production scheme)
        if: github.ref == 'refs/heads/main' || startsWith(github.ref, 'refs/tags/v')
        run: |
          cd ios && xcodebuild -workspace FrontendBlogMobile.xcworkspace \
            -scheme FrontendBlogMobile \
            -configuration Release \
            -archivePath ./build/Prod.xcarchive \
            archive \
            CODE_SIGN_IDENTITY="" CODE_SIGNING_REQUIRED=NO

      - name: Upload iOS artifacts
        uses: actions/upload-artifact@v4
        with:
          name: ios-archives
          path: ios/build/*.xcarchive
          retention-days: 30

  # ── Job 4: CodePush Hot Updates ─────────────────────────────────────
  codepush:
    needs: ci-gate
    if: github.ref == 'refs/heads/test' || github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'yarn'

      - name: Install dependencies
        run: yarn install --immutable

      - name: CodePush - Test (Staging channel)
        if: github.ref == 'refs/heads/test'
        env:
          CODEPUSH_TOKEN: ${{ secrets.CODEPUSH_TOKEN }}
        run: |
          npx code-push login --token $CODEPUSH_TOKEN
          npx code-push release-react TarsierTest android -d Staging
          npx code-push release-react TarsierTest ios -d Staging

      - name: CodePush - Production (Production channel)
        if: github.ref == 'refs/heads/main'
        env:
          CODEPUSH_TOKEN: ${{ secrets.CODEPUSH_TOKEN }}
        run: |
          npx code-push login --token $CODEPUSH_TOKEN
          npx code-push release-react TarsierProduction android -d Production
          npx code-push release-react TarsierProduction ios -d Production
```

#### GitHub Secrets to set up

| Secret                | Value                                                                                    |
| --------------------- | ---------------------------------------------------------------------------------------- |
| `KEYSTORE_BASE64`     | Base64 of upload keystore: `base64 -i android/app/release-upload-key.keystore \| pbcopy` |
| `KEYSTORE_PROPERTIES` | Contents of `android/app/keystore.properties`                                            |
| `CODEPUSH_TOKEN`      | App Center API token                                                                     |

---

### 1.7 Phase 6: CodePush (Hot Update) — Detailed Steps

#### Step 6.1: Install package

```bash
yarn add react-native-code-push
cd ios && pod install && cd ..
```

#### Step 6.2: Android native integration

Modify [`MainApplication.kt`](android/app/src/main/java/com/tarsier/labs/MainApplication.kt) — add `CodePush` package:

```kotlin
package com.tarsier.labs

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.microsoft.codepush.react.CodePush

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          add(CodePush("YOUR_CODEPUSH_DEPLOY_KEY_ANDROID", applicationContext, BuildConfig.DEBUG))
          add(RNBuildConfigPackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
  }
}
```

#### Step 6.3: iOS native integration

Modify [`AppDelegate.swift`](ios/FrontendBlogMobile/AppDelegate.swift):

1. Add `import CodePush` at top (line 5 area)
2. Update `bundleURL()` to use `CodePush.bundleURL()` for release builds

```swift
import CodePush

// ... rest of imports ...

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    CodePush.bundleURL()
#endif
  }
}
```

#### Step 6.4: Wrap App.tsx with codePush HOC

Add to [`App.tsx`](App.tsx):

```typescript
import codePush from 'react-native-code-push';

// ... existing App component ...

// Wrap with CodePush — check for updates on app resume
export default codePush({
  checkFrequency: codePush.CheckFrequency.ON_APP_RESUME,
  installMode: codePush.InstallMode.ON_NEXT_RESUME,
  updateDialog: !__DEV__,
})(App);
```

#### Step 6.5: Create CodePush apps in App Center

1. Go to [appcenter.ms](https://appcenter.ms)
2. Create two apps: `TarsierTest` and `TarsierProduction`
3. For each, go to **Distribute** → **CodePush** → create deployments: `Staging` and `Production`
4. Copy deployment keys and update `MainApplication.kt` with the correct deploy key

#### Step 6.6: Set up deploy keys

The deploy key in `MainApplication.kt` (`"YOUR_CODEPUSH_DEPLOY_KEY_ANDROID"`) should be replaced with the actual key from App Center. For production, use the Production deployment key; for test, use the Staging deployment key. You can also make this configurable per-flavor using `BuildConfig.FLAVOR`.

---

## Part 2: Complete File Change Summary

| #   | File                                                                                                                             | Action                                                                                     |
| --- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 1   | [`android/app/build.gradle`](android/app/build.gradle)                                                                           | Modify: add `flavorDimensions`, `productFlavors`, `debuggableVariants`, default `resValue` |
| 2   | [`android/app/src/main/java/com/tarsier/labs/MainApplication.kt`](android/app/src/main/java/com/tarsier/labs/MainApplication.kt) | Modify: add `RNBuildConfigPackage()` + `CodePush`                                          |
| 3   | `android/app/src/main/java/com/tarsier/labs/RNBuildConfigModule.kt`                                                              | **Create new**                                                                             |
| 4   | `android/app/src/main/java/com/tarsier/labs/RNBuildConfigPackage.kt`                                                             | **Create new**                                                                             |
| 5   | `ios/Config/Test.xcconfig`                                                                                                       | **Create new**                                                                             |
| 6   | `ios/Config/Prod.xcconfig`                                                                                                       | **Create new**                                                                             |
| 7   | [`ios/FrontendBlogMobile.xcodeproj/project.pbxproj`](ios/FrontendBlogMobile.xcodeproj/project.pbxproj)                           | Modify: add 4 build configurations                                                         |
| 8   | `ios/FrontendBlogMobile.xcodeproj/xcshareddata/xcschemes/FrontendBlogMobile-Test.xcscheme`                                       | **Create new**                                                                             |
| 9   | [`ios/FrontendBlogMobile/AppDelegate.swift`](ios/FrontendBlogMobile/AppDelegate.swift)                                           | Modify: add `import CodePush`, update `bundleURL()`                                        |
| 10  | [`src/lib/env.ts`](src/lib/env.ts)                                                                                               | Modify: add `TEST_CONFIG`, `detectFlavor()`, new exports                                   |
| 11  | [`Makefile`](Makefile)                                                                                                           | Modify: add per-flavor targets, update `.PHONY`                                            |
| 12  | `.github/workflows/deploy.yml`                                                                                                   | **Create new**                                                                             |
| 13  | [`App.tsx`](App.tsx)                                                                                                             | Modify: wrap with `codePush()` HOC                                                         |
| 14  | [`package.json`](package.json)                                                                                                   | Modify: add `react-native-code-push` dependency                                            |

---

## Part 3: Execution Order

```
Phase 1 (Android Flavors)
  └─ android/app/build.gradle ← flavorDimensions + productFlavors
  └─ Verify: ./gradlew assembleTestRelease

Phase 2 (iOS Configs)
  └─ ios/Config/Test.xcconfig + Prod.xcconfig
  └─ Xcode: add 4 configurations + Test scheme
  └─ Verify: xcodebuild archive (no-codesign)

Phase 3 (Environment Config)
  └─ src/lib/env.ts ← TEST_CONFIG + detectFlavor()
  └─ RNBuildConfigModule.kt + RNBuildConfigPackage.kt
  └─ Register package in MainApplication.kt

Phase 4 (Makefile)
  └─ Makefile ← per-flavor targets, .PHONY update

Phase 5 (CI/CD)
  └─ .github/workflows/deploy.yml ← full pipeline

Phase 6 (CodePush)
  └─ yarn add react-native-code-push
  └─ MainApplication.kt ← add CodePush
  └─ AppDelegate.swift ← CodePush.bundleURL()
  └─ App.tsx ← codePush() HOC
  └─ App Center setup + deploy keys
```

---

## Part 4: Key Concepts

### Why `applicationIdSuffix ".test"` instead of full `applicationId`?

`applicationIdSuffix` appends to the base `applicationId` defined in `defaultConfig`. Test builds get `com.tarsier.labs.test` automatically without duplicating the full package name per flavor. Play Store considers `com.tarsier.labs` and `com.tarsier.labs.test` as completely separate apps.

### Why xcconfig files instead of editing project.pbxproj directly?

xcconfig is the standard Apple way to externalize build settings. Changes don't require Xcode, are easy to version control, and integrate seamlessly with `Info.plist` which already uses `$(DISPLAY_NAME)` and `$(PRODUCT_BUNDLE_IDENTIFIER)` variables.

### How CodePush works with flavors

CodePush replaces the JS bundle at runtime without a native rebuild. Test builds get updates pushed to the `Staging` deployment, production builds get updates pushed to the `Production` deployment. Users receive updates silently on next app resume. CodePush cannot change native code — only JS bundle + assets.

### Why no separate `dev` flavor?

The user confirmed: "test is both local dev and test environment." The `DEV_CONFIG` in `env.ts` is the same as `TEST_CONFIG`, and `__DEV__` (Metro dev mode) is used to distinguish local development from release builds within the test flavor.
