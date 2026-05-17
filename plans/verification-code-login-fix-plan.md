# Verification Code Login Fix Plan

## Issues Fixed

| # | Issue | Severity | Files Affected |
|---|-------|----------|----------------|
| 1 | API path missing `/api` prefix — `/v1/auth/email/*` instead of `/api/v1/auth/email/*` (routes to broken `admin-next` upstream) | 🔴 Root Cause | [`src/api/endpoints/auth.ts`](../src/api/endpoints/auth.ts) |
| 2 | Login response structure mismatch (`tokens.*` vs top-level `accessToken`) | 🔴 Blocking | [`src/api/endpoints/auth.ts`](../src/api/endpoints/auth.ts), [`src/screens/AuthScreen.tsx`](../src/screens/AuthScreen.tsx) |
| 3 | No retry logic for 5xx server errors | 🟡 Improvement | [`src/api/baseApi.ts`](../src/api/baseApi.ts) |
| 4 | Error handling too generic, doesn't surface 502 details | 🟢 Improvement | [`src/screens/AuthScreen.tsx`](../src/screens/AuthScreen.tsx) |

## Execution Order

### Step 1: Fix Login Response Structure (`auth.ts`)

**Problem:** The `EmailCodeLoginResponse` interface defines `accessToken`/`refreshToken` at the top level, but the backend (matching Web) returns them nested under `tokens.*`.

**Action:** Update `EmailCodeLoginResponse` to match Web's `LoginResponse` format:

```typescript
// Web format (from authApi.ts:4-8):
interface LoginResponse {
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
  id: string;
  phone: string;
  phoneMd5: string;
  nickname: string;
  username: string;
  avatar: string | null;
  email: string;
  countryCode: string;
}
```

**Changes in [`src/api/endpoints/auth.ts`](../src/api/endpoints/auth.ts):**
1. Replace `EmailCodeLoginResponse` with structure matching Web (nest tokens under `tokens.*`, add missing fields like `phone`, `username`, `countryCode`)
2. Update `loginWithEmailCode`'s `onQueryStarted` to unwrap `data.tokens.accessToken` and `data.tokens.refreshToken` for storage
3. Keep the `transformResponse` unwrapping `response.data` intact

**Changes in [`src/screens/AuthScreen.tsx`](../src/screens/AuthScreen.tsx):**
1. Update `handleSubmit` to pass `result.tokens.accessToken` and `result.tokens.refreshToken` to `setCredentials`:
   ```typescript
   dispatch(setCredentials({
     user: result,  // or map to { id, email, nickname, avatar }
     accessToken: result.tokens.accessToken,
     refreshToken: result.tokens.refreshToken,
   }));
   ```
2. The `user` object now comes differently — map from `{ id, nickname, email, avatar }` fields at the top level of result

**File:** [`src/api/endpoints/auth.ts`](../src/api/endpoints/auth.ts)
- Lines 40-49: Replace `EmailCodeLoginResponse` interface
- Lines 119-138: Update `loginWithEmailCode` mutation's response handling to extract `tokens.*`

**File:** [`src/screens/AuthScreen.tsx`](../src/screens/AuthScreen.tsx)
- Lines 179-191: Update `handleSubmit` to use `result.tokens.accessToken` etc.

---

### Step 2: Add Retry Logic for 5xx Errors (`baseApi.ts`)

**Problem:** Mobile has no retry for transient server failures. The Web retries 3 times with exponential backoff.

**Action:** Add retry wrapper in the base query in [`src/api/baseApi.ts`](../src/api/baseApi.ts).

**Design:**
- Add a `withRetry` helper function (or integrate into the base query)
- Retry on 5xx errors (status >= 500) and network errors
- Use exponential backoff: `Math.min(1000 * 2 ** attempt, 10000)` = 1s, 2s, 4s, max 10s
- Max 3 retries (matching Web)
- Do NOT retry on 4xx errors (client errors like 400, 401, 403, 404)
- Wrap the `rawBaseQuery()` call inside this retry logic

