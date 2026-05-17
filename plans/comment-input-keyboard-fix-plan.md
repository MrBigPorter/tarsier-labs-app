# Fix Keyboard Gap in Comment Input

## Problem
[`ArticleDetailScreen.tsx`](../src/screens/ArticleDetailScreen.tsx:276) uses React Native's `KeyboardAvoidingView` with `behavior="padding"` and `keyboardVerticalOffset={88}`. This creates excessive empty space above the keyboard when the comment input panel appears.

## Root Cause
`behavior="padding"` adds bottom padding equal to keyboard height, pushing ALL content upward. The fixed offset (`88`) doesn't account precisely for the header + safe area, causing visual gap.

## Solution
Replace `KeyboardAvoidingView` + inner `ScrollView` with [`KeyboardAwareScrollView`](../src/screens/AuthScreen.tsx:287) from `react-native-keyboard-controller` (already installed at `package.json:37`, v1.21.7, same library AuthScreen uses).

`KeyboardAwareScrollView` tracks the actual keyboard position and scrolls precisely to keep the focused input visible — **no extra padding, no gap**.

## Changes — Only 1 file: [`src/screens/ArticleDetailScreen.tsx`](../src/screens/ArticleDetailScreen.tsx)

### Import changes
- Remove: `KeyboardAvoidingView`, `Platform` from `react-native` imports
- Add: `import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';`

### Structure change
```
Current:
  <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={88}>
    <ScrollView> ... </ScrollView>
    {showCommentInput && <View>comment panel</View>}  ← fixed outside scroll
  </KeyboardAvoidingView>

New:
  <KeyboardAwareScrollView keyboardShouldPersistTaps="handled">
    ... article content ...
    ... comments section ...
    {showCommentInput && <View>comment panel</View>}  ← inside scroll
  </KeyboardAwareScrollView>
```

### Details
1. Replace `<KeyboardAvoidingView>` wrapper with `<View style={styles.flex}>`
2. Replace inner `<ScrollView>` with `<KeyboardAwareScrollView>`
3. Move the `{showCommentInput && (...)}` block **inside** `<KeyboardAwareScrollView>`, right after the comments section `</View>`
4. Add `keyboardShouldPersistTaps="handled"` to `KeyboardAwareScrollView`
5. Keep existing `ref`, `contentContainerStyle`, `showsVerticalScrollIndicator`

### Risk Assessment
| Risk | Mitigation |
|------|-----------|
| Comment input no longer fixed at bottom | KeyboardAwareScrollView auto-scrolls to focused input — actually better UX |
| `keyboardShouldPersistTaps="handled"` might cause tap issues | AuthScreen uses same prop successfully |
| Scroll behavior regression | Same scroll props preserved; only keyboard handling changes |
| react-native-keyboard-controller not linked | Already installed and used by AuthScreen |

## Verification
1. Open an article → tap "Write a comment"
2. Verify comment input appears without gap above keyboard
3. Tap "Reply" on a comment → verify same
4. Verify AuthScreen keyboard behavior still works (regression check)
