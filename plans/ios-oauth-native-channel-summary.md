# iOS OAuth Native Channel — 完整原理解析

## 概述

本 App（FrontendBlogMobile）的第三方登录（Google / Facebook / Apple）采用 **后端重定向 OAuth 流程**，不集成任何第三方原生 SDK（如 Google Sign-In SDK、Facebook SDK）。所有 OAuth 交互通过 **iOS 系统框架 `AuthenticationServices`** 完成。

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐     ┌──────────────┐
│  AuthScreen.tsx  │────▶│  useOAuth.ts      │────▶│ ASAuthSession    │────▶│ iOS System    │
│  (React 组件)    │     │  (JS Hook)        │     │ (Swift 原生模块)  │     │ ASWebAuth-    │
│                  │     │                   │     │                  │     │ entication    │
│                  │     │                   │     │                  │     │ Session       │
└─────────────────┘     └──────────────────┘     └──────────────────┘     └──────┬───────┘
                                                                                 │
                                                                                 ▼
                                                                        ┌──────────────────┐
                                                                        │ Backend Server   │
                                                                        │ dev-api.joyminis │
                                                                        │ .com/auth/google │
                                                                        │ /login           │
                                                                        └──────────────────┘
```

---

## 架构分层（从 JS 到原生 iOS）

### Layer 1: React 组件层 — [`AuthScreen.tsx`](src/screens/AuthScreen.tsx)

用户点击 Google 按钮 → 触发 `handleGoogleLogin`

```tsx
const handleGoogleLogin = useCallback(async () => {
  try {
    setIsOAuthLoading(true);
    setError(null);
    await loginGoogle();          // ← 调用 useOAuth hook
    navigation.goBack();          // ← 成功后返回主页面
  } catch (err: any) {
    if (err?.code !== 'CANCELLED') {    // ← 只捕获非取消的错误
      setError(err?.message || t('auth.oauth.googleFailed'));
    }
  } finally {
    setIsOAuthLoading(false);
  }
}, [loginGoogle, navigation, t]);
```

**关键知识点：**
- `err?.code !== 'CANCELLED'` — 检查原生模块返回的 `code` 属性，而不是 `message`。因为 Swift 的 `rejectBlock` 第一个参数是 `code`（如 `"CANCELLED"`、`"AUTH_ERROR"`）。
- 同理适用于 Facebook 和 Apple 按钮（三个 handler 结构相同）。

---

### Layer 2: JS Hook 层 — [`useOAuth.ts`](src/lib/hooks/useOAuth.ts)

负责构建 OAuth URL、调用原生模块、解析回调、获取用户信息。

```tsx
export function useOAuth() {
  const dispatch = useAppDispatch();

  const loginWithProvider = useCallback(async (provider: OAuthProvider) => {
    // Step 1: 构建后端 OAuth 发起 URL
    const config = oauthProviders[provider];
    const authUrl = config.getAuthorizationUrl();
    // 结果: https://dev-api.joyminis.com/auth/google/login
    //       ?callback=tarsier%3A%2F%2Foauth%2Fcallback
    //       &platform=ios&client=mobile

    let callbackUrl: string;

    if (Platform.OS === 'ios') {
      // Step 2 (iOS): 调用原生 Swift 模块
      callbackUrl = await NativeModules.ASAuthSession.startAuth(
        authUrl,        // 要打开的 URL
        'tarsier',      // callback URL scheme
        true,           // prefersEphemeralSession
      );
    } else {
      // Android: 使用 Linking API + Chrome Custom Tabs
      callbackUrl = await openAuthSessionAndroid(authUrl);
    }

    // Step 3: 从回调 URL 解析 token
    // 回调 URL 格式: tarsier://oauth/callback?token=xxx&refreshToken=yyy
    const params = parseQueryParams(callbackUrl);
    const accessToken = params.token;
    const refreshToken = params.refreshToken;

    // Step 4: 用 accessToken 获取用户信息
    const user = await fetchProfile(accessToken);
    // GET https://dev-api.joyminis.com/api/v1/auth/profile
    // Authorization: Bearer <accessToken>

    // Step 5: 保存到 Redux + MMKV
    dispatch(setCredentials({ user, accessToken, refreshToken }));
  }, [dispatch]);

  return { loginGoogle, loginFacebook, loginApple };
}
```

**关键知识点：**
- `Platform.OS === 'ios'` 判断平台，iOS 走原生模块，Android 走 `Linking` API
- `NativeModules.ASAuthSession` — React Native 自动桥接 Swift 模块到 JS
- `parseQueryParams()` — 手动解析 URL 中的 query 参数
- `fetchProfile()` — 使用原生 `fetch` (不是 RTK Query)，因为此时 token 还未存入 Redux

**`fetchProfile` 函数：**

```tsx
async function fetchProfile(accessToken: string) {
  const response = await fetch(`${env.API_URL}/api/v1/auth/profile`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch profile: ${response.status}`);
  }
  const json = await response.json();
  return json.data ?? json;
}
```

> **注意：** 这里的 URL 是 `/api/v1/auth/profile`，不是 `/api/v1/frontend/auth/me`！之前写错了导致 404。

---

### Layer 3: OAuth 配置层 — [`config.ts`](src/lib/oauth/config.ts)

```tsx
export const CALLBACK_URL = 'tarsier://oauth/callback';

function buildAuthorizationUrl(provider: string): string {
  const params = new URLSearchParams({
    callback: CALLBACK_URL,
    platform: Platform.OS,    // 'ios' 或 'android'
    client: 'mobile',
  });
  return `${env.API_URL}/auth/${provider}/login?${params.toString()}`;
}
```

生成的 URL 示例：
```
https://dev-api.joyminis.com/auth/google/login?callback=tarsier%3A%2F%2Foauth%2Fcallback&platform=ios&client=mobile
```

**参数含义：**
| 参数 | 值 | 说明 |
|------|-----|------|
| `callback` | `tarsier://oauth/callback` | 用户认证成功后，后端重定向到此 URL，并带上 token |
| `platform` | `ios` 或 `android` | 让后端知道是什么平台 |
| `client` | `mobile` | 区分 Web 和 Mobile 请求 |

---

### Layer 4: 原生桥梁 — [`ASAuthSession.m`](ios/ASAuthSession.m)

Objective-C 桥接头文件，告诉 React Native 有一个名为 `ASAuthSession` 的原生模块：

```objc
#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(ASAuthSession, NSObject)

RCT_EXTERN_METHOD(startAuth:(NSString *)url
                  callbackUrlScheme:(NSString *)callbackUrlScheme
                  prefersEphemeralSession:(BOOL)prefersEphemeralSession
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
```

**关键知识点：**
- `RCT_EXTERN_MODULE` — 注册一个 Swift 类为 React Native 原生模块
- `RCT_EXTERN_METHOD` — 暴露一个方法给 JS 调用
- 参数类型映射：`NSString` ↔ `string`，`BOOL` ↔ `boolean`
- `RCTPromiseResolveBlock` / `RCTPromiseRejectBlock` — Promise 的 resolve/reject 回调

---

### Layer 5: Swift 原生实现 — [`ASAuthSession.swift`](ios/ASAuthSession.swift)

这是最核心的部分，包装了 iOS 系统的 `ASWebAuthenticationSession`。

```swift
import AuthenticationServices
import React
import UIKit

@objc(ASAuthSession)
class ASAuthSession: RCTEventEmitter, ASWebAuthenticationPresentationContextProviding {

  private var session: ASWebAuthenticationSession?
  private var resolveBlock: RCTPromiseResolveBlock?
  private var rejectBlock: RCTPromiseRejectBlock?

  @objc
  func startAuth(
    _ url: String,
    callbackUrlScheme: String,
    prefersEphemeralSession: Bool,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    // 1. 验证 URL 有效
    guard let authURL = URL(string: url) else {
      reject("INVALID_URL", "Invalid authorization URL", nil)
      return
    }

    self.resolveBlock = resolve
    self.rejectBlock = reject

    // 2. 创建 ASWebAuthenticationSession
    session = ASWebAuthenticationSession(
      url: authURL,
      callbackURLScheme: callbackUrlScheme,
      completionHandler: { [weak self] callbackURL, error in
        // 这个闭包在两种情况下触发:
        //   a. 用户取消登录
        //   b. 后端重定向回 callback URL
        guard let self = self else { return }

        if let error = error as? ASWebAuthenticationSessionError {
          switch error.code {
          case .canceledLogin:
            // 用户手动取消 (滑下关闭)
            self.rejectBlock?("CANCELLED", "User cancelled login", nil)
          default:
            // 其他系统错误
            self.rejectBlock?("AUTH_ERROR", error.localizedDescription, error)
          }
          return
        }

        if let callbackURL = callbackURL {
          // 成功! 后端重定向回来了
          self.resolveBlock?(callbackURL.absoluteString)
        } else {
          self.rejectBlock?("NO_CALLBACK", "No callback URL received", nil)
        }
      }
    )

    // 3. 配置: 不共享 Safari cookies
    session?.prefersEphemeralWebBrowserSession = prefersEphemeralSession

    // 4. [必须] 告诉 iOS 从哪个窗口弹出登录界面
    session?.presentationContextProvider = self

    // 5. 在主线程启动
    DispatchQueue.main.async { [weak self] in
      self?.session?.start()
    }
  }

  // 实现 ASWebAuthenticationPresentationContextProviding 协议
  func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
    // 找到当前活跃的窗口
    if let windowScene = UIApplication.shared.connectedScenes
      .first(where: { $0.activationState == .foregroundActive }) as? UIWindowScene,
      let window = windowScene.windows.first(where: { $0.isKeyWindow })
    {
      return window
    }
    return UIWindow()
  }
}
```

---

## ASWebAuthenticationSession 详解

### 什么是 ASWebAuthenticationSession？

iOS 12+ 引入的**系统级 OAuth 浏览器**。它在 App 上层显示一个 **SFSafariViewController** 风格的浏览器遮盖层，用于 OAuth 登录。

特点：
- ✅ **App 内体验** — 用户不会离开 App
- ✅ **无 Cookie 共享** — 和 Safari 浏览器隔离（`prefersEphemeralWebBrowserSession = true`）
- ✅ **自动拦截回调** — 当后端重定向到 `tarsier://...` 时，iOS 自动捕获
- ❌ **无 Cookie 共享** — 如果 `prefersEphemeralSession = true`，则完全不共享任何浏览器数据

### 生命周期

```
JS 调用 startAuth(url, scheme, ephemeral)
  │
  ▼
Swift 创建 ASWebAuthenticationSession
  │
  ▼
iOS 弹出浏览器遮盖层 → 用户看到登录页面
  │
  ├── 用户取消 (滑下关闭)
  │     └── completionHandler 触发, error.code == .canceledLogin
  │         └── rejectBlock("CANCELLED", ...)
  │
  ├── 后端重定向回 tarsier://oauth/callback?token=xxx
  │     └── completionHandler 触发, callbackURL != nil
  │         └── resolveBlock(callbackURL.absoluteString)
  │
  └── 系统错误 (如网络问题)
        └── completionHandler 触发, error != nil
            └── rejectBlock("AUTH_ERROR", ...)
```

### 关于 presentationContextProvider (iOS 13+ 必须)

iOS 13+ 要求设置 `presentationContextProvider`，否则会立即报错：
```
The operation couldn't be completed.
(com.apple.AuthenticationServices.WebAuthenticationSession error 2.)
```
错误码 **2** = **`presentationContextNotProvided`**

**为什么需要这个？** iOS 13 引入了多窗口支持（iPad），所以 iOS 需要明确知道从哪个窗口弹出认证界面。

**如何实现：**
1. 类声明添加 `ASWebAuthenticationPresentationContextProviding` 协议
2. 实现 `presentationAnchor(for:)` 方法
3. 设置 `session.presentationContextProvider = self`

```swift
class ASAuthSession: RCTEventEmitter, ASWebAuthenticationPresentationContextProviding {
  // ...
  session?.presentationContextProvider = self
  // ...
  func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
    // 从 UIApplication 找 keyWindow
    let windowScene = UIApplication.shared.connectedScenes
      .first(where: { $0.activationState == .foregroundActive }) as? UIWindowScene
    let window = windowScene?.windows.first(where: { $0.isKeyWindow })
    return window ?? UIWindow()
  }
}
```

---

## 完整数据流

```
┌─────────────────────────────────────────────────────────────────────────┐
│ AuthScreen.tsx                                                          │
│                                                                         │
│  handleGoogleLogin()                                                    │
│    ├─ setIsOAuthLoading(true)                                           │
│    ├─ setError(null)                                                    │
│    └─ await loginGoogle()                                               │
└──────────────────────┬──────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ useOAuth.ts                                                             │
│                                                                         │
│  loginWithProvider('google')                                            │
│    ├─ authUrl = oauthProviders.google.getAuthorizationUrl()             │
│    │     = https://dev-api.joyminis.com/auth/google/login               │
│    │       ?callback=tarsier%3A%2F%2Foauth%2Fcallback                   │
│    │       &platform=ios&client=mobile                                  │
│    │                                                                     │
│    └─ NativeModules.ASAuthSession.startAuth(authUrl, 'tarsier', true)   │
└──────────────────────┬──────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ ASAuthSession.swift (iOS 原生)                                          │
│                                                                         │
│  1. URL(string: url) → 验证 URL                                         │
│  2. ASWebAuthenticationSession(url, callbackURLScheme, completion)      │
│  3. session.prefersEphemeralWebBrowserSession = true                    │
│  4. session.presentationContextProvider = self      ← 必须设置!         │
│  5. DispatchQueue.main.async { session?.start() }                      │
└──────────────────────┬──────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ iOS 系统弹出 SFSafariViewController 遮盖层                               │
│                                                                         │
│  用户看到: https://dev-api.joyminis.com/auth/google/login               │
│  → 后端重定向到 Google 登录页                                            │
│  → 用户输入 Google 账号密码                                              │
│  → Google 重定向回后端                                                    │
│  → 后端创建/查找用户，生成 token                                           │
│  → 后端重定向到 tarsier://oauth/callback?token=xxx&refreshToken=yyy     │
└──────────────────────┬──────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ ASAuthSession.swift 收到回调                                             │
│                                                                         │
│  completionHandler(callbackURL, nil)                                    │
│    → resolveBlock?(callbackURL.absoluteString)                         │
│    → JS Promise resolves                                               │
└──────────────────────┬──────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ useOAuth.ts (继续)                                                      │
│                                                                         │
│  callbackUrl = "tarsier://oauth/callback?token=xxx&refreshToken=yyy"    │
│                                                                         │
│  params = parseQueryParams(callbackUrl)                                 │
│    → { token: "xxx", refreshToken: "yyy" }                              │
│                                                                         │
│  user = await fetchProfile(token)                                       │
│    → GET https://dev-api.joyminis.com/api/v1/auth/profile              │
│    → Authorization: Bearer xxx                                          │
│    → Response: { id, email, nickname, avatar }                          │
│                                                                         │
│  dispatch(setCredentials({ user, accessToken, refreshToken }))          │
└──────────────────────┬──────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ AuthScreen.tsx (继续)                                                   │
│                                                                         │
│  ✅ loginGoogle() 成功                                                  │
│  → navigation.goBack()   ← 返回主页面                                   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 各文件的对应关系

| 文件 | 作用 | 关键内容 |
|------|------|----------|
| [`src/screens/AuthScreen.tsx`](src/screens/AuthScreen.tsx) | UI 层 — 用户点击按钮 | `handleGoogleLogin`, `handleFacebookLogin`, `handleAppleLogin` |
| [`src/lib/hooks/useOAuth.ts`](src/lib/hooks/useOAuth.ts) | 业务逻辑层 — 控制 OAuth 流程 | `loginWithProvider`, `fetchProfile`, `parseQueryParams` |
| [`src/lib/oauth/config.ts`](src/lib/oauth/config.ts) | 配置层 — URL 构建 | `buildAuthorizationUrl`, `CALLBACK_URL`, `oauthProviders` |
| [`src/lib/env.ts`](src/lib/env.ts) | 环境配置 | `API_URL` (开发/生产) |
| [`ios/ASAuthSession.swift`](ios/ASAuthSession.swift) | 原生层 — iOS 平台实现 | `ASWebAuthenticationSession` 封装 |
| [`ios/ASAuthSession.m`](ios/ASAuthSession.m) | 原生桥接 — 注册模块给 JS | `RCT_EXTERN_MODULE`, `RCT_EXTERN_METHOD` |
| [`ios/FrontendBlogMobile/Info.plist`](ios/FrontendBlogMobile/Info.plist) | App 配置 — URL Scheme 注册 | `CFBundleURLSchemes` → `tarsier` |

---

## 常见问题 (FAQ)

### Q: 为什么不用 Google Sign-In SDK？
A: 后端重定向模式更简单 — 不需要管理各平台的 SDK 配置（client ID、API key 等），所有 OAuth 逻辑在后端统一处理。

### Q: `prefersEphemeralWebBrowserSession = true` 有什么用？
A: 不共享 Safari 的 cookies，每次登录都是"干净"的，不会受到之前登录状态的影响。适合需要明确切换账号的场景。

### Q: 什么情况下会报 `error 2`？
A: iOS 13+ 没有设置 `presentationContextProvider`。会导致浏览器无法弹出，直接显示错误。

### Q: 什么是 `tarsier://` 协议？
A: 自定义 URL Scheme，在 Info.plist 中注册。当后端重定向到 `tarsier://...` 时，iOS 知道应该唤醒本 App 来处理。

### Q: Android 端是怎么实现的？
A: 使用 React Native 的 `Linking.openURL()` 启动 Chrome Custom Tabs，通过 `Linking.addEventListener('url', ...)` 监听回调。不用 Swift 模块。

### Q: 为什么 `fetchProfile` 用原生 `fetch` 而不是 RTK Query？
A: 因为 OAuth 登录成功后，token 还不在 Redux store 中，`fetchBaseQuery` 的 `prepareHeaders` 无法自动注入 Authorization header。所以用 `fetch` 手动设置。
