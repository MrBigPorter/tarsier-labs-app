# 移动端媒体能力统一方案

## 问题

当前代码中媒体相关逻辑散落在组件里，没有复用：

| 逻辑 | 现状 | 问题 |
|------|------|------|
| 🔴 视频播放 | `ArticleCard.tsx` L66-150 | 硬编码在组件内 |
| 🟢 图片 URL 选择 | `ArticleCard.tsx` L77-102 | WebP/JPEG 逻辑在 useMemo 里 |
| 🖼️ Image 组件 | 直接 RN `<Image>` | 无优化、无 loading、无 fallback |
| ⚡ 图片预取 | 不存在 | **从未做过** |

Web 端有 `cloudflareImageLoader.ts` + Next.js `<Image>`，移动端也应该有对等的方案。

---

## 方案架构

```
src/lib/
├── utils/
│   └── image.ts              [新建] 图片 URL 工具函数
├── hooks/
│   ├── useVideoPlayback.ts   [新建] 视频播放逻辑
│   └── useImagePrefetch.ts   [新建] 图片预取
└── components/
    └── core/
        ├── AppImage.tsx       [新建] 类 Next.js Image
        └── ... (已有组件)

src/components/blog/
    └── ArticleCard.tsx        [改造] 使用以上模块
```

---

## 1. `src/lib/utils/image.ts` — 图片 URL 工具（纯函数）

### `getOptimizedImageUrl()`

Web 端 [`cloudflareImageLoader.ts`](/Volumes/MySSD/work/JoyMini_Nest_Monorepo/apps/frontend-blog/src/lib/utils/cloudflareImageLoader.ts:28) 的移动端复制，通过 Cloudflare `/cdn-cgi/image/` 边缘优化图片。

```typescript
function getOptimizedImageUrl(
  src: string,
  width?: number,    // 目标宽度
  quality?: number,  // 1-100
): string
```

**为什么 RN 能用？** RN `<Image source={{ uri: x }}>` 底层发 HTTP 请求，Cloudflare 边缘节点处理 `/cdn-cgi/image/` 后返回优化图。

### `getArticleImageUrl()`

根据 `meta.images` 和网络状态选最佳图片 URL。

```typescript
interface ArticleImageOptions {
  images?: ArticleMeta['images'];
  coverImage?: string | null;
  format: 'webp' | 'jpg';
  size: 'thumbnail' | 'medium' | 'large' | 'original';
}

function getArticleImageUrl(opts: ArticleImageOptions): string | null
```

优先级：`requested.size.requested.format → fallback size → coverImage → null`

---

## 2. `src/lib/hooks/useImagePrefetch.ts` — 图片预取

利用 RN 内置 `Image.prefetch()` 提前下载图片到原生缓存。

```typescript
function useImagePrefetch(): {
  /** 预取单个图片 */
  prefetch: (url: string) => Promise<void>;
  /** 批量预取（并行，自动忽略空值） */
  prefetchMany: (urls: Array<string | null | undefined>) => Promise<void>;
  /** 预取结果缓存 */
  prefetched: Set<string>;
  /** 是否正在预取 */
  isPrefetching: boolean;
}
```

使用场景：
- 列表页 FlatList `onViewableItemsChanged` 时预取可见项和附近项的图片
- 导航到详情页前预取详情页图片
- `AppImage` 组件内部自动触发

---

## 3. `src/components/core/AppImage.tsx` — 类 Next.js Image

```tsx
// 简单用法
<AppImage
  uri={article.coverImage}
  style={styles.image}
/>

// 自动选最佳尺寸 + Cloudflare 优化
<AppImage
  images={article.meta?.images}
  coverImage={article.coverImage}
  style={styles.image}
/>

// 指定 poster
<AppImage
  uri={article.meta?.video?.posterWebp}
  style={styles.image}
/>
```

### 接口

```typescript
interface AppImageProps extends Omit<ImageProps, 'source'> {
  uri?: string | null;                    // 原始图片 URL
  images?: ArticleMeta['images'];         // 多尺寸图片
  coverImage?: string | null;             // 回退封面图
  width?: number;                         // 传给 Cloudflare 的宽度
  quality?: number;                       // 传给 Cloudflare 的质量
  optimize?: boolean;                     // 是否走 Cloudflare 优化
  enablePrefetch?: boolean;              // 是否自动预取
}
```

