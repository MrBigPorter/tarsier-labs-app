# Share URL Configuration Plan

## Context

The user wants to configure the RN app's share URL to use `https://blog-dev.joyminis.com` for now (development), and later switch to `https://blog.joyminis.com` (production).

## Current State

| Config | Current `WEB_URL` | Should Be |
|--------|------------------|-----------|
| `DEV_CONFIG` (used when `__DEV__ = true`) | `https://dev.tarsier.app` | `https://blog-dev.joyminis.com` |
| `PROD_CONFIG` (used when `__DEV__ = false`, i.e. release builds) | `https://blog.joyminis.com` | ✅ Already correct |

## Where `WEB_URL` is used

1. **Share utility** — [`src/lib/utils/share.ts:67`](../src/lib/utils/share.ts:67)
   ```ts
   const shareUrl = `${env.WEB_URL}/${lang}/articles/${article.slug}`;
   ```
   This builds the URL shared via the native share sheet. Will automatically pick up the new `WEB_URL` value.

2. **Deep linking** — [`src/navigation/RootNavigator.tsx:252`](../src/navigation/RootNavigator.tsx:252)
   ```ts
   prefixes: ['tarsier://', env.WEB_URL],
   ```
   Used by React Navigation to handle incoming universal links. Will also automatically pick up the new value.

3. **iOS Entitlements** — [`ios/FrontendBlogMobile/FrontendBlogMobile.entitlements`](../ios/FrontendBlogMobile/FrontendBlogMobile.entitlements) (line 7)
   ```xml
   <string>applinks:blog.joyminis.com</string>
   ```
   ⚠️ If you need universal links to also work with `blog-dev.joyminis.com` during development, you would need to add `applinks:blog-dev.joyminis.com` here as well. However, this is **not required** for the share URL change — only if you want deep linking from the dev blog domain to open the app.

## Changes Required

### 1. Primary: Update `DEV_CONFIG.WEB_URL` in `src/lib/env.ts`

**File**: [`src/lib/env.ts:32`](../src/lib/env.ts:32)

**Change**:
```diff
 const DEV_CONFIG: EnvConfig = {
   API_URL: 'https://dev-api.joyminis.com',
-  WEB_URL: 'https://dev.tarsier.app',
+  WEB_URL: 'https://blog-dev.joyminis.com',
   SENTRY_DSN: '',
   DEFAULT_LOCALE: 'en',
   ENABLE_ANALYTICS: false,
```

**`PROD_CONFIG`** at line 43 already has `WEB_URL: 'https://blog.joyminis.com'` — no change needed.

### 2. Optional: Add dev domain to iOS Entitlements

If you want universal links to also open from `blog-dev.joyminis.com` during development, add to [`ios/FrontendBlogMobile/FrontendBlogMobile.entitlements`](../ios/FrontendBlogMobile/FrontendBlogMobile.entitlements:7):

```diff
 <key>com.apple.developer.associated-domains</key>
 <array>
+  <string>applinks:blog-dev.joyminis.com</string>
   <string>applinks:blog.joyminis.com</string>
 </array>
```

Note: This also requires the server-side AASA file to be deployed at `https://blog-dev.joyminis.com/.well-known/apple-app-site-association`.

## How Environment Switching Works

The app uses the `__DEV__` global injected by Metro:

- **Metro dev server** (`yarn start` / `make dev`): `__DEV__ = true` → uses `DEV_CONFIG` → `WEB_URL = 'https://blog-dev.joyminis.com'`
- **Release build** (Archive / App Store): `__DEV__ = false` → uses `PROD_CONFIG` → `WEB_URL = 'https://blog.joyminis.com'`

No manual switching needed — it's automatic based on build type.

## Verification

After the change:
1. Run `make dev-ios` or `make dev-android`
2. Share any article
3. The shared URL should be `https://blog-dev.joyminis.com/{locale}/articles/{slug}`
4. When building a release (`make release-ios`), the share URL will be `https://blog.joyminis.com/{locale}/articles/{slug}`

## Later: Switching to Production

When ready to go live, no RN code changes are needed — `PROD_CONFIG` already points to `https://blog.joyminis.com`. Simply build a release archive and distribute.
