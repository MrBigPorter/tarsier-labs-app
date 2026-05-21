# CI: Switch from Firebase App Distribution to Direct Google Play Upload

## Problem

CI pipeline (`.github/workflows/deploy.yml:156-189`) fails at Firebase App Distribution upload with:

```
Error: This app is not published in the Google Play console.
```

**Root cause:** The Firebase service account does not have Google Play Console permissions. Even though Firebase project is linked to Google Play, Firebase App Distribution requires the service account to be added as a Play Console user.

## Solution

Replace Firebase App Distribution with direct Google Play Internal Testing upload using `r0adkll/upload-google-play` GitHub Action. This bypasses Firebase entirely — AABs are uploaded directly to Google Play Console's Internal Testing track on each CI run.

## Prerequisites ✅ (Completed by user)

1. ✅ **Enable Google Play Android Developer API** — Google Cloud Console → project `adroit-outlet-444914-m0` → APIs & Services → Library → Android Publisher API → Enable
2. ✅ **Add service account to Play Console** — Google Play Console → Settings → Users & permissions → invite service account as Admin (13 permissions granted)
3. ✅ **Create `PLAY_SERVICE_ACCOUNT_KEY` GitHub Secret** — GitHub repo Settings → Secrets → Actions → new secret with `firebase-service-account.json` content

## Code Changes (Code mode)

### 1. Remove `Decode Firebase service account` step (`deploy.yml:108-122`)

This step decoded `FIREBASE_SERVICE_ACCOUNT` secret to `firebase-service-account.json` for Firebase CLI authentication. Since we're removing Firebase CLI usage, this step is no longer needed.

### 2. Replace `Upload to Firebase App Distribution` with `r0adkll/upload-google-play` (`deploy.yml:156-189`)

**BEFORE:**

```yaml
- name: Upload to Firebase App Distribution
  run: |
    echo "📤 Uploading to Firebase App Distribution..."
    npm install -g firebase-tools@13
    ...
    firebase --non-interactive appdistribution:distribute ...
```

**AFTER (proposed fix — env variable + tracks):**

```yaml
- name: 🔑 Write & validate service account key
  if: ${{ needs.resolve-flavor.outputs.flavor == 'production' }}
  env:
    PLAY_SA_KEY: ${{ secrets.PLAY_SERVICE_ACCOUNT_KEY }}
  shell: bash
  run: |
    echo "$PLAY_SA_KEY" > ${{ github.workspace }}/android-play-sa.json

    # Validate JSON format
    if ! echo '{}' | jq . > /dev/null 2>&1; then
      echo "⚠️ jq not available, skipping JSON validation"
    elif ! jq . ${{ github.workspace }}/android-play-sa.json > /dev/null 2>&1; then
      echo "❌ PLAY_SERVICE_ACCOUNT_KEY is NOT valid JSON!"
      echo "First 200 chars: $(head -c 200 ${{ github.workspace }}/android-play-sa.json)"
      exit 1
    else
      echo "✅ Valid JSON — project: $(jq -r '.project_id' ${{ github.workspace }}/android-play-sa.json)"
      echo "   client_email: $(jq -r '.client_email' ${{ github.workspace }}/android-play-sa.json)"
    fi

- name: 🚀 Upload to Google Play Internal Testing
  if: ${{ needs.resolve-flavor.outputs.flavor == 'production' }}
  uses: r0adkll/upload-google-play@v1
  with:
    serviceAccountJson: ${{ github.workspace }}/android-play-sa.json
    packageName: com.tarsier.labs
    releaseFiles: android/app/build/outputs/bundle/productionRelease/app-production-release.aab
    tracks: internal
    status: completed
```

### 3. Add auto versionCode in `build.gradle` (`android/app/build.gradle:100-101`)

Use `GITHUB_RUN_NUMBER` as `versionCode` in CI, fallback to local dev value.

**BEFORE:**

```groovy
        versionCode 1
        versionName "1.0.0"
```

**AFTER:**

```groovy
        def runNumber = System.getenv("GITHUB_RUN_NUMBER") ?: "1"
        versionCode runNumber.toInteger()
        versionName "1.0.1"
```

## Files NOT changed

- `google-services.json` — unused but harmless, keep as-is
- `FIREBASE_SERVICE_ACCOUNT` GitHub secret — unused but keep
- Decode keystore step — still needed for signing
- All other CI steps remain unchanged

## Execution Order

1. [x] User completes Step 1 — Enable Android Publisher API
2. [x] User completes Step 2 — Add service account to Play Console
3. [x] User completes Step 3 — Create PLAY_SERVICE_ACCOUNT_KEY GitHub Secret
4. [x] Switch to Code mode to modify deploy.yml + build.gradle
5. [x] Commit and push changes (ab00275, 8455103, 760abc7)
6. [x] Update docs: ci-cd-setup-guide.md & android-playstore-release-plan.md
7. [ ] CI re-runs, uploads AAB to Google Play Internal Testing
8. [ ] Verify in Google Play Console that new release appears
