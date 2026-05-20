# Share Optimization Plan

## Problem

[`shareArticle()`](src/lib/utils/share.ts:48) has a **double popup** bug:

1. First `RNShare.open({ url: imageUrl })` — shows article image
2. Falls through to second `RNShare.open({ url: shareUrl })` — shows image + text

Two consecutive share sheet popups.

## Root Cause

Fallback logic: if first `RNShare.open()` succeeds, second one still opens because the catch block falls through.

## Solution

Following the same pattern as the Flutter version — share **URL only**, no image download.

**Flutter reference** ([`ShareService.openSystemOrSheet`](https://github.com/user/flutter-app/blob/main/features/share/services/share_service.dart)):

```dart
// Just share the URL — social platforms scrape OG tags
await Share.shareUri(Uri.parse(d.url));
```

### Changes to [`src/lib/utils/share.ts`](src/lib/utils/share.ts)

| Change                                            | Reason                        |
| ------------------------------------------------- | ----------------------------- |
| Remove `getShareImageUrl()` function              | No image URL needed           |
| Remove `getArticleImageUrl`, `isVideoUrl` imports | Unused                        |
| Remove `imageUrl` branch (`if (imageUrl)`)        | Eliminates double popup       |
| Single `RNShare.open({ url: shareUrl })`          | One popup, shares article URL |

### Final Code

```typescript
import RNShare from 'react-native-share';
import { env } from '@/lib/env';
import type { FrontendArticle } from '@/types/frontend-blog';

export async function shareArticle(
  article: FrontendArticle,
  locale?: string,
): Promise<void> {
  const lang = locale || env.DEFAULT_LOCALE;
  const shareUrl = `${env.WEB_URL}/${lang}/articles/${article.slug}`;
  const message = `${article.title}\n\n${article.excerpt || ''}\n\n${shareUrl}`;

  await RNShare.open({
    url: shareUrl,
    title: article.title,
    message,
    subject: article.title,
    showAppsToView: true,
  });
}
```

### Behavior

| Aspect              | Before                       | After                     |
| ------------------- | ---------------------------- | ------------------------- |
| Share sheet popups  | Twice (image → fallback)     | Once                      |
| Share sheet preview | Varies by popup              | Link preview from OG tags |
| WhatsApp preview    | Logo (image URL not scraped) | OG image from blog HTML   |
| Image download      | Yes (delay)                  | No (instant)              |
