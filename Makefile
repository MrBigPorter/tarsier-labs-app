# ============================================================================
# Tarsier — Frontend Blog Mobile (React Native)
# Makefile for dev / staging / production workflows
# ============================================================================

.DEFAULT_GOAL := help
SHELL := /bin/zsh

# ── Node / binary resolution ──────────────────────────────────────────────────
# Volta installs global binaries outside the default PATH.
# code-push-standalone resolves from this path.
NODE_BIN := /Users/porter/.volta/tools/image/node/24.14.1/bin
.PHONY: help dev dev-ios dev-ios-device deploy-prod-ios deploy-prod-android dev-android dev-android-device staging staging-ios staging-android \
        release release-ios release-android release-android-aab \
        build build-ios build-android \
        build-test-android build-prod-aab build-prod-apk \
        run-test-android run-prod-android \
        build-test-ios build-prod-ios \
        codepush-login codepush-create-key codepush-keys codepush-setup-keys codepush-release-staging codepush-release-production codepush-promote codepush-history \
        install update clean reset lint typecheck test check \
        env-dev env-staging env-prod env-show \
        devtools fusebox logs-ios logs-android profile hermes-profile perf perf-ci check-bundle-size sentry-dashboard xcode \
        fresh reset-android reset-ios studio-android audit \
        doctor rebuild-ios rebuild-android reset-all \
        port-ls port-kill port-kill-metro ports \
        android-generate-key android-delete-key android-key-info android-key-backup android-debug-key-info \
        ios-cert-info ios-export-cert ios-profile-list ios-profile-info

# ── Help ──────────────────────────────────────────────────────────────────

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ── Environment Switching ─────────────────────────────────────────────────

env-dev: ## Switch to development environment (.env.development)
	cp .env.development .env
	@echo "🔧 Switched to \033[36mdevelopment\033[0m environment"

env-staging: ## Switch to staging environment (.env.staging)
	cp .env.staging .env
	@echo "🔧 Switched to \033[33mstaging\033[0m environment"

env-prod: ## Switch to production environment (.env.production)
	cp .env.production .env
	@echo "🔧 Switched to \033[31mproduction\033[0m environment"

env-show: ## Show current environment configuration
	@echo "=== Current .env ==="
	@cat .env
	@echo ""

# ── Installation ──────────────────────────────────────────────────────────

install: ## Install all dependencies (yarn + pods)
	yarn install
	cd ios && USE_FRAMEWORKS=static pod install && cd ..
	@echo "✅ Dependencies installed"

update: ## Show outdated dependencies
	yarn outdated

# ── Development ───────────────────────────────────────────────────────────

dev: env-dev ## Start Metro bundler in development mode
	yarn start

dev-ios: env-dev ## Build & run on iOS Simulator
	yarn ios

dev-ios-device: env-dev ## Build & run on iOS Device (Debug, interactive + auto logs, bypasses Xcode 16 devicectl bug)
	./scripts/deploy-ios-device.sh

deploy-prod-ios: env-prod ## Build & run on iOS Device (Release/production mode)
	@echo "🏗️  Deploying \033[31mproduction\033[0m build to connected iOS device..."
	@echo ""
	@echo "━━━ Step 1 — Metro Bundler ━━━"
	@if curl -s http://localhost:8081/status > /dev/null 2>&1; then \
		echo "  ✅ Metro bundler is already running"; \
	else \
		echo "  ⚠️  Metro bundler not running. Starting..."; \
		yarn start > /tmp/metro-bundler.log 2>&1 & \
		METRO_PID=$$!; \
		echo "  🔄 Metro PID: $$METRO_PID — waiting for ready..."; \
		for i in $$(seq 1 30); do \
			if curl -s http://localhost:8081/status > /dev/null 2>&1; then \
				echo "  ✅ Metro is ready!"; \
				break; \
			fi; \
			if [ "$$i" = "30" ]; then \
				echo "  ❌ Metro did not start. Check /tmp/metro-bundler.log"; \
				exit 1; \
			fi; \
			sleep 1; \
		done; \
	fi
	@echo ""
	@echo "━━━ Step 2 — Build & Install ━━━"
	@echo "  📱 Building Release and installing to first connected device..."
	@echo ""
	cd ios && npx react-native run-ios --device --mode Release 2>&1; \
	RC=$$?; \
	if [ $$RC -ne 0 ]; then \
		echo ""; \
		echo "  ❌ Deployment failed."; \
		echo "     Possible causes:"; \
		echo "     • Device is locked (unlock it)"; \
		echo "     • Device not trusted (tap 'Trust' on device)"; \
		echo "     • No connected device found"; \
		echo "     • Ensure iPhone is USB-connected or wirelessly paired"; \
		echo ""; \
		echo "     Check with: xcrun devicectl list devices"; \
		exit $$RC; \
	fi
	@echo ""
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo "  ✅  Production app deployed to iPhone!"
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo ""
	@echo "  🔍 To view console logs:"
	@echo "     In the Metro terminal, press ${BOLD}j${NC} → Fusebox DevTools"
	@echo ""

