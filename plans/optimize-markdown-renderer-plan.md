# Optimize MarkdownRenderer Rendering Performance

## Problem

`MarkdownRenderer` re-renders at ~634-748ms on each **update** phase. This happens because:

1. [`ArticleDetailScreen`](src/screens/ArticleDetailScreen.tsx:319) re-renders when API data arrives (related articles, comments)
2. This triggers `MarkdownRenderer` to re-render even though `content` hasn't changed
3. `react-native-markdown-display` re-parses all markdown content **synchronously** on the JS thread (~700ms)
4. This blocks the JS thread, inflating API wall-clock timing (the 2551ms includes ~700ms of rendering queue)

## Root Cause

`MarkdownRenderer` is a plain function component — **not wrapped in `React.memo`**. Every parent re-render causes a full markdown re-parse, even with identical props.

Additionally, [`markdownStyles`](src/components/blog/MarkdownRenderer.tsx:138) is recreated on every render (references `colors` from `useModeColors()`). While `React.memo` would prevent re-entry, memoizing styles is still good practice for initial render and theme-change scenarios.

## Optimization Plan

### Change 1: Wrap `MarkdownRenderer` in `React.memo` (highest impact)

```typescript
// Before
export function MarkdownRenderer({...}: MarkdownRendererProps) {

// After
export const MarkdownRenderer = React.memo(function MarkdownRenderer({...}: MarkdownRendererProps) {
```

This prevents re-render when `content`, `contentVideo`, `maxWidth`, or `enableCodeHighlight` haven't changed. Since these props are stable strings/arrays during ArticleDetailScreen re-renders, MarkdownRenderer will skip entirely — eliminating the ~700ms re-parse cost.

### Change 2: Memoize `markdownStyles` with `useMemo` (secondary)

```typescript
const markdownStyles = React.useMemo<MarkdownProps['style']>(
  () => ({
    heading1: { ... },
    // ... all existing styles
  }),
  [colors, containerWidth],
);
```

This prevents recreating style objects when neither colors nor containerWidth change. Not strictly needed after React.memo, but good practice.

## Expected Impact

| Metric                     | Before            | After (est.)                  |
| -------------------------- | ----------------- | ----------------------------- |
| Initial mount              | ~750ms            | ~750ms (unchanged)            |
| Re-render on parent update | **634-748ms**     | **~0ms** (skipped)            |
| API wall-clock time        | ~2551ms           | **~1800ms** (no render queue) |
| JS thread blocking         | ~700ms per render | 0ms (no re-render)            |

## Files to Modify

- [`src/components/blog/MarkdownRenderer.tsx`](src/components/blog/MarkdownRenderer.tsx:53) — `React.memo` wrapping + `useMemo` for styles

## Out of Scope (for now)

- Replacing `react-native-markdown-display` with a lighter alternative
- Code highlighting optimization (`enableCodeHighlight` is already `false`)
- Image lazy-loading (handled by `AppImage` at a higher level)
