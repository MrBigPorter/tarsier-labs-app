# Plan: Fix Firebase App Distribution CI Failure — `unknown option '--quiet'`

## Problem Statement

The CI pipeline [`deploy.yml`](.github/workflows/deploy.yml) fails at the "Upload to Firebase App Distribution" step with:

```
error: unknown option '--quiet'
Error: Process completed with exit code 1.
```

This blocks the entire `build-android` job, preventing the Android APK/AAB from being uploaded to Firebase App Distribution for both test and production flavors.

## Root Cause Analysis

### Where does the error occur?

In [`deploy.yml`](.github/workflows/deploy.yml:144-165), the Firebase upload step:

```yaml
- name: Upload to Firebase App Distribution
  run: |
    echo "📤 Uploading to Firebase App Distribution..."
    npm install -g firebase-tools
    export GOOGLE_APPLICATION_CREDENTIALS=firebase-service-account.json
    ...
    firebase appdistribution:distribute "$APK_PATH" \
      --app "$FIREBASE_APP_ID" \
      --testers-file .firebase-testers.txt \
      --release-notes "CI Build: $(git log -1 --pretty=%s)" \
      --quiet                    # <-- THIS FLAG CAUSES THE FAILURE
```

### Why does `--quiet` fail?

The command `npm install -g firebase-tools` ([line 147](.github/workflows/deploy.yml:147)) installs the **latest** version of firebase-tools with **no version pin**. When a newer version of `firebase-tools` is published that changes, removes, or renames the `--quiet` flag for the `appdistribution:distribute` subcommand, the CI pipeline breaks.

The `--quiet` flag is a **global** Firebase CLI flag intended to suppress non-essential output. However, in recently released versions of firebase-tools (v13+), the `appdistribution:distribute` command may no longer accept this global flag at the subcommand level, causing the `unknown option` error.

### Two issues at play:

| Issue                                 | Detail                                                                                                                                                                                   |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Unpinned version**               | `npm install -g firebase-tools` (no `@version`) means every CI run installs the latest release — builds are not reproducible and can break unexpectedly when a new version is published. |
| **2. `--quiet` flag incompatibility** | The latest firebase-tools version no longer accepts `--quiet` for `appdistribution:distribute`.                                                                                          |

## The Fix

### Step 1: Remove `--quiet` from the Firebase distribute command

The `--quiet` flag is **not needed in CI** because:

- GitHub Actions runners are non-interactive by default (no TTY) — output is already minimized
- The flag was only suppressing non-critical output; removing it won't affect functionality
- The upload will still succeed without it

Change in [`deploy.yml`](.github/workflows/deploy.yml:161):

```yaml
# BEFORE:
firebase appdistribution:distribute "$APK_PATH" \
  --app "$FIREBASE_APP_ID" \
  --testers-file .firebase-testers.txt \
  --release-notes "CI Build: $(git log -1 --pretty=%s)" \
  --quiet

# AFTER:
firebase appdistribution:distribute "$APK_PATH" \
  --app "$FIREBASE_APP_ID" \
  --testers-file .firebase-testers.txt \
  --release-notes "CI Build: $(git log -1 --pretty=%s)"
```

### Step 2: Pin `firebase-tools` to a known-stable version

To prevent future breakage from unpinned dependency updates, pin the installed version to `firebase-tools@13` (or a specific known-stable version):

```yaml
# BEFORE:
npm install -g firebase-tools

# AFTER:
npm install -g firebase-tools@13
```

Version 13 is chosen because:

- It has broad support for `appdistribution:distribute` without the `--quiet` requirement
- It's a mature, stable major version
- Can be updated intentionally later by bumping the pin

### Step 3: Verify with a CI run

Push the changes to the `test` branch and verify:

- Android build completes successfully
- Firebase App Distribution upload step succeeds
- Testers receive the APK

## Verification Checklist

- [ ] `--quiet` flag removed from the `firebase appdistribution:distribute` command in [`deploy.yml`](.github/workflows/deploy.yml:161)
- [ ] `firebase-tools` version pinned to `@13` in [`deploy.yml`](.github/workflows/deploy.yml:147)
- [ ] CI pipeline on `test` branch completes the "Upload to Firebase App Distribution" step successfully
- [ ] App is distributed to testers (check Firebase Console)

## Alternatives Considered

| Approach                                 | Pros                                              | Cons                                                                          |
| ---------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------- |
| **Remove `--quiet` + pin version**       | Simple, fixes the issue, prevents future breakage | Requires manual version bumps                                                 |
| **Only remove `--quiet`**                | Quick fix                                         | Future firebase-tools updates could introduce other breaking changes          |
| **Only pin version with `--quiet` kept** | Preserves cleaner logs                            | `--quiet` may still not work with the pinned version depending on sub-version |
| **Use `--non-interactive` instead**      | Similar intent                                    | Not a standard firebase-tools flag; may not exist                             |

Removing `--quiet` + pinning the version is the cleanest solution since it fixes the immediate failure and prevents future CI breakage from unpinned dependency updates.
