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

## 附录：CI/CD Firebase App Distribution 自动发布

> 已配置 GitHub Actions 自动构建并上传到 Firebase App Distribution

### ✅ 已完成（代码层面）

| 文件                                                                                          | 改动                                                                 |
| --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)                             | 添加 keystore 解码、Firebase 服务账号解码、App Distribution 上传步骤 |
| [`.firebase-testers.txt`](../.firebase-testers.txt)                                           | 测试者邮箱列表文件                                                   |
| [`.gitignore`](../.gitignore)                                                                 | 添加 `firebase-service-account.json`                                 |
| [`docs/ci-cd-setup-guide.md`](../docs/ci-cd-setup-guide.md#7-firebase-app-distribution-setup) | 新增 Firebase 配置文档                                               |

---

### 📋 手动操作步骤

你需要完成以下 **4 大步**，CICD 才能跑起来。

---

### 第 1 步：下载 Firebase Admin SDK 私钥（JSON 文件）

> 这是 Firebase 的「服务账号密钥」，CI 用它来上传 APK。

**1.1 打开 Firebase 控制台**

在浏览器输入这个地址，直接回车打开：

```
https://console.firebase.google.com/project/adroit-outlet-444914-m0/settings/serviceaccounts
```

**1.2 点击「生成新的私钥」**

页面中间有一个蓝色按钮 **「生成新的私钥」**。点击它。

**1.3 确认下载**

弹窗会提示「此私钥无法再次检索」—— 点击确定。浏览器会自动下载一个 `.json` 文件。

**1.4 把 JSON 复制到项目根目录**

打开终端，运行以下命令：

```bash
# 1. 查看 Downloads 里有没有 firebase 相关的 JSON
ls ~/Downloads/*.json

# 2. 把它复制到项目根目录（文件名改为 firebase-service-account.json）
cp ~/Downloads/firebase-service-account.json /Users/porter/Developer/frontend-blog-mobile/firebase-service-account.json

# 3. 检查是否复制成功（应该显示文件信息）
ls -la /Users/porter/Developer/frontend-blog-mobile/firebase-service-account.json
```

> **注意**：这个文件已被 `.gitignore` 忽略，不会提交到 git。

**1.5 把 JSON 文件编码为 base64（用于 GitHub Secrets）**

```bash
base64 -i /Users/porter/Developer/frontend-blog-mobile/firebase-service-account.json | pbcopy
```

> `pbcopy` 会把内容复制到你的系统剪贴板。下一步粘贴到 GitHub 用。

---

### 第 2 步：配置 GitHub Secrets

> 打开浏览器，进入你的 GitHub 仓库页面，然后：
> 点击 **Settings** → 左侧 **Secrets and variables** → **Actions**
> 点击绿色按钮 **「New repository secret」**

你需要添加以下 **6 个 Secret**：

#### Secret 1：FIREBASE_SERVICE_ACCOUNT

| 字段  | 值                                                                |
| ----- | ----------------------------------------------------------------- |
| Name  | `FIREBASE_SERVICE_ACCOUNT`                                        |
| Value | 直接按 **⌘V（Mac）** 粘贴（上一步 base64 的内容已经复制到剪贴板） |

#### Secret 2：KEYSTORE_BASE64

先运行这个命令，把 keystore 编码到剪贴板：

```bash
base64 -i /Users/porter/Developer/frontend-blog-mobile/android/app/release-upload-key.keystore | pbcopy
```

然后在 GitHub 新建 Secret：

| 字段  | 值                |
| ----- | ----------------- |
| Name  | `KEYSTORE_BASE64` |
| Value | 按 **⌘V** 粘贴    |

#### Secret 3：KEYSTORE_FILE

| 字段  | 值                                          |
| ----- | ------------------------------------------- |
| Name  | `KEYSTORE_FILE`                             |
| Value | 手动输入：`app/release-upload-key.keystore` |

> 注意：这是**文本**，不是上传文件。直接照抄上面那行字。

#### Secret 4：KEYSTORE_PASSWORD

| 字段  | 值                     |
| ----- | ---------------------- |
| Name  | `KEYSTORE_PASSWORD`    |
| Value | 手动输入：`haoran0718` |

#### Secret 5：KEY_ALIAS

| 字段  | 值                     |
| ----- | ---------------------- |
| Name  | `KEY_ALIAS`            |
| Value | 手动输入：`upload-key` |

#### Secret 6：KEY_PASSWORD

| 字段  | 值                     |
| ----- | ---------------------- |
| Name  | `KEY_PASSWORD`         |
| Value | 手动输入：`haoran0718` |

**添加完成后，你的 Secrets 列表应该看到这 6 项：**

```
FIREBASE_SERVICE_ACCOUNT      ********
KEYSTORE_BASE64               ********
KEYSTORE_FILE                 ********
KEYSTORE_PASSWORD             ********
KEY_ALIAS                     ********
KEY_PASSWORD                  ********
```

---

### 第 3 步：填写测试者邮箱

用编辑器打开项目根目录下的 `.firebase-testers.txt` 文件。

每行填一个测试者的邮箱：

```
zhangsan@example.com
lisi@example.com
wangwu@example.com
```

> 这些邮箱会收到 Firebase 发来的安装链接。

---

### 第 4 步：提交代码，触发 CI

```bash
# 添加到 git
git add .

# 提交
git commit -m "ci: add firebase app distribution"

# 推送到 GitHub
git push
```

### CI 构建规则

| 推送到分支 | CI 自动构建    | 上传到 Firebase   |
| ---------- | -------------- | ----------------- |
| `test`     | staging APK    | ✅ 测试者收到邮件 |
| `main`     | production AAB | ✅ 测试者收到邮件 |
