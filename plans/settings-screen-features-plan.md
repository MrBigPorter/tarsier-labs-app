# Settings Screen Features Implementation Plan (Final)

## Overview

Four features currently have placeholder/skeleton UI in the Settings screen and need full implementation:

1. **Font Size** — Global reading font size adjustment
2. **Clear Cache** — Comprehensive data clearing including auth (for App Store review)
3. **About Tarsier** — Fix navigation to existing About screen (1-line change)
4. **Privacy Policy** — New in-app screen with markdown-rendered content

---

## Feature 1: About Tarsier — Navigation Fix (1 line)

### Current State
- AboutScreen (`src/screens/AboutScreen.tsx`) is fully built (857 lines)
- `handleNavigateTo('About')` uses `navigation.getParent()?.navigate(screen)` — broken

### Root Cause
Settings is in RootStack. RootStack has no parent navigator (`getParent()` returns undefined).

### Fix
Change `handleNavigateTo` in `src/screens/SettingsScreen.tsx`:
```typescript
// Before:
const handleNavigateTo = useCallback((screen: string) => {
  navigation.getParent()?.navigate(screen);
}, [navigation]);

// After:
const handleNavigateTo = useCallback((screen: string) => {
  (navigation as any).navigate(screen);
}, [navigation]);
```
React Navigation v7 searches the entire navigation tree for screen names.

**Files changed**: Only SettingsScreen.tsx (1 line).

---

## Feature 2: Privacy Policy — New In-App Screen

### Current State
- TODO comment, web privacy page doesn't exist yet
- Cannot use `Linking.openURL()` since URL doesn't exist

### Implementation

#### A) `src/screens/PrivacyPolicyScreen.tsx` — NEW FILE

Premium full-screen layout:
- `Header` with `showBack` and `title={t('settings.privacyPolicy')}`
- `ScrollView` with `padding: spacing.xl`, themed background
- Policy content rendered via `MarkdownRenderer` (reuse existing component)
- Content is a Markdown string constant embedded in the file

Content sections:
1. **Introduction** — who we are, data collection overview
2. **Information We Collect** — account data, usage data, device info
3. **How We Use Information** — service provision, improvement, communication
4. **Data Sharing** — third parties, legal requirements
5. **Data Security** — encryption, storage practices
6. **Your Rights** — access, deletion, portability
7. **Contact** — email/contact information

#### B) `src/navigation/types.ts` — MODIFY
Add to RootStackParamList: `PrivacyPolicy: undefined;`

#### C) `src/navigation/RootNavigator.tsx` — MODIFY
Import and register PrivacyPolicyScreen in RootStack.

#### D) `src/screens/SettingsScreen.tsx` — MODIFY
Replace TODO with: `onPress={() => (navigation as any).navigate('PrivacyPolicy')}`

**Files changed**: 1 new + 3 modified.

---

## Feature 3: Clear Cache — Comprehensive Data Clearing

### Current State
- Calls `storage.clearAll()` which is correct intent but needs improvement
- Only clears bookmark Redux state
- No cache size, no feedback after clearing

### App Store Requirement
Apps with user accounts must provide a way for users to clear all local data. The clear cache feature should:
- Delete all MMKV data (including auth tokens — user re-logs in)
- Reset bookmark Redux state
- Clear FastImage disk cache
- Reset RTK Query API cache
- Show confirmation feedback

### Implementation

#### A) `src/lib/cache/clearAppCache.ts` — NEW FILE

```typescript
import { storage } from '@/lib/storage';
import { store } from '@/store';
import { clearCache as clearBookmarkCache } from '@/store/slices/bookmarksSlice';
import { logout } from '@/store/slices/authSlice';

export async function clearAppCache(): Promise<void> {
  // 1. Clear FastImage disk cache (if available)
  try {
    const FastImage = require('react-native-fast-image');
    FastImage.clearDiskCache();
  } catch { /* not critical */ }

  // 2. Clear all MMKV storage (includes auth tokens, bookmarks, settings)
  storage.clearAll();

  // 3. Reset Redux bookmark state
  store.dispatch(clearBookmarkCache());

  // 4. Reset RTK Query API cache
  store.dispatch({ type: 'api/resetApiState' });

  // 5. Logout (clears auth state in Redux)
  store.dispatch(logout());
}
```

