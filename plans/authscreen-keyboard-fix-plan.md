# AuthScreen Keyboard Fix Plan (Updated)

> **Last updated:** 2026-05-16 — Reflects final resolved state after multiple iterations.

## Issues & Resolutions

| # | Issue | Original Fix Attempt | Final Resolution |
|---|-------|---------------------|------------------|
| 1 | Android 键盘布局错乱 (`behavior="height"` 与 `adjustResize` 冲突) | `KeyboardAvoidingView` → `behavior={undefined}` on Android | **Superseded** — Replaced `KeyboardAvoidingView` with `KeyboardAwareScrollView` which handles both platforms correctly |
| 2 | iOS keyboardVerticalOffset 硬编码 88，内容被键盘压住 | `keyboardVerticalOffset={insets.top + 44}` | **Superseded** — `KeyboardAwareScrollView` manages offset automatically |
| 3 | 键盘上方多余空白 (50pt paddingBottom) | `paddingBottom: insets.bottom + spacing.sm` = 42pt | **Implemented** — [`AuthScreen.tsx:291`](../src/screens/AuthScreen.tsx:291) uses `insets.bottom + spacing.sm` |
| 4 | iOS 数字键盘没有完成按钮 | `InputAccessoryView` 工具栏 → `KeyboardStickyView` 悬浮按钮 | **Reverted to system native** — `returnKeyType="done"` triggers iOS built-in Done button. No custom code needed. |

---

## Detailed Resolution

### Fix 1 & 2: KeyboardAwareScrollView (Replaces KeyboardAvoidingView)

**File:** [`src/screens/AuthScreen.tsx`](../src/screens/AuthScreen.tsx:287)

The original `KeyboardAvoidingView` with platform-specific `behavior` and manual `keyboardVerticalOffset` was replaced by `KeyboardAwareScrollView` from `react-native-keyboard-controller`:

```tsx
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

// In JSX:
<KeyboardAwareScrollView
  style={styles.flex}
  contentContainerStyle={[
    styles.scrollContent,
    { paddingBottom: insets.bottom + spacing.sm },
  ]}
  keyboardShouldPersistTaps="handled"
  showsVerticalScrollIndicator={false}
>
```

**Why this works:**
- `KeyboardAwareScrollView` uses `react-native-reanimated` shared values to track keyboard height dynamically
- No need for `behavior` prop or `keyboardVerticalOffset` — the scroll view adjusts automatically
- Handles both iOS notch/Dynamic Island and Android `adjustResize` correctly

### Fix 3: Bottom Padding Reduction (Implemented)

**File:** [`src/screens/AuthScreen.tsx:291`](../src/screens/AuthScreen.tsx:291)

```tsx
contentContainerStyle={[
  styles.scrollContent,
  { paddingBottom: insets.bottom + spacing.sm },
]}
```

- `insets.bottom` = 34pt (home indicator on iPhone X+)
- `spacing.sm` = 8pt
- **Total:** 42pt — sufficient clearance for home indicator + small margin

### Fix 4: Done Button — iOS System Native (Final Solution)

After multiple failed approaches, the final solution uses iOS system built-in Done button.

**History of attempted approaches:**

| Attempt | Approach | Why It Failed |
|---------|----------|---------------|
| 1 | `InputAccessoryView` + `BlurView` with `borderRadius` + `overflow:"hidden"` | `UIVisualEffectView` in `InputAccessoryView` doesn't clip child views |
| 2 | Plain `View` wrapper around `BlurView` with `overflow:"hidden"` + `borderRadius` | `InputAccessoryView` (native UIKit) doesn't support child view clipping |
| 3 | `KeyboardStickyView` + `BlurView` pill button | `BlurView` (UIVisualEffectView) collapsed layout — Yoga can't measure padding/content correctly |
| 4 | `KeyboardStickyView` + `TouchableOpacity` with semi-transparent bg | Width/height issues with `position:absolute`, plus duplicate Done buttons appeared |
| 5 | **System native** — `returnKeyType="done"` on `keyboardType="number-pad"` | ✅ **Works perfectly.** iOS automatically shows a built-in Done button above the number pad. No custom code needed. |

**Final code —** [`AuthScreen.tsx:423-443`](../src/screens/AuthScreen.tsx:423):

```tsx
<TextInput
  ref={codeRef}
  style={[styles.input, { color: colors.text }]}
  placeholder={t('auth.codePlaceholder')}
  placeholderTextColor={colors.textSecondary}
  value={code}
  onChangeText={text => {
    const filtered = text.replace(/[^0-9]/g, '').slice(0, 6);
    setCode(filtered);
  }}
  keyboardType="number-pad"
  autoCapitalize="none"
  autoCorrect={false}
  maxLength={6}
  returnKeyType="done"
  onSubmitEditing={handleSubmit}
/>
```

**Key points:**
- `keyboardType="number-pad"` + `returnKeyType="done"` → iOS automatically renders a "Done" button above the number-pad keyboard
- `onSubmitEditing={handleSubmit}` → tapping Done triggers login submission
- No `InputAccessoryView`, no `KeyboardStickyView`, no `BlurView`, no custom toolbar code
- No `KeyboardProvider` needed in `App.tsx`
- No translation key needed (`auth.done`) — iOS renders the text natively
- Works on Android too (Android shows a return key that triggers `onSubmitEditing`)

---

## Current State Summary

| Component | Status | File |
|-----------|--------|------|
| `KeyboardAwareScrollView` | ✅ Replaces `KeyboardAvoidingView` | [`AuthScreen.tsx:287`](../src/screens/AuthScreen.tsx:287) |
| `paddingBottom: insets.bottom + spacing.sm` | ✅ 42pt total | [`AuthScreen.tsx:291`](../src/screens/AuthScreen.tsx:291) |
| `returnKeyType="done"` on code TextInput | ✅ System native Done | [`AuthScreen.tsx:441`](../src/screens/AuthScreen.tsx:441) |
| No custom toolbar/pill code | ✅ Clean — no `InputAccessoryView`, `KeyboardStickyView`, or `BlurView` | [`AuthScreen.tsx:26-38`](../src/screens/AuthScreen.tsx:26) |
| `KeyboardProvider` in `App.tsx` | ✅ Removed (not needed) | [`App.tsx`](../App.tsx) |

## Key Learning

For iOS number-pad Done button: **Always try `returnKeyType="done"` first** before reaching for `InputAccessoryView` or third-party libraries. The system built-in Done button is reliable, zero-code, and blends perfectly with the native keyboard appearance — no blur, no rounded corner hacks, no layout conflicts.
