# Self-Hosted CodePush Server — Architecture & Migration Plan

> **Status:** Draft for review  
> **Context:** App Center retired March 31, 2025 — management API endpoints are gone.  
> `code-push-server` (Microsoft, archived, MIT) + `code-push-standalone` (community CLI) are the self-hosted alternatives.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Resource Requirements](#2-resource-requirements)
3. [Deployment Options](#3-deployment-options)
4. [Step-by-Step Setup Guide](#4-step-by-step-setup-guide)
5. [Changes Required in This RN App](#5-changes-required-in-this-rn-app)
6. [CI/CD Integration](#6-cicd-integration)
7. [Migration: Move Existing Releases](#7-migration-move-existing-releases)
8. [Cost Analysis](#8-cost-analysis)
9. [Alternatives Comparison](#9-alternatives-comparison)
10. [Recommendation](#10-recommendation)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Your Server (VPS / Docker)             │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │               code-push-server (Node.js)           │   │
│  │  ┌─────────────┐  ┌────────────────────────────┐  │   │
│  │  │  API Server  │  │  REST API Endpoints:       │  │   │
│  │  │  (Express)   │  │  - apps, deployments,      │  │   │
│  │  │              │  │    releases, users,        │  │   │
│  │  │  Port 3000   │  │    accessKeys, auth        │  │   │
│  │  └──────┬───────┘  └────────────────────────────┘  │   │
│  │         │                                            │   │
│  │  ┌──────▼──────────────────┐                        │   │
│  │  │    MySQL 5.7             │                        │   │
│  │  │    (codepush 数据库)      │                        │   │
│  │  │    Port 3306             │                        │   │
│  │  └─────────────────────────┘                        │   │
│  │                                                      │   │
│  │  Storage: codepush-storage volume (.zip 更新包)      │   │
│  │  Cache:   codepush-redis (可选)                      │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  Exposed via: Cloudflare Tunnel → codepush.joyminis.com │
└──────────────┬───────────────────────────────────────────┘
                │
                │ Internet (HTTPS)
                │
     ┌──────────┴──────────────────┐
     │                              │
     ▼                              ▼
┌─────────────────┐     ┌───────────────────┐
│  Mobile App      │     │  CI/CD (GitHub     │
│  (iOS + Android)  │     │  Actions / CLI)    │
│                  │     │                    │
│  Points to:      │     │  Uses:             │
│  https://code-   │     │  code-push-        │
│  push.joyminis   │     │  standalone        │
│  .com/           │     │                    │
└─────────────────┘     └───────────────────┘
```

### Component Stack

| Component                  | Description                                                                                            | Source                                                                               |
| -------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| **code-push-server**       | Node.js Express API server (lisong fork), stores packages on local filesystem, uses **MySQL** for data | [GitHub](https://github.com/lisong/code-push-server) (MIT, actively maintained fork) |
| **code-push-standalone**   | CLI for managing apps/deployments/releases against self-hosted server                                  | [npm](https://www.npmjs.com/package/code-push-standalone) v0.0.1                     |
| **react-native-code-push** | RN plugin v9.0.1 — **no changes needed** (already using)                                               | Current project                                                                      |
| **code-push** (client SDK) | SDK bundled inside RN plugin that communicates with server                                             | v4.2.3 (inside node_modules)                                                         |
| **MySQL 5.7**              | Database for users, apps, deployments, releases metadata                                               | `mysql:5.7` Docker image                                                             |
| **Redis 4.0**              | Optional caching / login rate limiting                                                                 | `redis:4.0-alpine` Docker image                                                      |

### How the Flow Works

1. **Developer** runs `code-push-standalone release-react` → CLI uploads JS bundle + assets to self-hosted server
2. **Mobile App** checks for updates on resume/start → queries `https://your-server.com/v0.1/public/codepush/update_check?`
3. **Server** responds with latest package metadata (or "no update available")
4. **App** downloads the new bundle, applies it on next restart (per current config)

---

## 2. Resource Requirements

### Minimum (Raspberry Pi 4 / Cheap VPS)

| Resource    | Requirement         | Notes                                      |
| ----------- | ------------------- | ------------------------------------------ |
| **CPU**     | 1 vCPU (ARM or x86) | Node.js is single-threaded for API         |
| **RAM**     | 256 MB — 512 MB     | Node.js runtime ~80 MB, Azurite ~64-128 MB |
| **Storage** | 5 GB                | OS + Node.js + update packages             |
| **Network** | 100 Mbps            | Upload/download bandwidth for updates      |

### Recommended (Production)

| Resource    | Requirement | Notes                                     |
| ----------- | ----------- | ----------------------------------------- |
| **CPU**     | 2 vCPU      | Better concurrency for multiple clients   |
| **RAM**     | 1 GB — 2 GB | Room for caching, concurrent connections  |
| **Storage** | 20 GB+      | Depends on update package sizes & history |
| **Network** | 1 Gbps      | Faster deployments to devices             |

### Storage Calculation

- A typical React Native JS bundle (Hermes bytecode) = **~2-5 MB** (compressed)
- Each release also stores previous version (for rollback)
- If you do 50 releases across 2 apps × 2 platforms × 2 deployments = **~200 releases**
- Total storage needed: **~200 × 5 MB = ~1 GB** for a year of updates
- Add 1 GB for overhead/logs → **~2 GB total is comfortable**

### Your Concern: "我怕服务器不够啊" (Worried server not enough)

✅ **Even a $5/month VPS (1 vCPU, 1 GB RAM, 25 GB SSD) is MORE than enough** for:

- 2 apps (TarsierTest + Tarsier)
- 2 platforms each (iOS + Android)
- Hundreds of daily active users checking for updates
- Years of release history

The server does NOT:

- Process user authentication (your API server handles that)
- Store user data
- Handle high concurrency (update checks are lightweight GET requests)
- Run database migrations during peak hours

---

## 3. Deployment Options

### Option A: Docker (Recommended)

**Pros:** Isolated, reproducible, easy to update, easy backup/restore  
**Cons:** Requires Docker knowledge

```yaml
# Example docker-compose.yml structure (with MySQL + local storage):
services:
  # MySQL 5.7 — code-push-server 的数据库
  codepush-mysql:
    image: mysql:5.7
    container_name: codepush-mysql
    restart: unless-stopped
    volumes:
      - codepush-mysql-data:/var/lib/mysql
    environment:
      MYSQL_ALLOW_EMPTY_PASSWORD: 'yes'

  # Redis 4.0 — 可选，用于登录频率限制
  codepush-redis:
    image: redis:4.0-alpine
    container_name: codepush-redis
    restart: unless-stopped

  # lisong/code-push-server (npm v5.7.1)
  codepush:
    image: node:18-alpine
    container_name: codepush-prod
    restart: unless-stopped
    command: >
      sh -c "
        npm install -g code-push-server@5.7.1 &&
        code-push-server-db init --dbhost codepush-mysql --dbuser root --dbpassword '' --dbport 3306 --force &&
        code-push-server
      "
    environment:
      - RDS_HOST=codepush-mysql
      - RDS_PORT=3306
      - RDS_USERNAME=root
      - DATA_BASE=codepush
      - STORAGE_TYPE=local
      - STORAGE_DIR=/data/storage
      - LOCAL_DOWNLOAD_URL=https://codepush.yourdomain.com/download
      - DATA_DIR=/data/tmp
      - TOKEN_SECRET=<random-63-chars>
      - NODE_ENV=production
      - PORT=3000
      - REDIS_HOST=codepush-redis
      - REDIS_PORT=6379
    volumes:
      - codepush-storage:/data/storage
      - codepush-tmp:/data/tmp
    depends_on:
      - codepush-mysql
      - codepush-redis

volumes:
  codepush-mysql-data:
  codepush-storage:
  codepush-tmp:
```

**Reverse Proxy (nginx):**

```nginx
server {
    listen 443 ssl;
    server_name codepush.yourdomain.com;

    ssl_certificate /etc/ssl/certs/codepush.crt;
    ssl_certificate_key /etc/ssl/private/codepush.key;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_buffering off;  # Important for large uploads
        client_max_body_size 100m;  # For release uploads
    }
}
```

### Option B: Bare Metal (Direct Node.js)

**Pros:** Simpler setup, no Docker overhead  
**Cons:** Manual process management (pm2/systemd), harder to replicate

```bash
# Install
git clone https://github.com/microsoft/code-push-server.git
cd code-push-server
npm install

# Configure
cp config/config.json.default config/config.json
# Edit config.json (set port, db path, storage path)

# Run with pm2 (process manager)
npm install -g pm2
pm2 start bin/www --name codepush-server
pm2 save
pm2 startup
```

### Option C: Cloud Deployment (Railway / Fly.io / Render)

**Pros:** No server management, auto-scaling, free tier available  
**Cons:** Potentially higher cost at scale, vendor lock-in

Example — Fly.io:

```bash
# Dockerfile already configured
fly launch
fly secrets set RDS_HOST=... RDS_USERNAME=root DATA_BASE=codepush \
  STORAGE_TYPE=local TOKEN_SECRET=<random> NODE_ENV=production
fly deploy
```

---

## 4. Step-by-Step Setup Guide

### Phase 1: Server Deployment

#### Step 1.1: Get a Server

Choose one:

- **Cheapest:** [Raspberry Pi 4](https://www.raspberrypi.com/) (4GB RAM) at home + Cloudflare Tunnel for HTTPS → **~$0/mo** (just electricity)
- **VPS:** [DigitalOcean](https://digitalocean.com) $6/mo droplet, [Linode](https://linode.com) $5/mo, [Hetzner](https://hetzner.com) €4/mo
- **Free tier:** [Fly.io](https://fly.io) free allowance, [Railway](https://railway.app) $5 credit/mo

#### Step 1.2: Set Up code-push-server

```bash
# SSH into your server
ssh root@your-server-ip

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs git mysql-server

# Clone the server (lisong fork — actively maintained)
git clone https://github.com/lisong/code-push-server.git
cd code-push-server
npm install

# Create MySQL database
mysql -u root -e "CREATE DATABASE IF NOT EXISTS codepush;"

# Initialize schema
node bin/db init --dbhost localhost --dbuser root --dbpassword '' --dbport 3306 --force

# Create config
cp config/config.js.default config/config.js
```

Edit [`config/config.js`](code-push-server/config/config.js) — **bare metal with MySQL + local storage**:

```javascript
// Set these as environment variables (recommended) or edit config.js directly:
// RDS_HOST=localhost, RDS_PORT=3306, RDS_USERNAME=root, DATA_BASE=codepush
// STORAGE_DIR=/var/codepush/storage, LOCAL_DOWNLOAD_URL=https://codepush.yourdomain.com/download
// DATA_DIR=/var/codepush/tmp, TOKEN_SECRET=<random-63-chars>, STORAGE_TYPE=local
```

> **Note:** The `code-push-server` (lisong fork) requires **MySQL 5.7+**. It does NOT support SQLite or Azure Blob Storage. Storage is local filesystem (`STORAGE_TYPE=local`) by default. For Redis support, set `REDIS_HOST` and `REDIS_PORT`.

#### Step 1.3: Set Up Process Manager

```bash
npm install -g pm2
pm2 start bin/www --name codepush-server
pm2 save
pm2 startup

# Verify
pm2 status
# Should show "online" with ~0% CPU, ~50MB RAM
```

#### Step 1.4: Set Up HTTPS (Critical!)

```bash
# Using Caddy (easiest - auto HTTPS)
# Install Caddy
sudo apt install -y debian-keyring debian-archive-keyring
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install caddy

# Create Caddyfile
cat > /etc/caddy/Caddyfile << 'EOF'
codepush.yourdomain.com {
    reverse_proxy localhost:3000
    request_body {
        max_size 100MB
    }
}
EOF

# Start Caddy
sudo systemctl enable caddy && sudo systemctl start caddy
```

**OR using Cloudflare Tunnel (if you have a domain on Cloudflare):**

```bash
# Install cloudflared
# Authenticate and create tunnel
cloudflared tunnel create codepush
cloudflared tunnel route dns codepush codepush.yourdomain.com

# Create config
cat > ~/.cloudflared/config.yml << 'EOF'
tunnel: <tunnel-id>
credentials-file: /root/.cloudflared/<tunnel-id>.json

ingress:
  - hostname: codepush.yourdomain.com
    service: http://localhost:3000
  - service: http_status:404
EOF

# Install as service
cloudflared service install
```

#### Step 1.5: Verify Server

```bash
# Health check
curl https://codepush.yourdomain.com/authenticated

# Should return authentication status
```

### Phase 2: CLI Setup

```bash
# code-push-standalone is already installed globally on dev machine
# Verify:
code-push-standalone --version  # Should show 0.0.1

# Register first admin user
code-push-standalone register https://codepush.yourdomain.com
# Follow the browser authentication flow

# Or create access key directly on server (if you set up auth tokens)
code-push-standalone login https://codepush.yourdomain.com --accessKey your-admin-key
```

### Phase 3: Create Apps & Deployments

```bash
# Create apps (mirror what was in App Center)
code-push-standalone app add TarsierTest ios react-native
code-push-standalone app add TarsierTest android react-native
code-push-standalone app add Tarsier ios react-native
code-push-standalone app add Tarsier android react-native

# Create deployments (Staging + Production for each)
code-push-standalone deployment add TarsierTest-ios Staging
code-push-standalone deployment add TarsierTest-ios Production
code-push-standalone deployment add TarsierTest-android Staging
code-push-standalone deployment add TarsierTest-android Production
code-push-standalone deployment add Tarsier-ios Staging
code-push-standalone deployment add Tarsier-ios Production
code-push-standalone deployment add Tarsier-android Staging
code-push-standalone deployment add Tarsier-android Production

# List deployment keys
code-push-standalone deployment ls TarsierTest-ios -k
code-push-standalone deployment ls TarsierTest-android -k
code-push-standalone deployment ls Tarsier-ios -k
code-push-standalone deployment ls Tarsier-android -k
```

> **Note:** Unlike App Center, `code-push-server` creates **platform-specific apps** (suffix -ios, -android). Each app gets its own Staging and Production deployment with unique keys.

---

## 5. Changes Required in This RN App

### 5.1 iOS — Add `CodePushServerURL` to Info.plist

In [`ios/FrontendBlogMobile/Info.plist`](ios/FrontendBlogMobile/Info.plist), add:

```xml
<key>CodePushServerURL</key>
<string>$(CODEPUSH_SERVER_URL)</string>
```

Then in [`ios/Config/Test.xcconfig`](ios/Config/Test.xcconfig) and [`ios/Config/Prod.xcconfig`](ios/Config/Prod.xcconfig):

```diff
 // ios/Config/Test.xcconfig
 CODEPUSH_DEPLOYMENT_KEY = $(CODEPUSH_KEY_TEST)
+CODEPUSH_SERVER_URL = $(CODEPUSH_SERVER_URL)
```

And set the build setting value. In Xcode or via project.pbxproj, you'd reference your server URL.

**Alternative:** Hardcode it in Info.plist directly (less flexible but simpler):

```xml
<key>CodePushServerURL</key>
<string>https://codepush.yourdomain.com</string>
```

**How it works on iOS** — [`CodePushConfig.m`](node_modules/react-native-code-push/ios/CodePush/CodePushConfig.m:37):

```objc
NSString *serverURL = [infoDictionary objectForKey:@"CodePushServerURL"];
if (!serverURL) {
    serverURL = @"https://codepush.appcenter.ms/";
}
```

So iOS **already reads `CodePushServerURL` from Info.plist** — no native code changes needed!

### 5.2 Android — Add `ServerUrl` String Resource

In [`android/app/build.gradle`](android/app/build.gradle), add `resValue` to each flavor:

```diff
 productFlavors {
     staging {
         ...
         resValue "string", "CodePushDeploymentKey", "CODEPUSH_KEY_TEST_PLACEHOLDER"
+        resValue "string", "ServerUrl", "CODEPUSH_SERVER_URL_PLACEHOLDER"
     }
     production {
         ...
         resValue "string", "CodePushDeploymentKey", "CODEPUSH_KEY_PRODUCTION_PLACEHOLDER"
+        resValue "string", "ServerUrl", "CODEPUSH_SERVER_URL_PLACEHOLDER"
     }
 }
```

**How it works on Android** — [`CodePush.java`](node_modules/react-native-code-push/android/app/src/main/java/com/microsoft/codepush/react/CodePush.java:84-85):

```java
String serverUrlFromStrings = getCustomPropertyFromStringsIfExist("ServerUrl");
if (serverUrlFromStrings != null) mServerUrl = serverUrlFromStrings;
```

This means Android **already reads `ServerUrl` from string resources automatically** — no native code changes needed!

### 5.3 Deployment Keys

The deployment keys from the self-hosted server will replace the current `CODEPUSH_KEY_TEST_PLACEHOLDER` and `CODEPUSH_KEY_PRODUCTION_PLACEHOLDER` values.

**Key structure change:** Since code-push-server uses platform-specific apps (TarsierTest-ios, TarsierTest-android, etc.), the keys now map as:

| Old App Center App        | New Self-Hosted App | Deployment | Key Usage                     |
| ------------------------- | ------------------- | ---------- | ----------------------------- |
| TarsierTest (iOS+Android) | TarsierTest-ios     | Staging    | iOS Test builds               |
| TarsierTest (iOS+Android) | TarsierTest-ios     | Production | (future iOS Test prod)        |
| TarsierTest (iOS+Android) | TarsierTest-android | Staging    | Android staging builds        |
| TarsierTest (iOS+Android) | TarsierTest-android | Production | (future Android staging prod) |
| Tarsier (iOS+Android)     | Tarsier-ios         | Staging    | iOS TestFlight builds         |
| Tarsier (iOS+Android)     | Tarsier-ios         | Production | iOS App Store builds          |
| Tarsier (iOS+Android)     | Tarsier-android     | Staging    | Android internal test         |
| Tarsier (iOS+Android)     | Tarsier-android     | Production | Android Play Store builds     |

### 5.4 App.tsx — No Changes Needed

The [`App.tsx`](App.tsx:183) already uses the standard `codePush()` HOC pattern:

```typescript
const codePushOptions = {
  checkFrequency: codePush.CheckFrequency.ON_APP_RESUME,
  installMode: codePush.InstallMode.ON_NEXT_RESTART,
};
const App = codePush(codePushOptions)(AppComponent);
```

The server URL is configured natively (Info.plist for iOS, strings.xml for Android). The `code-push` client SDK picks it up automatically.

### 5.5 Summary of App Changes

| File                                                                     | Change Required                                      | Complexity     |
| ------------------------------------------------------------------------ | ---------------------------------------------------- | -------------- |
| [`ios/FrontendBlogMobile/Info.plist`](ios/FrontendBlogMobile/Info.plist) | Add `CodePushServerURL` key                          | ⭐ (1 line)    |
| [`ios/Config/Test.xcconfig`](ios/Config/Test.xcconfig)                   | Add `CODEPUSH_SERVER_URL` reference                  | ⭐ (1 line)    |
| [`ios/Config/Prod.xcconfig`](ios/Config/Prod.xcconfig)                   | Add `CODEPUSH_SERVER_URL` reference                  | ⭐ (1 line)    |
| [`android/app/build.gradle`](android/app/build.gradle)                   | Add `resValue "string", "ServerUrl"` per flavor      | ⭐⭐ (2 lines) |
| [`App.tsx`](App.tsx)                                                     | **No change**                                        | ✅             |
| [`Makefile`](Makefile)                                                   | Update `codepush-*` targets for new CLI + server URL | ⭐⭐⭐         |
| [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)           | Add `CODEPUSH_SERVER_URL` env var                    | ⭐ (1 line)    |
| [`docs/ci-cd-setup-guide.md`](docs/ci-cd-setup-guide.md)                 | Update App Center → self-hosted instructions         | ⭐⭐           |

**Total: ~6 files modified, ~10 lines added. No native code changes.**

---

## 6. CI/CD Integration

### 6.1 GitHub Secrets

Replace the old App Center-based secrets with self-hosted ones:

| Secret Name                       | Value                                          |
| --------------------------------- | ---------------------------------------------- |
| `CODEPUSH_SERVER_URL`             | `https://codepush.yourdomain.com`              |
| `CODEPUSH_ACCESS_KEY`             | Admin access key for code-push-standalone      |
| `CODEPUSH_IOS_STAGING_KEY`        | Deployment key for TarsierTest-ios Staging     |
| `CODEPUSH_ANDROID_STAGING_KEY`    | Deployment key for TarsierTest-android Staging |
| `CODEPUSH_IOS_PRODUCTION_KEY`     | Deployment key for Tarsier-ios Production      |
| `CODEPUSH_ANDROID_PRODUCTION_KEY` | Deployment key for Tarsier-android Production  |

### 6.2 Updated Makefile Targets

```makefile
# Self-hosted CodePush server
CODEPUSH_SERVER_URL ?= https://codepush.yourdomain.com
CODEPUSH_STANDALONE_CMD := code-push-standalone

codepush-login: ## Login to self-hosted CodePush. Usage: make codepush-login TOKEN=<access-key>
	@if [ -z "$(TOKEN)" ]; then \
		echo "⚠️  Usage: make codepush-login TOKEN=<your-access-key>"; \
		exit 1; \
	fi
	$(CODEPUSH_STANDALONE_CMD) login $(CODEPUSH_SERVER_URL) --accessKey "$(TOKEN)"
	@echo "✅ Logged in to self-hosted CodePush at $(CODEPUSH_SERVER_URL)"

codepush-keys: ## List deployment keys for all apps
	@echo "━━━ TarsierTest iOS Staging ━━━"
	$(CODEPUSH_STANDALONE_CMD) deployment ls TarsierTest-ios -k
	@echo ""
	@echo "━━━ TarsierTest Android Staging ━━━"
	$(CODEPUSH_STANDALONE_CMD) deployment ls TarsierTest-android -k
	@echo ""
	@echo "━━━ Tarsier iOS Production ━━━"
	$(CODEPUSH_STANDALONE_CMD) deployment ls Tarsier-ios -k
	@echo ""
	@echo "━━━ Tarsier Android Production ━━━"
	$(CODEPUSH_STANDALONE_CMD) deployment ls Tarsier-android -k

codepush-release-staging: ## Release a hot update to Staging (both platforms)
	@read -p "Enter OTA message: " msg; \
	$(CODEPUSH_STANDALONE_CMD) release-react TarsierTest-ios ios --deploymentName Staging --description "$$msg"; \
	$(CODEPUSH_STANDALONE_CMD) release-react TarsierTest-android android --deploymentName Staging --description "$$msg"

codepush-release-production: ## Release a hot update to Production (both platforms)
	@read -p "Enter OTA message: " msg; \
	$(CODEPUSH_STANDALONE_CMD) release-react Tarsier-ios ios --deploymentName Production --description "$$msg"; \
	$(CODEPUSH_STANDALONE_CMD) release-react Tarsier-android android --deploymentName Production --description "$$msg"

codepush-promote-to-production: ## Promote Staging → Production (both platforms)
	$(CODEPUSH_STANDALONE_CMD) promote TarsierTest-ios Staging Production
	$(CODEPUSH_STANDALONE_CMD) promote TarsierTest-android Staging Production
	$(CODEPUSH_STANDALONE_CMD) promote Tarsier-ios Staging Production
	$(CODEPUSH_STANDALONE_CMD) promote Tarsier-android Staging Production
```

### 6.3 Updated GitHub Actions

In [`deploy.yml`](.github/workflows/deploy.yml), add a CodePush release step:

```yaml
- name: CodePush Release (Staging)
  if: needs.resolve-flavor.outputs.flavor == 'test'
  run: |
    npx code-push-standalone release-react TarsierTest-ios ios \
      --deploymentName Staging \
      --description "CI build ${{ github.run_number }}"
    npx code-push-standalone release-react TarsierTest-android android \
      --deploymentName Staging \
      --description "CI build ${{ github.run_number }}"
  env:
    CODEPUSH_SERVER_URL: ${{ secrets.CODEPUSH_SERVER_URL }}
```

---

## 7. Migration: Move Existing Releases

Since App Center's management API is completely retired, **existing releases on App Center cannot be exported**. You must:

1. **Keep the last App Center release on devices** — users already have it, it still works
2. **Make a new release to the self-hosted server** — the first release becomes the baseline
3. **Submit a new app store update** — this update includes the self-hosted server URL

### Migration Timeline

```
Day 1:  Deploy code-push-server on VPS
Day 2:  Test with staging app (point TarsierTest to self-hosted server)
Day 3:  Verify hot updates work end-to-end
Day 4:  Submit app store update with self-hosted server URL
Day 5:  Start using code-push-standalone for all releases
Day 6:  Decommission old App Center workflow
```

### What Happens to Existing Users?

- **Users with the current app version** will continue to use the last CodePush update they received from App Center (it's cached locally)
- Once they update to the new app store version (with self-hosted server URL), they'll start checking the self-hosted server
- **No breakage** — the cached update bundle continues to work even without server connectivity

---

## 8. Cost Analysis

| Item                            | Cost/Month        | Notes                                            |
| ------------------------------- | ----------------- | ------------------------------------------------ |
| **Raspberry Pi 4** (at home)    | ~$3 (electricity) | Requires home internet + Cloudflare Tunnel       |
| **Cheapest VPS** (Hetzner CX22) | €4 (~$4.50)       | 2 vCPU, 4 GB RAM, 40 GB SSD — overkill but cheap |
| **DigitalOcean** basic droplet  | $6                | 1 vCPU, 1 GB RAM, 25 GB SSD                      |
| **Fly.io** (free tier)          | $0                | Up to 3 shared VMs, 256 MB RAM each              |
| **Railway** (free tier)         | $0                | $5 credit/month, enough for this                 |
| **Domain** (Cloudflare)         | ~$10/year         | For HTTPS + DNS                                  |
| **Cloudflare Tunnel**           | $0                | Free tier for personal use                       |
| **TOTAL (cheapest)**            | **~$3-4/month**   | RPi at home or Fly.io free tier                  |

**vs. App Center:** App Center was free, but is now retired. The $3-4/month is the new minimum cost to keep CodePush working.

**vs. Alternative services** (like EAS Update, BugSnag):

- EAS Update: Free tier (limited), Pro $40/month
- Others: Typically $20-100/month

---

## 9. Alternatives Comparison

| Feature                        | Self-Hosted code-push-server  | Remove CodePush Entirely | EAS Update (Expo)        | Microsoft App Center (Retired) |
| ------------------------------ | ----------------------------- | ------------------------ | ------------------------ | ------------------------------ |
| **Cost**                       | $3-4/mo (VPS)                 | $0                       | Free tier / $40/mo Pro   | ~~Free~~ Retired               |
| **Control**                    | Full (your server)            | N/A                      | Limited                  | ~~Full~~                       |
| **Setup complexity**           | Medium (server + config)      | Easy (remove dependency) | Medium (migrate to Expo) | ~~Easy~~                       |
| **Maintenance**                | You maintain the server       | None                     | Provider handles         | ~~Provider handled~~           |
| **Reliability**                | Your uptime                   | N/A                      | 99.9% SLA                | ~~Retired~~                    |
| **Rollback**                   | ✅ Built-in                   | ❌                       | ✅                       | ~~✅~~                         |
| **Mandatory app store update** | No (hot update works)         | Yes (every change)       | No                       | ~~No~~                         |
| **Data privacy**               | ✅ Full control (your server) | N/A                      | Data on Expo servers     | ~~Data on Azure~~              |
| **Updates per user**           | Unlimited                     | N/A                      | Limited on free tier     | ~~Unlimited~~                  |
| **License**                    | MIT (free, open source)       | MIT                      | Proprietary              | ~~Proprietary~~                |

### Why Keep CodePush vs Removing It

**Keep CodePush if:**

- You frequently deploy hot fixes (critical bug fixes, content updates)
- You want to skip the 1-3 day App Store review for urgent fixes
- You have limited users and can tolerate occasional server maintenance
- You value full control over your deployment infrastructure

**Remove CodePush if:**

- Your app rarely changes (static content, stable features)
- You're comfortable with the 1-3 day App Store review cycle
- You don't want to maintain a server
- Your team is small and every deployment goes through app review anyway

---

## 10. Recommendation

### For This Project (Tarsier Blog App)

**Recommended approach: Self-host `code-push-server` on a cheap VPS**

**Rationale:**

1. **Already invested** — The project has CodePush fully integrated (Android + iOS working, build passes, CI configured). Removing it means losing the hot update capability you've already built.

2. **Low cost** — $3-6/month for a VPS is negligible for production infrastructure.

3. **Low resource usage** — Even a $5/month DigitalOcean droplet (1 vCPU, 1 GB RAM) can handle thousands of users checking for updates.

4. **Simple migration** — Only ~6 files need minor changes. No native code modifications. The SDK already supports custom server URLs.

5. **Full data privacy** — The blog's content and update packages stay on your own server.

6. **Archived but working** — `code-push-server` is archived by Microsoft, but it's stable, MIT-licensed, and the community can fork it if needed.

### Next Steps (if you decide to proceed)

| Step      | Action                                                     | Estimated Time             |
| --------- | ---------------------------------------------------------- | -------------------------- |
| 1         | Get a VPS (recommend Hetzner CX22 at €4/mo or Fly.io free) | 30 min                     |
| 2         | Deploy code-push-server via Docker or bare Node.js         | 1 hour                     |
| 3         | Set up HTTPS (Caddy auto-HTTPS is easiest)                 | 30 min                     |
| 4         | Create apps + deployments via code-push-standalone         | 15 min                     |
| 5         | Update iOS Info.plist with CodePushServerURL               | 5 min                      |
| 6         | Update Android build.gradle with ServerUrl resValue        | 5 min                      |
| 7         | Update deploy.yml + Makefile with new CLI commands         | 30 min                     |
| 8         | Test end-to-end: release → device receives update          | 30 min                     |
| 9         | Submit app store update with new server URL                | 1 day (review)             |
| **Total** |                                                            | **~3-4 hours active work** |

### Do you want me to proceed?

Switch to **Code mode** to implement the changes if you decide to go ahead. The actual code changes are minor:

| What                                              | Lines Changed |
| ------------------------------------------------- | ------------- |
| `Info.plist` — add 2 lines                        | 2             |
| `Test.xcconfig` — add 1 line                      | 1             |
| `Prod.xcconfig` — add 1 line                      | 1             |
| `build.gradle` — add 2 lines (one per flavor)     | 2             |
| `Makefile` — rewrite `codepush-*` targets         | ~30           |
| `deploy.yml` — add server URL env + CodePush step | ~10           |
| `docs/ci-cd-setup-guide.md` — rewrite section 1.3 | ~40           |
| **Total**                                         | **~86 lines** |