deploy-prod-android: env-prod ## Build & deploy production APK to connected Android device
	@echo "🏗️  Deploying \033[31mproduction\033[0m build to connected Android device..."
	@echo ""
	@echo "━━━ Step 1 — Metro Bundler ━━━"
	@if curl -s http://localhost:8081/status > /dev/null 2>&1; then \
		echo "  ✅ Metro bundler is already running"; \
	else \
		echo "  ⚠️  Metro bundler not running. Starting..."; \
		yarn start > /tmp/metro-bundler.log 2>&1 & \
		METRO_PID=$$!; \
		echo "  🔄 Metro PID: $$METRO_PID — waiting for ready..."; \
		for i in $$(seq 1 30); do \
			if curl -s http://localhost:8081/status > /dev/null 2>&1; then \
				echo "  ✅ Metro is ready!"; \
				break; \
			fi; \
			if [ "$$i" = "30" ]; then \
				echo "  ❌ Metro did not start. Check /tmp/metro-bundler.log"; \
				exit 1; \
			fi; \
			sleep 1; \
		done; \
	fi
	@echo ""
	@echo "━━━ Step 2 — Device Discovery & Deploy ━━━"
	@echo "  📱 Scanning for connected devices and deploying..."
	@echo "     (signed with release-upload-key.keystore)"
	@echo ""
	@./scripts/deploy-android-prod-device.sh

dev-android: env-dev ## Build & run on Android Emulator
	yarn android

dev-android-device: env-dev ## Build & run on Android Device (USB, interactive + auto logs)
	./scripts/deploy-android-device.sh

# ── Code Quality ──────────────────────────────────────────────────────────

lint: ## Run ESLint
	yarn lint

typecheck: ## Run TypeScript type checking
	yarn tsc --noEmit

test: ## Run Jest unit tests
	yarn test

check: lint typecheck test ## Run all code quality checks

# ── Performance & DevTools ─────────────────────────────────────────────────

xcode: ## Open iOS project in Xcode
	@echo "📱 Opening iOS workspace in Xcode..."
	@open ios/FrontendBlogMobile.xcworkspace

devtools: ## Launch standalone React DevTools
	@echo "🔍 Starting React DevTools..."
	@echo "   Make sure your app is running on a simulator/device."
	@echo "   Then press ⌘D (iOS) / ⌘M (Android) → 'Open React DevTools'"
	react-devtools

fusebox: ## Show Metro debugger shortcuts (Fusebox — the RN 0.85+ debugging experience)
	@echo "🔍 Metro Debugger (Fusebox) — keyboard shortcuts:"
	@echo ""
	@echo "   While the Metro bundler terminal is active:"
	@echo "     ${BOLD}j${NC}     Open React DevTools (Fusebox) — Console tab shows logs"
	@echo "     ${BOLD}d${NC}     Open Dev Menu on connected device/simulator"
	@echo "     ${BOLD}r${NC}     Reload JavaScript bundle"
	@echo ""
	@echo "   Standalone tools:"
	@echo "     ${BOLD}make devtools${NC}     Launch standalone React DevTools window"
	@echo "     ${BOLD}make logs-ios${NC}     Simulator log stream (use j key for devices)"
	@echo "     ${BOLD}make logs-android${NC} Android device/emulator log stream"
	@echo ""
	@echo "   Device deployment:"
	@echo "     ${BOLD}make dev-ios-device${NC}     Build → deploy wirelessly to device"
	@echo "     ${BOLD}make dev-android-device${NC} Build → deploy to Android device"
	@echo ""

profile-hermes: ## Generate Hermes CPU profile (iOS simulator)
	@echo "⚡ Generating Hermes CPU profile..."
	@echo "   Usage:"
	@echo "   1. Start app in iOS simulator"
	@echo "   2. Press ⌘D → 'Start Hermes Profiler'"
	@echo "   3. Interact with the app to capture activity"
	@echo "   4. Press ⌘D → 'Stop Hermes Profiler'"
	@echo "   5. This will save a .cpuprofile to the simulator"
	@echo ""
	@echo "   To convert the profile to a readable format:"
	@echo "   $$ react-native profile-hermes --filename <path-to-profile>"

profile: profile-hermes ## Alias for Hermes profiling

perf: ## Performance monitoring overview
	@echo "📊 Performance monitoring tools:"
	@echo ""
	@echo "   ⚡ Automated (zero UI — runs in background):"
	@echo "      • FPS tracking in PerfContext (requestAnimationFrame-based)"
	@echo "      • Auto-trigger Hermes CPU Profiler when FPS < 25 sustained"
	@echo "      • Slow API warning (console.warn when > 1000ms)"
	@echo "      • API timing recording via apiTiming -> baseApi"
	@echo ""
	@echo "   🧪 CI Gates:"
	@echo "      $$ make perf-ci           (run Detox performance budgets)"
	@echo "      $$ make check-bundle-size (verify JS bundle size budget)"
	@echo ""
	@echo "   📤 Export:"
	@echo "      $$ bash scripts/pull-perf-data.sh (copy .cpuprofile files)"
	@echo ""
	@echo "   📈 Production (Sentry):"
	@echo "      $$ make sentry-dashboard  (open Sentry Performance)"
	@echo ""
	@echo "   🪵 Live Logs:"
	@echo "      $$ make logs-ios       (attach iOS log stream to running app)"
	@echo "      $$ make logs-android   (attach Android log stream to running app)"
	@echo ""

perf-ci: ## Run Detox E2E performance budget tests
	@echo "🧪 Running Detox performance budget tests..."
	cd e2e && yarn detox test --configuration ios.sim.release performance-budget.test.ts

logs-ios: ## Attach iOS simulator log stream to running app
	@echo "📱 Starting iOS simulator log stream (Ctrl+C to stop)..."
	@echo "   Make sure your app is running in a simulator."
	@echo "   For physical devices, press 'l' in the Metro terminal instead."
	npx react-native log-ios

logs-android: ## Attach Android device/emulator log stream to running app
	@echo "📱 Starting Android log stream (Ctrl+C to stop)..."
	@echo "   Make sure your app is running on a device or emulator."
	@if [ -n "$(DEVICE_ID)" ]; then \
		echo "   Targeting device: $(DEVICE_ID)"; \
		ANDROID_SERIAL="$(DEVICE_ID)" npx react-native log-android; \
	else \
		npx react-native log-android; \
	fi

