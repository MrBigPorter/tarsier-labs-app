# AuthScreen Theme Consistency Fix Plan

## Issues Found

| # | Area | Current State | Problem | Fix |
|---|------|--------------|---------|-----|
| 1 | **Tip box** | Brand colors: `bgBrandPrimary` / `borderBrand` / `textBrandSecondary` | Web uses **blue** info style (`bg-blue-50`/`border-blue-200`/`text-blue-700`). Brand gold/brown doesn't match informational tip context. | Replace with **blue utility tokens** matching Web |
| 2 | **Error borders on inputs** | Hardcoded `#EF4444` (Tailwind red-500) | Doesn't use theme token `borderError`. In dark mode, `borderError` = `#f97066` (coral red), completely different from `#EF4444`. | Replace with `colors.borderError` |
| 3 | **Error border logic** | `error && !email.trim()` / `error && !code.trim()` | Error border only shows for **empty field** validation. For invalid email format or invalid code errors, border stays default. | Show error border whenever there's any error, regardless of field content |
| 4 | **Error container dark mode** | `bgErrorSecondary` = `#d92d20` (solid dark red) in dark mode | Solid `#d92d20` background with `#f97066` text may look too aggressive/harsh in dark mode | Switch to `bgErrorPrimary` (`#f04438` dark / `#fef3f2` light) for a softer error background |

---

## Detailed Changes

### Fix 1: Tip Box — Switch to Blue Info Style

**File:** [`src/screens/AuthScreen.tsx:327`](../src/screens/AuthScreen.tsx:327)

**Current:**
```tsx
<View style={[styles.tipBox, { backgroundColor: colors.bgBrandPrimary, borderColor: colors.borderBrand }]}>
  <Text style={[styles.tipText, { color: colors.textBrandSecondary }]}>{t('auth.login.tip')}</Text>
</View>
```

**Fixed (match Web's blue):**
```tsx
<View style={[styles.tipBox, { backgroundColor: colors.utilityBlue50, borderColor: colors.utilityBlue200 }]}>
  <Text style={[styles.tipText, { color: colors.utilityBlue700 }]}>{t('auth.login.tip')}</Text>
</View>
```

**Token values:**
| Token | Light | Dark | Web Equivalent |
|-------|-------|------|----------------|
| `utilityBlue50` | `#eff8ff` | `#eff8ff` | `bg-blue-50` |
| `utilityBlue200` | `#b2ddff` | `#b2ddff` | `border-blue-200` |
| `utilityBlue700` | `#175cd3` | `#175cd3` | `text-blue-700` |

**Note:** These utility tokens are static (same in light/dark), which matches Web's behavior (Tailwind blue colors don't change by theme).

---

### Fix 2: Error Border — Use Theme Token

**File:** [`src/screens/AuthScreen.tsx:345-347`](../src/screens/AuthScreen.tsx:345)

**Current:**
```tsx
borderColor: error && !email.trim()
  ? '#EF4444'
  : colors.border,
```

**Fixed:**
```tsx
borderColor: error && !email.trim()
  ? colors.borderError
  : colors.border,
```

**Token values comparison:**
| Mode | `#EF4444` (current) | `colors.borderError` (fix) |
|------|--------------------|---------------------------|
| Light | `#EF4444` | `#f04438` (close but correct) |
| Dark | `#EF4444` | `#f97066` (coral red — correct for dark) |

---

### Fix 3: Error Border — Show for All Validation Errors

**File:** [`src/screens/AuthScreen.tsx:345-347`](../src/screens/AuthScreen.tsx:345) and [`src/screens/AuthScreen.tsx:409-411`](../src/screens/AuthScreen.tsx:409)

**Problem:** `error && !email.trim()` only lights up the border red when the field is empty AND there's an error. But:
- If the user types an invalid email like `abc`, the error will be `auth.invalidEmail` — but `email.trim()` is truthy, so border stays default
- Same for code input with invalid format (non-6-digit)

**Current logic:**
```tsx
// Email input
borderColor: error && !email.trim() ? '#EF4444' : colors.border,
// Code input
borderColor: error && !code.trim() ? '#EF4444' : colors.border,
```

**Fixed logic:**
```tsx
// Email input — show error border whenever error exists (any validation failure)
borderColor: error ? colors.borderError : colors.border,
// Code input — same
borderColor: error ? colors.borderError : colors.border,
```

**Why:** This matches the Web pattern where error state is universal — if there's an error message shown, the inputs should reflect error state.

---

### Fix 4: Error Container — Removed Background (per user feedback)

**File:** [`src/screens/AuthScreen.tsx:448`](../src/screens/AuthScreen.tsx:448)

**Current (before):**
```tsx
<View style={[styles.errorContainer, { backgroundColor: colors.bgErrorSecondary }]}>
```

**Final (no background):**
```tsx
<View style={styles.errorContainer}>
```

Error is displayed with just the alert icon + red text, no background container — cleaner look.

---

## Files to Modify

Only one file needs changes:

| File | Lines | Change |
|------|-------|--------|
| [`src/screens/AuthScreen.tsx`](../src/screens/AuthScreen.tsx) | 327 | Tip box: `bgBrandPrimary`→`utilityBlue50`, `borderBrand`→`utilityBlue200`, `textBrandSecondary`→`utilityBlue700` |
| [`src/screens/AuthScreen.tsx`](../src/screens/AuthScreen.tsx) | 345-347 | Email error border: `#EF4444`→`colors.borderError`, fix logic |
| [`src/screens/AuthScreen.tsx`](../src/screens/AuthScreen.tsx) | 409-411 | Code error border: `#EF4444`→`colors.borderError`, fix logic |
| [`src/screens/AuthScreen.tsx`](../src/screens/AuthScreen.tsx) | 448 | Error container: remove `backgroundColor` entirely |

---

## Verification Checklist

- [x] Tip box shows blue info style (light blue bg, blue text, blue border) — matching Web
- [x] Error input borders use `colors.borderError` instead of hardcoded `#EF4444`
- [x] Error borders appear for ALL validation errors (not just empty fields)
- [x] Error container has **no background** — just icon + red text
- [x] Light mode: colors look natural and consistent
- [x] `npx tsc --noEmit` passes
