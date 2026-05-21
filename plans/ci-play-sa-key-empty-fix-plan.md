# CI: Fix Empty PLAY_SERVICE_ACCOUNT_KEY Secret in Google Play Upload Step

## Problem

CI pipeline at [`.github/workflows/deploy.yml:140-144`](../.github/workflows/deploy.yml:140) fails with `Error:` when writing the Google Play service account key:

```
Run echo "${PLAY_SA_KEY}" > /tmp/android-play-sa.json
  env:
    PLAY_SA_KEY:              ← EMPTY!
0s
Error:
0s
Error:
```

`secrets.PLAY_SERVICE_ACCOUNT_KEY` resolves to an empty string.

## Root Cause

Two contributing factors:

### 1. Environment-level secret not configured (primary)

The [`build-android` job](../.github/workflows/deploy.yml:66) uses:

```yaml
environment: ${{ needs.resolve-flavor.outputs.flavor }} # → "production"
```

When a job specifies `environment: production`, GitHub Actions resolves `secrets.*` from the **production environment's secrets** (Settings → Environments → production → Environment secrets). Repository-level secrets may not be accessible when an environment is explicitly declared, depending on how the secret is scoped.

The secret `PLAY_SERVICE_ACCOUNT_KEY` was likely only configured at the repository level or not configured at all for the `production` environment.

### 2. Bash quoting fragility (secondary)

The current command:

```yaml
run: echo "${PLAY_SA_KEY}" > /tmp/android-play-sa.json
```

- If the secret is empty, the step silently writes an empty file (no validation)
- Multi-line JSON secrets with special characters could cause subtle bash quoting issues in `bash -e` mode
- No validation step to confirm the file is valid JSON

## Proposed Changes

### Change 1: Replace the "Write Google Play service account key" step

**File:** [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml:140-144)

Replace:

```yaml
- name: 🔑 Write Google Play service account key
  if: ${{ needs.resolve-flavor.outputs.flavor == 'production' }}
  run: echo "${PLAY_SA_KEY}" > /tmp/android-play-sa.json
  env:
    PLAY_SA_KEY: ${{ secrets.PLAY_SERVICE_ACCOUNT_KEY }}
```

With a more robust step that:

1. Validates the secret is not empty
2. Uses `printf` (safer than `echo` for multi-line content)
3. Validates the resulting file is valid JSON using `jq`
4. Provides clear error messages

```yaml
- name: 🔑 Write & validate Google Play service account key
  if: ${{ needs.resolve-flavor.outputs.flavor == 'production' }}
  env:
    PLAY_SA_KEY: ${{ secrets.PLAY_SERVICE_ACCOUNT_KEY }}
  run: |
    # Validate secret is not empty
    if [ -z "${PLAY_SA_KEY}" ]; then
      echo "❌ ERROR: PLAY_SERVICE_ACCOUNT_KEY is empty or not configured."
      echo ""
      echo "   This secret must be set in the GitHub 'production' environment:"
      echo "   Settings → Environments → production → Environment secrets"
      echo "   Secret name: PLAY_SERVICE_ACCOUNT_KEY"
      echo "   Value: the full JSON content of your Google Play service account key"
      exit 1
    fi

    # Write the key file (printf handles multi-line JSON safely)
    printf '%s' "${PLAY_SA_KEY}" > /tmp/android-play-sa.json

    # Validate it's valid JSON
    if command -v jq > /dev/null 2>&1; then
      if ! jq . /tmp/android-play-sa.json > /dev/null 2>&1; then
        echo "❌ ERROR: PLAY_SERVICE_ACCOUNT_KEY is not valid JSON"
        echo "   First 200 chars: $(head -c 200 /tmp/android-play-sa.json)"
        exit 1
      fi
      echo "✅ Service account key written & validated"
      echo "   Project: $(jq -r '.project_id' /tmp/android-play-sa.json)"
      echo "   Client email: $(jq -r '.client_email' /tmp/android-play-sa.json)"
    else
      echo "⚠️  jq not available, skipping JSON validation"
      echo "   File written: $(wc -c < /tmp/android-play-sa.json) bytes"
    fi
```

### Change 2: (No code change required) Ensure the secret is in the right place

The user must verify that `PLAY_SERVICE_ACCOUNT_KEY` exists in:

**GitHub Repo → Settings → Environments → `production` → Environment secrets**

Not just at:

- Repository-level secrets (Settings → Secrets and variables → Actions → Repository secrets)

The `production` environment must also have no protection rules blocking the job (required reviewers, wait timer, etc.) if CI needs to run automatically.

## Files to Modify

| File                                                              | Change                | Purpose                                             |
| ----------------------------------------------------------------- | --------------------- | --------------------------------------------------- |
| [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) | Replace lines 140-144 | Add validation, safer writing, clear error messages |

## No Changes Needed

- [`scripts/upload-android-play-store.mjs`](../scripts/upload-android-play-store.mjs) — already has proper validation at lines 44-48 (checks file exists, exits with clear message)
- All other CI steps remain unchanged
- No new secrets need to be created (just verify placement)

## Verification

After the fix:

1. CI re-runs on `main` branch push
2. The "Write & validate Google Play service account key" step passes with green checkmark
3. The upload script runs and the AAB appears in Google Play Console Internal Testing