check-bundle-size: ## Check production JS bundle size against budget
	@echo "📦 Checking production JS bundle size..."
	bash scripts/check-bundle-size.sh

sentry-dashboard: ## Open Sentry Performance dashboard in browser
	@echo "📈 Opening Sentry Performance dashboard..."
	@open "https://sentry.io/organizations/YOUR_ORG/performance/" 2>/dev/null || \
		echo "⚠️  Update the Sentry org URL in Makefile's sentry-dashboard target"

# ── Staging Build (QA / Pre-release) ──────────────────────────────────────

staging: env-staging ## Build both platforms in staging mode
	$(MAKE) staging-ios
	$(MAKE) staging-android

staging-ios: env-staging ## Build iOS staging archive
	@echo "🏗️  Building iOS \033[33mstaging\033[0m archive..."
	cd ios && xcodebuild -workspace FrontendBlogMobile.xcworkspace \
		-scheme FrontendBlogMobile \
		-configuration Release \
		-archivePath ./build/Staging.xcarchive \
		archive
	@echo "✅ iOS staging archive: ios/build/Staging.xcarchive"

staging-android: env-staging ## Build Android staging APK
	@echo "🏗️  Building Android \033[33mstaging\033[0m APK..."
	cd android && ./gradlew assembleRelease
	@echo "✅ Android staging APK: android/app/build/outputs/apk/release/app-release.apk"

# ── Production Build (App Store / Google Play) ────────────────────────────

release: env-prod ## Build both platforms for production
	$(MAKE) release-ios
	$(MAKE) release-android

release-ios: env-prod ## Build iOS production archive (App Store)
	@echo "🏗️  Building iOS \033[31mproduction\033[0m archive..."
	cd ios && xcodebuild -workspace FrontendBlogMobile.xcworkspace \
		-scheme FrontendBlogMobile \
		-configuration Release \
		-archivePath ./build/FrontendBlogMobile.xcarchive \
		archive
	@echo "✅ iOS production archive: ios/build/FrontendBlogMobile.xcarchive"
	@echo "📦 Open Xcode → Organizer → Distribute App → App Store"

release-android-aab: env-prod ## Build Android AAB (Google Play)
	@echo "🏗️  Building Android \033[31mproduction\033[0m AAB..."
	cd android && ./gradlew bundleRelease
	@echo "✅ Android AAB: android/app/build/outputs/bundle/release/app-release.aab"

release-android: env-prod ## Build Android APK (direct install)
	@echo "🏗️  Building Android \033[31mproduction\033[0m APK..."
	cd android && ./gradlew assembleRelease
	@echo "✅ Android APK: android/app/build/outputs/apk/release/app-release.apk"

# ── Quick Build (clean + build) ──────────────────────────────────────────

build: clean env-prod ## Clean + build both platforms for production
	$(MAKE) build-ios
	$(MAKE) build-android

build-ios: env-prod ## Clean + build iOS production archive
	@echo "🏗️  Building iOS \033[31mproduction\033[0m archive..."
	cd ios && xcodebuild -workspace FrontendBlogMobile.xcworkspace \
		-scheme FrontendBlogMobile \
		-configuration Release \
		-archivePath ./build/FrontendBlogMobile.xcarchive \
		archive
	@echo "✅ iOS production archive: ios/build/FrontendBlogMobile.xcarchive"
	@echo "📦 Open Xcode → Organizer → Distribute App → App Store"

build-android: env-prod ## Clean + build Android AAB (Google Play)
	@echo "🏗️  Building Android \033[31mproduction\033[0m AAB..."
	cd android && ./gradlew bundleRelease
	@echo "✅ Android AAB: android/app/build/outputs/bundle/release/app-release.aab"

# ── Build per flavor ──────────────────────────────────────────────────

build-test-android: ## Build Android staging APK (stagingRelease)
	@echo "🏗️  Building Android \033[36mstaging\033[0m APK..."
	cd android && ./gradlew assembleStagingRelease
	@echo "✅ Staging APK: android/app/build/outputs/apk/staging/release/app-staging-release.apk"

build-prod-aab: ## Build Android production AAB (bundleProductionRelease)
	@echo "🏗️  Building Android \033[31mproduction\033[0m AAB..."
	cd android && ./gradlew bundleProductionRelease
	@echo "✅ Production AAB: android/app/build/outputs/bundle/productionRelease/app-production-release.aab"

build-prod-apk: ## Build Android production APK (assembleProductionRelease)
	@echo "🏗️  Building Android \033[31mproduction\033[0m APK..."
	cd android && ./gradlew assembleProductionRelease
	@echo "✅ Production APK: android/app/build/outputs/apk/production/release/app-production-release.apk"

# ── Run per flavor ────────────────────────────────────────────────────

run-test-android: ## Run Android staging flavor on emulator
	@echo "🎯 Running Android \033[36mstaging\033[0m flavor..."
	yarn android --variant=stagingDebug

run-prod-android: ## Run Android production flavor on emulator
	@echo "🎯 Running Android \033[31mproduction\033[0m flavor..."
	yarn android --variant=productionDebug

# ── iOS per flavor ────────────────────────────────────────────────────

build-test-ios: ## Build iOS test archive (no codesign)
	@echo "🏗️  Building iOS \033[36mtest\033[0m archive..."
	cd ios && xcodebuild -workspace FrontendBlogMobile.xcworkspace \
		-scheme FrontendBlogMobile-Test \
		-configuration Release-Test \
		-archivePath ./build/Test.xcarchive \
		archive \
		CODE_SIGN_IDENTITY="" CODE_SIGNING_REQUIRED=NO
	@echo "✅ iOS test archive: ios/build/Test.xcarchive"

