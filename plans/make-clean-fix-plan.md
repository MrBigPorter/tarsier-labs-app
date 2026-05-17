# Fix `make clean` Build Failure

## Root Cause

The project was moved from `/Volumes/MySSD/work/frontend-blog-mobile/` to `/Users/porter/Developer/frontend-blog-mobile/`, but stale **generated build artifacts** in `android/build/generated/` were carried over. These files contain hardcoded absolute paths referencing the old location.

### Key Culprit

[`android/build/generated/autolinking/autolinking.json`](../android/build/generated/autolinking/autolinking.json:2) contains:

```json
"root": "/Volumes/MySSD/work/frontend-blog-mobile",
"reactNativePath": "/Volumes/MySSD/work/frontend-blog-mobile/node_modules/react-native",
```

All dependency `sourceDir` paths also point to the old location:

```
/Volumes/MySSD/work/frontend-blog-mobile/node_modules/@react-native-community/netinfo/android
```

When Gradle reads this file during configuration, it tries to resolve project directories at the old path. Since `node_modules` was installed at the new location, those directories don't exist.

## Plan

### Step 1 — Delete stale `android/build/`

```sh
rm -rf android/build/
```

This removes all generated artifacts with hardcoded old paths.

### Step 2 — Re-run `yarn install`

```sh
yarn install
```

React Native's autolinking script regenerates `android/build/generated/autolinking/autolinking.json` with paths rooted at the current project location (`/Users/porter/Developer/frontend-blog-mobile/`).

### Step 3 — Run `make clean`

```sh
make clean
```

Should now succeed since:
- `@react-native/gradle-plugin` is available in `node_modules` (resolved via step 2)
- `autolinking.json` paths point to the correct location
- Gradle can find all dependency Android source directories

## Verification

Successful `make clean` output should look like:

```
🧹 Cleaning build artifacts...
> Task :app:clean
> Task :react-native-community_netinfo:clean
> Task :react-native-gesture-handler:clean
... (etc)
BUILD SUCCESSFUL in Xs
✅ Cleaned
```
