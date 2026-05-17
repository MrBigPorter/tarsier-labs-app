# AuthScreen Redesign Plan — Switch to Passwordless Verification Code Flow

## Overview

Redesign the mobile `AuthScreen.tsx` to match the Web login page, switching from email+password login to a passwordless email verification code flow. Also add working Apple OAuth login.

## Reference Files

- **Web login page:** `/Volumes/MySSD/work/JoyMini_Nest_Monorepo/apps/frontend-blog/src/app/[locale]/login/page.client.tsx`
- **Web auth API:** `/Volumes/MySSD/work/JoyMini_Nest_Monorepo/apps/frontend-blog/src/lib/api/authApi.ts` (lines 39-67: `sendEmailCode`, `loginWithEmailCode`)
- **Current mobile AuthScreen:** `src/screens/AuthScreen.tsx`
- **Mobile auth API:** `src/api/endpoints/auth.ts`
- **Mobile authSlice:** `src/store/slices/authSlice.ts`
- **Mobile SvgIcon component:** `src/components/core/SvgIcon.tsx`
- **Mobile i18n en.json:** `src/messages/en.json` (auth section lines 69-118)

## Key Design Decision

**New Auth Flow (replacing password login + register toggle):**
```
1. User enters email
2. User taps "Send code" → POST /v1/auth/email/send-code
3. Backend sends 6-digit code to email
4. User enters 6-digit code
5. User taps "Login" → POST /v1/auth/email/login (email + code)
6. If account doesn't exist → auto-creates (Web's "login to register" philosophy)
```

This removes: password field, confirm password field, nickname field, login/register toggle.

## Files to Modify

### 1. `src/api/endpoints/auth.ts` — Add verification code API mutations

Add two new RTK Query mutations via `injectEndpoints`:
- **`sendEmailCode`**: `POST /v1/auth/email/send-code` with `{ email }` body
- **`loginWithEmailCode`**: `POST /v1/auth/email/login` with `{ email, code }` body

The response type for `loginWithEmailCode` will be similar to the existing `AuthTokens`:
```typescript
interface EmailCodeLoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    nickname: string;
    avatar?: string;
  };
}
```

Export hooks: `useSendEmailCodeMutation`, `useLoginWithEmailCodeMutation`.

### 2. `src/store/slices/authSlice.ts` — Add email-code login async thunk

Add a new `loginWithEmailCode` async thunk (similar to existing `login` thunk but calls the verification code endpoint):
```typescript
export const loginWithEmailCode = createAsyncThunk(
  'auth/loginWithEmailCode',
  async (
    { email, code }: { email: string; code: string },
    { rejectWithValue },
  ) => {
    // POST to /api/v1/frontend/auth/email/login (or /v1/auth/email/login depending on path)
    // Store tokens + user
  },
);
```

Add `loginWithEmailCode.pending/fulfilled/rejected` cases to `extraReducers`.

### 3. `src/components/core/SvgIcon.tsx` — Add social login icons

