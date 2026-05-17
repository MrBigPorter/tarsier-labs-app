# Duplicate Comment Fix Plan (Final)

## Root Cause

提交评论显示两条的根本原因：**两条插入路径同时运行导致竞态条件**。

```
mutation success → realComment
    │
    ├─ 路径 A (原 comments.ts:96-107)
    │   updateQueryData → 修补 RTK Query 缓存
    │   → useLazyGetCommentsQuery data 变化
    │   → Effect (useCommentsInfiniteQuery.ts:82-84) 触发
    │   → setAllItems(data.items)  ← 替换 allItems，里面已包含 realComment
    │
    └─ 路径 B (ArticleDetailScreen.tsx:190)
        prependComment(result) → setAllItems(prev => [realComment, ...prev])
        → React 18 批处理中，函数式更新接收的 prev 可能来自路径 A 已替换的 allItems
        → 去重检测 prev.some(c => c.id === realComment.id)
        → 在特定时序下去重失败，realComment 出现两次
```

**解决方案**：消除路径 A（`updateQueryData`），只保留路径 B（`prependComment`）。

## Final Data Flow

```
mutation success → unwrap() → prependComment → setAllItems (单一路径)
                  ↘ statusPolling → 审核状态追踪
```

## Files Modified

### 1. [`src/lib/hooks/useCommentsInfiniteQuery.ts`](src/lib/hooks/useCommentsInfiniteQuery.ts:118)

Added `prependComment` callback — directly inserts into `allItems` with dedup guard.

```ts
const prependComment = useCallback((comment: Comment) => {
  setAllItems((prev) => {
    if (prev.some((c) => c.id === comment.id)) return prev;
    return [comment, ...prev];
  });
  setTotal((prev) => prev + 1);
}, []);
```

### 2. [`src/api/endpoints/comments.ts`](src/api/endpoints/comments.ts:87)

- **Removed** `updateQueryData` (cause of duplicate)
- **Kept** `commentStatusManager.registerPendingComment` — 审核状态追踪
- **Kept** `commentStatusManager.startStatusPolling` — 状态轮询
- Mutation 现在只处理 API 调用 + 状态追踪，UI 插入由 Screen 负责

### 3. [`src/screens/ArticleDetailScreen.tsx`](src/screens/ArticleDetailScreen.tsx:189)

Calls `commentsQuery.prependComment(result)` after mutation success — 唯一的 UI 插入入口。

## Why This Works

1. **单一插入路径**：不再有 `updateQueryData`，只有一个 `setAllItems` 调用点
2. **内置去重**：`prev.some(c => c.id === comment.id)` 防止重复
3. **无 temp comment**：评论直接从服务器返回的数据插入，没有中间状态
4. **缓存最终一致性**：导航离开再回来时，初始 fetch 会从服务器重新获取最新数据
