# Android Google Play 上架计划

> 项目: frontend-blog-mobile (Tarsier)
> 状态: 准备首次上架 Google Play
> 包名: `com.tarsier.labs`
> 签名方式: Google Play App Signing

---

## 总览

当前应用基本功能完整，但存在若干 **阻塞性问题** 需要解决才能通过 Google Play 审核。以下按优先级列出了所有需要完成的工作。

---

## 🔴 第一阶段：代码层面修改（必须）

### 1. 更改 Package Name 为 `com.tarsier.labs`

**涉及文件：**

- [`android/app/build.gradle:90`](../android/app/build.gradle:90) — `applicationId "com.frontendblogmobile"` → 改为 `com.tarsier.labs`
- [`android/app/src/main/AndroidManifest.xml:1`](../android/app/src/main/AndroidManifest.xml:1) — `package` 改为 `com.tarsier.labs`
- [`android/app/src/main/java/com/frontendblogmobile/`](../android/app/src/main/java/com/frontendblogmobile/) — 整个目录结构需要重命名
- `MainActivity.kt` 和 `MainApplication.kt` 中的 `package com.frontendblogmobile` → 改为 `com.tarsier.labs`

**操作步骤：**

1. 在 `android/app/build.gradle` 中将 `applicationId` 改为 `com.tarsier.labs`
2. 将 `android/app/src/main/java/com/frontendblogmobile/` 目录重命名为 `android/app/src/main/java/com/tarsier/labs/`
3. 更新 `MainActivity.kt` 和 `MainApplication.kt` 中的 `package` 声明为 `com.tarsier.labs`
4. 更新 `AndroidManifest.xml` 中的 `package` 属性为 `com.tarsier.labs`

> ⚠️ **首次上传后不可更改！** 必须在第一次提交 AAB 前完成。iOS 端已有的 `CFBundleURLName` 是 `com.tarsier.blog`，后续也可以统一对齐。

### 2. 移除不必要的权限声明

**涉及文件：**

- [`android/app/src/main/AndroidManifest.xml:3-9`](../android/app/src/main/AndroidManifest.xml:3)

**需要移除的权限：**

```xml
<!-- 删除以下行 -->
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
```

**保留的权限：**

- `INTERNET` — 必需，API 通信
- `POST_NOTIFICATIONS` — 推送通知（Android 13+）
- `VIBRATE` — 触觉反馈

> ⚠️ Google Play 会审核权限是否被代码实际使用，未使用的权限可能导致拒审。

### 3. 配置 Release 签名（Google Play App Signing）

**涉及文件：**

- [`android/app/build.gradle:96-103`](../android/app/build.gradle:96) — signingConfigs 区块
- [`android/app/build.gradle:112-121`](../android/app/build.gradle:112) — buildTypes.release 区块

**操作步骤：**

1. 创建上传密钥 (Upload Key)：
   ```bash
   keytool -genkey -v -storetype PKCS12 \
     -keystore release-upload-key.keystore \
     -alias upload-key \
     -keyalg RSA -keysize 2048 \
     -validity 10000
   ```
2. 将 `release-upload-key.keystore` 放在 `android/app/` 目录下（**不要提交到 Git**）
3. 创建 `android/app/keystore.properties` 文件（**不要提交到 Git**）：
   ```properties
   storeFile=release-upload-key.keystore
   storePassword=your-password
   keyAlias=upload-key
   keyPassword=your-password
   ```
4. 在 `android/app/build.gradle` 中添加 release signing 配置：
   ```gradle
   signingConfigs {
       debug { /* 保持现状 */ }
       release {
           if (project.hasProperty('KEYSTORE_FILE')) {
               storeFile file(KEYSTORE_FILE)
               storePassword KEYSTORE_PASSWORD
               keyAlias KEY_ALIAS
               keyPassword KEY_PASSWORD
           }
       }
   }
   ```
5. 将 `buildTypes.release.signingConfig` 改为 `signingConfigs.release`

### 4. 更新版本号

**涉及文件：**

- [`android/app/build.gradle:93-94`](../android/app/build.gradle:93)

```gradle
defaultConfig {
    versionCode 1        // 每次上传递增
    versionName "1.0.0"  // 语义化版本号
}
```

### 5. 启用 ProGuard（可选但推荐）

**涉及文件：**

- [`android/app/build.gradle:68`](../android/app/build.gradle:68)

```gradle
def enableProguardInReleaseBuilds = true
```

并确保 `proguard-rules.pro` 包含了所有必要的 keep 规则（已配置 ExoPlayer/react-native-video）。

### 6. 添加 Adaptive Icon（自适应图标）

**需要创建的文件：**

- `android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml`
- `android/app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml`
- `android/app/src/main/res/drawable/ic_launcher_background.xml`（纯色背景）
- `android/app/src/main/res/drawable/ic_launcher_foreground.xml`（应用图标前景，SVG/Vector）

