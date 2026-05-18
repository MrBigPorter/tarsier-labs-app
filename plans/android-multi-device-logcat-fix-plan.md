# Android Multi-Device Logcat Fix Plan

## Problem

When running `make dev-android-device`, the deploy script [`scripts/deploy-android-device.sh`](scripts/deploy-android-device.sh) successfully builds and deploys the app, but the final step (Step 5 — Device Logs) fails with:

```
error: more than one device/emulator
```

## Root Cause

The deploy script runs `npx react-native log-android` on [line 464](scripts/deploy-android-device.sh:464) after deployment to stream device logs.

The `react-native log-android` command delegates to `logkitty`, which calls:

```js
// node_modules/logkitty/build/android/adb.js:34
execFileSync(adbPath, ['logcat', '-c']); // Clear logcat buffer
// then
spawn(adbPath, ['logcat', '-v', 'time', 'process', 'tag']); // Stream logs
```

Both calls use `adb` **without** specifying a device serial (`-s <device_id>`). When multiple Android devices or emulators are connected, `adb` returns `error: more than one device/emulator`.

Additionally, the `react-native log-android` CLI command (defined in [`node_modules/@react-native-community/cli-platform-android/build/commands/logAndroid/index.js`](node_modules/@react-native-community/cli-platform-android/build/commands/logAndroid/index.js:42-46)) does **not** accept a `--deviceId` option — it has no options defined.

## Solution

Use the `ANDROID_SERIAL` environment variable. The `adb` tool natively reads `ANDROID_SERIAL` to determine which device to target when `-s` isn't explicitly specified. This is documented Android SDK behavior.

### Changes Required

#### 1. [`scripts/deploy-android-device.sh`](scripts/deploy-android-device.sh:464) — Primary Fix

**Line 464**: Change:

```bash
npx react-native log-android
```

to:

```bash
ANDROID_SERIAL="$SELECTED_ID" npx react-native log-android
```

This scopes the env var to just the `npx` command, so it doesn't pollute the parent shell. `logkitty`'s adb calls will then use the correct device automatically.

#### 2. [`Makefile`](Makefile:160-163) — Secondary Fix (Enhancement)

The `logs-android` target has the same issue — it runs `npx react-native log-android` without a device ID. Enhance it to accept an optional `DEVICE_ID` parameter:

```makefile
logs-android: ## Attach Android device/emulator log stream to running app
	@echo "📱 Starting Android log stream (Ctrl+C to stop)..."
	@echo "   Make sure your app is running on a device or emulator."
	@if [ -n "$(DEVICE_ID)" ]; then \
		ANDROID_SERIAL="$(DEVICE_ID)" npx react-native log-android; \
	else \
		npx react-native log-android; \
	fi
```

This allows: `make logs-android DEVICE_ID=emulator-5554`

### Why Not Patch logkitty?

- `logkitty` is a third-party package in `node_modules`
- The project already uses `patch-package` for other patches, but:
  - Patching logkitty only fixes `react-native log-android` from the CLI
  - The deploy script fix is simpler and more direct
  - logkitty has no mechanism to pass a device ID from the CLI command

### Testing

1. Connect multiple Android devices/emulators:
   ```bash
   adb devices
   # List of devices attached
   # emulator-5554   device
   # 1234567890abcdef  device
   ```
2. Run `make dev-android-device`
3. Verify the app deploys and logs stream without the "more than one device/emulator" error
