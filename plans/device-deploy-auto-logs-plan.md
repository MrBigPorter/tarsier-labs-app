# 真机部署 + 自动日志方案

## 目标

一个命令完成「部署到真机 + 自动显示日志」，不再需要手动开第二个终端。

## 修改清单

### 1. 修改 `scripts/deploy-ios-device.sh`

**改动：** 部署成功后自动启动 `npx react-native log-ios`

流程变为：
1. 选择设备（交互式）
2. 检查 Metro（自动启动）
3. `xcodebuild` 编译
4. `ios-deploy` 安装到真机
5. **自动启动 `log-ios`** → 实时显示设备日志，直到用户 Ctrl+C

伪代码：
```bash
# After successful ios-deploy:
info "Starting device log stream (Ctrl+C to stop)..."
npx react-native log-ios
```

`log-ios` 会在 Ctrl+C 时退出，同时会触发脚本后面的 cleanup 杀掉 Metro（如果脚本启动了 Metro）。

### 2. 新建 `scripts/deploy-android-device.sh`

Android 不需要像 iOS 那样绕过 devicectl，`react-native run-android` 直接就能部署到 USB 真机。所以脚本相对简单：

1. 检查 adb 设备连接
2. 列出连接的 Android 设备（`adb devices`）
3. 交互式选择设备
4. 运行 `npx react-native run-android --deviceId <DEVICE_ID>`
5. 部署成功后自动启动 `npx react-native log-android`

### 3. 更新 `Makefile`

```makefile
dev-android-device: env-dev ## Build & run on Android Device (USB) + auto logs
	./scripts/deploy-android-device.sh
```

同时更新 `.PHONY`。

### 4. 更新 `package.json`

```json
"android:device": "./scripts/deploy-android-device.sh",
```

## 使用方式

```bash
# iOS 真机部署 + 自动日志
make dev-ios-device

# Android 真机部署 + 自动日志
make dev-android-device

# 或者
yarn ios:device
yarn android:device
```

## 文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `scripts/deploy-ios-device.sh` | 修改 | 末尾添加自动启动 `log-ios` |
| `scripts/deploy-android-device.sh` | 新建 | Android 版部署脚本 |
| `Makefile` | 修改 | 添加 `dev-android-device` target |
| `package.json` | 修改 | 添加 `android:device` script |