Add three new icon names to the `IconName` type and their SVG paths:
- **`google`**: 4-color Google logo SVG (from Web's inline SVG)
- **`facebook`**: Facebook "f" logo SVG
- **`apple`**: Apple logo SVG (for iOS)

These are needed for the OAuth buttons.

### 4. `src/screens/AuthScreen.tsx` — Complete rewrite

This is the biggest change. Full diff from the current implementation.

#### New UI Layout (matching Web):

```
┌─────────────────────────────────────┐
│ ← Back (Header)                     │
├─────────────────────────────────────┤
│          ┌─────────────┐            │
│          │    Logo T   │            │
│          └─────────────┘            │
│         Login                       │  ← t('auth.login.title')
│  Login to your Tarsier Labs account │  ← t('auth.login.subtitle')
│                                     │
│  ┌─────────────────────────────┐    │
│  │ 💡 Tip: New user? Login to  │    │  ← Blue tip box
│  │ register! First login will  │    │     t('auth.login.tip')
│  │ automatically create an     │    │
│  │ account.                    │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─ Card container (border,shadow)┐ │
│  │  Email address                 │ │  ← Label
│  │  ┌─────────────────────────┐   │ │
│  │  │ 📧  you@example.com     │   │ │  ← Mail icon + input
│  │  └─────────────────────────┘   │ │
│  │                                │ │
│  │  Verification code    Send code│ │  ← Label + button row
│  │  ┌─────────────────────────┐   │ │
│  │  │ 🔒  Enter code         │   │ │  ← Lock icon + input (6-digit)
│  │  └─────────────────────────┘   │ │
│  │                                │ │
│  │  ⚠ Error message (if any)     │ │  ← Error alert
│  │                                │ │
│  │  ┌─────────────────────────┐   │ │
│  │  │  Login           →     │   │ │  ← Submit button
│  │  └─────────────────────────┘   │ │
│  │                                │ │
│  │  ──── Or continue with ────    │ │  ← Divider
│  │                                │ │
│  │  ┌─ Google ─────────────────┐  │ │  ← Google button
│  │  │  Google logo  Google     │  │ │
│  │  └──────────────────────────┘  │ │
│  │  ┌─ Facebook ───────────────┐  │ │  ← Facebook button
│  │  │  Facebook logo  Facebook  │  │ │
│  │  └──────────────────────────┘  │ │
│  │  ┌─ Apple ──────────────────┐  │ │  ← Apple button (iOS only)
│  │  │  Apple logo  Apple       │  │ │
│  │  └──────────────────────────┘  │ │
│  └────────────────────────────────┘ │
└─────────────────────────────────────┘
```

#### Key Visual Changes:

| Element | Before | After (matching Web) |
|---------|--------|---------------------|
| Form container | Inline fields | Card with `borderWidth: 1, borderRadius: 16, padding: 24, shadow` |
| Input fields | Plain inputs | Rounded corners (borderRadius: 12), left icon inside |
| Email icon | None | Mail icon (from SvgIcon) |
| Code icon | None | Lock icon (from SvgIcon) |
| Tip box | None | Blue background alert box |
| Send code button | None | Label row button with countdown |
| Submit button | Plain | With ArrowRight icon |
| Divider text | "OR" | "Or continue with" |
| Google button | Text only, disabled | Google SVG icon, functional |
| Facebook button | Missing entirely | Facebook icon, functional |
| Apple button | Text only, disabled | Apple icon, functional (iOS only) |
| Register toggle | Full register mode | Removed (auto-register on login) |
| Password/Confirm | Yes | Removed entirely |

#### State Changes:
```typescript
// BEFORE
const [mode, setMode] = useState<AuthMode>('login');  // 'login' | 'register'
const [nickname, setNickname] = useState('');
const [email, setEmail] = useState('');
const [password, setPassword] = useState('');
const [confirmPassword, setConfirmPassword] = useState('');
const [showPassword, setShowPassword] = useState(false);

// AFTER
const [email, setEmail] = useState('');
const [code, setCode] = useState('');
const [isSendingCode, setIsSendingCode] = useState(false);
const [countdown, setCountdown] = useState(0);
const [error, setError] = useState<string | null>(null);
const [isOAuthLoading, setIsOAuthLoading] = useState(false);
```

#### New Functions to Add:
1. **`handleSendCode()`**: Validate email → set isSendingCode → call `sendEmailCode` API → start 60s countdown
2. **`handleSubmit()`**: Validate email+code → call `loginWithEmailCode` thunk
3. **`handleGoogleLogin()`**: Initiate Google OAuth flow (using `@react-native-google-signin/google-signin` or similar)
4. **`handleFacebookLogin()`**: Initiate Facebook OAuth flow
5. **`handleAppleLogin()`**: Initiate Apple OAuth flow (`react-native-apple-authentication` on iOS)

#### Validation Rules:
- Email: must match email regex (same as before)
- Code: must be exactly 6 numeric digits (`/^\d{6}$/`)
- Send code: must have valid email (show error if not)

#### Styles to Update:
- Wrap the form in a card container (StyleSheet changes)
- Update input styles: `borderRadius: 12`, `paddingLeft: 44` (space for icon)
- Add `inputIcon` style: absolute positioned icon inside input
- Add `tipBox` style: blue background, border, rounded
- Add `sendCodeButton` style: for the inline send code button
- Add `sendCodeButtonDisabled` style: opacity when disabled
- Add `countdownText` style
- Update `divider` style to match Web
- Update `socialButton` style to include icon layout
- Update `submitButton` style with row layout for text + arrow

### 5. `src/messages/en.json` — No changes needed

The mobile `en.json` already has all the necessary i18n keys:
- `auth.email`, `auth.emailPlaceholder` — email field
- `auth.verificationCode`, `auth.codePlaceholder` — verification code field
- `auth.sending`, `auth.sendCode`, `auth.resendIn` — send code button
- `auth.orContinueWith` — divider text
- `auth.login.title`, `auth.login.subtitle`, `auth.login.button` — login section
- `auth.login.tip` — tip box text
- `auth.oauth.googleFailed` — OAuth error messages

### 6. Other locale files — No changes needed

The i18n keys are identical between mobile and Web for the auth section. All locale files (`de.json`, `fr.json`, `ja.json`, `ko.json`, `zh.json`) already have matching keys.

## Execution Order

1. **`src/api/endpoints/auth.ts`** — Add `sendEmailCode` and `loginWithEmailCode` mutations
2. **`src/store/slices/authSlice.ts`** — Add `loginWithEmailCode` async thunk
3. **`src/components/core/SvgIcon.tsx`** — Add `google`, `facebook`, `apple` icons
4. **`src/screens/AuthScreen.tsx`** — Full rewrite (UI + logic + styles)
5. **TypeScript check** — `npx tsc --noEmit` to verify compilation

## Web-Exact Match Checklist

- [x] Email input with Mail icon
- [x] Verification code input with Lock icon
- [x] "Send code" button with 3 states (sending / countdown / idle)
- [x] 60-second countdown after sending
- [x] Error display (red alert box)
- [x] Submit button with ArrowRight icon + loading spinner
- [x] Divider "Or continue with"
- [x] Google OAuth button with 4-color Google icon
- [x] Facebook OAuth button with Facebook icon
- [x] Tip box (blue bg, "First login auto-creates account")
- [x] No password field
- [x] No register toggle (single unified login)
- [x] Card container (border, rounded corners, shadow)
- [x] Title + subtitle centered
- [x] Apple OAuth (iOS only, added for mobile)

## Edge Cases to Handle

1. **Already authenticated**: Already handled by navigation (user won't reach AuthScreen)
2. **Network error during send code**: Show error, re-enable button
3. **Invalid email format**: Show inline validation error before calling API
4. **Invalid code format (not 6 digits)**: Show validation error before submit
5. **Countdown running while component unmounts**: Clean up interval in useEffect return
6. **Keyboard covering inputs**: Keep `KeyboardAvoidingView` with `behavior="padding"` on iOS
7. **OAuth loading state collision**: Both send-code and OAuth can't be loading simultaneously
8. **Rapid double-tap on send code**: Disable button while isSendingCode is true