### 内部流程

```
AppImage
├── 解析输入
│   ├── uri 存在 → 直接使用
│   ├── images + coverImage → getArticleImageUrl() 选最佳
│   └── 都不存在 → return null (不渲染)
├── Cloudflare 优化
│   └── getOptimizedImageUrl(finalUrl, width, quality)
├── 预取（异步，不阻塞渲染）
│   └── useImagePrefetch.prefetch(optimizedUrl)
├── 渲染状态
│   ├── loading → Skeleton 占位
│   ├── loaded → RN Image with optimized URL
│   └── error → 显示 fallback 或空
└── 清理
    └── 组件卸载时取消 pending 请求
```

---

## 4. `src/lib/hooks/useVideoPlayback.ts` — 视频播放逻辑

同之前方案，不做改动。

```typescript
function useVideoPlayback(article: FrontendArticle): {
  hasVideo: boolean;          // 是否有视频
  videoPlaying: boolean;      // 是否正在播放
  videoPaused: boolean;       // 是否暂停
  videoUri: string | null;    // 当前视频 URL
  videoFailed: boolean;       // 是否完全失败
  handlePlayPress: () => void;
  handleVideoLoad: () => void;
  handleVideoError: (e: any) => void;  // HLS→MP4 回退
  handleVideoEnd: () => void;
};
```

---

## 5. 改造 `ArticleCard.tsx`

**移除**（~60 行）：

| 行 | 内容 |
|----|------|
| 19 | `useState` import |
| 66-71 | 4 个 useState |
| 73-75 | hasVideo 推导 |
| 77-102 | imageUrl useMemo |
| 104-106 | debug 日志 |
| 108-150 | handlePlayPress/VideoLoad/VideoError/VideoEnd |
| 208-212 | `<Image>` (poster) |
| 242-246 | `<Image>` (static) |

**新增**（~10 行）：

```typescript
import { useVideoPlayback } from '@/lib/hooks/useVideoPlayback';
import { AppImage } from '@/components/core/AppImage';

// 替换所有 useState + useCallback + hasVideo + imageUrl
const {
  hasVideo, videoPlaying, videoPaused, videoUri, videoFailed,
  handlePlayPress, handleVideoLoad, handleVideoError, handleVideoEnd,
} = useVideoPlayback(article);

// 替换 <Image>
<AppImage uri={imageUrl} ... />

// 如果 logger 不再被其他地方使用，移除 logger import
```

**JSX 改动量：几乎为零。** `useVideoPlayback` 返回的变量名和原来一样，`<AppImage uri={imageUrl}>` 替换 `<Image source={{ uri: imageUrl }}>` 是一样的。

---

## 执行顺序

| # | 文件 | 操作 | 说明 |
|---|------|------|------|
| 1 | `src/lib/utils/image.ts` | 新建 | `getOptimizedImageUrl` + `getArticleImageUrl` |
| 2 | `src/lib/hooks/useImagePrefetch.ts` | 新建 | 封装 `Image.prefetch()` |
| 3 | `src/components/core/AppImage.tsx` | 新建 | 依赖 1+2 |
| 4 | `src/lib/hooks/useVideoPlayback.ts` | 新建 | 无依赖 |
| 5 | `src/components/blog/ArticleCard.tsx` | 改造 | 依赖 3+4 |

---

## 与 Web 端对位

| 能力 | Web (Next.js) | Mobile (RN) |
|------|--------------|-------------|
| **URL 优化** | `getOptimizedImageUrl()` | 同样实现到 `image.ts` |
| **图片组件** | `<Image>` (next/image) | `<AppImage>` |
| **自动优化** | `loaderFile` 配置 | `<AppImage optimize>` prop |
| **图片预取** | `<link rel="preload">` + 浏览器缓存 | `useImagePrefetch` + `Image.prefetch()` |
| **响应式** | `sizes` + `loader` | `getArticleImageUrl(size, format)` |
| **视频检测** | 不需要（H5 `<video>` 直接） | `useVideoPlayback.hasVideo` |
| **HLS→MP4** | 不需要 | `handleVideoError` 回退 |