build-prod-ios: ## Build iOS production archive (no codesign)
	@echo "🏗️  Building iOS \033[31mproduction\033[0m archive..."
	cd ios && xcodebuild -workspace FrontendBlogMobile.xcworkspace \
		-scheme FrontendBlogMobile \
		-configuration Release \
		-archivePath ./build/Prod.xcarchive \
		archive \
		CODE_SIGN_IDENTITY="" CODE_SIGNING_REQUIRED=NO
	@echo "✅ iOS production archive: ios/build/Prod.xcarchive"

# ── Hot Update (CodePush Self-Hosted) ──────────────────────────
CODEPUSH_STANDALONE_CMD := $(NODE_BIN)/code-push-standalone
CODEPUSH_SERVER_URL := https://codepush.joyminis.com

codepush-login: ## Login to self-hosted CodePush. Usage: make codepush-login TOKEN=<access-key>
	@if [ -z "$(TOKEN)" ]; then \
		echo "⚠️  Usage: make codepush-login TOKEN=<your-access-key>"; \
		echo "   Get your access key from: make codepush-create-key SSH_HOST=root@<vps-ip>"; \
		exit 1; \
	fi
	$(CODEPUSH_STANDALONE_CMD) login $(CODEPUSH_SERVER_URL) --accessKey "$(TOKEN)"
	@echo "✅ Logged in to CodePush at $(CODEPUSH_SERVER_URL)"

codepush-create-key: ## Generate a new access key on the VPS via REST API. Usage: make codepush-create-key SSH_HOST=root@<VPS_IP>
	@if [ -z "$(SSH_HOST)" ]; then \
		echo "⚠️  Usage: make codepush-create-key SSH_HOST=root@<vps-ip>"; \
		exit 1; \
	fi
	@echo "📝 Generating access key (valid 365 days) via REST API..."
	@echo "   (Requires admin email and password — set ADMIN_EMAIL and ADMIN_PASSWORD)"
	@echo ""
	ssh $(SSH_HOST) "ADMIN_EMAIL=$${ADMIN_EMAIL:-admin@joyminis.com}; ADMIN_PASSWORD=$${ADMIN_PASSWORD:-}; \
		if [ -z \"\$$ADMIN_PASSWORD\" ]; then \
			echo '❌ ADMIN_PASSWORD not set. Usage: make codepush-create-key SSH_HOST=root@<vps-ip> ADMIN_PASSWORD=your-password'; \
			exit 1; \
		fi; \
		echo \">>> Logging in as \$$ADMIN_EMAIL...\"; \
		TOKEN=\$$(curl -s -X POST http://localhost:3000/auth/login \
			-H 'Content-Type: application/json' \
			-d \"{\\\"email\\\":\\\"\$$ADMIN_EMAIL\\\",\\\"password\\\":\\\"\$$ADMIN_PASSWORD\\\"}\" | \
			node -e \"let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).data.token)}catch(e){console.error('Login failed',d);process.exit(1)}})\"); \
		if [ -z \"\$$TOKEN\" ]; then exit 1; fi; \
		echo \">>> Creating access key 'ci-key' (365 days)...\"; \
		ACCESS_KEY=\$$(curl -s -X POST http://localhost:3000/accessKeys \
			-H 'Content-Type: application/json' \
			-H \"Authorization: Bearer \$$TOKEN\" \
			-d '{\"name\":\"ci-key\",\"ttl\":365}' | \
			node -e \"let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).data.accessKey)}catch(e){console.error('Key creation failed',d);process.exit(1)}})\"); \
		echo \"✅ Access Key: \$$ACCESS_KEY\"; \
		echo \"   Save this key — you need it as CODEPUSH_ACCESS_KEY in GitHub Secrets\"; \
		echo \"   Also use it locally: make codepush-login TOKEN=\$$ACCESS_KEY\"; \
	"

codepush-setup-keys: ## Interactive: login, get keys, auto-fill config files
	./scripts/setup-codepush-keys.sh

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
	$(CODEPUSH_STANDALONE_CMD) release-react TarsierTest-ios ios --deploymentName Staging --description "$$msg" --plistFile ios/FrontendBlogMobile/Info.plist --xcodeProjectFile ios/FrontendBlogMobile.xcodeproj && \
	echo "📦 Releasing to TarsierTest-android Staging..." && \
	$(CODEPUSH_STANDALONE_CMD) release-react TarsierTest-android android --deploymentName Staging --description "$$msg" && \
	echo "✅ Staging OTA update sent"

codepush-release-production: ## Release OTA update to Production (both platforms)
	@read -p "📝 Enter OTA description: " msg; \
	echo "📦 Releasing to Tarsier-ios Production..." && \
	$(CODEPUSH_STANDALONE_CMD) release-react Tarsier-ios ios --deploymentName Production --description "$$msg" --plistFile ios/FrontendBlogMobile/Info.plist --xcodeProjectFile ios/FrontendBlogMobile.xcodeproj && \
	echo "📦 Releasing to Tarsier-android Production..." && \
	$(CODEPUSH_STANDALONE_CMD) release-react Tarsier-android android --deploymentName Production --description "$$msg" && \
	echo "✅ Production OTA update sent"

codepush-promote: ## Promote Staging → Production for all 4 apps
	$(CODEPUSH_STANDALONE_CMD) promote TarsierTest-ios Staging Production
	$(CODEPUSH_STANDALONE_CMD) promote TarsierTest-android Staging Production
	$(CODEPUSH_STANDALONE_CMD) promote Tarsier-ios Staging Production
	$(CODEPUSH_STANDALONE_CMD) promote Tarsier-android Staging Production

