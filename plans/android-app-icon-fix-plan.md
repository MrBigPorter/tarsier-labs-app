# Android App Icon Fix Plan

## Problem

The Android production build shows the default React Native icon (React logo) instead of the Tarsier app logo. The `mipmap-*` directories contain files from `react-native init` that were never replaced.

## Root Cause

`AndroidManifest.xml` references `@mipmap/ic_launcher` which resolves to PNG files in:

```
android/app/src/main/res/
  mipmap-mdpi/    ic_launcher.png    ← React default, needs replacement
  mipmap-hdpi/    ic_launcher.png    ← React default, needs replacement
  mipmap-xhdpi/   ic_launcher.png    ← React default, needs replacement
  mipmap-xxhdpi/  ic_launcher.png    ← React default, needs replacement
  mipmap-xxxhdpi/ ic_launcher.png    ← React default, needs replacement
```

iOS already has proper AppIcon assets set up in `ios/.../AppIcon.appiconset/`, with `icon-1024@1x.png` as the master source.

## Source Image

Use the existing iOS 1024×1024 icon as the source:

```
ios/FrontendBlogMobile/Images.xcassets/AppIcon.appiconset/icon-1024@1x.png
```

## Steps

### Step 1: Generate PNGs for all density buckets

Use ImageMagick to resize the 1024px source to each required Android mipmap size:

| Directory         | Target Size | ImageMagick command                      |
| ----------------- | ----------- | ---------------------------------------- |
| `mipmap-mdpi/`    | 48×48       | `convert in.png -resize 48x48 out.png`   |
| `mipmap-hdpi/`    | 72×72       | `convert in.png -resize 72x72 out.png`   |
| `mipmap-xhdpi/`   | 96×96       | `convert in.png -resize 96x96 out.png`   |
| `mipmap-xxhdpi/`  | 144×144     | `convert in.png -resize 144x144 out.png` |
| `mipmap-xxxhdpi/` | 192×192     | `convert in.png -resize 192x192 out.png` |

Since there are both `ic_launcher.png` and `ic_launcher_round.png` (for round icon support on devices that use it), each size needs to be generated twice — once for each filename.

One-liner script:

```bash
SOURCE="ios/FrontendBlogMobile/Images.xcassets/AppIcon.appiconset/icon-1024@1x.png"
BASE="android/app/src/main/res"

for SIZE in mdpi:48 hdpi:72 xhdpi:96 xxhdpi:144 xxxhdpi:192; do
  DIR="${BASE}/mipmap-${SIZE%%:*}"
  PX="${SIZE##*:}"
  convert "$SOURCE" -resize "${PX}x${PX}" "$DIR/ic_launcher.png"
  convert "$SOURCE" -resize "${PX}x${PX}" "$DIR/ic_launcher_round.png"
done
```

### Step 2: Update adaptive icon XML (optional)

Current adaptive icon config:

```xml
<!-- ic_launcher.xml -->
<adaptive-icon>
    <background android:drawable="@color/bootsplash_background"/>  <!-- #ffffff -->
    <foreground android:drawable="@mipmap/ic_launcher"/>
</adaptive-icon>
```

This already works — it places the full PNG (with background) over a white background. If the Tarsier logo has a non-white background that should be used directly, no change needed.

If the Tarsier logo has a transparent background and you want a brand-color background, update `colors.xml`:

```xml
<color name="bootsplash_background">#3f4c85</color>  <!-- Tarsier brand color -->
```

But since `bootsplash_background` (#ffffff) is also used for the splash screen, changing it would affect the splash screen too. So keeping it white is safer unless you want both to change.

### Step 3: Build and verify

```bash
cd android && ./gradlew assembleProductionRelease
```

Install the APK and check the home screen app icon.

## Files to modify

| File                                                            | Action  |
| --------------------------------------------------------------- | ------- |
| `android/app/src/main/res/mipmap-mdpi/ic_launcher.png`          | Replace |
| `android/app/src/main/res/mipmap-mdpi/ic_launcher_round.png`    | Replace |
| `android/app/src/main/res/mipmap-hdpi/ic_launcher.png`          | Replace |
| `android/app/src/main/res/mipmap-hdpi/ic_launcher_round.png`    | Replace |
| `android/app/src/main/res/mipmap-xhdpi/ic_launcher.png`         | Replace |
| `android/app/src/main/res/mipmap-xhdpi/ic_launcher_round.png`   | Replace |
| `android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png`        | Replace |
| `android/app/src/main/res/mipmap-xxhdpi/ic_launcher_round.png`  | Replace |
| `android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png`       | Replace |
| `android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_round.png` | Replace |

(10 files total, all PNG replacements)

## Prerequisites

- **ImageMagick** (`convert` command) — install with `brew install imagemagick` if not present
- The source file `ios/.../AppIcon.appiconset/icon-1024@1x.png` must exist

## Verification

After the build, the app icon on the home screen should show the Tarsier logo instead of the React Native default icon. Check both normal and round icon variants.
