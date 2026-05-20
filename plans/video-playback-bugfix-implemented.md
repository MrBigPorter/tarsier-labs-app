# Video Playback Bug Fixes — ✅ Implemented

> 记录所有视频播放相关 bug 的根因分析与最终实现方案。

---

## 架构概览

视频播放逻辑完全提取到两个文件：

| 文件                                                                                    | 职责                                                 |
| --------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| [`src/lib/hooks/useVideoPlayback.ts`](../src/lib/hooks/useVideoPlayback.ts)             | 所有播放状态 + 事件回调（纯逻辑，无 UI）             |
| [`src/components/features/VideoPlayer.tsx`](../src/components/features/VideoPlayer.tsx) | 渲染 `<Video>` + poster overlay + 播放按钮 + spinner |

`ArticleCard` 直接使用 `<VideoPlayer article={article} />` ，不含任何视频状态。

`<Video>` **始终挂载**（不随 `videoPlaying` 条件渲染），让 ExoPlayer 在用户点击前完成 codec 初始化，消除首播竞态。

---

## Bug 1 — Android ExoPlayer `audio/mp4a-latm` 播放失败

### 根因

HLS 音频轨使用 **AAC-LATM** 封装格式（`audio/mp4a-latm`）。Android ExoPlayer (Media3) 无法将样本队列绑定到该音轨，抛出：

```
SampleQueueMappingException: Unable to bind a sample queue to TrackGroup
with MIME type audio/mp4a-latm.
```

> ⚠️ 该异常**仅出现在 `errorStackTrace`**（Caused-by 链），不在顶层 `errorException` 或 `errorString`，因此早期实现无法检测。

### 修复流程（三阶梯降级）

```
HLS onError
  │
  ├─ [Case 1] LATM 错误 + 重试次数 < 1
  │   └─ videoUri=null (强制销毁 ExoPlayer)，500ms 后恢复 hlsUrl → return
  │
  ├─ [Case 1.5] LATM 错误 + 重试耗尽 + 音频未禁用
  │   └─ setAudioDisabled(true)，同样 null→hlsUrl 重建 ExoPlayer → return
  │       <Video selectedAudioTrack={{ type: DISABLED }}> 绕过音轨绑定
  │
  ├─ [Case 2] HLS 失败 + coverImage.endsWith('.mp4')
  │   └─ setVideoUri(mp4Url) → return
  │
  └─ [Case 3] 全部失败 → setVideoFailed(true)（显示 ⚠ 错误提示）
```

### 关键实现

- `isAudioLatmError()` 同时检查 `errorException`、`errorString`、**`errorStackTrace`**
- `videoLatmRetryCount` 用 `useRef`（不触发重渲染），每次 article 变更时重置为 0
- `audioDisabled` 状态传给 `VideoPlayer`，驱动 `<Video selectedAudioTrack>` prop

---

## Bug 2 — `videoLoaded` 被 pause 回调错误重置（poster 永久覆盖）

### 根因

模块级 `videoPauseCallbacks` 注册的暂停函数原含 `setVideoLoaded(false)`。当另一视频播放触发自动暂停后：

1. `videoLoaded = false`
2. 用户点击播放 → `videoPlaying = true`
3. poster 条件：`!videoPlaying || !videoLoaded` = `false || true` = **`true`** → poster 永久覆盖
4. `onLoad` 不会再触发（视频已在后台加载完毕）→ poster 永不消失

### 修复

从暂停回调中移除 `setVideoLoaded(false)`。Video 始终挂载，数据已预加载，暂停操作不应清除加载状态。

---

## Bug 3 — 双击 double-fire 导致视频立刻被暂停

### 根因

1. 点击播放 → `videoPlaying=true`，但 poster 仍覆盖（`videoLoaded=false`），无视觉反馈
2. 用户以为没反应，1 秒内再次点击
3. 此时 `videoPlaying=true` → 进入 pause 分支 → **视频立刻被暂停**

