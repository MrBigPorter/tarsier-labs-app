# Android Deep Link 修复计划

## 问题

从邮箱点击分享的文章链接，跳转的是浏览器而不是 App。

## 根因

分享出去的 URL 和 Android 注册的 URL 域名不一致。

```
分享出去 → https://blog.joyminis.com/en/articles/slug
              ↓
邮箱里点击 → 浏览器打开
              ↓
Android 检查 intent filter → 只注册了 tarsier.app，没有 blog.joyminis.com → 找不到 App ❌
```

### 三处配置对比

| 文件                                                                                              | 当前值                                          | 应该用                        |
| ------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ----------------------------- |
| [`share.ts:26`](../src/lib/utils/share.ts:26)                                                     | `env.WEB_URL` → `https://blog.joyminis.com/...` | ✅ 正确                       |
| [`RootNavigator.tsx:293`](../src/navigation/RootNavigator.tsx:293) linking prefixes               | `['tarsier://', env.WEB_URL]`                   | ✅ 正确                       |
| [`AndroidManifest.xml:41-43`](../android/app/src/main/AndroidManifest.xml:41) https intent filter | `android:host="tarsier.app"`                    | ❌ 应该是 `blog.joyminis.com` |

**`tarsier.app` 是旧占位域名，实际网站跑在 `blog.joyminis.com` 上。**

---

## 需要改的文件

### 1. [`android/app/build.gradle`](../android/app/build.gradle)

两个 flavor 的域名不同，需要用 `manifestPlaceholders` 动态传值。

当前（L131-156）：

```groovy
productFlavors {
    staging { ... }
    production { ... }
}
```

改为：

```groovy
productFlavors {
    staging {
        ...
        manifestPlaceholders = [deepLinkHost: "blog-dev.joyminis.com"]
    }
    production {
        ...
        manifestPlaceholders = [deepLinkHost: "blog.joyminis.com"]
    }
}
```

### 2. [`android/app/src/main/AndroidManifest.xml`](../android/app/src/main/AndroidManifest.xml)

当前（L37-44）硬编码了 `tarsier.app`。

```xml
<intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data
        android:scheme="https"
        android:host="tarsier.app" />
</intent-filter>
```

改为使用 placeholder：

```xml
<intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data
        android:scheme="https"
        android:host="${deepLinkHost}" />
</intent-filter>
```

说明：

- `android:autoVerify="true"` — 告诉 Android 在安装时自动验证 App Links
- `${deepLinkHost}` — Gradle 编译时替换成对应 flavor 的域名

---

## 还需要服务器端做的事

### 3. 托管 `assetlinks.json`

要让 Android **直接打开 App（不弹"打开方式"选择器）**，需要在网站根目录放验证文件。

**production 域名** `https://blog.joyminis.com/.well-known/assetlinks.json`：

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.tarsier.labs",
      "sha256_cert_fingerprints": ["<上传密钥的 SHA256 指纹>"]
    }
  }
]
```

**staging 域名** `https://blog-dev.joyminis.com/.well-known/assetlinks.json`：

同上（staging 可以用 debug 签名证书的 SHA256）。

> SHA256 指纹获取方式：
>
> ```bash
> # 上传密钥（release）
> keytool -list -v -keystore your-upload-key.keystore -alias your-key-alias
>
> # Debug 密钥
> keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
> ```

---

## 数据流（修复后）

```
用户在 App 内点击"分享"
    ↓
share.ts → https://blog.joyminis.com/en/articles/hello-react
    ↓ （粘贴到邮箱发送）
收件人在手机邮箱点击链接
    ↓
Android 收到 Intent: https://blog.joyminis.com/en/articles/hello-react
    ↓
匹配 intent filter: scheme=https, host=blog.joyminis.com ✅
    ↓
验证 assetlinks.json → 自动打开 App（不弹选择器）
    ↓
React Navigation getInitialState() → getStateFromPath()
    ↓
根据 linking config 解析路径: en/articles/hello-react
    ↓
匹配 ArticleDetail: { locale: 'en', slug: 'hello-react' }
    ↓
导航到 ArticleDetail 页面
```

---

## 验证方式

1. **安装 staging 或 production build 到手机**
2. **在邮箱或备忘录里点这个链接**：`https://blog.joyminis.com/en/articles/<某个存在的 slug>`
3. 预期结果：直接打开 App 并显示对应文章
4. 如果弹了"打开方式"选择器 → 检查 `assetlinks.json` 是否正确部署

也可以用 adb 直接测试（不需要经过邮箱）：

```bash
# 测试 production
adb shell am start -W -a android.intent.action.VIEW \
  -d "https://blog.joyminis.com/en/articles/hello-react" \
  com.tarsier.labs

# 测试 staging
adb shell am start -W -a android.intent.action.VIEW \
  -d "https://blog-dev.joyminis.com/en/articles/hello-react" \
  com.tarsier.labs.test

# 测试自定义 scheme
adb shell am start -W -a android.intent.action.VIEW \
  -d "tarsier://en/articles/hello-react" \
  com.tarsier.labs
```

---

## 文件修改清单

| 文件                                                                                      | 改动类型 | 改动内容                                              |
| ----------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------- |
| [`android/app/build.gradle`](../android/app/build.gradle)                                 | 修改     | staging/production flavor 各加 `manifestPlaceholders` |
| [`android/app/src/main/AndroidManifest.xml`](../android/app/src/main/AndroidManifest.xml) | 修改     | host 改为 `${deepLinkHost}`，加 `autoVerify="true"`   |
| 服务器 `https://blog.joyminis.com/.well-known/assetlinks.json`                            | 新建     | 部署 Android App Links 验证文件                       |
| 服务器 `https://blog-dev.joyminis.com/.well-known/assetlinks.json`                        | 新建     | 同上（staging）                                       |
