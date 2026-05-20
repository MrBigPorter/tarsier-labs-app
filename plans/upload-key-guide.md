# Upload Key 密钥库 — 生成与保管指南

## 什么是 Upload Key 密钥库？

**密钥库**（Keystore）是一个加密文件，里面存放着**一对密钥**（私钥 + 证书）。你可以把它想象成一个保险箱：

```
release-upload-key.keystore  ← 这个文件就是"保险箱"
    ├── 私钥 (Private Key)    ← 用于签名 AAB
    └── 证书 (Certificate)    ← 包含公钥和指纹，用于识别身份
```

保险箱需要**密码**才能打开，里面的密钥也需要**单独密码**（这里两个密码设为相同，简化管理）。

---

## 如何生成的？（已为你完成）

### 使用的命令

```bash
keytool -genkey -v -storetype PKCS12 \
  -keystore release-upload-key.keystore \
  -alias upload-key \
  -keyalg RSA -keysize 2048 \
  -validity 10000 \
  -storepass "2VBjDDtZGnWDDtk6VTKp" \
  -keypass "2VBjDDtZGnWDDtk6VTKp" \
  -dname "CN=Tarsier Labs, OU=Mobile, O=Tarsier, L=Manila, S=Manila, C=PH"
```

### 参数说明

| 参数                | 值                     | 说明                         |
| ------------------- | ---------------------- | ---------------------------- |
| `-storetype PKCS12` | PKCS12                 | 现代标准格式（推荐，非 JKS） |
| `-alias`            | `upload-key`           | 密钥在保险箱里的"名字"       |
| `-keyalg RSA`       | RSA                    | 加密算法                     |
| `-keysize 2048`     | 2048 位                | 密钥强度，够用且兼容性好     |
| `-validity 10000`   | 10,000 天 (~27 年)     | 有效期，够用几十年           |
| `-storepass`        | `2VBjDDtZGnWDDtk6VTKp` | 保险箱密码                   |
| `-keypass`          | `2VBjDDtZGnWDDtk6VTKp` | 密钥密码                     |
| `-dname`            | CN=Tarsier Labs, ...   | 证书中的身份信息，不重要     |

---

## 已生成的文件及位置

```
android/app/
├── release-upload-key.keystore    ← 密钥库文件（保险箱）
├── keystore.properties            ← 密码配置文件（钥匙纸条）
└── build.gradle                   ← 构建脚本（自动读取 properties）
```

### 文件内容

[`keystore.properties`](../android/app/keystore.properties):

```properties
storeFile=release-upload-key.keystore
storePassword=2VBjDDtZGnWDDtk6VTKp
keyAlias=upload-key
keyPassword=2VBjDDtZGnWDDtk6VTKp
```

### 构建时如何自动加载

[`build.gradle`](../android/app/build.gradle:83):

```groovy
def keystorePropertiesFile = rootProject.file("app/keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}
```

构建时 Gradle 会自动读取 `keystore.properties`，用里面的密码打开 `release-upload-key.keystore`，取出 `upload-key` 这个密钥来签名 AAB。

---

## 必须做的备份

> ⚠️ **如果你丢失了 `release-upload-key.keystore` 和密码，虽然能在 Play Console 重置 Upload Key，但过程很麻烦。请立即备份！**

### 推荐的备份方式（选一个即可）

**方式 1：密码管理器**（推荐）

```
1. 打开你的密码管理器（1Password / Bitwarden / LastPass 等）
2. 新建一条记录，标题：Tarsier Android Upload Key
3. 填入以下信息：

   文件路径: android/app/release-upload-key.keystore
   密码:     2VBjDDtZGnWDDtk6VTKp
   别名:     upload-key
   SHA-1:   23:67:4B:CE:EE:36:78:62:D2:8C:A4:7C:32:9F:50:71:32:A6:D2:0B
   SHA-256: 7D:40:F9:F1:63:80:AE:D4:29:E0:91:63:04:09:1E:CF:A2:EC:30:EF:57:CB:57:9F:95:B2:C5:D1:5C:69:44:86

4. 将 release-upload-key.keystore 文件作为附件上传到这条记录
```

**方式 2：加密压缩后存到云盘**

```bash
# 在 android/app/ 目录下执行
zip -er release-upload-key-backup.zip release-upload-key.keystore keystore.properties
# 输入一个你记得住的加密密码（不同于密钥密码）
# 然后将 zip 文件存到 Google Drive / Dropbox / iCloud
```

**方式 3：AirDrop 到另一台电脑**

```bash
# Mac 间传文件
cp android/app/release-upload-key.keystore ~/Desktop/
cp android/app/keystore.properties ~/Desktop/
# 然后 AirDrop 到你的其他设备
```

---

## 如果需要重新生成（如果不小心丢了）

> 注意：重新生成后，新的 SHA-1 指纹会变化，需要在 Play Console 更新。

```bash
cd android/app

# 1. 删除旧的
rm release-upload-key.keystore

# 2. 生成新的（换成你自己的密码）
keytool -genkey -v -storetype PKCS12 \
  -keystore release-upload-key.keystore \
  -alias upload-key \
  -keyalg RSA -keysize 2048 \
  -validity 10000

# 3. 按提示输入密码和身份信息

# 4. 更新 keystore.properties（用你刚设置的密码）
```

---

## 安全注意事项

| ✅ 应该做              | ❌ 不应该做                                  |
| ---------------------- | -------------------------------------------- |
| 将密钥库备份到安全位置 | 将密钥库提交到 Git（已配置 `.gitignore` ✅） |
| 使用强密码             | 使用简单密码                                 |
| 限制谁可以访问此文件   | 在公共电脑上保留密钥库副本                   |
| 密码管理器保存凭据     | 将密码写在代码注释中                         |

### Git 保护已就绪

[`.gitignore`](../.gitignore:34) 中已经自动保护：

```gitignore
*.keystore
!debug.keystore
keystore.properties
```

> `release-upload-key.keystore` 和 `keystore.properties` 都不会被提交到 Git。

---

## 总结

| 项目         | 值                                                                                                |
| ------------ | ------------------------------------------------------------------------------------------------- |
| 密钥库文件   | [`android/app/release-upload-key.keystore`](../android/app/release-upload-key.keystore)           |
| 密码配置文件 | [`android/app/keystore.properties`](../android/app/keystore.properties)                           |
| 密码         | `2VBjDDtZGnWDDtk6VTKp`                                                                            |
| 别名         | `upload-key`                                                                                      |
| SHA-1 指纹   | `23:67:4B:CE:EE:36:78:62:D2:8C:A4:7C:32:9F:50:71:32:A6:D2:0B`                                     |
| SHA-256 指纹 | `7D:40:F9:F1:63:80:AE:D4:29:E0:91:63:04:09:1E:CF:A2:EC:30:EF:57:CB:57:9F:95:B2:C5:D1:5C:69:44:86` |
