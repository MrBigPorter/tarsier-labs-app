# Upload Key 密钥库 说明

## 什么是 Upload Key？

Upload Key（上传密钥）是一个用于将你的 App 上传到 **Google Play Console** 的"临时签名密钥"。它**不是**最终用户手机上 App 的签名密钥。

## Google Play App Signing 流程

```mermaid
flowchart LR
    A["你（开发者）"] -->|"步骤1: 用 Upload Key 签名"| B["release-upload-key.keystore"]
    B -->|"步骤2: 上传 AAB 到 Google Play"| C["Google Play Console"]
    C -->|"步骤3: Google 用 App Signing Key 重新签名"| D["App Signing Key<br>Google 保管"]
    D -->|"步骤4: 分发到用户手机"| E["用户安装的 APK"]

    style A fill:#4a90d9,color:#fff
    style B fill:#e67e22,color:#fff
    style C fill:#27ae60,color:#fff
    style D fill:#c0392b,color:#fff
    style E fill:#2c3e50,color:#fff
```

## 为什么需要 Upload Key？

| 概念                                | 说明                                                                             |
| ----------------------------------- | -------------------------------------------------------------------------------- |
| **App Signing Key**（应用签名密钥） | Google Play 保管的**主密钥**，用于最终签名用户手机上的 APK。**丢失无法恢复**     |
| **Upload Key**（上传密钥）          | **你保管的密钥**，只用于上传 AAB 文件到 Google Play。**丢失可以在 Console 重置** |

### 好处

1. ✅ **安全** — 即使你的电脑被盗，攻击者也只能上传新版本，拿不到最终签名密钥
2. ✅ **可恢复** — Upload Key 丢了可以在 Console 申请重置，App Signing Key 丢了就永远无法更新应用
3. ✅ **支持多开发者** — 团队多人可以有不同的 Upload Key，无需共享主密钥

## 已为你生成的文件

| 文件                                                                        | 位置           | 作用                  | 能否恢复             |
| --------------------------------------------------------------------------- | -------------- | --------------------- | -------------------- |
| [`release-upload-key.keystore`](../android/app/release-upload-key.keystore) | `android/app/` | Upload Key 密钥库文件 | ✅ 可在 Console 重置 |
| [`keystore.properties`](../android/app/keystore.properties)                 | `android/app/` | 保存密钥库密码        | 和密钥库一起备份     |

## 如何上传到 Google Play Console

1. 登录 [Google Play Console](https://play.google.com/console)
2. 创建应用 → 包名: `com.tarsier.labs`
3. 进入 **Setup → App Integrity**
4. 在 "Upload key certificate" 部分，粘贴以下 SHA-1 指纹：
   ```
   23:67:4B:CE:EE:36:78:62:D2:8C:A4:7C:32:9F:50:71:32:A6:D2:0B
   ```
5. 保存即可

> 不需要上传 `.keystore` 文件本身到 Console，只需要粘贴证书指纹。