### 修复（两层保护）

**层 1 — 加载中不响应 pause**：

```ts
if (videoPlaying) {
  if (!videoLoaded) {
    // 仍在 buffering，忽略，避免误暂停
    return;
  }
  setVideoPaused(p => !p);
}
```

**层 2 — 500ms 防抖**：

```ts
const now = Date.now();
if (now - lastPlayPressTimestamp.current < 500) {
  return;
}
lastPlayPressTimestamp.current = now;
```

**UI 反馈**：加载中显示 `<ActivityIndicator>` 白色 spinner 替代 ▶，用户明确知道正在 buffering。

---

## Bug 4 — `resume()` 与 `paused` prop 双重控制冲突

### 根因

`VideoPlayer.tsx` 原先同时存在：

- 声明式：`<Video paused={!videoPlaying || videoPaused}>`
- 命令式 `useEffect`：`videoRef.current?.resume()`

两个信号同时到达 native player，造成播放行为不可预期。

### 修复

删除 `useEffect`，**只通过 `paused` prop 控制播放**。

---

## Bug 5 — LATM 重试期间 `videoUri=null` 传给 `<Video>` 可能 crash

### 根因

重试时 `videoUri` 临时为 `null`，原来 `source={{ uri: videoUri as string }}` 强转绕过 TS，null 传给 native player 可能 crash。

### 修复

```tsx
{videoUri != null && (
  <Video source={{ uri: videoUri }} ... />
)}
```

null 期间不渲染 `<Video>`，与 ExoPlayer teardown 目的一致。

---

## Bug 6 — 开发环境 Sentry 满屏噪音

### 根因

Android staging flavor + Metro dev server 时，`detectFlavor()` 返回 `'staging'`，加载含真实 DSN 的 `TEST_CONFIG`，Sentry 被完整初始化，`debug: true` 产生大量日志，包括 `Unable to find click target`（native `<Video>` 触摸无法被 Sentry React 树识别，完全无害噪音）。

### 修复

**`initSentry()`** 最前加 `if (__DEV__) return` — Metro dev 模式均跳过 Sentry。  
**`App.tsx`** `LogBox.ignoreLogs(['Unable to find click target'])` 屏蔽残留。  
**`sentry.ts` `beforeBreadcrumb`** 过滤无效 touch breadcrumb（`category=touch && message==null`）。

---

## 最终状态验证（正常播放日志序列）

```
[VideoPlayer] state playing=false loaded=false uri="...master.m3u8"
[VideoPlayer] <Video paused=true>
[useVideoPlayback] video load start
[useVideoPlayback] video loaded                      ← ✅ HLS 预加载完成
[VideoPlayer] state playing=false loaded=true

--- 点击播放 ---
[useVideoPlayback] play pressed videoLoaded=true
[VideoPlayer] state playing=true paused=false loaded=true
[VideoPlayer] <Video paused=false>                   ← ✅ 视频播放

--- 另一个视频被点击，本视频自动暂停 ---
[VideoPlayer] state playing=false paused=false loaded=true  ← loaded 维持 true ✅

--- 再次点击本视频 ---
[useVideoPlayback] play pressed videoLoaded=true
[VideoPlayer] <Video paused=false>                   ← ✅ 正常续播，poster 不会重现
```

---

## 未来优化方向

| 方向                   | 说明                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------ |
| **服务端彻底修复**     | HLS 转码改为输出 AAC-ADTS（标准 MPEG-4 AAC）而非 AAC-LATM，消除 ExoPlayer 兼容问题   |
| **Native FFmpeg 扩展** | 如持续出现 LATM，在 Android build 添加 `media3-exoplayer-ffmpeg`（需应用商店更新）   |
| **API 增强**           | 文章接口直接返回 `video.mp4Url`，避免依赖 `coverImage.endsWith('.mp4')` 这种脆弱检测 |
