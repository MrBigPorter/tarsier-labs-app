# ============================================================================
# Tarsier — Frontend Blog Mobile (React Native)
# Makefile for dev / staging / production workflows
# ============================================================================

.DEFAULT_GOAL := help
SHELL := /bin/zsh
.PHONY: help dev dev-ios dev-ios-device dev-android dev-android-device staging staging-ios staging-android \
        release release-ios release-android release-android-aab \
        install update clean reset lint typecheck test check \
        env-dev env-staging env-prod env-show \
        devtools fusebox logs-ios logs-android profile hermes-profile perf perf-ci check-bundle-size sentry-dashboard xcode \
        purge fresh reset-android reset-ios clear-cache studio-android audit \
        doctor rebuild-ios rebuild-android reset-all \
        port-ls port-kill port-kill-metro ports

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
	cd ios && pod install && cd ..
	@echo "✅ Dependencies installed"

update: ## Show outdated dependencies
	yarn outdated

# ── Development ───────────────────────────────────────────────────────────

dev: env-dev ## Start Metro bundler in development mode
	yarn start

dev-ios: env-dev ## Build & run on iOS Simulator
	yarn ios

dev-ios-device: env-dev ## Build & run on iOS Device (interactive + auto logs, bypasses Xcode 16 devicectl bug)
	./scripts/deploy-ios-device.sh

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
	npx react-native log-android

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

# ── Cleanup & Reset ───────────────────────────────────────────────────────

clean: ## Clean all build artifacts
	@echo "🧹 Cleaning build artifacts..."
	cd android && ./gradlew clean && cd ..
	rm -rf ios/build
	@echo "✅ Cleaned"

reset: clean ## Full reset: clean + remove node_modules/pods + reinstall
	@echo "🔄 Full reset..."
	rm -rf node_modules
	cd ios && rm -rf Pods Podfile.lock && cd ..
	yarn install
	cd ios && pod install && cd ..
	@echo "✅ Full reset complete"

purge: ## Force-remove generated build artifacts without Gradle (use when stale paths block clean)
	@echo "🧹 Purging generated build artifacts..."
	rm -rf android/build ios/build
	@echo "✅ Build artifacts purged. Run 'make install' then 'make clean' to regenerate."

fresh: ## Complete project bootstrap from scratch (no dependency on clean)
	@echo "🆕 Bootstrapping project from scratch..."
	rm -rf node_modules android/build ios/build ios/Pods Podfile.lock
	yarn install
	cd ios && pod install && cd ..
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
	cd ios && rm -rf Pods Podfile.lock && pod install && cd ..
	@echo "✅ iOS dependencies reset. DerivedData cleaned."

reset-all: clear-cache reset-android reset-ios ## Reset both platforms + clear all caches
	@echo "🔄 Both platforms reset complete."

clear-cache: ## Clear all caches (Metro, Watchman, DerivedData, TS)
	@echo "🗑️  Clearing all caches..."
	-watchman watch-del-all 2>/dev/null
	-rm -rf $$TMPDIR/metro-* $$TMPDIR/haste-* 2>/dev/null || true
	-rm -rf ~/Library/Developer/Xcode/DerivedData/FrontendBlogMobile-* 2>/dev/null || true
	-rm -rf .tsbuildinfo 2>/dev/null || true
	@echo "✅ Caches cleared (Metro, Watchman, DerivedData, TS). Restart Metro with 'make dev'."

rebuild-ios: clear-cache reset-ios ## Full iOS rebuild: clear caches + reinstall Pods + build
	@echo "🏗️  Rebuilding iOS..."
	yarn ios
	@echo "✅ iOS rebuild complete"

rebuild-android: clear-cache reset-android ## Full Android rebuild: clear caches + reinstall deps + build
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
		echo "     ▶️  Run: make clear-cache (only if you suspect stale cache)"; \
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
			echo "     ▶️  Run: make purge && make install"; \
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
