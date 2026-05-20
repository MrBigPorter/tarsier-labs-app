# Plan: Fix CI Build Failure — `postinstall-postinstall`

## Problem Statement

The CI pipeline (`yarn install --immutable --ignore-scripts`) fails at the "Building fresh packages" phase with:

```
error /home/runner/work/tarsier-labs-app/tarsier-labs-app/node_modules/postinstall-postinstall: Command failed.
```

This blocks all CI builds on `main` and `test` branches, preventing Android APK/AAB generation, Firebase App Distribution uploads, and CodePush hot updates.

## Root Cause Analysis

### What is `postinstall-postinstall`?

[`postinstall-postinstall`](package.json:83) is a dev dependency (`^2.1.0`) designed to re-run the **project's** `postinstall` script (which runs `patch-package`) even when `yarn install` is invoked with `--ignore-scripts`.

The package contains its own lifecycle script (`node ./run.js`) that executes during `yarn install`.

### Why does it fail in CI?

1. The CI workflow (lines [90](.github/workflows/deploy.yml:90), [186](.github/workflows/deploy.yml:186), [257](.github/workflows/deploy.yml:257)) runs:
   ```yaml
   yarn install --immutable --ignore-scripts
   ```
2. Despite `--ignore-scripts`, `postinstall-postinstall`'s own `install` script (not `postinstall`) is still triggered by yarn classic v1, and its `run.js` crashes with a non-zero exit code.

### Is `postinstall-postinstall` needed in CI?

**No.** The CI workflow already handles patches **explicitly** as a separate step (lines [92-93](.github/workflows/deploy.yml:92-93), [188-189](.github/workflows/deploy.yml:188-189), [259-260](.github/workflows/deploy.yml:259-260)):

```yaml
- name: Apply patches
  run: npx patch-package
```

So `postinstall-postinstall` is **redundant in CI** — the patches are applied manually right after install.

### Is `postinstall-postinstall` needed locally?

**No.** For local development:

- `yarn install` (without `--ignore-scripts`) runs the `postinstall` script defined in [`package.json:15`](package.json:15) (`"postinstall": "patch-package"`) automatically.
- `make install` (Makefile line 57) runs `yarn install` without `--ignore-scripts`, so patches are applied automatically.
- The only scenario where `postinstall-postinstall` helps is if someone runs `yarn install --ignore-scripts` locally — but this is unnecessary and doesn't happen in the standard dev workflow.

## The Fix

### Step 1: Remove `postinstall-postinstall` from `devDependencies`

Edit [`package.json`](package.json:83) — delete the line:

```json
"postinstall-postinstall": "^2.1.0",
```

### Step 2: Regenerate `yarn.lock`

Run `yarn install` to regenerate the lockfile without `postinstall-postinstall`.

### Step 3: Verify local dev workflow

Run `make install` (or `yarn install` directly) and confirm:

- Patches are applied (check `node_modules` for patched files)
- No errors during install

### Step 4: Push to CI

Push the changes to the `test` branch and verify the CI pipeline completes the `yarn install --immutable --ignore-scripts` step without errors.

## Verification Checklist

- [ ] `postinstall-postinstall` removed from `package.json`
- [ ] `yarn.lock` regenerated and committed
- [ ] Local `yarn install` completes successfully
- [ ] Patches are still applied (`npx patch-package` runs during `postinstall`)
- [ ] CI pipeline passes the "Install dependencies" step
- [ ] Full CI pipeline (build Android + Firebase upload) succeeds on `test` branch

## Rollback Plan

If removing `postinstall-postinstall` causes any unforeseen issues:

1. Re-add the dependency: `yarn add --dev postinstall-postinstall@^2.1.0`
2. Or switch to a pinned version: `"postinstall-postinstall": "2.1.0"`
3. Or replace with an alternative mechanism in CI to ensure patches are applied

## Why This Approach?

| Approach                           | Pros                                     | Cons                            |
| ---------------------------------- | ---------------------------------------- | ------------------------------- |
| **Remove postinstall-postinstall** | Simple, fixes CI, no impact on workflows | —                               |
| Pin version to working release     | May still break                          | Doesn't fix root cause          |
| Add `--ignore-scripts` workaround  | Keeps unused dependency                  | Band-aid, not a fix             |
| Replace with different tool        | More moving parts                        | Over-engineering for simple fix |

Removal is the cleanest solution since the package serves no purpose in either CI or local development workflows.
