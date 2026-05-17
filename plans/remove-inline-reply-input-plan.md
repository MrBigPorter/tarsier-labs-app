# Plan: Remove Inline Reply Input — Keep Only One Floating Input

## Problem

There are currently **two input fields** for comments/replies:

1. **Inline reply TextInput** inside [`CommentItem.tsx`](../src/components/blog/CommentItem.tsx) (lines 198-240) — appears inside the scrollable comment area when user taps "Reply"
2. **Main floating input** in [`ArticleDetailScreen.tsx`](../src/screens/ArticleDetailScreen.tsx) (lines 562+) — the `KeyboardStickyView` at the bottom

This causes **keyboard coverage issues** because the inline input is inside `KeyboardAwareScrollView`, not in the `KeyboardStickyView`.

## Solution

Remove the inline reply from `CommentItem.tsx`. When user taps "Reply", always delegate to the parent via `onReply` callback. The parent sets `replyTo` context, and the **main floating input** shows "Reply to X..." placeholder and submits with `parentId`. Since the main input uses `KeyboardStickyView`, it **stays above the keyboard** at all times.

## Changes

### File 1: [`src/components/blog/CommentItem.tsx`](../src/components/blog/CommentItem.tsx)

| # | Lines | Change | Reason |
|---|-------|--------|--------|
| 1 | 19-39 (Props) | Remove `onSubmitReply` and `isPostingReply` from interface | No longer needed |
| 2 | 60-61 (Destructure) | Remove `onSubmitReply` and `isPostingReply` from function params | No longer needed |
| 3 | 72-73 (State) | Remove `showReplyInput` and `replyContent` state | Inline reply removed |
| 4 | 75-88 (handleReplyPress) | Remove `if (onSubmitReply)` branch — always call `onReply(comment)` directly | Always delegate to parent |
| 5 | 90-95 (handleSubmitReply) | Remove entire function | No longer needed |
| 6 | 183 (disabled prop) | Remove `\|\| isPostingReply` from TouchableOpacity disabled check | No longer needed |
| 7 | 198-240 (JSX) | Remove entire `{showReplyInput && isAuthenticated && (...)}` block | Inline reply removed |
| 8 | Styles | Remove `replyInputContainer`, `replyInput`, `replyActions`, `cancelReplyButton`, `cancelReplyText`, `submitReplyButton`, `submitReplyText` | No longer needed |
| 9 | Imports | Remove `TextInput` and `ActivityIndicator` from react-native imports | No longer used |

### File 2: [`src/screens/ArticleDetailScreen.tsx`](../src/screens/ArticleDetailScreen.tsx)

| # | Lines | Change | Reason |
|---|-------|--------|--------|
| 1 | 112 | Remove `const [isPostingReply, setIsPostingReply] = useState(false);` | No longer needed |
| 2 | 177-194 | Remove entire `handleSubmitReplyInline` `useCallback` | No longer needed |
| 3 | 436 | Change `onPress={() => setShowCommentInput(true)}` → `onPress={() => scrollRef.current?.scrollToEnd({ animated: true })}` | Input always visible; clicking message icon scrolls to comments |
| 4 | 526-527 | Remove `onSubmitReply={handleSubmitReplyInline}` and `isPostingReply={isPostingReply}` from `<CommentItem>` props | Props no longer exist |

## Flow After Changes

```
User taps "Reply" on comment
  → CommentItem.handleReplyPress()
    → onReply(comment) → parent.handleReply(comment)
      → setReplyTo({ commentId, author })
        → Main floating input shows "Reply to X..."
        → User types and taps Send
          → handleSubmitComment with parentId: replyTo.commentId
            → Creates reply via API
            → scrollToEnd instantly
            → Clears replyTo
```

## Keyboard Behavior

The `KeyboardStickyView` from `react-native-keyboard-controller` ensures the main input **always stays above the keyboard** — it cannot be covered. No more inline inputs inside the scrollable area.
