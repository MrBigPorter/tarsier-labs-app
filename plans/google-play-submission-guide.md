# Google Play 上架完整操作流程

> 主流程按步骤排列，详细概念说明在尾部附录中。

---

## 1️⃣ 构建 Release AAB

```bash
# 先清理构建缓存（包名变更后必须执行一次）
make clean

# 构建 AAB
cd android && ./gradlew bundleRelease
```

**构建条件**（均已就绪）：

- `release-upload-key.keystore` → ✅ 已生成（[查看 Upload Key 说明](#appendix-upload-key)）
- `keystore.properties` → ✅ 已创建（已被 .gitignore 排除）
- `build.gradle` → ✅ 已配置自动加载

**输出文件**：`android/app/build/outputs/bundle/release/app-release.aab`

> AAB 是什么？见 [附录：AAB 说明](#appendix-aab)

---

## 2️⃣ Google Play Console — 创建应用

1. 访问 [play.google.com/console](https://play.google.com/console)（账号已开通 ✅）
2. 点击 **Create app**
3. 填写：Name → `Tarsier` / 类型 → App / 定价 → Free
4. 点击 **Create app**

---

## 3️⃣ Setup → App Integrity（配置 Upload Key）

1. 左侧菜单 **Setup → App Integrity**
2. **Upload key certificate** → 点击 **Add upload key**
3. 选择 **Paste certificate fingerprint**
4. 在本地终端运行以下命令获取 SHA-1 指纹：

```bash
keytool -list -v -keystore android/app/release-upload-key.keystore -alias upload-key
# 输入密码后，找到 SHA-1 那一行，复制该值
```

5. 将复制的 SHA-1 粘贴到 Play Console
6. 点击 **Save**

> 指纹是公开信息（证书内嵌），但为了安全不直接写在文档中，请运行命令获取。也可直接查看 `keystore.properties` 所在目录的相邻文件。

---

## 4️⃣ 上传 AAB

1. 进入 **Production** 或 **Testing → Closed testing**
2. 点击 **Create new release**
3. 拖拽 `app-release.aab` 到上传区域
4. 填写 Release name（如 `1.0.0`）和 Release notes
5. 点击 **Save**

---

## 5️⃣ Store Listing（商店信息）

| Field                 | Suggested Content                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **App name**          | `Tarsier`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **Short description** | A sleek blog reader — browse, bookmark, and discover tech articles on the go                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **Full description**  | Tarsier is a modern blog reader built for readers who love to explore and stay informed. Dive into a curated feed of tech articles, save your favorites with bookmarks, browse by categories and tags, and engage through comments. Whether you're catching up on the latest trends or deep-diving into a topic, Tarsier makes reading smooth, fast, and distraction-free.<br><br>✨ **Key Features:**<br>• **Curated article feed** — discover articles across multiple categories<br>• **Bookmarks** — save articles to read later, synced across devices<br>• **Category & tag browsing** — find exactly what interests you<br>• **Comments & interaction** — join the conversation<br>• **Search** — quickly find articles by keyword<br>• **Multi-language support** — English, Chinese, Japanese, Korean, French, German<br>• **Dark mode** — comfortable reading day or night |
| **Category**          | News & Magazines or Books & Reference                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

**Required Assets**：

| Asset             | Size                      | Description                      |
| ----------------- | ------------------------- | -------------------------------- |
| Feature Graphic   | 1024x500 px               | Top banner on Play Store listing |
| Phone screenshots | At least 2 (1080x1920 px) | Show core feature screens        |
| App icon          | 512x512 px                | Automatically adapted by Android |

---

## 6️⃣ Data Safety（Data Security）

| Data Type             | Collected?  | Notes                         |
| --------------------- | ----------- | ----------------------------- |
| Location              | ❌ No       | Permission removed            |
| Photos / Media        | ❌ No       | Permission removed            |
| Device ID             | ✅ Possibly | Push notifications            |
| App Info / Crash Logs | ✅ Possibly | Crash analytics (Sentry)      |
| User Account          | ✅ Yes      | OAuth login (email, username) |
| Bookmarks / Favorites | ✅ Yes      | Cloud sync                    |

---

## 7️⃣ Content Rating

- Complete the questionnaire (5–10 min)
- Your app is expected to be rated **Everyone** or **Teen** (tech articles, no adult content)

## 8️⃣ Pricing & Distribution

- Select **Free**
- Select all countries by default
- Confirm the agreement

---

## 9️⃣ Closed Testing (Required for New Accounts)

> Since Nov 2023, new developer accounts must complete Closed Testing before publishing to Production.

**Requirement**: At least **20 testers** x **14 days** of continuous testing

**Steps**:

1. Left menu **Testing → Closed testing → Create track**
2. Create a tester list (emails or Google Groups)
3. Upload AAB to the track
4. Testers join via invite link and install the app
5. After 14 days, click **Promote to Production**

---

## 🔟 提交前检查清单

**代码层面（全部完成）**：

- [x] Package name: `com.tarsier.labs`
- [x] Version: 1 / 1.0.0
- [x] Upload Key: 已生成配置
- [x] 权限: 仅 INTERNET, POST_NOTIFICATIONS, VIBRATE
- [x] ProGuard, Adaptive Icon, 屏幕方向 均已配置
- [x] `make clean` 已合并（旧 purge, clear-cache 统一为一个命令）

**Play Console 待办**：

- [ ] 创建应用
- [ ] 运行 `keytool` 命令获取 SHA-1 并粘贴到 App Integrity
- [ ] 上传 AAB
- [ ] Store Listing（名称、描述、截图、Feature Graphic）
- [ ] Data Safety
- [ ] Content Rating 问卷
- [ ] Pricing & Distribution
- [ ] Closed Testing（20 人 x 14 天）
- [ ] 隐私政策 URL 已部署并可访问

---

## 1️⃣1️⃣ 发布流程时间线

```
Day 1:     构建 AAB + Play Console 配置
Day 1-14:  Closed Testing（20 人测试）
Day 15:    Promote to Production
Day 15-17: Google 审核（1-3 天）
Day 17:    正式上架
```

---

## 附录

### <a name="appendix-aab"></a>附录 1：什么是 AAB

**AAB**（Android App Bundle，.aab 文件）是 Google Play **强制要求**的上传格式。

| 对比项       | APK（旧方式）      | AAB（新方式）    |
| ------------ | ------------------ | ---------------- |
| 后缀         | .apk               | .aab             |
| 能否直接安装 | 可以               | 不能             |
| 文件大小     | 50MB（含所有架构） | 用户只下载 ~30MB |
| Google 要求  | 旧应用仍支持       | 新应用强制使用   |

**工作原理**：你上传 AAB 到 Google Play，Google 根据用户手机型号（CPU 架构、屏幕分辨率）动态生成最合适的 APK，用户下载的 APK 只包含自己需要的部分。

**什么情况用什么**：

| 场景             | 命令                                      | 格式 |
| ---------------- | ----------------------------------------- | ---- |
| 平时开发调试     | `npx react-native run-android`            | APK  |
| 自己装 APK 测试  | `cd android && ./gradlew assembleRelease` | APK  |
| 上传 Google Play | `cd android && ./gradlew bundleRelease`   | AAB  |

---

### <a name="appendix-upload-key"></a>附录 2：Upload Key 密钥库

**密钥库**（Keystore）是一个加密文件，里面存放着签名用的私钥和证书。

**Google Play App Signing 流程**：

```
你（开发者）                          Google Play Console                    用户手机
    |                                      |                                  |
    +-- 用 Upload Key 签名 AAB ---------->  +-- 用 App Signing Key 重新签名 --->  APK
    |                                      |                                  |
 release-upload-key.keystore             App Signing Key
 （你保管，可重置）                      （Google 保管，不可恢复）
```

**两种密钥的区别**：

|            | Upload Key（上传密钥）   | App Signing Key（应用签名密钥） |
| ---------- | ------------------------ | ------------------------------- |
| 谁保管     | 你                       | Google                          |
| 用途       | 上传 AAB 到 Play Console | 最终签名用户手机上的 APK        |
| 丢了怎么办 | 可在 Console 重置        | 永远无法恢复                    |

**已生成的文件**：

```
android/app/
+-- release-upload-key.keystore    密钥库文件（不要提交到 Git）
+-- keystore.properties            密码配置文件（已被 .gitignore 排除）
+-- build.gradle                   构建脚本（自动读取密码）
```

---

### <a name="appendix-fingerprint"></a>附录 3：获取证书指纹

在本地终端运行以下命令获取指纹，用于在 Google Play Console 配置 Upload Key：

```bash
keytool -list -v -keystore android/app/release-upload-key.keystore -alias upload-key
```

输入密码后，输出中会包含：

- **SHA-1**：用于 Play Console 配置 Upload Key
- **SHA-256**：用于某些第三方服务（如 Firebase）

> ⚠️ 不要将指纹直接写入文档，每次需要时运行命令获取即可。虽然指纹是公开信息，但避免意外泄露。

---

### <a name="appendix-keygen"></a>附录 4：Upload Key 生成步骤

以下是整个 Upload Key 的生成、配置、加载的完整流程说明。

#### 步骤 1：生成密钥库文件

```bash
# 在 android/app 目录下生成
keytool -genkey -v -keystore android/app/release-upload-key.keystore \
  -alias upload-key \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storetype pkcs12
```

执行后会交互式填写：

| 提示           | 示例输入                                |
| -------------- | --------------------------------------- |
| 输入密钥库密码 | 自定义密码（如 `2VBjDDtZGnWDDtk6VTKp`） |
| 您的名字与姓氏 | `Tarsier`                               |
| 组织单位名称   | `Development`                           |
| 组织名称       | `Tarsier`                               |
| 城市或区域     | `Hong Kong`                             |
| 省/市/自治区   | `Hong Kong`                             |
| 国家代码       | `HK`                                    |
| 确认密钥密码   | 回车（与密钥库密码相同）                |

#### 步骤 2：配置 keystore.properties

创建 `android/app/keystore.properties`，写入：

```properties
storeFile=release-upload-key.keystore
storePassword=你设置的密码
keyAlias=upload-key
keyPassword=你设置的密码
```

> ⚠️ 此文件已加入 `.gitignore`，不会提交到 Git。

#### 步骤 3：build.gradle 自动加载

`android/app/build.gradle` 中已配置以下逻辑（无需手动修改）：

```groovy
def keystorePropertiesFile = rootProject.file("app/keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

// release 构建类型自动使用上述配置签名
release {
    if (keystorePropertiesFile.exists()) {
        storeFile rootProject.file(keystoreProperties['storeFile'])
        storePassword keystoreProperties['storePassword']
        keyAlias keystoreProperties['keyAlias']
        keyPassword keystoreProperties['keyPassword']
    }
}
```

#### 步骤 4：验证指纹

```bash
keytool -list -v -keystore android/app/release-upload-key.keystore -alias upload-key
# 输入密码后查看 SHA-1，用于 Play Console App Integrity 配置
```

#### 步骤 5：构建 AAB（签名自动生效）

```bash
make clean && cd android && ./gradlew bundleRelease
```

构建完成后，输出文件 `android/app/build/outputs/bundle/release/app-release.aab` 已使用 Upload Key 签名。

#### 如果要重新生成

```bash
# 1. 备份旧的
cp android/app/release-upload-key.keystore android/app/release-upload-key.keystore.bak

# 2. 删除旧文件（否则 keytool 会尝试打开旧文件并报密码错误）
rm android/app/release-upload-key.keystore

# 3. 生成新的（重新运行步骤 1 的命令，输入新密码）
keytool -genkey -v -keystore android/app/release-upload-key.keystore \
  -alias upload-key \
  -keyalg RSA -keysize 2048 -validity 10000 -storetype pkcs12

# 4. 更新 keystore.properties（用新密码）
# 5. 在 Play Console → App Integrity 上传新证书的指纹
```

---

### <a name="appendix-backup"></a>附录 5：Upload Key 备份方法

> 请立即备份，虽然能在 Play Console 重置，但过程麻烦。

**方式 1：密码管理器（推荐）**

- 在 1Password / Bitwarden 中新建记录
- 标题：`Tarsier Android Upload Key`
- 保存内容：
  - `keystore.properties` 里的密码（运行 `cat android/app/keystore.properties` 查看）
  - 别名 `upload-key`
  - 两个指纹（运行上方 keytool 命令获取）
- 将 `release-upload-key.keystore` 文件作为附件上传

**方式 2：加密压缩**

```bash
cd android/app && zip -er release-upload-key-backup.zip release-upload-key.keystore keystore.properties
# 输入加密密码后，存到 Google Drive / Dropbox / iCloud
```

---

### <a name="appendix-faq"></a>附录 6：FAQ

**Q: 可以跳过 Closed Testing 吗？**
不能。2023年11月起新账号必须完成 20人 x 14天 测试。

**Q: 14 天从什么时候开始算？**
从 AAB 上传到 Closed Testing track 且测试者安装后开始计算。

**Q: 上架后如何更新？**

1. 增加 versionCode（+1）和 versionName
2. `cd android && ./gradlew bundleRelease`
3. 上传新 AAB 到 Production -- Create new release

**Q: 忘了 keystore 密码怎么办？**
在 Play Console -- App Integrity 申请重置 Upload Key。
