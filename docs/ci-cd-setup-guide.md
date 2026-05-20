# CI/CD Setup Guide — Step by Step

This guide walks you through configuring the CI/CD pipeline for **Tarsier** (frontend-blog-mobile). Follow these steps in order — each section tells you exactly which page to open and what to click.

---

## Table of Contents

1. [Self-Hosted CodePush Setup](#1-self-hosted-codepush-setup)
2. [GitHub Secrets Configuration](#2-github-secrets-configuration)
3. [Android Keystore for CI](#3-android-keystore-for-ci)
4. [GitHub Environments](#4-github-environments)
5. [iOS Code Signing (Future)](#5-ios-code-signing-future)
6. [Verification Checklist](#6-verification-checklist)

---

## 1. Self-Hosted CodePush Setup

> ⚠️ **App Center was retired on March 31, 2025.** This project uses a **self-hosted `code-push-server`** running on your Bluehost VPS at `https://codepush.joyminis.com`.

The pipeline uses the self-hosted CodePush server to push over-the-air JavaScript updates without app store review.

### 1.1 Prerequisites — Server must be running

Before proceeding, confirm your VPS has `code-push-server` running:

```sh
# SSH into your VPS and check
ssh root@<your-vps-ip>
docker compose -f /opt/lucky/compose.codepush.yml ps
# Should show "codepush" service as "Up"
```

Also verify the Cloudflare Tunnel routes `codepush.joyminis.com` to the CodePush container:

```sh
curl -s https://codepush.joyminis.com
# Should return: {"status":"OK"} (or similar JSON)
```

If the server is not yet set up, follow the guide at [`docs/self-hosted-codepush-implementation.md`](./self-hosted-codepush-implementation.md) first.

### 1.2 Create Admin User & Generate Access Key

> ⚠️ **`lisong/code-push-server` does NOT have a `bin/cli.js` file.**
> Admin user must be created directly in MySQL. Access keys are generated via REST API.

**Step 1 — Create admin user in MySQL:**

```sh
ssh root@<your-vps-ip>

# Generate bcrypt password hash using code-push-server's bcryptjs
HASH=$(docker compose -f /opt/lucky/compose.codepush.yml exec -T codepush \
  node -e "const b=require('bcryptjs');console.log(b.hashSync('your-admin-password',12))")

# Insert admin user into MySQL
IDENTICAL=$(openssl rand -hex 9)
docker compose -f /opt/lucky/compose.codepush.yml exec -T codepush-mysql \
  mysql -u root codepush -e \
  "INSERT INTO users (email, password, identical, created_at, updated_at)
   VALUES ('admin@joyminis.com', '$HASH', '$IDENTICAL', NOW(), NOW())"

echo "Admin user created: admin@joyminis.com"
```

**Step 2 — Login via REST API to get JWT token:**

```sh
# SSH to VPS and login via API
ssh root@<your-vps-ip>

TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@joyminis.com","password":"your-admin-password"}' | \
  node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).data.token))")

echo "JWT Token obtained"
```

**Step 3 — Generate an access key for CI (valid 365 days):**

```sh
ACCESS_KEY=$(curl -s -X POST http://localhost:3000/accessKeys \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"ci-key","ttl":365}' | \
  node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).data.accessKey))")

echo "Access Key: $ACCESS_KEY"
# Copy this key — you'll need it as CODEPUSH_ACCESS_KEY
```

**Or use the Makefile + script shortcut:**

```sh
make codepush-create-key SSH_HOST=root@<your-vps-ip>
```

### 1.3 Create CodePush Apps & Get Deployment Keys

You need **4 apps** on the self-hosted server (2 names × 2 platforms):

| App Name              | Platform | Purpose                         |
| --------------------- | -------- | ------------------------------- |
| `TarsierTest-android` | Android  | Test hot updates (CI automated) |
| `TarsierTest-ios`     | iOS      | Test hot updates (CI automated) |
| `Tarsier-android`     | Android  | Production hot updates (manual) |
| `Tarsier-ios`         | iOS      | Production hot updates (manual) |

**Login locally first:**

```sh
make codepush-login TOKEN=<access-key-from-step-1.2>
```

**Create the 4 apps:**

```sh
code-push-standalone app add TarsierTest-android android react-native
code-push-standalone app add TarsierTest-ios ios react-native
code-push-standalone app add Tarsier-android android react-native
code-push-standalone app add Tarsier-ios ios react-native
```

**Get the deployment keys:**

```sh
make codepush-keys
```

This shows all 4 apps' `Staging` and `Production` deployment keys.

**Key mapping:**

| Key                                | Where to put it                                                                                                   |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `TarsierTest-android` — Staging    | [`android/app/build.gradle:139`](../android/app/build.gradle:139) — replace `CODEPUSH_KEY_TEST_PLACEHOLDER`       |
| `TarsierTest-android` — Production | [`android/app/build.gradle:151`](../android/app/build.gradle:151) — replace `CODEPUSH_KEY_PRODUCTION_PLACEHOLDER` |
| `TarsierTest-ios` — Staging        | iOS xcconfig `CODEPUSH_DEPLOYMENT_KEY` (Test config)                                                              |
| `TarsierTest-ios` — Production     | iOS xcconfig `CODEPUSH_DEPLOYMENT_KEY` (Prod config)                                                              |
| `Tarsier-android` Staging/Prod     | Used manually via `make codepush-release-production`                                                              |
| `Tarsier-ios` Staging/Prod         | Used manually via `make codepush-release-production`                                                              |

---

## 2. GitHub Secrets Configuration

### 2.1 Navigate to the Secrets page

1. Open your GitHub repo: `https://github.com/<your-org>/frontend-blog-mobile`
2. Click the **Settings** tab (top bar)
3. In the left sidebar, expand **Secrets and variables** → click **Actions**
4. You're on the **Secrets** tab

### 2.2 Add each secret one by one

Click **+ New repository secret** for each of the following:

| #   | Secret Name           | Value / How to get it                                                              |
| --- | --------------------- | ---------------------------------------------------------------------------------- |
| 1   | `CODEPUSH_SERVER_URL` | `https://codepush.joyminis.com` (your self-hosted server URL)                      |
| 2   | `CODEPUSH_ACCESS_KEY` | The access key generated in [Section 1.2](#12-register-admin--generate-access-key) |
| 3   | `KEYSTORE_FILE`       | `app/release-upload-key.keystore` (this is the relative path from `android/`)      |
| 4   | `KEYSTORE_PASSWORD`   | Your keystore password (the one you set when generating the upload key)            |
| 5   | `KEY_ALIAS`           | `upload-key` (or whatever alias you set during keystore generation)                |
| 6   | `KEY_PASSWORD`        | Your key password (may be same as keystore password)                               |

For each secret:

1. Click **+ New repository secret**
2. Enter the **Name** (copy exactly from the table above — case-sensitive)
3. Paste the **Value**
4. Click **Add secret**

✅ Done when you see all 6 secrets listed.

---

## 3. Android Keystore for CI

The CI runner needs the `release-upload-key.keystore` file to sign Android release builds. This file is **gitignored** (see [`.gitignore:34`](../.gitignore:34): `*.keystore`), so CI can't access it unless you provide it.

### Option A: Base64-encoded secret (recommended)

**Step 1: Encode the keystore file**

Run this in your terminal (from the project root):

```sh
base64 -i android/app/release-upload-key.keystore | pbcopy
```

This base64-encodes the keystore and copies the result to your clipboard.

**Step 2: Create a GitHub Secret**

1. Go to GitHub **Settings → Secrets and variables → Actions → Secrets**
2. Click **+ New repository secret**
3. Name: `KEYSTORE_BASE64`
4. Paste the base64 string (from clipboard)
5. Click **Add secret**

**Step 3: Add a decode step to deploy.yml**

Open [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) and add this step **before** the "Build Android" step (around line 104):

```yaml
- name: Decode keystore
  run: |
    echo "${{ secrets.KEYSTORE_BASE64 }}" | base64 -d > android/app/release-upload-key.keystore
```

### Option B: Commit the keystore file (simpler but less secure)

If you don't want to deal with base64 encoding, you can force-add the keystore:

```sh
git add -f android/app/release-upload-key.keystore
git commit -m "Add Android upload keystore for CI builds"
```

> ⚠️ Only do this if you understand the risks — anyone with repo access can sign release builds.

---

## 4. GitHub Environments

The pipeline references two GitHub Environments: `test` and `production`.

1. Go to your repo **Settings → Environments**
2. Click **+ New environment**
3. Name it `test` → click **Configure**
4. (Optional) Under **Protection rules**, add **Required reviewers** to control who can deploy to test
5. Click **Save protection rules**
6. Click **+ New environment** again
7. Name it `production` → click **Configure**
8. (Optional but recommended) Add **Required reviewers** for production
9. Click **Save protection rules**

---

## 5. iOS Code Signing (Future)

Currently, the CI pipeline builds iOS archives without code signing:

```yaml
CODE_SIGN_STYLE=Manual
CODE_SIGNING_REQUIRED=NO
CODE_SIGNING_ALLOWED=NO
```

This means the `.xcarchive` produced by CI **cannot be uploaded to App Store Connect**. For now, production iOS releases must be built locally and distributed via Xcode Organizer (see "Apple App Store Release" in the README).

When you're ready to set up CI code signing:

1. **Enroll in Apple Developer Program** ($99/year) at [developer.apple.com](https://developer.apple.com/programs/)
2. **Set up fastlane match** to manage certificates and provisioning profiles:

   ```sh
   # Install fastlane
   cd ios && bundle init && bundle add fastlane

   # Initialize match
   bundle exec fastlane match init
   ```

3. Store these as GitHub Secrets:
   - `MATCH_PASSWORD` — password for the encrypted match repo
   - `APP_STORE_CONNECT_API_KEY` — App Store Connect API key (JSON)
4. Update the `build-ios` job in `deploy.yml` to:
   - Run `fastlane match` to install certificates
   - Sign the build properly
   - Run `xcodebuild -exportArchive` to produce a signed `.ipa`

---

## 6. Verification Checklist

After completing all the steps above, verify everything is ready:

### Self-Hosted CodePush Server

- [ ] `compose.codepush.yml` deployed (via `deploy.sh --sync`)
- [ ] `codepush.joyminis.com` ingress added to `cloudflared.yml`
- [ ] CodePush container running: `docker compose ps` shows `codepush` as `Up`
- [ ] Server responds: `curl https://codepush.joyminis.com` returns JSON
- [ ] Admin user registered on server
- [ ] Access key generated (used as `CODEPUSH_ACCESS_KEY`)
- [ ] 4 apps created on server: `TarsierTest-android`, `TarsierTest-ios`, `Tarsier-android`, `Tarsier-ios`
- [ ] Deployment keys visible via `make codepush-keys`

### GitHub Secrets

- [ ] `CODEPUSH_SERVER_URL`
- [ ] `CODEPUSH_ACCESS_KEY`
- [ ] `KEYSTORE_FILE`
- [ ] `KEYSTORE_PASSWORD`
- [ ] `KEY_ALIAS`
- [ ] `KEY_PASSWORD`
- [ ] (Optional) `KEYSTORE_BASE64` if using Option A

### Android

- [ ] Deployment keys replaced in [`android/app/build.gradle:139-151`](../android/app/build.gradle:139)
- [ ] `ServerUrl` resValue set to `https://codepush.joyminis.com` (line 141, 153)
- [ ] Keystore file accessible by CI (base64 secret or committed)

### iOS

- [ ] `CodePushServerURL` key added to [`Info.plist:76`](../ios/FrontendBlogMobile/Info.plist:76)
- [ ] `CodePushDeploymentKey` uses `$(CODEPUSH_DEPLOYMENT_KEY)` variable

### GitHub

- [ ] `test` environment created
- [ ] `production` environment created

### CI/CD

- [ ] `deploy.yml` updated: CodePush job uses `code-push-standalone` with `CODEPUSH_SERVER_URL` + `CODEPUSH_ACCESS_KEY`

---

> **Pro tip:** Push to the `test` branch to trigger a trial run of the pipeline. Check the Actions tab in GitHub to see if all jobs succeed.