**Note**: `storage.clearAll()` clears everything including auth tokens. After clearing, the user:
- Must sign in again
- Bookmark cache is gone (re-fetched from server on next load)
- App settings (theme, language, font size) are reset to defaults
- Image cache is cleared

#### B) `src/screens/SettingsScreen.tsx` — MODIFY

Update `handleClearCache` to use the new utility. Keep the existing Alert.alert() UX pattern — simple and effective.

#### C) i18n — UPDATE ALL 6 language files

No new keys needed for the clear cache flow itself (existing keys are sufficient). Just update the message text to reflect that auth data will also be cleared.

---

## Feature 4: Font Size — Full Adjustment System

### Current State
- Single SettingRow with `value="Default"` and `onPress={() => {}}`
- No font size scaling exists anywhere

### Implementation

#### A) `src/lib/theme/FontSizeContext.tsx` — NEW FILE

```typescript
export const FONT_SIZE_PRESETS = [
  { key: 'small', scale: 0.85 },
  { key: 'default', scale: 1.0 },
  { key: 'large', scale: 1.15 },
  { key: 'xlarge', scale: 1.3 },
] as const;

interface FontSizeContextValue {
  fontScale: number;
  currentPresetKey: string;
  setPreset: (key: string) => void;
}
```

- Preset key stored in MMKV under `font_size_preset`
- Default: `'default'` (scale 1.0)
- Hook: `useFontSize()` returns `{ fontScale, currentPresetKey, setPreset }`

#### B) `App.tsx` — MODIFY

Wrap app in FontSizeProvider (inside ThemeProvider, since font size depends on theme):
```
<ThemeProvider>
  <FontSizeProvider>
    <AppContentWithPerf />
  </FontSizeProvider>
</ThemeProvider>
```

#### C) `src/screens/SettingsScreen.tsx` — MODIFY

- Font Size row: `onPress={() => setShowFontSizeSheet(true)}`
- Value shows current preset name (e.g., "Default", "Large")
- New BottomSheet with:
  - 4 preset option rows, each with "Aa" preview at corresponding scale
  - Selected preset has gold check circle
  - Preview sentence at bottom: "The quick brown fox jumps over the lazy dog" in selected size

#### D) `src/components/blog/MarkdownRenderer.tsx` — MODIFY

Import `useFontSize()` and apply scale to all markdownStyles:
```typescript
const { fontScale } = useFontSize();
// Apply to body, headings, code blocks:
fontSize: typography.body.fontSize * fontScale,
lineHeight: typography.body.lineHeight * fontScale,
```

#### E) `src/screens/ArticleDetailScreen.tsx` — MODIFY

Consume `fontScale` for article title, metadata, and other non-markdown text elements.

#### F) iOS Dynamic Type Integration

Use `PixelRatio.getFontScale()` to detect system-level accessibility font scaling:
- `effectiveScale = PixelRatio.getFontScale() * userFontScale`
- This ensures users with "Larger Text" accessibility settings get proportional scaling

---

## Implementation Order

| Step | Feature | Files Changed | Complexity |
|------|---------|---------------|------------|
| 1 | Fix About navigation | `SettingsScreen.tsx` (1 line) | ⭐ Trivial |
| 2 | Privacy Policy screen | `PrivacyPolicyScreen.tsx` (NEW), `types.ts`, `RootNavigator.tsx`, `SettingsScreen.tsx` | ⭐⭐ Medium |
| 3 | Clear Cache overhaul | `clearAppCache.ts` (NEW), `SettingsScreen.tsx` | ⭐⭐ Medium |
| 4 | Font Size system | `FontSizeContext.tsx` (NEW), `App.tsx`, `SettingsScreen.tsx`, `MarkdownRenderer.tsx`, `ArticleDetailScreen.tsx`, i18n (6 files) | ⭐⭐⭐⭐ Large |

Steps 1-3 are independent. Step 4 is the largest feature.

---

## App Store Compliance Checklist

- [x] **Account deletion**: Already implemented
- [x] **Privacy Policy**: New PrivacyPolicyScreen with markdown content
- [x] **Sign out**: Already implemented
- [x] **Data clearing**: Clear Cache now clears all local data including auth
- [x] **Accessibility**: Font size scaling with Dynamic Type integration
- [x] **Language support**: Full i18n across all 6 languages
