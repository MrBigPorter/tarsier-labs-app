# Debugging Setup Plan — React Native 0.85.3

## Background

You asked about installing **Flipper** for debugging [`FrontendBlogMobile`](package.json:2). After analyzing the project, here's the key finding:

**Flipper is incompatible with React Native 0.85.3.** Flipper was deprecated in RN 0.74 (April 2024) and completely removed in RN 0.76+. Your project is on RN 0.85.3, which uses the new **Fusebox debugging architecture** built directly into Metro.

The old `use_flipper!()` Podfile configuration and FlipperKit dependencies no longer exist in RN 0.85 — the Podfile at [`ios/Podfile`](ios/Podfile) confirms zero Flipper integration.

---

## What RN 0.85.3 Provides Instead

### 1. Metro Built-in Debugger (Fusebox)

The Metro terminal itself is the primary debugging interface:

| Metro Key | Action |
|-----------|--------|
| `j` | Open React DevTools (components, props, state) |
| `d` | Open Dev Menu on connected device/simulator |
| `l` | Toggle log streaming (shows `console.log` in terminal) |
| `r` | Reload JavaScript bundle |

**This is the WebStorm Terminal approach you mentioned** — all `console.log` calls appear directly in the Metro terminal when log streaming is enabled.

### 2. React DevTools (Already Installed)

[`react-devtools`](package.json:75) (v7) is already in `devDependencies`. You can launch it standalone:

```bash
make devtools
# or
npx react-devtools
```

This opens a standalone DevTools window showing component tree, props, and state — works via WebSocket to the Metro server.

### 3. Device Log Streaming (Already Working for Android, Needs Fix for iOS)

The deploy scripts already handle this:

- [`scripts/deploy-android-device.sh`](scripts/deploy-android-device.sh:225-228) — ✅ Auto-streams logs via `npx react-native log-android` after deploy
- [`scripts/deploy-ios-device.sh`](scripts/deploy-ios-device.sh:235-253) — ❌ Only shows **manual instructions** instead of auto-streaming

### 4. Custom Logger (Already Built)

[`src/lib/logger/index.ts`](src/lib/logger/index.ts) — Your `[Tarsier]` logger with level filtering is already in place. All logger output goes to `console.*` which appears in Metro terminal.

---

## Proposed Changes

### Change 1: Fix iOS Deploy Script — Auto-Stream Logs

Modify [`scripts/deploy-ios-device.sh`](scripts/deploy-ios-device.sh) Step 5 to auto-start `npx react-native log-ios` after successful deploy, matching the Android script behavior.

### Change 2: Add `make logs-ios` / `make logs-android` Targets

Add convenience Makefile targets to quickly start log streaming for an already-running app, without needing to re-deploy.

### Change 3: Add `make fusebox` Target

Add a Makefile target that explains the Metro debugger keyboard shortcuts and opens React DevTools.

---

## Workflow Summary

After these changes, debugging workflows will be:

| Scenario | Command / Action |
|----------|-----------------|
| **Dev + auto logs** (simulator) | `make dev-ios` — logs appear in Metro terminal (press `l`) |
| **Deploy to device + auto logs** | `make dev-ios-device` — auto-streams `log-ios` after deploy |
| **Already running + logs** | `make logs-ios` — attaches `log-ios` to running app |
| **React DevTools** | `make devtools` — standalone component inspector |
| **Metro debug menu** | Press `j` in Metro terminal for DevTools, `d` for Dev Menu |

---

## What NOT to Do

- ❌ **Do NOT install Flipper** — unsupported in RN 0.85, no Podspecs available, would require manual integration that may break
- ❌ **Do NOT use Chrome DevTools** — the old Chrome debugger (`--debug` flag) is also deprecated in RN 0.85; Fusebox replaces it

---

## Files to Modify

| File | Action | Description |
|------|--------|-------------|
| [`scripts/deploy-ios-device.sh`](scripts/deploy-ios-device.sh) | Modify | Replace Step 5 manual instructions with auto `npx react-native log-ios` |
| [`Makefile`](Makefile) | Modify | Add `logs-ios`, `logs-android`, `fusebox` targets |
