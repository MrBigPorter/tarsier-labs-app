# Android CI Build "Error: The operation was canceled" 修复计划

## 问题概述

CI/CD 上 Android Release 构建在原生库编译阶段失败，Gradle 报 `"Error: The operation was canceled."`。
根本原因是 GitHub Actions runner（7GB 内存）在构建 4 种 CPU 架构 + New Architecture + Hermes + ProGuard 时内存不足，操作系统杀掉了 Gradle 进程。

## 修复步骤

### 步骤 1：限制 CI 构建只编译 arm64-v8a 架构

**目标**：减少原生代码编译量从 4 倍降到 1 倍。

**修改文件**：[`.github/workflows/build.yml`](.github/workflows/build.yml:57)

在第 57 行的 Gradle 命令中，通过 `-PreactNativeArchitectures` 参数只指定 `arm64-v8a`：

```yaml
# 修改前：
run: cd android && ./gradlew assembleRelease --no-daemon

# 修改后：
run: cd android && ./gradlew assembleRelease --no-daemon -PreactNativeArchitectures=arm64-v8a
```

**同时修改**：[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml:120,126)

```yaml
# 第 120 行（staging）：
cd android && ./gradlew assembleStagingRelease --no-daemon \
  -PreactNativeArchitectures=arm64-v8a \
  -PKEYSTORE_FILE=...

# 第 126 行（production bundle）：
cd android && ./gradlew bundleProductionRelease --no-daemon \
  -PreactNativeArchitectures=arm64-v8a \
  -PKEYSTORE_FILE=...
```

> **为什么只保留 arm64-v8a？** 现代 Android 设备（2020 年以后）几乎都是 64 位 ARM。Google Play 从 2019 年 8 月起就要求新应用必须支持 64 位。`armeabi-v7a`（32 位）和 `x86`/`x86_64`（模拟器）在发布版中不需要。
>
> **本地开发不受影响**：`reactNativeArchitectures` 在 gradle.properties 中保留了所有 4 种架构，本地 `make dev-android` 仍然会构建全部架构用于调试。

---

### 步骤 2：修复 build.yml 中 `assembleRelease` 的二义性问题

**目标**：明确指定要构建的 flavor 变体，避免同时构建 stagingRelease + productionRelease。

**修改文件**：[`.github/workflows/build.yml`](.github/workflows/build.yml:57)

```yaml
# 修改前（会构建所有 release 变体，翻倍工作量）：
run: cd android && ./gradlew assembleRelease --no-daemon

# 修改后（只构建 stagingRelease）：
run: cd android && ./gradlew assembleStagingRelease --no-daemon -PreactNativeArchitectures=arm64-v8a
```

> **说明**：`build.yml` 主要用于 release 触发和 workflow_dispatch。由于项目有 `staging` 和 `production` 两种 flavor，`assembleRelease` 会构建两个 flavor 的 release 变体。应该用 `assembleStagingRelease`（或根据环境变量动态选择），就像 [`deploy.yml`](.github/workflows/deploy.yml:120) 已经正确处理的那样。

---

### 步骤 3：增大 Gradle JVM 堆内存

**目标**：给 Gradle 守护进程分配更多内存，避免 JVM 触发 OOM。

**修改文件**：[`android/gradle.properties`](android/gradle.properties:13)

```properties
# 修改前：
org.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=1024m --add-opens=...

# 修改后：
org.gradle.jvmargs=-Xmx4g -XX:MaxMetaspaceSize=1024m --add-opens=...
```

> **说明**：从 2GB 增加到 4GB。GitHub runner 有 7GB 总内存，分配 4GB 给 Gradle JVM 是安全的。同时，`-Xmx4g` 比 `-Xmx4096m` 更清晰易读。

---

### 步骤 4：增加 CI 超时时间（可选但推荐）

**目标**：给构建留出充足时间，避免因超时被取消。

**修改文件**：[`.github/workflows/build.yml`](.github/workflows/build.yml:25)

```yaml
# 修改前：
timeout-minutes: 30

# 修改后：
timeout-minutes: 45
```

同样修改 [`deploy.yml`](.github/workflows/deploy.yml:70)：

```yaml
# 修改前：
timeout-minutes: 30

# 修改后：
timeout-minutes: 45
```

---

### 步骤 5（可选）：考虑去掉 `--no-daemon`

**目标**：允许 Gradle 守护进程在多次 CI 运行间复用，减少启动开销。

但需要配合 Gradle 缓存策略，且 GitHub Actions 的 runner 每次都是全新的环境，所以 `--no-daemon` 实际上影响不大。这一步可以跳过。

---

## 影响范围

| 修改文件                       | 影响                                   |
| ------------------------------ | -------------------------------------- |
| `.github/workflows/build.yml`  | CI 构建（release / workflow_dispatch） |
| `.github/workflows/deploy.yml` | CI 部署（push 到 main/test 分支）      |
| `android/gradle.properties`    | 所有 Android 构建（包括本地开发）      |

## 验证方法

1. **本地验证**：`cd android && ./gradlew assembleStagingRelease -PreactNativeArchitectures=arm64-v8a --no-daemon`
2. **CI 验证**：触发 `workflow_dispatch` 选择 staging 环境，观察构建是否通过
3. **生产构建**：触发 production 构建，确认 bundleProductionRelease 也能通过
