# App Store Review Risk Analysis + Fix Plan

**Generated:** May 18, 2026
**Project:** Frontend Blog Mobile (React Native)

---

## 🔴 Critical

### 1. Account Deletion — `handleDeleteAccount` Not Wired Up ✅

- **File:** [`src/screens/SettingsScreen.tsx:476-492`](../src/screens/SettingsScreen.tsx:476)
- **Status:** ✅ **Fixed** — `useClearUserDataMutation` imported and called in `handleDeleteAccount`. Calls `clearUserData().unwrap()`, checks `result.accountDeleted`, then dispatches `logout()`. Falls back to local logout on API failure.

### 2. Unused Permission Declarations ✅

- **File:** [`ios/FrontendBlogMobile/Info.plist`](../ios/FrontendBlogMobile/Info.plist)
- **Status:** ✅ **Fixed** — Removed `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`, `NSLocationWhenInUseUsageDescription` from Info.plist. Removed `react-native-geolocation-service` from package.json dependencies.

---

## 🟡 High Risk

### 3. PrivacyInfo.xcprivacy — Data Types Manifest Populated ✅

- **File:** [`ios/FrontendBlogMobile/PrivacyInfo.xcprivacy:32-96`](../ios/FrontendBlogMobile/PrivacyInfo.xcprivacy:32)
- **Status:** ✅ **Fixed** — Populated `NSPrivacyCollectedDataTypes` with 8 data types: Email Address, Name, User ID, Product Interaction, Other Usage Data, Device ID, IP Address, Comments. Each with appropriate `linked` and `purposes` fields.

### 4. Push Notification Toggle Removed ✅

- **File:** [`src/screens/SettingsScreen.tsx`](../src/screens/SettingsScreen.tsx), [`ios/FrontendBlogMobile/Info.plist`](../ios/FrontendBlogMobile/Info.plist)
- **Status:** ✅ **Fixed** — Removed the Notifications section (SectionHeader + SectionCard with Switch toggle) from SettingsScreen. Removed `remote-notification` from `UIBackgroundModes` in Info.plist.

---

## 🟢 Medium Risk

### 5. Remove `react-native-app-auth` unused dependency ✅

- **File:** [`package.json`](../package.json)
- **Status:** ✅ **Fixed** — Removed `react-native-app-auth: ^8` from dependencies (OAuth uses custom `ASAuthSession` instead).

### 6. `NSAllowsArbitraryLoadsForMedia` — HTTPS Verified ✅

- **Status:** ✅ **Verified** — All API URLs (`api.joyminis.com`, `dev-api.joyminis.com`), CDN (`img.joyminis.com`), and Web URLs (`blog.joyminis.com`) use HTTPS. Set `NSAllowsArbitraryLoadsForMedia` to `false`.

### 7. Privacy policy data retention wording — Reviewed ✅

- **Status:** ✅ **Reviewed** — Section 4 specifies "retain your data for as long as your account is active" with clear timeframes in 4.2 (30 days for deletion, 90 days for backups). Sufficient for App Store guidelines. No changes needed.

---

## ✅ Already Good

- Privacy policy accessible without login
- Clear All Data flow implemented + documented in Section 4.1
- Auto-logout after clear data
- OAuth uses native `ASWebAuthenticationSession`
- `NSPrivacyTracking` = false
- Sign in with Apple offered (iOS only)

---

## ✨ New Feature: System Language Detection

- **File:** [`src/lib/i18n/index.ts:26`](../src/lib/i18n/index.ts:26)
- **Current:** `defaultLocale = 'en'` — always defaults to English
- **Fix:** On first launch (no MMKV persisted language), read iOS/Android system language via `NativeModules.SettingsManager` / `I18nManager`
- If system language matches supported list (`zh`/`en`/`ja`/`ko`/`fr`/`de`), auto-set it
- Otherwise fallback to `'en'`
- User manual selection in Settings still overrides (and persists via MMKV)

---

## 📋 Action Items — All Completed ✅

| #   | Type   | Task                                                                       | Status         | Files                                   |
| --- | ------ | -------------------------------------------------------------------------- | -------------- | --------------------------------------- |
| 1   | 🔴 Fix | Wire up `handleDeleteAccount` → `clearUserData` mutation                   | ✅ Done        | `SettingsScreen.tsx`                    |
| 2   | 🔴 Fix | Remove 3 unused permissions + geolocation dependency                       | ✅ Done        | `Info.plist`, `package.json`            |
| 3   | 🟡 Fix | Populate `NSPrivacyCollectedDataTypes`                                     | ✅ Done        | `PrivacyInfo.xcprivacy`                 |
| 4   | 🟡 Fix | Remove push notification toggle + `UIBackgroundModes: remote-notification` | ✅ Done        | `SettingsScreen.tsx`, `Info.plist`      |
| 5   | 🟢 Fix | Remove `react-native-app-auth`                                             | ✅ Done        | `package.json`                          |
| 6   | 🟢 Fix | Verify `NSAllowsArbitraryLoadsForMedia` HTTPS                              | ✅ Done        | `Info.plist` (set to `false`)           |
| 7   | 🟢 Fix | Review privacy policy data retention wording                               | ✅ Done        | `privacyContent.ts` (no changes needed) |
| 8   | ✨ New | System language detection on first launch                                  | ✅ Done (prev) | `src/lib/i18n/index.ts`                 |