**Pseudo-code for the change:**
```typescript
// Inside the baseQuery function, around line 66:
const MAX_RETRIES = 3;

async function executeWithRetry(attempt: number = 0): Promise<typeof result> {
  let result = await rawBaseQuery(args, api, extraOptions);

  const shouldRetry = result.error && 
    typeof result.error.status === 'number' &&
    result.error.status >= 500 &&
    attempt < MAX_RETRIES;

  if (shouldRetry) {
    const delay = Math.min(1000 * 2 ** attempt, 10000);
    console.warn(`[API] Retrying ${method} ${endpoint} (attempt ${attempt + 1}/${MAX_RETRIES}) after ${delay}ms`);
    await new Promise(resolve => setTimeout(resolve, delay));
    return executeWithRetry(attempt + 1);
  }

  return result;
}

let result = await executeWithRetry();
```

**Note:** The timing/logging code (lines 70-90) and 401 refresh logic (lines 105-151) should remain after the retry completes, so we only log/track the final attempt's result.

**File:** [`src/api/baseApi.ts`](../src/api/baseApi.ts)
- Around line 34-66: Add retry wrapper
- Replace `let result = await rawBaseQuery(args, api, extraOptions);` with retry logic

---

### Step 3: Improve Error Handling Surface (`AuthScreen.tsx`)

**Problem:** Error messages are too generic — API errors like 502 show "Send code failed" without the actual status or detail.

**Action:** Enhance error extraction in both `handleSendCode` and `handleSubmit` to provide more context.

**Changes in [`src/screens/AuthScreen.tsx`](../src/screens/AuthScreen.tsx):**

1. **`handleSendCode`** (line 147-150): Extract richer error info:
   ```typescript
   catch (err: any) {
     // Try to extract meaningful error details
     const status = err?.status || err?.error?.status;
     const data = err?.data || err?.error?.data;
     const serverMessage = data?.message || data?.error;
     
     let message: string;
     if (status === 502) {
       message = `${t('auth.serverError')} (502)`;
     } else if (serverMessage) {
       message = serverMessage;
     } else {
       message = t('auth.sendCodeFailed');
     }
     setError(message);
   }
   ```

2. **`handleSubmit`** (line 193-195): Same pattern for login errors

3. **Update i18n messages** (optional): Add a `auth.serverError` key if desired, or use inline strings.

**File:** [`src/screens/AuthScreen.tsx`](../src/screens/AuthScreen.tsx)
- Lines 147-153: Update error handling in `handleSendCode`
- Lines 192-196: Update error handling in `handleSubmit`

---

## Summary of Changes

| # | File | Change | Type |
|---|------|--------|------|
| 1 | [`src/api/endpoints/auth.ts`](../src/api/endpoints/auth.ts):40-49 | Fix `EmailCodeLoginResponse` to match Web format (nested `tokens.*`) | 🔴 Bug fix |
| 2 | [`src/screens/AuthScreen.tsx`](../src/screens/AuthScreen.tsx):179-191 | Update `dispatch(setCredentials(...))` to unwrap `result.tokens.*` | 🔴 Bug fix |
| 3 | [`src/api/baseApi.ts`](../src/api/baseApi.ts):66 | Add retry logic (3 retries, exponential backoff) for 5xx errors | 🟡 Improvement |
| 4 | [`src/screens/AuthScreen.tsx`](../src/screens/AuthScreen.tsx):147-153 | Improve error detail extraction in `handleSendCode` | 🟢 Improvement |
| 5 | [`src/screens/AuthScreen.tsx`](../src/screens/AuthScreen.tsx):192-196 | Improve error detail extraction in `handleSubmit` | 🟢 Improvement |

## Verification Checklist

- [ ] `npx tsc --noEmit` passes without type errors
- [ ] Login response structure correctly extracts `tokens.accessToken` and `tokens.refreshToken`
- [ ] `handleSubmit` dispatches `setCredentials` with properly extracted tokens
- [ ] User is redirected to home screen after successful login
- [ ] When server returns 502, user sees a descriptive error (not just "Send code failed")
- [ ] Retry mechanism retries 3 times with backoff on 5xx errors
- [ ] Retry does NOT retry on 4xx errors (400, 401, etc.)
- [ ] OAuth login still works (not affected by these changes)
