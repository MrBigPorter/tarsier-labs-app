# Naming Unification Plan — Minimal Scope (User-Facing Only)

## Scope

Only change what **end users see** on their devices. Keep all internal identifiers (`app.json` `name`, project names, bundle IDs) unchanged.

## Changes

### Android — App Name on Home Screen

| # | File | Current | Target |
|---|------|---------|--------|
| 1 | [`android/app/src/main/res/values/strings.xml:2`](../../android/app/src/main/res/values/strings.xml:2) | `FrontendBlogMobile` | `Tarsier` |

This controls the app label shown under the icon on Android launcher.

### iOS — App Name on Home Screen

In [`ios/FrontendBlogMobile/Info.plist:9-10`](../../ios/FrontendBlogMobile/Info.plist:9), `CFBundleDisplayName` is set to `$(DISPLAY_NAME)`. This build variable is currently **undefined** in the Xcode project, so it defaults to `PRODUCT_NAME` = `FrontendBlogMobile`.

| # | File | Change |
|---|------|--------|
| 2 | [`ios/FrontendBlogMobile.xcodeproj/project.pbxproj`](../../ios/FrontendBlogMobile.xcodeproj/project.pbxproj) | Add `DISPLAY_NAME = Tarsier` to both Debug and Release build configurations |

This makes `$(DISPLAY_NAME)` resolve to `Tarsier`, which updates the app name shown under the icon on iOS home screen.

### iOS — Short Bundle Name (Optional)

`CFBundleName` in [`Info.plist:17-18`](../../ios/FrontendBlogMobile/Info.plist:17) is `$(PRODUCT_NAME)` which resolves to `FrontendBlogMobile`. This is used in some system UI elements. To change it, we could either:

- **Option A**: Hardcode `CFBundleName` to `Tarsier` in Info.plist
- **Option B**: Leave as is (less visible to users)

### What Stays Unchanged

| Item | Reason |
|------|--------|
| `app.json` `name: "FrontendBlogMobile"` | Internal RN identifier — users never see it |
| `app.json` `displayName: "Tarsier"` | ✅ Already correct |
| `package.json` `name` | npm package name — developers only |
| Android `applicationId` | Store identifier — not user-visible |
| iOS `PRODUCT_BUNDLE_IDENTIFIER` | Store identifier — not user-visible |
| iOS directory/Xcode names | Internal build artifacts |
| Deep link scheme `tarsier://` | ✅ Already correct |

## Summary

**Only 2 files need changing** — minimal risk, immediate user-facing impact.
