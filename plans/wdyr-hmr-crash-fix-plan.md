# WDYR HMR Crash Fix Plan

## Problem

`HomeScreen.whyDidYouRender = true;` at [`src/screens/HomeScreen.tsx:553`](../src/screens/HomeScreen.tsx:553) causes React to crash during Metro HMR (Hot Module Replacement).

During HMR, React re-renders the component with updated code. The WDYR library detects hook order differences between the old and new renders, which is a normal artifact of module replacement, but WDYR treats it as a violation of the Rules of Hooks and throws `TypeError: Cannot read property 'current' of null`.

This crashes the component on every HMR update, requiring a full clean build (`npx react-native run-android`) to recover.

## Root Cause

The WDYR integration at line 553 (`HomeScreen.whyDidYouRender = true;`) wraps React hooks to detect unnecessary re-renders. During HMR:

1. Old module unmounts → hooks deregistered
2. New module mounts → hooks registered fresh
3. WDYR compares old hook order to new hook order → detects `useState → useRef` difference (positions 84-85)
4. WDYR throws `TypeError` → component crashes

This is a **false positive** — the hook order change is caused by module replacement, not by conditional hooks.

## Files to Modify

### 1. [`src/screens/HomeScreen.tsx:553`](../src/screens/HomeScreen.tsx:553)

Remove `HomeScreen.whyDidYouRender = true;`

### 2. [`src/screens/HomeScreen.tsx:146-168`](../src/screens/HomeScreen.tsx:146)

Restore diagnostic console.logs for language change tracking (briefly, for verification):

- `[LangEffect]` logs in the lang-change useEffect
- `[displayArticles]` log in the memo
- `[PaginationEffect]` log in the accumulation effect

## Verification

1. Clean build: `npx react-native run-android` (Metro bundle cache cleared)
2. Test: 中文 → 日文 → 中文 — list should auto-switch
3. Make any source edit → Metro HMR should apply without WDYR crash
4. Report results, then remove diagnostic logs