codepush-history: ## Show deployment history
	@echo "━━━ TarsierTest-ios Staging ━━━"
	$(CODEPUSH_STANDALONE_CMD) deployment history TarsierTest-ios Staging
	@echo ""
	@echo "━━━ Tarsier-ios Production ─────"
	$(CODEPUSH_STANDALONE_CMD) deployment history Tarsier-ios Production

# ── Key Management (Android & iOS) ─────────────────────────────────────────

KEYSTORE_DIR := android/app
KEYSTORE_FILE := $(KEYSTORE_DIR)/release-upload-key.keystore
KEYSTORE_PROPS := $(KEYSTORE_DIR)/keystore.properties

android-generate-key: ## Generate a new Android release upload keystore (interactive)
	@echo "🔑 Generating new Android release upload keystore..."
	@echo ""
	@if [ -f "$(KEYSTORE_FILE)" ]; then \
		echo "⚠️  $(KEYSTORE_FILE) already exists."; \
		read "answer?❓ Overwrite? [y/N]: "; \
		if [ "$$answer" != "y" ] && [ "$$answer" != "Y" ]; then \
			echo "⏭️  Aborted."; \
			exit 0; \
		fi; \
	fi
	@read "storepass?🔐 Enter keystore password: "; \
	read "keyalias?🏷️  Enter key alias [default: upload-key]: "; \
	keyalias=$${keyalias:-upload-key}; \
	keypass=$$storepass; \
	echo ""; \
	mkdir -p "$(KEYSTORE_DIR)"; \
	keytool -genkey -v -storetype PKCS12 \
		-keystore "$(KEYSTORE_FILE)" \
		-alias "$$keyalias" \
		-keyalg RSA -keysize 2048 -validity 10000 \
		-storepass "$$storepass" -keypass "$$keypass" \
		-dname "CN=Tarsier Labs, OU=Mobile, O=Tarsier, L=Manila, S=Manila, C=PH" && \
	echo "" && \
	echo "storeFile=release-upload-key.keystore" > "$(KEYSTORE_PROPS)" && \
	echo "storePassword=$$storepass" >> "$(KEYSTORE_PROPS)" && \
	echo "keyAlias=$$keyalias" >> "$(KEYSTORE_PROPS)" && \
	echo "keyPassword=$$keypass" >> "$(KEYSTORE_PROPS)" && \
	echo "✅ Keystore generated: $(KEYSTORE_FILE)" && \
	echo "✅ Config written: $(KEYSTORE_PROPS)"

android-delete-key: ## Delete the Android release upload keystore (with confirmation)
	@echo "🗑️  Deleting Android release upload keystore..."
	@echo ""
	@if [ ! -f "$(KEYSTORE_FILE)" ] && [ ! -f "$(KEYSTORE_PROPS)" ]; then \
		echo "⚠️  No keystore found — nothing to delete."; \
		exit 0; \
	fi
	@echo "  Files to delete:"
	@if [ -f "$(KEYSTORE_FILE)" ]; then echo "    • $(KEYSTORE_FILE)"; fi
	@if [ -f "$(KEYSTORE_PROPS)" ]; then echo "    • $(KEYSTORE_PROPS)"; fi
	@echo ""
	@read "answer?❓ Are you sure? This cannot be undone! [y/N]: "; \
	if [ "$$answer" != "y" ] && [ "$$answer" != "Y" ]; then \
		echo "⏭️  Aborted."; \
		exit 0; \
	fi; \
	rm -f "$(KEYSTORE_FILE)" "$(KEYSTORE_PROPS)" && \
	echo "✅ Keystore deleted."

android-key-info: ## Show SHA-1 and SHA-256 fingerprints of the release upload key
	@echo "🔍 Android Release Upload Key Info"
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@if [ ! -f "$(KEYSTORE_FILE)" ]; then \
		echo "❌ Keystore not found: $(KEYSTORE_FILE)"; \
		exit 1; \
	fi; \
	STORE_PASS=$$(grep '^storePassword' "$(KEYSTORE_PROPS)" 2>/dev/null | head -1 | cut -d= -f2-); \
	if [ -z "$$STORE_PASS" ]; then \
		read "STORE_PASS?🔐 Enter keystore password: "; \
	fi; \
	keytool -list -v -keystore "$(KEYSTORE_FILE)" -storepass "$$STORE_PASS" 2>/dev/null | grep -E "(SHA[0-9]*:|Alias name|Valid from|Entry type)" | head -10; \
	if [ $$? -ne 0 ]; then \
		echo ""; \
		echo "⚠️  Failed to read keystore. Possible causes:"; \
		echo "   • Wrong password — check keystore.properties or enter manually"; \
		echo "   • Keystore file is corrupted"; \
		keytool -list -v -keystore "$(KEYSTORE_FILE)" 2>&1 | head -5; \
	fi

android-debug-key-info: ## Show debug.keystore SHA-256 fingerprint (for assetlinks.json)
	@echo "🔍 Android Debug Keystore Info"
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@DEBUG_KEY=$$HOME/.android/debug.keystore; \
	if [ ! -f "$$DEBUG_KEY" ]; then \
		echo "❌ Debug keystore not found at $$DEBUG_KEY"; \
		echo "   Generate one by running any debug build, or create with:"; \
		echo "   keytool -genkey -v -keystore $$DEBUG_KEY -alias androiddebugkey -keyalg RSA -keysize 2048 -validity 10000 -storepass android -keypass android -dname 'CN=Android Debug,O=Android,C=US'"; \
		exit 1; \
	fi; \
	echo "   SHA-1:   $$(keytool -list -v -keystore "$$DEBUG_KEY" -storepass android 2>/dev/null | grep SHA1 | head -1 | awk '{print $$NF}')"; \
	echo "   SHA-256: $$(keytool -list -v -keystore "$$DEBUG_KEY" -storepass android 2>/dev/null | grep 'SHA256:' | head -1 | awk '{print $$NF}')"

