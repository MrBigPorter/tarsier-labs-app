# Fix: `react-native-screens` Patch File Parse Error

## Root Cause

The `make install` command failed because Yarn Berry runs the `postinstall` script (`patch-package`) during workspace build, and `patch-package` 8.0.1 **cannot parse** the patch file [`patches/react-native-screens+4.25.0.patch`](patches/react-native-screens+4.25.0.patch).

The build log at `/private/var/folders/7w/zsgmqn7549dff51cd3mq9hqr0000gn/T/xfs-7bd8d9f7/build.log` shows:

```
**ERROR** Failed to apply patch for package react-native-screens
  This happened because the patch file patches/react-native-screens+4.25.0.patch could not be parsed.
```

The working patch file [`patches/@react-native-community+netinfo+11.5.2.patch`](patches/@react-native-community+netinfo+11.5.2.patch) applies successfully, confirming this is an isolated issue with the `react-native-screens` patch.

### Why the Patch Fails to Parse

The broken patch file has:

```
@@ -57,9 +57,9 @@
      private fun setupFabric() {
```

The hunk header `@@ -57,9 +57,9 @@` has an **empty description** (nothing after the trailing `@@`). While this is technically valid in standard unified diff format, `patch-package` 8.x uses a stricter parser that may fail on this format, especially if combined with specific whitespace or encoding issues.

## Fix Steps

### Step 1: Regenerate the patch using `patch-package`

```bash
npx patch-package react-native-screens --use-yarn
```

This will regenerate the patch file at `patches/react-native-screens+4.25.0.patch` with the correct format that `patch-package` 8.0.1 can parse.

### Step 2: Verify the regenerated patch

```bash
cat patches/react-native-screens+4.25.0.patch
```

Confirm the hunk header now includes a proper description after the `@@` markers.

### Step 3: Verify the fix

```bash
yarn install
```

If successful, `yarn install` should complete without errors.

## Alternative Approaches (if Step 1 fails)

If `npx patch-package` cannot regenerate the patch because `node_modules` is not yet fully installed, use one of these alternatives:

**Option A — Manual patch fix:**
Manually edit the patch file to add a description to the hunk header:

```
@@ -57,9 +57,9 @@ private fun setupFabric() {
```

**Option B — Fresh install with patch bypass:**

```bash
YARN_ENABLE_IMMUTABLE_INSTALLS=false yarn install --no-immutable
```

Then regenerate the patch:

```bash
npx patch-package react-native-screens
```

**Option C — Delete and reinstall:**
Remove `node_modules` and the broken patch, reinstall, then regenerate:

```bash
rm -rf node_modules patches/react-native-screens+4.25.0.patch
yarn install
npx patch-package react-native-screens
```
