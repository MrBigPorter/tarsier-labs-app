# Android Build Fix

## Problem

`make clean` failed with `Cannot convert '' to File` — Gradle's `.execute(null, rootDir)` doesn't inherit `PATH`, so Volta's `node` returns empty string.

## Fixes

| # | Issue | Fix |
|---|-------|-----|
| 1 | `ANDROID_SDK_ROOT` → non-existent dir | Created [`android/local.properties`](android/local.properties), cleaned [`~/.zshrc`](Users/porter/.zshrc) |
| 2 | netinfo `.execute(null, rootDir)` | [`patches/@react-native-community+netinfo+11.5.2.patch`](patches/@react-native-community+netinfo+11.5.2.patch) — uses `providers.exec` instead; applied via `postinstall` in [`package.json`](package.json) |
| 3 | reanimated & keychain same bug | Added `ext.REACT_NATIVE_NODE_MODULES_DIR` in [`android/app/build.gradle`](android/app/build.gradle) — pre-sets path so they skip `node` call entirely |

## For New Devs

```bash
git clone <repo> && cd frontend-blog-mobile
yarn install     # postinstall auto-applies netinfo patch
make clean       # BUILD SUCCESSFUL
```