android-key-sha256: ## Quick: get SHA-256 only (for assetlinks.json). Usage: make android-key-sha256 [PASS=storepass]
	@if [ ! -f "$(KEYSTORE_FILE)" ]; then \
		echo "❌ Keystore not found: $(KEYSTORE_FILE)"; \
		exit 1; \
	fi; \
	STORE_PASS=$${PASS:-$$(grep '^storePassword' "$(KEYSTORE_PROPS)" 2>/dev/null | head -1 | cut -d= -f2-)}; \
	if [ -z "$$STORE_PASS" ]; then \
		read "STORE_PASS?🔐 Enter keystore password: "; \
	fi; \
	echo "$$(keytool -list -v -keystore "$(KEYSTORE_FILE)" -storepass "$$STORE_PASS" 2>/dev/null | grep 'SHA256:' | head -1 | awk '{print $$NF}')"

android-key-backup: ## Create encrypted backup of keystore + properties to Desktop
	@echo "💾 Backing up Android release upload keystore..."
	@echo ""
	@if [ ! -f "$(KEYSTORE_FILE)" ]; then \
		echo "❌ Keystore not found: $(KEYSTORE_FILE)"; \
		exit 1; \
	fi
	@BACKUP_FILE=$$HOME/Desktop/tarsier-android-key-backup-$$(date +%Y%m%d-%H%M%S).zip; \
	cd "$(KEYSTORE_DIR)" && zip -er "$$BACKUP_FILE" release-upload-key.keystore keystore.properties && \
	echo "" && \
	echo "✅ Backup created:" && \
	echo "   $$BACKUP_FILE"

ios-cert-info: ## List all valid iOS code signing certificates in Keychain
	@echo "🔍 iOS Code Signing Certificates"
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@security find-identity -v -p basic 2>&1 || \
		(echo "❌ Failed to list certificates." && exit 1)
	@echo ""
	@echo "📋 To export a certificate as .p12:"
	@echo "   $$ make ios-export-cert SHA1=<fingerprint>"
	@echo "   (Find the SHA1 fingerprint in the list above)"

ios-export-cert: ## Export a signing certificate as .p12. Usage: make ios-export-cert SHA1=<fingerprint>
	@if [ -z "$(SHA1)" ]; then \
		echo "⚠️  Usage: make ios-export-cert SHA1=<40-char-hex-fingerprint>"; \
		echo "   Run 'make ios-cert-info' to see available certificates."; \
		exit 1; \
	fi
	@OUTPUT=$$HOME/Desktop/ios-distribution-$$(date +%Y%m%d).p12; \
	echo "📤 Exporting certificate $(SHA1) to Desktop..."; \
	security export -k ~/Library/Keychains/login.keychain-db -t identities -f pkcs12 -P "" -o "$$OUTPUT" 2>&1; \
	if [ $$? -eq 0 ]; then \
		echo "✅ Exported: $$OUTPUT"; \
		echo "⚠️  This file contains your private key. Keep it secure!"; \
	else \
		echo "❌ Export failed. Try unlocking your keychain first:"; \
		echo "   security unlock-keychain ~/Library/Keychains/login.keychain-db"; \
		exit 1; \
	fi

