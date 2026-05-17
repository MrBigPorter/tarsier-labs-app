# HomeScreen Typography Crash Fix Plan

## Root Cause Analysis

### Error Chain (Cascade Failure)

Three runtime errors occur in [`HomeScreen.tsx`](../src/screens/HomeScreen.tsx), all originating from `renderRecentSection`:

1. **`TypeError: Cannot read property 'fontSize' of undefined`** (fires twice)
2. **`TypeError: Cannot read property 'EmptyState' of undefined`**

### The Cascade

```
EmptyState.tsx references typography.body (INVALID KEY)
  → Module-level StyleSheet.create tries typography.body.fontSize
  → typography.body is undefined → TypeError thrown during module EVALUATION
  → EmptyState module fails to load entirely
  → HomeScreen.tsx import { EmptyState } gets undefined
  → <EmptyState /> in renderRecentSection crashes with "EmptyState of undefined"
```

### The typography Key Mapping

[`typography.ts`](../src/lib/theme/typography.ts) defines these valid keys:
`display`, `h1`, `h2`, `h3`, `h4`, `h5`, **`base`**, `small`, `xs`, `label`, `caption`

**Missing keys that components assume exist:**

| Missing Key | Used In | Line(s) |
|---|---|---|
| `typography.body` | [`EmptyState.tsx`](../src/components/core/EmptyState.tsx) | 142, 161, 173 |
| `typography.body` | [`MarkdownRenderer.tsx`](../src/components/blog/MarkdownRenderer.tsx) | 82, 98, 130, 136 |
| `typography.body` | [`CommentItem.tsx`](../src/components/blog/CommentItem.tsx) | 227, 234 |
| `typography.body` | [`ErrorBoundary.tsx`](../src/components/core/ErrorBoundary.tsx) | 236, 270 |
| `typography.body2` | [`ArticleCard.tsx`](../src/components/blog/ArticleCard.tsx) | 230 |
| `typography.subtitle2` | [`ArticleCard.tsx`](../src/components/blog/ArticleCard.tsx) | 226 |

### Why This Happens Now (not before)

The `recentError` state in HomeScreen's `renderRecentSection` triggers rendering of `<EmptyState>` — if recent data errors out from the API call. This is likely a new code path that wasn't exercised before, or the API is now returning errors in this dev environment.

## Recommended Fix: Add Missing Typography Keys as Aliases

Rather than fixing 11+ individual references across 5 component files (which is high-churn and error-prone), add the missing keys as aliases in the source of truth: [`typography.ts`](../src/lib/theme/typography.ts).

### Mapping

| Alias | Maps To | Rationale |
|---|---|---|
| `body` | `base` | Semantically identical — body text style |
| `body2` | `small` | `body2` is typically a smaller body variant (`textXs: 12` vs `textSm: 14`) |
| `subtitle2` | `h5` | Subtitle variant maps to h5 (`textMd: 16`, weight `600`) |

### Changes Required

**Single file:** [`src/lib/theme/typography.ts`](../src/lib/theme/typography.ts)

Add after the existing `caption` key definition:

```typescript
// ── Backward-compatible aliases ──────────────────────────
body: {
  fontFamily: front.fontFamilyBody,
  fontSize: front.textSm,
  fontWeight: '400',
  lineHeight: front.leadingSm,
},
body2: {
  fontFamily: front.fontFamilyBody,
  fontSize: front.textXs,
  fontWeight: '400',
  lineHeight: front.leadingXs,
},
subtitle2: {
  fontFamily: front.fontFamilyBody,
  fontSize: front.textMd,
  fontWeight: '600',
  lineHeight: front.leadingMd,
},
```

This approach:
- ✅ Fixes the immediate crash (EmptyState module loads successfully)
- ✅ Prevents crashes in ALL other components using these keys
- ✅ Preserves original visual intent of component authors
- ✅ Minimal change (one file, three lines)
- ✅ No risk of style regressions

## Test Plan

1. Reload the React Native app (Cmd+R or shake → reload)
2. Verify the app renders without the TypeError
3. Navigate through screens that use:
   - EmptyState (trigger error states)
   - ArticleCard (home screen, article lists)
   - MarkdownRenderer (article detail)
   - CommentItem (article detail with comments)
   - ErrorBoundary (trigger errors)