Adaptive Icon 在 Android 8+ (API 26+) 上显示为自适应形状，建议添加以获得更好的用户体验。

### 7. 屏幕方向限制（建议）

**涉及文件：**

- [`android/app/src/main/AndroidManifest.xml:23`](../android/app/src/main/AndroidManifest.xml:23)

在 `<activity>` 标签中添加：

```xml
android:screenOrientation="portrait"
```

与 iOS 保持一致（iOS 限制 iPhone 为竖屏）。

---

## 🟡 第二阶段：配置与密钥

### 8. 配置 Sentry DSN

**涉及文件：**

- [`src/lib/env.ts:44`](../src/lib/env.ts:44)

```typescript
const PROD_CONFIG: EnvConfig = {
  // ...
  SENTRY_DSN: 'https://your-dsn@sentry.io/your-project',
  // ...
};
```

**操作步骤：**

1. 在 [sentry.io](https://sentry.io) 创建项目
2. 获取 React Native 项目的 DSN
3. 更新 `src/lib/env.ts` 中的 `PROD_CONFIG.SENTRY_DSN`

### 9. 配置 OAuth Client ID

**涉及文件：**

- [`src/lib/env.ts:48-49`](../src/lib/env.ts:48)

```typescript
const PROD_CONFIG: EnvConfig = {
  // ...
  OAUTH_GOOGLE_CLIENT_ID: 'your-google-client-id',
  OAUTH_APPLE_CLIENT_ID: 'your-apple-client-id',
  // ...
};
```

### 10. 托管隐私政策到公开 URL

- 将隐私政策内容部署到 `https://blog.joyminis.com/privacy`
- 可以在 Web 前端添加一个 `/privacy` 路由，复用应用内隐私内容
- 或者在 API 端创建一个静态页面
- Google Play Console 中需要填入此 URL

---

## 🟢 第三阶段：Google Play Console 操作

### 11. 在 Google Play Console 创建应用

1. 前往 [play.google.com/console](https://play.google.com/console)
2. 创建新应用，选择 **应用 (App)** 类型
3. 名称：`Tarsier`（或最终确定的应用名称）
4. 语言：默认选择（可添加多语言）
5. 应用或游戏：应用
6. 免费或付费：免费

### 12. 设置 Google Play App Signing

1. 在 Play Console → **Setup** → **App Integrity**
2. 选择 **Google Play App Signing** 选项
3. 上传上面生成的 **Upload Key** 公钥证书
4. Google 会生成并管理最终签名密钥

### 13. Fill in Store Listing

**Required content:**

- **App description** (Short description: max 80 characters; Full description: max 4000 characters)
- **Screenshots** (at least 2 phone screenshots, 6-8 recommended)
  - Size: 16:9 or 9:16
  - Generate using Android emulator
- **Feature Graphic** (1024x500px)
- **Category**: News & Magazines or Books & Reference
- **Tags**: blog, reading, tech

### 14. Set up Data Safety

Google Play requires you to declare what data your app collects and shares.

**Based on code analysis:**

- ✅ **Account info** (email, username) — OAuth login
- ✅ **App activity** (browsing history, bookmarks, likes)
- ✅ **App info & performance** (Sentry crash reports)
- ❌ Location — not collected
- ❌ Photos / Media — not collected
- ❌ Device ID — Sentry may collect (confirm)

### 15. Set up Content Rating

Complete the Google Play content rating questionnaire:

- Expected rating: **Everyone** or **Teen**
- Blog content, no adult material

### 16. Set up Pricing & Distribution

- Free app
- Select distribution countries (default: all)
- Confirm no ads (no ad SDK found in codebase, select "No")

### 17. Set up Testers

- Closed Testing is required before production release for new accounts
- Google Play requires: **20 testers for 14 days** (unless you have a Managed Publishing exception)
- Recommendation: start with Internal Testing, then promote to Closed Testing

### 18. Build AAB & Upload

```bash
# Switch to production environment
make env-prod

# Build AAB
make build-android

# Output
# android/app/build/outputs/bundle/release/app-release.aab
```

---

## 📋 Execution Order Summary

| #     | Task                                               | Type     | Est. Files |
| ----- | -------------------------------------------------- | -------- | ---------- |
| 1     | Change package name to `com.tarsier.labs`          | Code     | ~5         |
| 2     | Remove unused permissions (CAMERA, LOCATION)       | Code     | 1          |
| 3     | Create Upload Key + configure Release signing      | Config   | 2          |
| 4     | Update version (versionCode 1, versionName 1.0.0)  | Code     | 1          |
| 5     | Enable ProGuard                                    | Code     | 1          |
| 6     | Add Adaptive Icon                                  | Assets   | ~4         |
| 7     | Restrict screen orientation (portrait)             | Code     | 1          |
| 8     | Configure Sentry DSN                               | Config   | 1          |
| 9     | Configure OAuth Client ID                          | Config   | 1          |
| 10    | Deploy privacy policy to blog.joyminis.com/privacy | External | -          |
| 11-17 | Google Play Console setup                          | External | -          |
| 18    | Build AAB & upload                                 | Build    | -          |

---

## ⚠️ Important Notes

1. **Package name is irreversible** — once uploaded to Play Console, it can never be changed
2. **Key security** — Upload Key must be backed up; without it you cannot update the app
3. **Closed Testing** — new developer accounts require 14 days of testing before production
4. **API review** — if your API returns user-generated content, additional review may be required
5. **Android 16 (SDK 36)** — ensure all dependency libraries are compatible with targetSdk 36

---

## 附录：CI/CD Google Play Internal Testing 自动发布

> 已配置 GitHub Actions 自动构建并直接上传到 Google Play Console Internal Testing 轨道

### ✅ 已完成（代码层面）

| 文件                                                                                                            | 改动                                                                                   |
| --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)                                               | 使用 `r0adkll/upload-google-play` 替换 Firebase App Distribution，直接上传到 Play 内测 |
| [`android/app/build.gradle`](../android/app/build.gradle)                                                       | `versionCode` 自动递增（使用 `GITHUB_RUN_NUMBER`），`versionName` 更新为 `1.0.1`       |
| [`docs/ci-cd-setup-guide.md`](../docs/ci-cd-setup-guide.md#7-google-play-internal-testing-setup-ci-auto-upload) | 更新为 Google Play Internal Testing 配置文档                                           |

---

### 📋 手动操作步骤（一次性设置）

以下是 CI 上线前需要完成的 **手动设置**（已完成 ✅）：

---

### 第 1 步：启用 Google Play Android Developer API ✅

> 在 Google Cloud Console 中启用 Play 的 API，让 service account 能调用 Play 上传接口。

1. 打开 **Google Cloud Console**：https://console.cloud.google.com/apis/library/androidpublisher.googleapis.com
2. 确保选择了项目 `adroit-outlet-444914-m0`
3. 点击 **Enable**（已启用 ✅）

---

### 第 2 步：添加 Service Account 到 Google Play Console ✅

> 把 Firebase 的 service account 邮箱加到 Play Console 中，授予上传权限。

1. 打开 **Google Play Console** → **Settings** → **Users & permissions**
2. 点击 **Invite new user**
3. 输入 service account 邮箱（在 Firebase Console → Project Settings → Service Accounts 中可以找到）
4. 权限选择 **Admin**（所有权限）
5. 点击 **Invite**（已添加 ✅，确认 13 个权限）

---

### 第 3 步：创建 `PLAY_SERVICE_ACCOUNT_KEY` GitHub Secret ✅

> 把 service account 的 JSON 密钥存为 GitHub Secret，供 CI 使用。

1. 打开 **Firebase Console** → **Project Settings** → **Service Accounts**
2. 点击 **Generate new private key** → 下载 JSON 文件
3. 复制 JSON 文件的**全部原始内容**（不要 base64 编码）
4. 打开 **GitHub → Settings → Secrets and variables → Actions**
5. 点击 **New repository secret**
   - **Name:** `PLAY_SERVICE_ACCOUNT_KEY`
   - **Value:** 粘贴 JSON 原始内容
6. 点击 **Add secret**（已创建 ✅）

---

### 第 4 步：在 Google Play Console 添加测试者

> 测试者管理直接在 Google Play Console 中操作，不再需要本地文件。

1. 打开 **Google Play Console → Tarsier → Testing → Internal Testing**
2. 在 **Testers** 部分，点击 **Add email addresses**
3. 输入测试者的 Gmail 邮箱（每行一个）
4. 点击 **Save**
5. 测试者会收到邀请链接，点击加入即可

> ⚠️ 不要将真实邮箱提交到 git 仓库。`.firebase-testers.txt` 仅作为模板保留。

---

### CI 构建规则

| 推送到分支 | CI 自动构建    | 上传到 Google Play Internal Testing |
| ---------- | -------------- | ----------------------------------- |
| `test`     | staging APK    | ❌ 不上传（仅开发调试）             |
| `main`     | production AAB | ✅ 上传到 Internal Testing 并发布   |
| `v*` tag   | production AAB | ✅ 上传到 Internal Testing 并发布   |

### 版本号规则

- **versionCode** — 自动递增，每个 CI 运行使用 `GITHUB_RUN_NUMBER`（如 #8 → versionCode 8）
- **versionName** — 手动在 [`android/app/build.gradle`](../android/app/build.gradle:100-103) 中设置，遵循语义化版本 `MAJOR.MINOR.PATCH`
  - 大版本改动 → 改 MAJOR（如 `2.0.0`）
  - 新功能 → 改 MINOR（如 `1.1.0`）
  - 小修复 → 改 PATCH（如 `1.0.2`）