ios-profile-list: ## List installed iOS provisioning profiles
	@echo "🔍 Installed Provisioning Profiles"
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@PROFILE_DIR=$$HOME/Library/MobileDevice/Provisioning\ Profiles; \
	if [ ! -d "$$PROFILE_DIR" ]; then \
		echo "❌ No provisioning profiles directory found."; \
		exit 1; \
	fi; \
	profiles=("$$PROFILE_DIR"/*.mobileprovision 2>/dev/null); \
	if [ $$#profiles -eq 0 ] || [ ! -f "$${profiles[0]}" ]; then \
		echo "❌ No provisioning profiles installed."; \
		exit 1; \
	fi; \
	for f in "$$PROFILE_DIR"/*.mobileprovision; do \
		name=$$(security cms -D -i "$$f" 2>/dev/null | plutil -extract Name raw - -o - 2>/dev/null || echo "unknown"); \
		expiry=$$(security cms -D -i "$$f" 2>/dev/null | plutil -extract ExpirationDate raw - -o - 2>/dev/null || echo "unknown"); \
		team=$$(security cms -D -i "$$f" 2>/dev/null | plutil -extract TeamName raw - -o - 2>/dev/null || echo "unknown"); \
		echo "  📄 $$name"; \
		echo "     Team: $$team  |  Expires: $$expiry"; \
		echo "     $$f"; \
		echo ""; \
	done

ios-profile-info: ## Show details of a provisioning profile. Usage: make ios-profile-info FILE=<path>
	@if [ -z "$(FILE)" ]; then \
		echo "⚠️  Usage: make ios-profile-info FILE=path/to/profile.mobileprovision"; \
		echo "   Run 'make ios-profile-list' to find profile paths."; \
		exit 1; \
	fi; \
	if [ ! -f "$(FILE)" ]; then \
		echo "❌ File not found: $(FILE)"; \
		exit 1; \
	fi; \
	security cms -D -i "$(FILE)" 2>/dev/null | plutil -p - 2>/dev/null | head -80

# ── Cleanup & Reset ───────────────────────────────────────────────────────

clean: ## Clean ALL build artifacts + caches (combines old clean + purge + clear-cache)
	@echo "🧹 Cleaning all build artifacts and caches..."
	@echo "  → Deleting android/build..."
	@rm -rf android/build
	@echo "  → Deleting ios/build..."
	@rm -rf ios/build
	@echo "  → Clearing Metro, Watchman, DerivedData, TS caches..."
	@-watchman watch-del-all 2>/dev/null
	@-rm -rf $$TMPDIR/metro-* $$TMPDIR/haste-* 2>/dev/null || true
	@-rm -rf ~/Library/Developer/Xcode/DerivedData/FrontendBlogMobile-* 2>/dev/null || true
	@-rm -rf .tsbuildinfo 2>/dev/null || true
	@echo "✅ All cleaned. Run 'make dev' to restart Metro."

reset: clean ## Full reset: clean + remove node_modules/pods + reinstall
	@echo "🔄 Full reset..."
	rm -rf node_modules
	cd ios && rm -rf Pods Podfile.lock && cd ..
	yarn install
	cd ios && USE_FRAMEWORKS=static pod install && cd ..
	@echo "✅ Full reset complete"

fresh: ## Complete project bootstrap from scratch (no dependency on clean)
	@echo "🆕 Bootstrapping project from scratch..."
	rm -rf node_modules android/build ios/build ios/Pods Podfile.lock
	yarn install
	cd ios && USE_FRAMEWORKS=static pod install && cd ..
	@echo "✅ Project bootstrap complete"

reset-android: ## Reset Android native deps + DerivedData
	@echo "📱 Resetting Android dependencies..."
	-rm -rf ~/Library/Developer/Xcode/DerivedData/FrontendBlogMobile-* 2>/dev/null || true
	rm -rf android/build
	yarn install
	@echo "✅ Android dependencies reset. DerivedData cleaned."

reset-ios: ## Reset iOS native deps (Pods) + DerivedData
	@echo "🍎 Resetting iOS dependencies..."
	-rm -rf ~/Library/Developer/Xcode/DerivedData/FrontendBlogMobile-* 2>/dev/null || true
	cd ios && rm -rf Pods Podfile.lock && USE_FRAMEWORKS=static pod install && cd ..
	@echo "✅ iOS dependencies reset. DerivedData cleaned."

reset-all: clean reset-android reset-ios ## Reset both platforms + clear all caches
	@echo "🔄 Both platforms reset complete."

rebuild-ios: clean reset-ios ## Full iOS rebuild: clean caches + reinstall Pods + build
	@echo "🏗️  Rebuilding iOS..."
	yarn ios
	@echo "✅ iOS rebuild complete"

rebuild-android: clean reset-android ## Full Android rebuild: clean caches + reinstall deps + build
	@echo "🏗️  Rebuilding Android..."
	yarn android
	@echo "✅ Android rebuild complete"

studio-android: ## Open Android project in Android Studio
	@echo "📱 Opening Android project in Android Studio..."
	@open -a "Android Studio" android/ 2>/dev/null || \
		echo "⚠️  Android Studio not found. Install it from https://developer.android.com/studio"

audit: ## Run security audit on dependencies
	@echo "🔒 Running security audit..."
	yarn audit
	@echo "✅ Audit complete"

# ── Environment Diagnostics ────────────────────────────────────────────────

doctor: ## Run diagnostics: detect stale paths, missing deps, cache issues
	@echo "🔍 Running environment diagnostics..."
	@echo ""
	@echo "━━━ JS Dependencies ━━━"
	@if [ -d node_modules/react-native ]; then \
		echo "  ✅ node_modules — installed"; \
	else \
		echo "  ❌ node_modules — MISSING"; \
		echo "     📍 node_modules/react-native"; \
		echo "     ▶️  Run: make install"; \
	fi
	@if [ -f node_modules/hermes-compiler/hermesc/osx-bin/hermesc ]; then \
		echo "  ✅ Hermes compiler — found"; \
	else \
		echo "  ❌ Hermes compiler — MISSING"; \
		echo "     📍 node_modules/hermes-compiler/hermesc/osx-bin/hermesc"; \
		echo "     ▶️  Run: yarn install (or make install)"; \
	fi
	@echo ""
	@echo "━━━ iOS ━━━"
	@if [ -f ios/build/generated/ios/ReactCodegen/RCTThirdPartyComponentsProvider.mm ]; then \
		echo "  ✅ Codegen files — present"; \
	else \
		echo "  ❌ Codegen files — MISSING"; \
		echo "     📍 ios/build/generated/ios/ReactCodegen/"; \
		echo "     ▶️  Run: make install (or make reset-ios)"; \
	fi
	@if [ -d ios/Pods/Pods.xcodeproj ]; then \
		echo "  ✅ Pods — installed"; \
	else \
		echo "  ❌ Pods — MISSING"; \
		echo "     📍 ios/Pods/Pods.xcodeproj"; \
		echo "     ▶️  Run: cd ios && pod install (or make install)"; \
	fi
	@stale_ios_xcconfig=$$(grep -l "/Volumes/MySSD" ios/Pods/Target\ Support\ Files/Pods-FrontendBlogMobile/Pods-FrontendBlogMobile.*.xcconfig 2>/dev/null); \
	if [ -n "$$stale_ios_xcconfig" ]; then \
		echo "  ⚠️  Pods xcconfig — stale SSD paths detected"; \
		for f in $$stale_ios_xcconfig; do \
			line=$$(grep -n "/Volumes/MySSD" "$$f" | head -1 | cut -d: -f1); \
			echo "     📍 $$f:$$line"; \
		done; \
		echo "     ▶️  Run: make reset-ios"; \
	else \
		echo "  ✅ Pods xcconfig — paths correct"; \
	fi
	@deriveddata_dir=$$(ls -d ~/Library/Developer/Xcode/DerivedData/FrontendBlogMobile-* 2>/dev/null | head -1); \
	if [ -n "$$deriveddata_dir" ]; then \
		echo "  ⚠️  DerivedData — cached (normal after build)"; \
		echo "     📍 $$deriveddata_dir"; \
		echo "     ▶️  Run: make clean (only if you suspect stale cache)"; \
	else \
		echo "  ✅ DerivedData — clean"; \
	fi
	@echo ""
	@echo "━━━ Android ━━━"
	@if [ -f android/build/generated/autolinking/autolinking.json ]; then \
		stale_android=$$(grep -l "/Volumes/MySSD" android/build/generated/autolinking/autolinking.json 2>/dev/null); \
		if [ -n "$$stale_android" ]; then \
			echo "  ⚠️  Android autolinking — stale SSD paths detected"; \
			echo "     📍 android/build/generated/autolinking/autolinking.json"; \
			echo "     ▶️  Run: make clean && make install"; \
		else \
			echo "  ✅ Android autolinking — paths correct"; \
		fi; \
	else \
		echo "  ❌ Android autolinking.json — MISSING"; \
		echo "     📍 android/build/generated/autolinking/autolinking.json"; \
		echo "     ▶️  Run: make install"; \
	fi
	@if [ -f android/gradlew ]; then \
		echo "  ✅ Gradle wrapper — present"; \
	else \
		echo "  ❌ Gradle wrapper — MISSING"; \
		echo "     📍 android/gradlew"; \
	fi
	@echo ""
	@echo "━━━ Environment ━━━"
	@if [ -f .env ]; then \
		env_name=$$(head -1 .env | grep -o "APP_ENV=[a-z]*" | cut -d= -f2 || echo "unknown"); \
		echo "  ✅ .env file — present ($$env_name)"; \
	else \
		echo "  ⚠️  .env file — MISSING"; \
		echo "     📍 .env"; \
		echo "     ▶️  Run: make env-dev"; \
	fi
	@echo ""

# ── Port Management ─────────────────────────────────────────────────────

ports: ## Show occupancy of all common React Native ports
	@echo "━━━ Port Occupancy ━━━"
	@for port in 8081 8088 19000 19001 3000 4000; do \
		pid=$$(lsof -ti :$$port 2>/dev/null); \
		if [ -n "$$pid" ]; then \
			name=$$(ps -o comm= -p $$pid 2>/dev/null || echo "unknown"); \
			echo "  🔴 Port $$port — in use by PID $$pid ($$name)"; \
		else \
			echo "  🟢 Port $$port — free"; \
		fi; \
	done
	@echo ""

port-ls: ## Show process info for a specific port. Usage: make port-ls PORT=8081
	@if [ -z "$(PORT)" ]; then \
		echo "⚠️  Usage: make port-ls PORT=<number>"; \
		echo "   Common ports: 8081 Metro, 8088 Expo, 19000/19001 Expo, 3000 web, 4000 API"; \
		exit 1; \
	fi; \
	echo "🔍 Checking port $(PORT)..."; \
	lsof -i :$(PORT) -P -n || echo "✅ Port $(PORT) is free"

port-kill: ## Kill process on a specific port. Usage: make port-kill PORT=8081
	@if [ -z "$(PORT)" ]; then \
		echo "⚠️  Usage: make port-kill PORT=<number>"; \
		echo "   Common ports: 8081 Metro, 8088 Expo, 19000/19001 Expo, 3000 web, 4000 API"; \
		exit 1; \
	fi; \
	pid=$$(lsof -ti :$(PORT) 2>/dev/null); \
	if [ -z "$$pid" ]; then \
		echo "✅ Port $(PORT) is already free — nothing to kill"; \
		exit 0; \
	fi; \
	name=$$(ps -o comm= -p $$pid 2>/dev/null || echo "unknown"); \
	echo "🔴 Port $(PORT) is occupied by PID $$pid ($$name)"; \
	read "answer?❓ Kill process $$pid? [y/N] "; \
	if [ "$$answer" = "y" ] || [ "$$answer" = "Y" ]; then \
		kill $$pid 2>/dev/null && echo "✅ Killed PID $$pid" || \
		(kill -9 $$pid 2>/dev/null && echo "✅ Force-killed PID $$pid (SIGKILL)"); \
	else \
		echo "⏭️  Skipped"; \
	fi

port-kill-metro: ## Kill Metro bundler on port 8081
	$(MAKE) port-kill PORT=8081
	@echo "━━━ Summary ━━━"
	@issues=0; \
	if grep -q "/Volumes/MySSD" ios/Pods/Target\ Support\ Files/Pods-FrontendBlogMobile/Pods-FrontendBlogMobile.*.xcconfig 2>/dev/null; then issues=$$((issues+1)); fi; \
	if ls ~/Library/Developer/Xcode/DerivedData/FrontendBlogMobile-* >/dev/null 2>&1; then issues=$$((issues+1)); fi; \
	if grep -q "/Volumes/MySSD" android/build/generated/autolinking/autolinking.json 2>/dev/null; then issues=$$((issues+1)); fi; \
	if [ ! -d node_modules/react-native ]; then issues=$$((issues+1)); fi; \
	if [ ! -f ios/build/generated/ios/ReactCodegen/RCTThirdPartyComponentsProvider.mm ]; then issues=$$((issues+1)); fi; \
	if [ ! -d ios/Pods/Pods.xcodeproj ]; then issues=$$((issues+1)); fi; \
	if [ ! -f android/build/generated/autolinking/autolinking.json ]; then issues=$$((issues+1)); fi; \
	if [ ! -f .env ]; then issues=$$((issues+1)); fi; \
	if [ $$issues -eq 0 ]; then \
		echo "  ✅ Environment is healthy — no issues detected"; \
	elif [ $$issues -le 2 ]; then \
		echo "  ⚠️  $$issues minor issue(s) — review warnings above"; \
	else \
		echo "  ❌ $$issues issue(s) — fix the critical ones first, then re-run make doctor"; \
	fi
	@echo ""
