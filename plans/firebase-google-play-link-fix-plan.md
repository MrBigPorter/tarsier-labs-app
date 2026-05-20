# Plan: Fix Firebase App Distribution CI Failure — Google Play Linking Required

## Problem

CI pipeline [`deploy.yml`](../.github/workflows/deploy.yml) fails at the "Upload to Firebase App Distribution" step with:

```
Error: Failed to upload release. There's been an error uploading your app bundle.
Your Firebase project needs to be connected to your Google Play developer account.
Visit the App Distribution page in the Firebase Console for more information.
```

## Root Cause

Firebase App Distribution requires the Firebase project to be linked to a Google Play Console account. The Firebase project `adroit-outlet-444914-m0` has the Android app `com.tarsier.labs` registered (App ID: `1:1065683669109:android:48f4e979b9d9dacf7a283c`), but the Firebase<->Google Play link is not established.

**This is not a code issue.** The CI script, Firebase service account authentication, and Android build all succeed. The failure is purely a Firebase Console / Google Play Console configuration prerequisite.

## Prerequisites

- ✅ Google Play Developer account (already registered)
- ❌ App not yet created in Google Play Console

## Steps

### Step 1: Create App in Google Play Console

1. Open https://play.google.com/console
2. Sign in with your Google Developer account
3. Click **+ Create app** button (top right)
4. Fill in the form:

   | Field                | Value                                                  |
   | -------------------- | ------------------------------------------------------ |
   | **Name**             | `Tarsier`                                              |
   | **Default language** | English (or your preference)                           |
   | **App or game**      | App                                                    |
   | **Free or paid**     | Free                                                   |
   | **Package name**     | `com.tarsier.labs` (must match `google-services.json`) |

5. Click **Create app**

> ⚠️ **Important**: You don't need to fill in the full store listing (descriptions, screenshots, etc.) for Firebase App Distribution to work. The app just needs to exist in Play Console.

### Step 2: Link Firebase to Google Play

1. Open Firebase Console: https://console.firebase.google.com
2. Select project **`adroit-outlet-444914-m0`**
3. Go to **Project Settings** (gear icon top left) → **Integrations** tab
4. Find **Google Play** in the integrations list
5. Click **Link** (or **Manage** if already partially linked)
6. Authorize Firebase to access your Google Play Developer account
7. Select the app **`com.tarsier.labs`** (Tarsier)
8. Click **Link** to complete

### Step 3: Verify Firebase App Distribution is Ready

1. In Firebase Console → **App Distribution**
2. Select the Android app `com.tarsier.labs`
3. You should see the page without any "Link to Google Play" prompts
4. Add tester emails if you want (they'll receive install links)

### Step 4: Add Tester Emails (Local)

Edit [`.firebase-testers.txt`](../.firebase-testers.txt) and add tester email addresses, one per line:

```
your-email@gmail.com
tester1@example.com
```

### Step 5: Re-run CI Pipeline

Trigger the pipeline via any of these methods:

- **Push to `test` branch** (triggers test APK build + upload)
- **Push to `main` branch** (triggers production AAB build + upload)
- **Manual trigger**: GitHub → Actions → "Deploy (Test / Production)" → "Run workflow"

## Verification Checklist

- [ ] App created in Google Play Console with package name `com.tarsier.labs`
- [ ] Firebase project `adroit-outlet-444914-m0` linked to Google Play in Project Settings → Integrations
- [ ] The specific Android app `com.tarsier.labs` is associated with the Google Play app
- [ ] `.firebase-testers.txt` has at least one tester email
- [ ] CI pipeline run completes the "Upload to Firebase App Distribution" step successfully
- [ ] Testers receive the app via Firebase email notification

## Troubleshooting

| Symptom                                    | Likely Cause                                 | Solution                                                                                             |
| ------------------------------------------ | -------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Still getting the same error after linking | The Google Play app may not be fully created | Go to Play Console and ensure the app setup is complete (at least "App Integrity" section populated) |
| "App not found" in Firebase linking        | Package name mismatch                        | Verify the package name in Play Console matches `com.tarsier.labs` from `google-services.json`       |
| Firebase says "No apps available"          | The Google Play app hasn't been created yet  | Create the app in Play Console first, then retry linking                                             |
