# Web 首页模式分析 — 每个技术知识点详解

> 最后更新：2026-05-16
>
> **勘误**：
> - `imageFormat`（WebP vs JPEG）：Cloudflare 的 [`f=auto`](https://developers.cloudflare.com/images/url-format/) 通过 HTTP `Accept` 头部自动协商最佳格式。因此使用 `getOptimizedImageUrl()` 时，`imageFormat` 是冗余的，应始终使用 `f=auto`。
> - Blurhash：用户要求**立即实现**并在首帧加载，非延迟优化。需添加 `react-native-blurhash` 原生模块。

> Source: `/Volumes/MySSD/work/JoyMini_Nest_Monorepo/apps/frontend-blog/src/app/[locale]/page.client.tsx`
> Companion: `ArticleCard.tsx`, `HlsVideoPlayer.tsx`, `BlurhashImage.tsx`, `NativeVideoPlayer.tsx`, `cloudflareImageLoader.ts`, `media.ts`

---

## 目录

1. [networkQuality 作为 Prop 传递](#1-networkquality-作为-prop-传递)
2. [priority 属性 — LCP 优化](#2-priority-属性--lcp-优化)
3. [IntersectionObserver 预测性图片预取](#3-intersectionobserver-预测性图片预取)
4. [底部 Sentinel 自动预取下一页](#4-底部-sentinel-自动预取下一页)
5. [KeepAlive Context — 跨页面状态保持](#5-keepalive-context--跨页面状态保持)
6. [Cloudflare 图片优化](#6-cloudflare-图片优化)
7. [Blurhash 占位图](#7-blurhash-占位图)
8. [三级媒体渲染策略](#8-三级媒体渲染策略)
9. [isVideoUrl() 工具函数](#9-isvideourl-工具函数)
10. [HLS 视频播放器（clickToPlay 模式）](#10-hls-视频播放器clicktoplay-模式)
11. [SSR 水合管理](#11-ssr-水合管理)
12. [URL 状态同步](#12-url-状态同步)
13. [防抖分类切换 + View Transitions](#13-防抖分类切换--view-transitions)
14. [加载更多按钮](#14-加载更多按钮)

---

## 1. networkQuality 作为 Prop 传递

### Web 实现

[`page.client.tsx:55-61`](/Volumes/MySSD/work/JoyMini_Nest_Monorepo/apps/frontend-blog/src/app/[locale]/page.client.tsx:55)

```typescript
interface HomePageClientProps {
  networkQuality: NetworkQuality;
}
```

`NetworkQuality` 在页面级通过 props 注入（服务端计算），然后下传到 `ArticleCard`：

```typescript
<ArticleCard
  key={article.id}
  article={article}
  networkQuality={networkQuality}
  priority={index < 2}
/>
```

**为什么不在 ArticleCard 内部调用 `useNetworkQuality()`？**
- 保持 ArticleCard 为纯展示组件（Pure Component）
- 避免每个卡片都挂载 NetInfo 监听器（N 个卡片 = N 个监听器）
- 网络质量在页面级是统一的，不需要每张卡片单独判断
- 方便测试：可以通过 props 注入不同的 networkQuality

### Mobile 现状

[`useNetworkQuality`](../../src/lib/hooks/useNetworkQuality.ts:94) 已存在，但在 [`HomeScreen.tsx`](../../src/screens/HomeScreen.tsx:82) **未使用**。ArticleCard 也没有接收这个 prop。

### 迁移方案

1. 在 `HomeScreen` 调用 `useNetworkQuality()`
2. 将 `networkQuality` 传给 `ArticleCard` 作为 prop
3. ArticleCard 内部用 `networkQuality` 决定：
   - `imageFormat`: `'webp' | 'jpg'` — 选哪种格式的图片
   - `imageSize`: `'thumbnail' | 'medium' | 'large' | 'original'` — 选多大尺寸
   - `showBlurhash`: 弱网时显示 blurhash 占位

---

## 2. priority 属性 — LCP 优化

### Web 实现

[`page.client.tsx:547`](/Volumes/MySSD/work/JoyMini_Nest_Monorepo/apps/frontend-blog/src/app/[locale]/page.client.tsx:547)

```typescript
return (
  <ArticleCard
    priority={index < 2}
    ...
  />
);
```

前 2 篇文章标记为 `priority=true`，传给 `BlurhashImage`：
- Web 端：Next.js `<Image priority>` → 预加载 `<link rel="preload">`
- 浏览器会立即下载图片，不等待 lazy loading

### Mobile 现状

没有 `priority` 概念。所有卡片同等对待。

### 迁移方案

- `HomeScreen` 中 `renderArticleItem` 传递 `priority={index < 2}`
- `ArticleCard` 将 `priority` 传给 `AppImage`
- `AppImage` 对 priority 图片调用 `Image.prefetch()` 在组件挂载前就开始下载
- 注意：RN 没有 `<link rel="preload">`，但 `Image.prefetch()` 达到相同效果

---

## 3. IntersectionObserver 预测性图片预取

### Web 实现

[web `ArticleCard.tsx:74-104`](/Volumes/MySSD/work/JoyMini_Nest_Monorepo/apps/frontend-blog/src/components/blog/ArticleCard.tsx:74)

```typescript
useEffect(() => {
  if (!coverImageUrl || priority || isVideoUrl(coverImageUrl)) return;
  const el = cardRef.current;
  if (!el) return;
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const img = new Image();
          img.src = coverImageUrl;
          // Warm SW cache + browser HTTP cache
          fetch(coverImageUrl, { mode: 'no-cors' }).catch(() => {});
          observer.disconnect();
          break;
        }
      }
    },
    { rootMargin: '200px', threshold: 0 } // 200px 提前触发！
  );
  observer.observe(el);
  return () => observer.disconnect();
}, [coverImageUrl, priority]);
```

**关键点**：
- `rootMargin: '200px'` — 元素进入视口前 200px 就开始预取！用户还没看到就提前下载
- `fetch(url, { mode: 'no-cors' })` — 浏览器不会得到响应数据（opaque），但会**缓存到 HTTP 缓存 + Service Worker**
- `priority` 的跳过预取 — priority 已经预加载了，不需要重复预取
- 视频 URL 跳过预取 — 视频文件太大，不预取

### Mobile 现状

完全没有图片预取。

### 迁移方案

Web 端用 `IntersectionObserver` + `fetch()`，但移动端不同：
- RN 的 `Image.prefetch()` 是原生级缓存，比 `fetch()` 更强（缓存到 native image cache）
- RN 没有 IntersectionObserver，需用 `FlatList` 的 `onViewableItemsChanged` 或 `react-native-reanimated` 的滚动事件
- 推荐使用 `onViewableItemsChanged` + `viewabilityConfig.viewAreaCoveragePercentThreshold` 来触发预取

```typescript
// HomeScreen 中
const viewabilityConfig = useRef({
  itemVisiblePercentThreshold: 10, // 10% 可见即触发
  minimumViewTime: 100,           // 至少 100ms
}).current;

const onViewableItemsChanged = useRef(
  ({ viewableItems }: { viewableItems: ViewToken[] }) => {
    viewableItems.forEach(item => {
      // 预取当前可见项 + 附近项的图片
      prefetchArticleImages(item.item);
    });
  }
).current;
```

---

## 4. 底部 Sentinel 自动预取下一页

### Web 实现

[`page.client.tsx:314-390`](/Volumes/MySSD/work/JoyMini_Nest_Monorepo/apps/frontend-blog/src/app/[locale]/page.client.tsx:314)

```typescript
const observer = new IntersectionObserver(
  async (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting && hasMore && !loadMoreLoading && !loadMoreError) {
        // 预取下一批文章的封面图！
        const nextArticles = await queryClient.fetchQuery({
          queryKey: ['frontend-articles', { ...currentParams, page: nextPage }],
          queryFn: () => fetchArticles({ ...currentParams, page: nextPage }),
        });
        // 预取每篇文章的图片 URL，传给 cloudflareImageLoader 加上宽度/质量参数
        // 用 fetch() 提前缓存到浏览器 + SW
        nextArticles.items.forEach((article) => {
          const imgUrl = cloudflareImageLoader({
            src: article.coverImage,
            width: 480,
            quality: 65,
          });
          fetch(imgUrl, { mode: 'cors' }).catch(() => {});
        });
      }
    }
  },
  { rootMargin: '400px', threshold: 0 } // 提前 400px！
);
```

**关键点**：
- `rootMargin: '400px'` — 用户离底部还有 400px 就开始预取，远早于 `onEndReached` 的默认触发
- 不只是获取数据，还**预取图片到缓存**！
- 用 `cloudflareImageLoader` 加上具体 width/quality 参数，确保缓存的是最终渲染版本
- 宽度 480（卡片缩略图） + 质量 65（压缩比平衡）

### Mobile 现状

使用 `onEndReached` + `onEndReachedThreshold={0.5}`，但**只获取数据不预取图片**。

### 迁移方案

1. 保留 `onEndReached` 数据获取逻辑
2. 在数据返回后，遍历 `newItems`，对每篇文章的封面图调用 `Image.prefetch()`
3. 使用 `getOptimizedImageUrl()` 加上 width/quality 参数

```typescript
const handleLoadMore = useCallback(() => {
  if (!isFetching && hasMore) {
    setPage(p => p + 1);
    // 注意：data 返回后自动由 useEffect 处理图片预取
  }
}, [isFetching, hasMore]);

// 新增：数据更新后预取图片
useEffect(() => {
  if (articlesData?.items && page > 1) {
    articlesData.items.forEach(item => {
      const url = getArticleImageUrl({
        images: item.meta?.images,
        coverImage: item.coverImage,
        format: networkQuality.imageFormat,
        size: 'medium',
      });
      if (url) {
        Image.prefetch(getOptimizedImageUrl(url, 480, 65));
      }
    });
  }
}, [articlesData, page]);
```

---

## 5. KeepAlive Context — 跨页面状态保持

### Web 实现

在 layout.tsx 中，`KeepAliveProvider` 包裹整个应用：

- **滚动位置** — 切换分类后再切回，恢复到之前的滚动位置
- **文章数据** — 分类切换时不重新获取已有数据，用缓存
- **URL 状态** — 分类/页码同步到 URL，支持浏览器前进/后退

```typescript
// layout.tsx
<KeepAliveProvider>
  <CategoryPageContent />
</KeepAliveProvider>
```

### Mobile 现状

已有 [`ScrollContext`](../../src/lib/ScrollContext.tsx:18)，但**只用于 TabBar 动画**，未保存滚动位置。

`allArticles` 状态（累加文章数据）在分类切换时被清空（`setAllArticles([])`），但 React Navigation 的屏幕保活机制（`react-native-screens`）会在 Tab 切换时保持 HomeScreen 挂载，所以数据不丢失。

### 迁移方案

移动端不需要完全复刻 KeepAlive Context，因为 React Navigation 有内置的屏幕保活：

1. **保持 `allArticles` 状态** — 当前已经做到
2. **分类切换时不清空 `allArticles`？** 不行，因为分类切换后数据变了。当前做法正确
3. **滚动位置恢复** — FlatList 的 `maintainVisibleContentPosition` 或 `scrollToIndex` 在数据恢复后恢复位置

---

## 6. Cloudflare 图片优化

### Web 实现

[`cloudflareImageLoader.ts:28`](/Volumes/MySSD/work/JoyMini_Nest_Monorepo/apps/frontend-blog/src/lib/utils/cloudflareImageLoader.ts:28)

```typescript
export function getOptimizedImageUrl({
  src,
  width,
  quality,
}: {
  src: string;
  width?: number;
  quality?: number;
}): string {
  // 跳过非优化 URL：data: blob: svg video .m3u8 等
  // 构造 Cloudflare URL: {protocol}//{host}/cdn-cgi/image/width={w},quality={q},f=auto,fit=scale-down/{path}
  return `${protocol}//${host}/cdn-cgi/image/${params}${path}`;
}
```

**为什么 RN 也能用？** RN `<Image source={{ uri: x }}>` 底层发 HTTP 请求。如果 URL 是 `https://example.com/cdn-cgi/image/width=480,quality=65/photo.jpg`，Cloudflare 边缘节点会在返回图片前**实时压缩/调整大小**。RN 完全不知情，拿到的是优化后的小图片。

### Mobile 现状

**完全没有使用 Cloudflare 优化**。所有图片 URL 都是原始大小，浪费带宽。

### 迁移方案

1. 创建 `src/lib/utils/image.ts` — 移植 `getOptimizedImageUrl()`
2. 创建 `AppImage` 组件 — 内部调用 `getOptimizedImageUrl()`
3. 注意：RN 没有 `next.config.js` 的 `loaderFile` 配置，所以需要在组件层主动调用

---

## 7. Blurhash 占位图

### Web 实现

[`BlurhashImage.tsx:107`](/Volumes/MySSD/work/JoyMini_Nest_Monorepo/apps/frontend-blog/src/components/blog/BlurhashImage.tsx:107)

**渲染策略**：「闪光」消除方案：
1. 真实 Image 以**全透明度立即渲染**（不淡入）
2. Blurhash 叠加层盖在图片上方（z-index 更高）
3. 当真实图片加载完成 → blurhash 淡出（300ms）
4. 所以用户永远不会看到「空白 → 图片」的闪光

**全局 LRU 缓存**：
- 解码后的 blurhash data URL 缓存在 `Map<string, string>`
- 最多 100 条，防止内存泄漏
- 分类切换时组件卸载再挂载，blurhash 不需要重新解码

### Mobile 现状

没有 blurhash 支持。API 返回的 `ArticleMeta` 中可能包含 `blurhash` 字段，但从未使用。

### 迁移方案

**立即实现**，首帧加载。

1. 添加 [`react-native-blurhash`](https://github.com/mrousavy/react-native-blurhash) 依赖（原生模块，提供 `BlurhashView` 组件）
   - 如需纯 JS 方案（避免原生依赖）：使用 `blurhash` npm 包 + 生成 SVG data URI 代替 canvas
2. 在 `AppImage` 中使用 `BlurhashView` 作为加载占位：
   - 组件挂载时**立即显示** blurhash（首帧即可见，零延迟）
   - 同时后台通过 `Image.prefetch()` 下载优化后的图片
   - 图片加载完成 → blurhash 淡出（300ms fade out）
   - 与 Web 的 BlurhashImage 完全一致的无闪烁方案

```tsx
// AppImage 内部结构 — 无闪烁方案
<View style={styles.container}>
  {/* Blurhash 占位 — 立即渲染，覆盖全区域 */}
  <BlurhashView blurhash={blurhash} style={StyleSheet.absoluteFill} />
  
  {/* 真实图片 — 图片在 blurhash 下层一直存在，加载后淡出 blurhash */}
  <Image
    source={{ uri: optimizedUrl }}
    style={[styles.image, { opacity: isLoaded ? 1 : 0 }]}
    onLoad={() => setIsLoaded(true)}
  />
  
  {/* 加载失败时显示 fallback 图标 */}
  {hasError && <FallbackIcon />}
</View>
```

3. **全局 LRU 缓存** — 参考 Web 的 `blurhashCache`，解码后的 data URL 最多缓存 100 条，避免分类切换时重新解码

> `imageFormat` 说明：使用 Cloudflare `f=auto` 后，WebP/JPEG 由服务端根据 `Accept` 头部自动协商，`useNetworkQuality` 中的 `imageFormat` 字段不再需要。但 `imageSize` 仍有用（为弱网用户缩小小图尺寸）。

---

## 8. 三级媒体渲染策略

### Web 实现

[web `ArticleCard.tsx:189-288`](/Volumes/MySSD/work/JoyMini_Nest_Monorepo/apps/frontend-blog/src/components/blog/ArticleCard.tsx:189)

```tsx
// 三级策略
if (hlsUrl) {
  return <HlsVideoPlayer hlsUrl={hlsUrl} poster={posterWebp} clickToPlay />;
}
if (isVideoUrl(coverImageUrl)) {
  return <NativeVideoPlayer src={coverImageUrl} poster={poster} />;
}
return <BlurhashImage src={coverImageUrl} blurhash={blurhash} />;
```

| 类型 | 组件 | 行为 |
|------|------|------|
| HLS 视频 | `HlsVideoPlayer` | hls.js 流媒体，clickToPlay |
| 原生视频 | `NativeVideoPlayer` | 简单 mp4，clickToPlay |
| 静态图片 | `BlurhashImage` | blurhash 占位 + 图片 |

### Mobile 现状

两级策略：`hasVideo ? <Video/> : <Image/>`。已经区分了视频和图片，但没有 HLS/非HLS 细分。

### 迁移方案

保持两级策略即可（移动端不需要区分 HLS 和原生视频，因为 `react-native-video` 同时支持两者）：
```
hasVideo ? <Video source={{ uri: hlsUrl || coverImage }} /> : <AppImage uri={coverImage} />
```

---

## 9. isVideoUrl() 工具函数

### Web 实现

[`media.ts:11`](/Volumes/MySSD/work/JoyMini_Nest_Monorepo/apps/frontend-blog/src/lib/utils/media.ts:11)

```typescript
export function isVideoUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.ogv', '.m4v', '.m3u8'];
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return videoExtensions.some((ext) => pathname.endsWith(ext));
  } catch {
    const urlLower = url.toLowerCase();
    return videoExtensions.some((ext) => urlLower.endsWith(ext));
  }
}
```

### Mobile 现状

在 ArticleCard 中硬编码 `article.coverImage.endsWith('.mp4')`。

### 迁移方案

提取到 `src/lib/utils/image.ts` 中作为共享工具函数。

---

## 10. HLS 视频播放器（clickToPlay 模式）

### Web 实现

[`HlsVideoPlayer.tsx:29`](/Volumes/MySSD/work/JoyMini_Nest_Monorepo/apps/frontend-blog/src/components/blog/HlsVideoPlayer.tsx:29)

**核心功能**：
1. `clickToPlay` 模式：默认只显示海报，用户点击后才开始加载视频流
2. **跨组件协调**：通过 `window.dispatchEvent(new CustomEvent('hls-video-play'))` 通知其他 clickToPlay 实例暂停。确保同时只有一个视频在播放
3. 使用 `hls.js` 库，不支持时回退到原生 `<video>`（Safari 原生支持 HLS）

### Mobile 现状

ArticleCard 中的 `<Video>` 组件直接渲染，没有 clickToPlay 模式，也没有跨组件协调。

### 迁移方案

`useVideoPlayback` hook 将来可以添加跨卡片协调功能：

```typescript
// useVideoPlayback.ts — 未来可加
// 使用全局事件或 Context 通知其他卡片暂停
// 但需要先通过 `useVideoPlayback` 提取状态
```

---

## 11. SSR 水合管理

### Web 实现

[`page.client.tsx:132-165`](/Volumes/MySSD/work/JoyMini_Nest_Monorepo/apps/frontend-blog/src/app/[locale]/page.client.tsx:132)

```typescript
const [isHydrated, setIsHydrated] = useState(false);
const initialSeedDone = useRef(false);

useEffect(() => {
  setIsHydrated(true);
}, []);

// 双重检查防止 SSR → CSR 过渡时的重复请求
if (!isHydrated && !initialSeedDone.current) {
  initialSeedDone.current = true;
  // 用服务端初始数据，不发起新请求
}
```

**解决的问题**：Next.js SSR 先渲染静态 HTML，然后客户端水合（hydration）。如果 useEffect 直接发请求，会和 SSR 数据竞争，导致重复请求。

### Mobile 现状

RN 没有 SSR，所以不需要。但是要注意：
- RTK Query 的缓存机制 — 数据从缓存加载是同步的，不会闪烁
- 当前实现已用 `useState(() => articlesData?.items ?? [])` 初始化，避免了首次渲染的空状态

---

## 12. URL 状态同步

### Web 实现

[`page.client.tsx:212-228`](/Volumes/MySSD/work/JoyMini_Nest_Monorepo/apps/frontend-blog/src/app/[locale]/page.client.tsx:212)

```typescript
useEffect(() => {
  const params = new URLSearchParams();
  if (selectedCategoryId) params.set('category', selectedCategoryId);
  if (page > 1) params.set('page', String(page));
  router.replace(`?${params.toString()}`, { scroll: false });
}, [selectedCategoryId, page, router]);
```

**好处**：
- 支持浏览器前进/后退
- 支持分享当前分类+页码的 URL
- 刷新页面保留状态

### Mobile 现状

- 使用本地 React state
- 分类切换不更新导航 URL
- 但移动端不需要这个模式 — 没有 URL 地址栏，没有浏览器导航

---

## 13. 防抖分类切换 + View Transitions

### Web 实现

[`page.client.tsx:416-447`](/Volumes/MySSD/work/JoyMini_Nest_Monorepo/apps/frontend-blog/src/app/[locale]/page.client.tsx:416)

```typescript
const handleCategoryChange = useCallback(
  (categoryId?: string) => {
    if (categoryDebounceRef.current) {
      clearTimeout(categoryDebounceRef.current);
    }
    setLoadMoreLoading(false);
    setLoadMoreError(false);
    // 清除当前动画...
    categoryDebounceRef.current = setTimeout(() => {
      // document.startViewTransition 实现平滑过渡动画
      document.startViewTransition(() => {
        setSelectedCategoryId(categoryId ?? null);
        setPage(1);
        // ...
      });
    }, 300);
  },
  []
);
```

### Mobile 现状

[`HomeScreen.tsx:210-218`](../../src/screens/HomeScreen.tsx:210)

```typescript
const handleCategoryChange = useCallback((categoryId: string | null) => {
  if (debounceRef.current) {
    clearTimeout(debounceRef.current);
  }
  debounceRef.current = setTimeout(() => {
    setSelectedCategoryId(categoryId);
    setPage(1);
    setAllArticles([]);
  }, DEBOUNCE_MS);
}, []);
```

**差异**：移动端没有 View Transitions API，但有相同的 300ms 防抖逻辑。

---

## 14. 加载更多按钮

### Web 实现

[`LoadMore.tsx:17`](/Volumes/MySSD/work/JoyMini_Nest_Monorepo/apps/frontend-blog/src/components/blog/LoadMore.tsx:17)

Web 端使用**用户点击的「Load More」按钮**，而不是无限滚动。

原因：
- SEO 友好（链接可索引）
- 用户可以主动控制何时加载更多
- 配合底部 sentinel 预取（用户还没点，数据已经预取好了）

### Mobile 现状

使用 **FlatList 的 `onEndReached`** 自动加载更多。这是移动端的最佳实践。

**不需要改**。移动端和 Web 端的交互模式不同。

---

## 总结：迁移优先级

| 优先级 | 模式 | 难度 | 影响 |
|--------|------|------|------|
| 🅿️ P0 | `getOptimizedImageUrl()` | 低 | 减少图片流量 30-50% |
| 🅿️ P0 | `AppImage` 组件 | 中 | 统一图片加载 |
| 🅿️ P0 | `useVideoPlayback` hook | 低 | 解耦视频逻辑 |
| 🅿️ P1 | `networkQuality` + `priority` | 低 | LCP 优化 |
| 🅿️ P1 | 图片预取 `useImagePrefetch` | 中 | 减少图片加载时间 |
| 🅿️ P2 | IntersectionObserver 预测预取 | 高 | 进一步提升体验 |
| 🅿️ P3 | Blurhash 占位图 | 高 | 需要原生模块 |
| 🅿️ P3 | 跨卡片视频协调 | 中 | 防止多个视频同时播放 |
