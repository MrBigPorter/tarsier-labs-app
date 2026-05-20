# Self-Hosted CodePush — Implementation Guide

> **Target:** Bluehost VPS (Ubuntu 24.04, 8GB RAM, 200GB NVMe)  
> **Approach:** Independent `compose.codepush.yml` (Option B — 独立部署)  
> **Domain:** `codepush.joyminis.com` (new Cloudflare Tunnel ingress)  
> **Cost:** $0 (runs on existing VPS with unused ~3.4GB RAM)

---

## 目录

- [Part A: 服务器端配置](#part-a-服务器端配置)
- [Part B: RN App 端改动](#part-b-rn-app-端改动)
- [Part C: CLI 创建 Apps 和 Deployments](#part-c-cli-创建-apps-和-deployments)
- [Part D: 验证](#part-d-验证)
- [实施顺序](#实施顺序)

---

## Part A: 服务器端配置

### A1. 创建独立的 compose.codepush.yml

在 [`JoyMini_Nest_Monorepo`](/Volumes/MySSD/work/JoyMini_Nest_Monorepo/) 目录下创建新文件 `compose.codepush.yml`：

```yaml
# ==========================================
# CodePush Server — Docker Compose
# ==========================================
# 独立的 CodePush 热更新服务，与 compose.prod.yml 共存
#
# 使用方法:
#   docker compose -f compose.codepush.yml up -d
#
# 组件:
#   - code-push-server (lisong/code-push-server npm v5.7.1, MIT)
#     GitHub: https://github.com/lisong/code-push-server
#   - MySQL 5.7 (数据库 — code-push-server 必备)
#   - Redis 4.0 (可选，用于登录频率限制)
#
# 环境变量 (来自 config/config.js):
#   RDS_HOST, RDS_PORT, RDS_USERNAME, DATA_BASE    — MySQL 连接
#   STORAGE_DIR, LOCAL_DOWNLOAD_URL                 — 本地存储
#   TOKEN_SECRET            — JWT 签名密钥 (务必修改)
#   STORAGE_TYPE            — local / qiniu / s3 / oss / tencentcloud
#   REDIS_HOST, REDIS_PORT  — Redis 连接
#
# 存储: 本地文件系统 (STORAGE_TYPE=local)
#   更新包 (.zip) 存储在 codepush-storage volume
#
# 认证方式:
#   1. 手动插入管理员用户到 MySQL (无需 SMTP)
#   2. 通过 REST API 登录获取 JWT token
#   3. 通过 REST API 创建 Access Key
#
# 内存预算 (8GB 服务器):
#   OS + Docker:         ~500 MB
#   现有服务 (compose.prod.yml): ~4.6 GB
#   MySQL 5.7:          ~256-512 MB
#   code-push-server:   ~80-128 MB
#   Redis:              ~16-32 MB
#   Swap 兜底:           2 GB
#   总计:                ~5.8 GB 容器 + 2 GB swap，预留 ~200 MB 弹性空间
# ==========================================

services:
  # =========================================
  # MySQL 5.7 — code-push-server 的数据库
  # 注意：与 compose.prod.yml 的 PostgreSQL 不同，
  # 这是独立的 MySQL 实例
  # =========================================
  codepush-mysql:
    image: mysql:5.7
    container_name: lucky-codepush-mysql
    restart: unless-stopped
    logging:
      driver: json-file
      options:
        max-size: '5m'
        max-file: '3'
    deploy:
      resources:
        limits:
          memory: 512M
        reservations:
          memory: 256M
    volumes:
      - codepush-mysql-data:/var/lib/mysql
    environment:
      MYSQL_ALLOW_EMPTY_PASSWORD: 'yes'
      MYSQL_DATABASE: codepush
    expose:
      - '3306'
    networks: [app]

  # =========================================
  # Redis 4.0 — 可选，用于登录频率限制
  # 不配置 Redis 也能正常运行
  # =========================================
  codepush-redis:
    image: redis:4.0-alpine
    container_name: lucky-codepush-redis
    restart: unless-stopped
    logging:
      driver: json-file
      options:
        max-size: '5m'
        max-file: '3'
    deploy:
      resources:
        limits:
          memory: 32M
        reservations:
          memory: 16M
    expose:
      - '6379'
    networks: [app]

  # =========================================
  # CodePush Server
  # 使用 lisong/code-push-server npm 包 (v5.7.1)
  # - MySQL 驱动 (mysql2)
  # - 本地文件系统存储 (STORAGE_TYPE=local)
  # - JWT 认证
  # =========================================
  codepush:
    image: node:18-alpine
    container_name: lucky-codepush-prod
    restart: unless-stopped
    logging:
      driver: json-file
      options:
        max-size: '5m'
        max-file: '3'
    deploy:
      resources:
        limits:
          memory: 256M
        reservations:
          memory: 80M
    command: >
      sh -c "
        echo '>>> Installing code-push-server...' &&
        npm install -g code-push-server@5.7.1 &&
        echo '>>> Waiting for MySQL to be ready...' &&
        for i in \$(seq 1 30); do
          node -e \"require('mysql2').createConnection({host:'codepush-mysql',user:'root',password:''}).connect(function(e){process.exit(e?1:0)})\" 2>/dev/null &&
          echo '  MySQL is ready!' &&
          break
          echo \"  attempt \$i/30...\"
          sleep 2
        done &&
        echo '>>> Initializing database schema...' &&
        code-push-server-db init --dbhost codepush-mysql --dbuser root --dbpassword '' --dbport 3306 --force &&
        echo '>>> Starting code-push-server on port 3000...' &&
        code-push-server
      "
    environment:
      # ── MySQL 连接 (config/config.js: RDS_*) ──
      - RDS_HOST=codepush-mysql
      - RDS_PORT=3306
      - RDS_USERNAME=root
      - DATA_BASE=codepush

      # ── 本地文件存储 ──
      - STORAGE_TYPE=local
      - STORAGE_DIR=/data/storage
      - LOCAL_DOWNLOAD_URL=https://codepush.joyminis.com/download
      - DATA_DIR=/data/tmp

      # ── JWT 签名密钥 (务必替换为随机字符串！) ──
      # 生成命令: openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | head -c 63
      - TOKEN_SECRET=<generate-with-openssl-rand-63-chars>

      # ── 服务器配置 ──
      - PORT=3000
      - NODE_ENV=production

      # ── Redis (可选) ──
      - REDIS_HOST=codepush-redis
      - REDIS_PORT=6379
    healthcheck:
      test: ['CMD', 'wget', '-qO-', 'http://localhost:3000/']
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 90s
    volumes:
      - codepush-storage:/data/storage
      - codepush-tmp:/data/tmp
    depends_on:
      - codepush-mysql
      - codepush-redis
    expose:
      - '3000'
    networks: [app]

networks:
  app:
    external: true # 使用 compose.prod.yml 中定义的 app 网络

volumes:
  codepush-mysql-data:
  codepush-storage:
  codepush-tmp:
```

> **关键设计决定:**
>
> - **数据库从 SQLite / Azure Blob → MySQL 5.7** — `code-push-server` (lisong fork) 使用 Sequelize ORM + mysql2 驱动，**只支持 MySQL**。不支持 SQLite，也不支持 Azure Blob Storage
> - **存储从 Azurite → 本地文件系统** — `STORAGE_TYPE=local`，代码包直接存本地 volume，无需 Azurite 或 Azure 连接
> - **认证从 DEBUG_DISABLE_AUTH → 正常 JWT** — lisong fork 没有 OAuth bypass 功能。必须创建真实用户，通过 REST API 登录获取 JWT token，再用 token 创建 Access Key
> - **`networks.app.external: true`** — 连接到现有的 `app` 网络，与 backend/nginx/redis/postgres 在同一网络
> - **独立的 compose 文件** — 不影响现有生产服务，可以单独 `docker compose -f compose.codepush.yml up -d` 启动
> - **`code-push-server-db init --force`** — 首次启动时创建数据库和表，后续重启自动跳过（CREATE TABLE IF NOT EXISTS）

### A2. 在 cloudflared.yml 添加 CodePush 入口

在 [`cloudflared.yml`](/Volumes/MySSD/work/JoyMini_Nest_Monorepo/cloudflared.yml) 的 `ingress:` 块添加（在 fallback 之前）：

```yaml
# CodePush Server — 热更新服务
- hostname: codepush.joyminis.com
  service: http://localhost:3000
```

最终文件结构应该是：

```yaml
ingress:
  - hostname: blog-dev.joyminis.com
    service: http://localhost:80
  - hostname: blog-admin-dev.joyminis.com
    service: http://localhost:80
  - hostname: admin-dev.joyminis.com
    service: http://localhost:80
  - hostname: dev-api.joyminis.com
    service: http://localhost:80
  - hostname: liveness-dev.joyminis.com
    service: http://localhost:80
  # CodePush Server — 热更新服务
  - hostname: codepush.joyminis.com
    service: http://localhost:3000
  # Fallback
  - service: http_status:404
```

> **为什么不需要 Nginx?** code-push-server 直接暴露 3000 端口，Cloudflare Tunnel 直接代理到容器端口。不需要经过 Nginx 反向代理。

### A3. 更新 deploy/deploy.sh 的 sync_configs 函数

在 [`deploy/deploy.sh`](/Volumes/MySSD/work/JoyMini_Nest_Monorepo/deploy/deploy.sh) 的 `sync_configs()` 函数中，添加新的 `scp` 命令来同步 `compose.codepush.yml` 和 `cloudflared.yml`：

在 `scp redis/redis.conf` 之后添加：

```bash
    # CodePush 配置
    scp compose.codepush.yml                "$SSH_TARGET:$VPS_DIR/"

    # Cloudflare Tunnel 配置
    scp cloudflared.yml                     "$SSH_TARGET:$VPS_DIR/"
```

### A4. 部署到服务器

```bash
# 1. 本地：同步配置文件到 VPS
cd /Volumes/MySSD/work/JoyMini_Nest_Monorepo
VPS_IP=<你的VPS_IP> ./deploy/deploy.sh --sync

# 2. SSH 到 VPS
ssh root@<VPS_IP>

# 3. 启动 CodePush 服务（首次会自动 npm install + 初始化数据库）
docker compose -f /opt/lucky/compose.codepush.yml up -d

# 4. 查看启动日志（等待 npm install + MySQL 初始化 + DB init）
docker compose -f /opt/lucky/compose.codepush.yml logs codepush -f
# 日志流程：
#   ">>> Installing code-push-server..."        ← npm install
#   ">>> Waiting for MySQL to be ready..."       ← 等待 MySQL 启动
#   ">>> Initializing database schema..."        ← code-push-server-db init
#   ">>> Starting code-push-server on port 3000..."  ← 启动成功

# 5. 验证服务
docker compose -f /opt/lucky/compose.codepush.yml ps
# 应该显示三个服务都是 "Up" 状态

# 6. 重启 Cloudflare Tunnel（使新 ingress 生效）
# 查看 cloudflared 是如何运行的：
docker ps | grep cloudflared
# 如果是 systemd 服务：
systemctl restart cloudflared
# 如果是 docker 运行：
docker compose -f /opt/lucky/compose.prod.yml restart cloudflared
# 或者找到 cloudflared 容器名：
docker restart <cloudflared-container-name>
```

### A5. 验证服务器可达

```bash
# 从本地测试
curl -k https://codepush.joyminis.com/
# 应该返回类似：{"status":"OK"} 或认证相关响应
```

---

## Part B: RN App 端改动

### B1. iOS — Info.plist 添加 CodePushServerURL

[`ios/FrontendBlogMobile/Info.plist`](/Users/porter/Developer/frontend-blog-mobile/ios/FrontendBlogMobile/Info.plist)

在 `CodePushDeploymentKey` 附近添加：

```xml
<key>CodePushServerURL</key>
<string>https://codepush.joyminis.com</string>
```

最终效果（在 line 76-77 之前）：

```xml
<key>CodePushServerURL</key>
<string>https://codepush.joyminis.com</string>
<key>CodePushDeploymentKey</key>
<string>$(CODEPUSH_DEPLOYMENT_KEY)</string>
```

**这是 iOS SDK 原生支持的** — [`CodePushConfig.m:37`](/Users/porter/Developer/frontend-blog-mobile/node_modules/react-native-code-push/ios/CodePush/CodePushConfig.m:37) 会自动读取 `CodePushServerURL` 这个 key。

### B2. Android — build.gradle 添加 ServerUrl resValue

[`android/app/build.gradle`](/Users/porter/Developer/frontend-blog-mobile/android/app/build.gradle)

在 `staging` 和 `production` 两个 flavor 中各添加一行 `resValue "string", "ServerUrl", "https://codepush.joyminis.com"`：

```groovy
staging {
    dimension "env"
    missingDimensionStrategy 'env', 'staging'
    applicationIdSuffix ".test"
    versionNameSuffix "-test"
    resValue "string", "app_name", "Tarsier(Test)"
    resValue "string", "CodePushDeploymentKey", "CODEPUSH_KEY_TEST_PLACEHOLDER"
    resValue "string", "ServerUrl", "https://codepush.joyminis.com"   // ← 添加这行
}
production {
    dimension "env"
    missingDimensionStrategy 'env', 'production'
    applicationIdSuffix ""
    resValue "string", "app_name", "Tarsier"
    resValue "string", "CodePushDeploymentKey", "CODEPUSH_KEY_PRODUCTION_PLACEHOLDER"
    resValue "string", "ServerUrl", "https://codepush.joyminis.com"   // ← 添加这行
}
```

**这是 Android SDK 原生支持的** — [`CodePush.java:84-85`](/Users/porter/Developer/frontend-blog-mobile/node_modules/react-native-code-push/android/app/src/main/java/com/microsoft/codepush/react/CodePush.java:84-85) 会自动从 string resources 读取 `ServerUrl`。

### B3. App.tsx — 无需改动

现有代码（line 183）已经正确使用 `codePush()` HOC，服务器 URL 由原生层配置。不需要改任何 TypeScript/JS 代码。

### B4. Makefile — 更新 codepush-\* 命令

[`Makefile`](/Users/porter/Developer/frontend-blog-mobile/Makefile)

将 `CODEPUSH_CMD` 从 `code-push`（指向已退役的 App Center）改为 `code-push-standalone`（指向自建服务器）：

**替换整个 CodePush section（lines 306-356）:**

```makefile
# ── Hot Update (CodePush Self-Hosted) ──────────────────────────
CODEPUSH_STANDALONE_BIN := /Users/porter/.volta/tools/image/node/24.14.1/bin
CODEPUSH_STANDALONE_CMD := $(CODEPUSH_STANDALONE_BIN)/code-push-standalone
CODEPUSH_SERVER_URL := https://codepush.joyminis.com

codepush-login: ## Login to self-hosted CodePush. Usage: make codepush-login TOKEN=<access-key>
	@if [ -z "$(TOKEN)" ]; then \
		echo "⚠️  Usage: make codepush-login TOKEN=<your-access-key>"; \
		echo "   Get your access key from: make codepush-create-key"; \
		exit 1; \
	fi
	$(CODEPUSH_STANDALONE_CMD) login $(CODEPUSH_SERVER_URL) --accessKey "$(TOKEN)"
	@echo "✅ Logged in to CodePush at $(CODEPUSH_SERVER_URL)"

codepush-create-key: ## Generate a new access key on the server (SSH required). Usage: make codepush-create-key SSH_HOST=root@<VPS_IP>
	@if [ -z "$(SSH_HOST)" ]; then \
		echo "⚠️  Usage: make codepush-create-key SSH_HOST=root@<vps-ip>"; \
		exit 1; \
	fi
	@echo "📝 Generating access key (valid 365 days)..."
	ssh $(SSH_HOST) "docker compose -f /opt/lucky/compose.codepush.yml exec codepush node /app/bin/cli.js access-key add 'ci-key' --ttl 365d"

codepush-keys: ## List all deployment keys (requires logged in)
	@echo "━━━ TarsierTest-ios Staging ━━━"
	$(CODEPUSH_STANDALONE_CMD) deployment ls TarsierTest-ios -k
	@echo ""
	@echo "━━━ TarsierTest-android Staging ━━━"
	$(CODEPUSH_STANDALONE_CMD) deployment ls TarsierTest-android -k
	@echo ""
	@echo "━━━ Tarsier-ios Production ─────"
	$(CODEPUSH_STANDALONE_CMD) deployment ls Tarsier-ios -k
	@echo ""
	@echo "━━━ Tarsier-android Production ──"
	$(CODEPUSH_STANDALONE_CMD) deployment ls Tarsier-android -k

codepush-release-staging: ## Release OTA update to Staging (both platforms)
	@read -p "📝 Enter OTA description: " msg; \
	echo "📦 Releasing to TarsierTest-ios Staging..." && \
	$(CODEPUSH_STANDALONE_CMD) release-react TarsierTest-ios ios --deploymentName Staging --description "$$msg" && \
	echo "📦 Releasing to TarsierTest-android Staging..." && \
	$(CODEPUSH_STANDALONE_CMD) release-react TarsierTest-android android --deploymentName Staging --description "$$msg" && \
	echo "✅ Staging OTA update sent"

codepush-release-production: ## Release OTA update to Production (both platforms)
	@read -p "📝 Enter OTA description: " msg; \
	echo "📦 Releasing to Tarsier-ios Production..." && \
	$(CODEPUSH_STANDALONE_CMD) release-react Tarsier-ios ios --deploymentName Production --description "$$msg" && \
	echo "📦 Releasing to Tarsier-android Production..." && \
	$(CODEPUSH_STANDALONE_CMD) release-react Tarsier-android android --deploymentName Production --description "$$msg" && \
	echo "✅ Production OTA update sent"

codepush-promote: ## Promote Staging → Production for all 4 apps
	$(CODEPUSH_STANDALONE_CMD) promote TarsierTest-ios Staging Production
	$(CODEPUSH_STANDALONE_CMD) promote TarsierTest-android Staging Production
	$(CODEPUSH_STANDALONE_CMD) promote Tarsier-ios Staging Production
	$(CODEPUSH_STANDALONE_CMD) promote Tarsier-android Staging Production

codepush-history: ## Show deployment history for all apps
	@echo "━━━ TarsierTest-ios Staging ━━━"
	$(CODEPUSH_STANDALONE_CMD) deployment history TarsierTest-ios Staging
	@echo ""
	@echo "━━━ Tarsier-ios Production ─────"
	$(CODEPUSH_STANDALONE_CMD) deployment history Tarsier-ios Production
```

**更新 `.PHONY` 行（line 14-26）** — 替换 `codepush-login codepush-keys codepush-test codepush-prod \` 为：

```makefile
.PHONY: help dev dev-ios dev-ios-device dev-android dev-android-device staging staging-ios staging-android \
        release release-ios release-android release-android-aab \
        build build-ios build-android \
        build-test-android build-prod-aab build-prod-apk \
        run-test-android run-prod-android \
        build-test-ios build-prod-ios \
        codepush-login codepush-create-key codepush-keys \
        codepush-release-staging codepush-release-production codepush-promote codepush-history \
        install update clean reset lint typecheck test check \
        env-dev env-staging env-prod env-show \
        devtools fusebox logs-ios logs-android profile hermes-profile perf perf-ci check-bundle-size sentry-dashboard xcode \
        fresh reset-android reset-ios studio-android audit \
        doctor rebuild-ios rebuild-android reset-all \
        port-ls port-kill port-kill-metro ports
```

### B5. deploy.yml — CodePush CI 改为 code-push-standalone

[`.github/workflows/deploy.yml`](/Users/porter/Developer/frontend-blog-mobile/.github/workflows/deploy.yml)

替换 `codepush-test` job（lines 201-231）的内容，将 `code-push` 命令改为 `code-push-standalone`：

```yaml
# ─────────────────────────────────────────────────────────────────────────────
# CodePush (hot update) — only for test branch pushes
# ─────────────────────────────────────────────────────────────────────────────
codepush-test:
  name: CodePush Test (Hot Update)
  needs: [resolve-flavor]
  if: ${{ needs.resolve-flavor.outputs.flavor == 'test' }}
  runs-on: ubuntu-latest
  timeout-minutes: 15
  environment: test

  steps:
    - name: Checkout
      uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ env.NODE_VERSION }}
        cache: 'yarn'

    - name: Install dependencies
      run: yarn install --immutable

    - name: Install code-push-standalone
      run: npm install -g code-push-standalone

    - name: CodePush Test (Staging)
      env:
        CODEPUSH_SERVER_URL: ${{ secrets.CODEPUSH_SERVER_URL }}
        CODEPUSH_ACCESS_KEY: ${{ secrets.CODEPUSH_ACCESS_KEY }}
      run: |
        code-push-standalone login $CODEPUSH_SERVER_URL --accessKey "$CODEPUSH_ACCESS_KEY"
        code-push-standalone release-react TarsierTest-android android --deploymentName Staging --description "CI build ${{ github.run_number }}"
        code-push-standalone release-react TarsierTest-ios ios --deploymentName Staging --description "CI build ${{ github.run_number }}"
```

**GitHub Secrets 需要添加：**
| Secret | 值 |
|--------|-----|
| `CODEPUSH_SERVER_URL` | `https://codepush.joyminis.com` |
| `CODEPUSH_ACCESS_KEY` | （从 Part C 生成的 admin access key） |

可以从 `.env.staging` 或 `.env.production` 移除旧的 `APPCENTER_ACCESS_TOKEN`（不再需要）。

### B6. docs/ci-cd-setup-guide.md — 更新

将 [Section 1.3](docs/ci-cd-setup-guide.md:75) 的 "Get CodePush Deployment Keys" 从 App Center 步骤改为自建服务器步骤。

---

## Part C: CLI 创建 Apps 和 Deployments

### C1. 创建管理员用户

> ⚠️ **`lisong/code-push-server` 没有 `bin/cli.js` 文件，也没有 SMTP 邮件验证功能。**
> 必须手动插入用户到 MySQL。使用 `bcryptjs`（已随 npm 包安装）生成密码哈希。

```bash
# SSH 到 VPS
ssh root@<VPS_IP>

# 生成 bcrypt 密码哈希并插入管理员用户到 MySQL
# 注意：将 'your-admin-password' 替换为你的实际密码
docker compose -f /opt/lucky/compose.codepush.yml exec -T codepush \
  sh -c "
    node -e \"
      const bcrypt = require('bcryptjs');
      const hash = bcrypt.hashSync('your-admin-password', 12);
      console.log(hash);
    \"
  " | read HASH

# 或者手动两步法：
# Step 1: 先获取 bcrypt hash
HASH=$(docker compose -f /opt/lucky/compose.codepush.yml exec -T codepush \
  node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('your-admin-password', 12))")

# Step 2: 插入用户（identical 是 9 位随机字符串）
IDENTICAL=$(openssl rand -hex 9)
docker compose -f /opt/lucky/compose.codepush.yml exec -T codepush-mysql \
  mysql -u root codepush -e \
  "INSERT INTO users (email, password, identical, created_at, updated_at)
   VALUES ('admin@joyminis.com', '$HASH', '$IDENTICAL', NOW(), NOW())"

echo "✅ 管理员用户创建成功: admin@joyminis.com"
echo "   密码: your-admin-password"
echo "   (请在实际使用中替换为你的密码)"
```

### C2. 生成 Access Key（通过 REST API）

> `lisong/code-push-server` 没有 CLI access-key 命令。需要通过 REST API 创建：
>
> 1. 先用管理员凭据登录获取 JWT token
> 2. 再用 token 创建 Access Key

```bash
# SSH 到 VPS
ssh root@<VPS_IP>

# 1. 登录获取 JWT token
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@joyminis.com","password":"your-admin-password"}')

# 提取 token（使用 node 解析 JSON）
TOKEN=$(echo "$LOGIN_RESPONSE" | node -e "
  let d = '';
  process.stdin.on('data', c => d += c);
  process.stdin.on('end', () => {
    try { console.log(JSON.parse(d).data.token); }
    catch(e) { console.error('Login failed:', d); process.exit(1); }
  });
")

echo "JWT Token: $TOKEN"

# 2. 创建 Access Key（有效期 365 天）
ACCESS_KEY_RESPONSE=$(curl -s -X POST http://localhost:3000/accessKeys \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"ci-key","ttl":365}')

# 提取 access key
ACCESS_KEY=$(echo "$ACCESS_KEY_RESPONSE" | node -e "
  let d = '';
  process.stdin.on('data', c => d += c);
  process.stdin.on('end', () => {
    try { console.log(JSON.parse(d).data.accessKey); }
    catch(e) { console.error('Key creation failed:', d); process.exit(1); }
  });
")

echo "✅ Access Key: $ACCESS_KEY"
echo "   请保存此 key，后续步骤需要用到："
echo "   - 本地 CLI 登录 (make codepush-login TOKEN=...)"
echo "   - GitHub Secrets (CODEPUSH_ACCESS_KEY)"
```

### C3. 从本地登录

```bash
# 在本地 Mac 上
export CODEPUSH_ACCESS_KEY="<上面生成的key>"
/Users/porter/.volta/tools/image/node/24.14.1/bin/code-push-standalone \
  login https://codepush.joyminis.com --accessKey "$CODEPUSH_ACCESS_KEY"

# 验证登录状态
/Users/porter/.volta/tools/image/node/24.14.1/bin/code-push-standalone app list
# 应该显示空列表（还没有 app）
```

### C4. 创建 Apps 和 Deployments

```bash
# code-push-server 需要每个平台独立创建 app
# 使用 code-push-standalone CLI

# ── Staging Apps ──
code-push-standalone app add TarsierTest-ios
code-push-standalone app add TarsierTest-android

# ── Production Apps ──
code-push-standalone app add Tarsier-ios
code-push-standalone app add Tarsier-android

# 验证 apps 已创建
code-push-standalone app list
# 应该显示 4 个 apps

# 查看 deployment keys（默认每个 app 有 Staging + Production）
code-push-standalone deployment ls TarsierTest-ios -k
code-push-standalone deployment ls TarsierTest-android -k
code-push-standalone deployment ls Tarsier-ios -k
code-push-standalone deployment ls Tarsier-android -k
```

### C5. 填入 Deployment Keys

复制输出的 keys 到以下位置：

| App                   | Deployment   | Key 值                          | 填入位置                                                                                                                                     |
| --------------------- | ------------ | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `TarsierTest-ios`     | `Staging`    | `xxx`                           | [`ios/Config/Test.xcconfig`](/Users/porter/Developer/frontend-blog-mobile/ios/Config/Test.xcconfig) — `CODEPUSH_DEPLOYMENT_KEY`              |
| `TarsierTest-android` | `Staging`    | `yyy`                           | [`android/app/build.gradle`](/Users/porter/Developer/frontend-blog-mobile/android/app/build.gradle:139) — staging `CodePushDeploymentKey`    |
| `Tarsier-ios`         | `Production` | `zzz`                           | [`ios/Config/Prod.xcconfig`](/Users/porter/Developer/frontend-blog-mobile/ios/Config/Prod.xcconfig) — `CODEPUSH_DEPLOYMENT_KEY`              |
| `Tarsier-android`     | `Production` | `www`                           | [`android/app/build.gradle`](/Users/porter/Developer/frontend-blog-mobile/android/app/build.gradle:149) — production `CodePushDeploymentKey` |
| —                     | —            | `CODEPUSH_ACCESS_KEY`           | GitHub Secrets (`CODEPUSH_ACCESS_KEY`)                                                                                                       |
| —                     | —            | `https://codepush.joyminis.com` | GitHub Secrets (`CODEPUSH_SERVER_URL`)                                                                                                       |

---

## Part D: 验证

### D1. 完整的端到端测试

```bash
# 1. 发布一个测试更新
make codepush-release-staging
# 输入描述: "Test hot update v1"

# 2. 确认更新已发布
code-push-standalone deployment history TarsierTest-ios Staging

# 3. 在手机上打开 Tarsier(Test) 应用
#    - 切换到后台再切回来（触发 ON_APP_RESUME）
#    - 应该弹出更新提示（或静默下载，取决于 installMode）

# 4. 检查应用是否收到了更新
#    - 在 JS 端可以通过 codePush.getUpdateMetadata() 查看
```

### D2. 需要填写的配置值总结

| 配置项                          | 值                              | 位置                                      |
| ------------------------------- | ------------------------------- | ----------------------------------------- |
| CodePush Server URL             | `https://codepush.joyminis.com` | iOS `Info.plist` + Android `build.gradle` |
| TarsierTest-ios Staging Key     | （从 CLI 获取）                 | iOS `Test.xcconfig`                       |
| TarsierTest-android Staging Key | （从 CLI 获取）                 | Android `build.gradle` staging flavor     |
| Tarsier-ios Production Key      | （从 CLI 获取）                 | iOS `Prod.xcconfig`                       |
| Tarsier-android Production Key  | （从 CLI 获取）                 | Android `build.gradle` production flavor  |
| `CODEPUSH_SERVER_URL` (GitHub)  | `https://codepush.joyminis.com` | GitHub Secrets                            |
| `CODEPUSH_ACCESS_KEY` (GitHub)  | （从服务器生成）                | GitHub Secrets                            |

---

## 实施顺序

| 步骤                                                     | 谁做                               | 文件                                     |
| -------------------------------------------------------- | ---------------------------------- | ---------------------------------------- |
| **1. 创建 `compose.codepush.yml`**                       | **你做** (`JoyMini_Nest_Monorepo`) | 新建文件                                 |
| **2. 更新 `cloudflared.yml` 添加 ingress**               | **你做** (`JoyMini_Nest_Monorepo`) | 添加一行                                 |
| **3. 更新 `deploy/deploy.sh` 添加 sync**                 | **你做** (`JoyMini_Nest_Monorepo`) | 添加 2 行                                |
| **4. 部署到 VPS**                                        | **你做** (SSH)                     | `--sync` + `up -d` + restart cloudflared |
| **5. 注册管理员 + 生成 access key**                      | **你做** (SSH)                     | 运行 2 个命令                            |
| **6. 创建 4 apps + 获取 keys**                           | **你做** (本地 CLI)                | 运行 6 个命令                            |
| **7. 填入 deployment keys**                              | **你做**                           | 复制到 xcconfig + build.gradle           |
| **8. iOS Info.plist + Android build.gradle (ServerUrl)** | **切换 Code mode 后我来做**        | 2 个文件                                 |
| **9. 更新 Makefile codepush-\* 命令**                    | **切换 Code mode 后我来做**        | Makefile                                 |
| **10. 更新 deploy.yml CI**                               | **切换 Code mode 后我来做**        | `.github/workflows/deploy.yml`           |
| **11. 更新 docs/ci-cd-setup-guide.md**                   | **切换 Code mode 后我来做**        | docs                                     |
| **12. 端到端测试**                                       | **你做**                           | 验证 OTA                                 |

**要点总结：**

- **独立 compose 文件** — `compose.codepush.yml` 不修改现有 `compose.prod.yml`
- **连接到现有 `app` 网络** — 使用 `external: true`
- **Cloudflare Tunnel** — 无需 Nginx，直接 3000 端口
- **SDK 原生支持** — iOS 读 `Info.plist`，Android 读 `string resources`，无需改原生代码
- **Key 管理** — 填 4 个 deployment keys + 2 个 GitHub Secrets
