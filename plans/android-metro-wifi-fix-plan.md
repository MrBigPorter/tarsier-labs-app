# Metro Dev Server WiFi Connection Fix

## Problem

When running the Android app over WiFi (not USB), Metro shows "Cannot connect to Metro" error. The dev server is only listening on `127.0.0.1` (localhost), making it inaccessible from other devices on the network.

## Root Cause

The `package.json` start script runs:

```
"start": "react-native start"
```

By default, `react-native start` in RN CLI 20.x binds Metro to `127.0.0.1:8081`, which only accepts connections from the local machine. Android devices connecting over WiFi need to reach the dev computer's LAN IP address.

## Changes Required

### 1. `package.json` — Add `--host 0.0.0.0` flag

Change the start script to bind Metro to all network interfaces:

```diff
- "start": "react-native start",
+ "start": "react-native start --host 0.0.0.0",
```

### 2. `scripts/deploy-android-device.sh` — Update Metro launch

Line 178 currently starts Metro without the host flag:

```bash
cd "$PROJECT_DIR" && yarn start > /tmp/metro-bundler.log 2>&1 &
```

No change needed here since it runs `yarn start` which will use the updated script.

## Post-Fix Steps (manual, on the Android device)

After rebuilding the app:

1. Shake the device to open Dev Menu
2. Go to **Settings** → **Debug server host & port for device**
3. Enter your computer's LAN IP + port (e.g., `192.168.1.100:8081`)
4. Go back and select **Reload**

### How to find your LAN IP on macOS:

```bash
ipconfig getifaddr en0
# or
ifconfig | grep inet | grep -v 127.0.0.1
```

## How ADB Reverse Works (alternative)

If USB is connected, this command forwards port 8081:

```bash
adb reverse tcp:8081 tcp:8081
```

This is why USB works without the `--host 0.0.0.0` flag — ADB handles the forwarding.
