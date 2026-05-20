#!/bin/zsh
# ============================================================================
# deploy-android-prod-device.sh — Production Android Device Deploy + Auto Logs
# ============================================================================
# Deploys a productionRelease APK to a connected Android device (USB or WiFi)
# and automatically shows device logs.
#
# This script is for PRODUCTION builds. Key differences from the debug variant
# (deploy-android-device.sh):
#   - Builds productionRelease variant (signed with release-upload-key.keystore)
#   - Uses --deviceId to skip emulator launch attempt entirely
#   - No adb reverse / Metro dev server needed (JS is bundled inside the APK)
#   - Metro is optional (not required for release builds)
#   - Includes no-device fallback menu with build-only option + AVD guide
#
# Usage:
#   make deploy-prod-android
#
# Dependencies:
#   - Android SDK (adb)
#   - React Native (node_modules)
#   - Android release keystore (android/app/release-upload-key.keystore)
#   - keystore.properties (android/app/keystore.properties)
#
# WiFi (Wireless Debugging) — One-Time Setup:
#   1. On your Android device: Settings → Developer Options → Wireless debugging → ON
#   2. Tap "Pair device with pairing code" → note the IP:port and 6-digit code
#   3. Enter them when prompted
#
#   ✅ After pairing once, the script remembers the connection.
#      Subsequent runs auto-reconnect — no need to pair again!
# ============================================================================

set -euo pipefail

# ── Java Environment ────────────────────────────────────────────────────────
# Prefer JDK 17 (compatible with all RN native modules) over the system
# default JDK which may be JDK 25+ (causes "restricted java.lang.System method"
# errors in react-native-worklets CMake configure step).
if [ -d "/opt/homebrew/Cellar/openjdk@17/17.0.17/libexec/openjdk.jdk/Contents/Home" ]; then
  export JAVA_HOME="/opt/homebrew/Cellar/openjdk@17/17.0.17/libexec/openjdk.jdk/Contents/Home"
elif [ -d "/usr/local/opt/openjdk@17" ]; then
  export JAVA_HOME="/usr/local/opt/openjdk@17"
fi

# ── Configuration ───────────────────────────────────────────────────────────
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# ── Helper Functions ────────────────────────────────────────────────────────

info()  { echo -e "${CYAN}ℹ${NC} $1"; }
ok()    { echo -e "${GREEN}✓${NC} $1"; }
warn()  { echo -e "${YELLOW}⚠${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1" >&2; }
header() {
    echo ""
    echo -e "${BOLD}━━━ $1 ━━━${NC}"
    echo ""
}

# Cache file for WiFi device — so you only pair once
# Shared with deploy-android-device.sh (debug script)
WIFI_CACHE="$HOME/.cache/frontend-blog-mobile/android-wifi-device"

cleanup() {
    if [[ -n "${METRO_PID:-}" ]]; then
        info "Stopping Metro bundler (PID: $METRO_PID)..."
        kill "$METRO_PID" 2>/dev/null || true
    fi
}
trap cleanup EXIT

# ── ADB Auto-Discovery ─────────────────────────────────────────────────────
# adb may not be in PATH of non-login shells; search common locations.
find_adb() {
    # First try PATH
    if command -v adb &>/dev/null; then
        ADB=$(command -v adb)
        return 0
    fi

    # Common locations
    for candidate in \
        "$HOME/Android/sdk/platform-tools/adb" \
        "$HOME/Library/Android/sdk/platform-tools/adb" \
        "/opt/homebrew/bin/adb" \
        "/usr/local/bin/adb" \
        "/opt/android-sdk/platform-tools/adb"; do
        if [[ -x "$candidate" ]]; then
            ADB="$candidate"
            return 0
        fi
    done

    return 1
}

# ── Build-only fallback ────────────────────────────────────────────────────
build_apk_only() {
    header "Building Production APK (no deploy)"

    echo "  📦 Building productionRelease APK..."
    echo "     (signed with release-upload-key.keystore)"
    echo ""

    cd "$PROJECT_DIR/android"

    if ./gradlew assembleProductionRelease --no-daemon; then
        APK_PATH="app/build/outputs/apk/production/release/app-production-release.apk"
        echo ""
        ok "APK built successfully!"
        echo ""
        echo "  📍 APK location:"
        echo "     ${CYAN}$PROJECT_DIR/android/$APK_PATH${NC}"
        echo ""
        echo "  📱 To install on a connected device:"
        echo "     ${CYAN}$ADB install $PROJECT_DIR/android/$APK_PATH${NC}"
        echo ""
        echo "  📦 To generate AAB (Google Play):"
        echo "     ${CYAN}make build-prod-aab${NC}"
        echo ""
    else
        error "Gradle build failed. Check output above for details."
        exit 1
    fi
}

# ── AVD creation guide ─────────────────────────────────────────────────────
show_avd_guide() {
    header "Creating an Android Emulator (AVD)"

    echo "  To create an Android emulator for ongoing development:"
    echo ""
    echo "  ${BOLD}Option A: Android Studio (recommended)${NC}"
    echo ""
    echo "    1. Open Android Studio"
    echo "    2. More Actions → ${BOLD}AVD Manager${NC}"
    echo "    3. Click ${BOLD}Create Virtual Device${NC}"
    echo "    4. Select a device (e.g., Pixel 7) → ${BOLD}Next${NC}"
    echo "    5. Select a system image (e.g., API 35) → Download → ${BOLD}Next${NC}"
    echo "    6. ${BOLD}Finish${NC}"
    echo "    7. Click the ${BOLD}▶${NC} (Play) button to start the emulator"
    echo ""
    echo "  ${BOLD}Option B: Command Line${NC}"
    echo "    (Requires Android SDK command-line tools)"
    echo ""
    echo "    ${CYAN}avdmanager create avd \\"
    echo "      -n Pixel_7_API_35 \\"
    echo "      -k 'system-images;android-35;google_apis;arm64-v8a' \\"
    echo "      -d pixel_7${NC}"
    echo ""
    echo "    ${CYAN}emulator -avd Pixel_7_API_35${NC}"
    echo ""
    echo "  Once the emulator is running, re-run:"
    echo "    ${CYAN}make deploy-prod-android${NC}"
    echo ""
    echo -n "  Press Enter to return to the menu... "
    read -r
}

# ── No-device fallback menu ────────────────────────────────────────────────
show_no_device_menu() {
    while true; do
        echo ""
        echo "  ${BOLD}━━━ No Device Found ━━━${NC}"
        echo ""
        echo "  No Android devices detected. What would you like to do?"
        echo ""
        echo "  ${CYAN}[1]${NC} Connect over WiFi (Wireless debugging) — recommended"
        echo "     (Only need to pair once — auto-reconnects afterward)"
        echo "  ${CYAN}[2]${NC} Connect over USB — plug in your device now"
        echo "  ${CYAN}[3]${NC} Build APK only — save to disk for manual install"
        echo "  ${CYAN}[4]${NC} Create an Android emulator (AVD) — setup guide"
        echo "  ${CYAN}[5]${NC} Quit"
        echo ""
        echo -n "  Select [1/2/3/4/5]: "
        read NO_DEVICE_CHOICE

        case "$NO_DEVICE_CHOICE" in
            1)
                # ── WiFi pairing workflow ──────────────────────────────────
                header "WiFi ADB Pairing"

                echo "  📱 On your Android device (must be on the same WiFi network):"
                echo "     1. Go to ${BOLD}Settings → Developer Options${NC}"
                echo "     2. Enable ${BOLD}Wireless debugging${NC}"
                echo "     3. Tap ${BOLD}Pair device with pairing code${NC}"
                echo ""
                echo "  ── You'll see a screen like this ──"
                echo ""
                echo "    ╔══════════════════════════════════════╗"
                echo "    ║  Wireless debugging                  ║"
                echo "    ║                                      ║"
                echo "    ║  Wi-Fi pairing code:                 ║"
                echo "    ║  ${CYAN}192.168.100.50:39725${NC}               ║"
                echo "    ║  ${CYAN}028640${NC}                             ║"
                echo "    ║                                      ║"
                echo "    ║  ◉  ${BOLD}IP:Port${NC}  →  ${CYAN}192.168.100.50:39725${NC}  ║"
                echo "    ║  ◉  ${BOLD}Code${NC}     →  ${CYAN}028640${NC}        ║"
                echo "    ╚══════════════════════════════════════╝"
                echo ""
                echo "  ─────────────────────────────────────────────"
                echo ""

                # --- Pairing step ---
                echo ""
                echo -n "  ${BOLD}Step A${NC} — Enter the ${BOLD}IP:Port${NC} shown on your device (e.g. 192.168.100.50:39725): "
                read PAIR_HOST

                # Validate input contains a colon (IP:Port format)
                if [[ "$PAIR_HOST" != *":"* ]]; then
                    error "That doesn't look like an IP:Port — it should have a colon, e.g. 192.168.100.50:39725"
                    echo "  You entered: '$PAIR_HOST'"
                    echo "  The IP:Port is the first line shown under 'Pair device with pairing code'."
                    continue
                fi

                echo -n "  ${BOLD}Step B${NC} — Enter the 6-digit ${BOLD}pairing code${NC} (input hidden): "
                read -s PAIR_CODE
                echo ""

                echo ""
                info "Pairing with $PAIR_HOST..."
                if "$ADB" pair "$PAIR_HOST" "$PAIR_CODE" 2>&1; then
                    ok "Device paired successfully!"
                else
                    error "Pairing failed. Make sure:"
                    echo "    • Device and computer are on the same WiFi network"
                    echo "    • You entered the IP:Port correctly (e.g. 192.168.100.50:39725)"
                    echo "    • You entered the 6-digit code correctly (expires after a while)"
                    echo "    • Wireless debugging is enabled on the device"
                    echo ""
                    echo "  Retry from the menu when ready."
                    continue
                fi

                echo ""
                echo "  ─────────────────────────────────────────────"
                echo ""

                # --- Connection step ---
                echo "  ✅ Paired! Now connect to the service port."
                echo "  📱 On your device, look for the ${BOLD}service${NC} IP:port"
                echo "     (different from the pairing port — usually a higher port)"
                echo "     It's shown under 'Wireless debugging' after pairing"
                echo ""
                echo -n "  Enter the service IP:Port to connect (e.g. 192.168.1.50:39723): "
                read CONNECT_HOST

                info "Connecting to $CONNECT_HOST..."
                CONNECT_RESULT=$("$ADB" connect "$CONNECT_HOST" 2>&1 || true)
                if echo "$CONNECT_RESULT" | grep -qi "connected"; then
                    ok "Connected to device over WiFi!"
                    # Cache the service address for auto-reconnect next time
                    mkdir -p "$(dirname "$WIFI_CACHE")"
                    echo "$CONNECT_HOST" > "$WIFI_CACHE"
                    ok "Saved WiFi device address — next time will auto-reconnect"
                    echo ""
                    info "Re-scanning for devices..."
                    # Break out of menu and continue to device selection
                    return 0
                else
                    error "Connection failed: $CONNECT_RESULT"
                    echo "  Retry from the menu when ready."
                    continue
                fi
                ;;

            2)
                # ── USB connection guide ───────────────────────────────────
                error "USB not detected."
                echo ""
                echo "  Please connect your device via USB with USB debugging enabled:"
                echo ""
                echo "  ${BOLD}One-Time Setup:${NC}"
                echo "    1. Enable Developer Options:"
                echo "       Settings → About phone → Tap Build number 7 times"
                echo "    2. Enable USB Debugging:"
                echo "       Settings → Developer Options → USB debugging → ON"
                echo "    3. Connect USB cable → Accept 'Allow USB debugging?' prompt"
                echo "       → ☑️ 'Always allow from this computer' → Allow"
                echo ""
                echo "  Then re-run: ${CYAN}make deploy-prod-android${NC}"
                echo ""
                echo "  If still not detected:"
                echo "    $ADB kill-server && $ADB start-server && $ADB devices"
                echo ""
                echo -n "  Press Enter to return to the menu... "
                read -r
                ;;

            3)
                # ── Build APK only ─────────────────────────────────────────
                build_apk_only
                echo ""
                echo -n "  Press Enter to return to the menu... "
                read -r
                ;;

            4)
                # ── AVD creation guide ─────────────────────────────────────
                show_avd_guide
                ;;

            5)
                # ── Quit ───────────────────────────────────────────────────
                info "Exiting."
                exit 0
                ;;

            *)
                error "Invalid selection. Please choose 1-5."
                ;;
        esac
    done
}

# ═══════════════════════════════════════════════════════════════════════════
# MAIN EXECUTION
# ═══════════════════════════════════════════════════════════════════════════

# ── Step 1: Check Prerequisites ─────────────────────────────────────────────

header "Step 1 — Verifying Prerequisites"

# Find adb
if find_adb; then
    ok "adb found: $ADB"
else
    error "adb not found."
    echo "  Install Android SDK or add platform-tools to PATH."
    echo ""
    echo "  Try:"
    echo "    brew install --cask android-platform-tools"
    echo "  Or download from: https://developer.android.com/studio/releases/platform-tools"
    exit 1
fi

# Check node_modules
if [[ ! -f "$PROJECT_DIR/node_modules/.package-lock.json" ]] && \
   [[ ! -f "$PROJECT_DIR/node_modules/.yarn-integrity" ]] && \
   [[ ! -f "$PROJECT_DIR/node_modules/.yarn-state.yml" ]]; then
    warn "node_modules may not be installed. Run: yarn install"
fi

# Check keystore.properties exists (required for release signing)
KEYSTORE_PROPS="$PROJECT_DIR/android/app/keystore.properties"
if [[ -f "$KEYSTORE_PROPS" ]]; then
    ok "Release keystore configuration found"
else
    warn "keystore.properties not found at android/app/keystore.properties"
    echo "  The APK will still build but may use debug signing."
    echo "  To set up release signing:"
    echo "    make android-generate-key"
    echo ""
fi

# ── Step 2: Discover Connected Android Devices ─────────────────────────────

header "Step 2 — Scanning for Connected Android Devices"

# Start adb server first
"$ADB" start-server 2>/dev/null || true

RAW_DEVICES=$("$ADB" devices | tail -n +2 | grep -v '^$' || true)

if [[ -z "$RAW_DEVICES" ]]; then
    # ── Try auto-reconnecting to a previously paired WiFi device ──────────
    if [[ -f "$WIFI_CACHE" ]]; then
        CACHED_HOST=$(cat "$WIFI_CACHE")
        info "Found saved WiFi device: $CACHED_HOST"
        info "Attempting auto-reconnect..."
        CONNECT_RESULT=$("$ADB" connect "$CACHED_HOST" 2>&1 || true)
        if echo "$CONNECT_RESULT" | grep -qi "connected"; then
            ok "Auto-reconnected to $CACHED_HOST"
            RAW_DEVICES=$("$ADB" devices | tail -n +2 | grep -v '^$' || true)
        else
            warn "Auto-reconnect failed (device may be offline or IP changed)."
            rm -f "$WIFI_CACHE"
        fi
    fi
fi

if [[ -z "$RAW_DEVICES" ]]; then
    # ── No devices found → show interactive fallback menu ────────────────
    warn "No Android devices detected via USB or ADB."
    show_no_device_menu

    # After returning from menu (WiFi pairing succeeded), re-scan
    RAW_DEVICES=$("$ADB" devices | tail -n +2 | grep -v '^$' || true)

    if [[ -z "$RAW_DEVICES" ]]; then
        error "Still no devices found after WiFi pairing attempt."
        echo "  Please check the connection and try again."
        exit 1
    fi
fi

# Filter only "device" state (not "unauthorized", "offline", etc.)
DEVICE_LINES=$(echo "$RAW_DEVICES" | grep -E 'device$' || true)

if [[ -z "$DEVICE_LINES" ]]; then
    error "No authorized Android devices found."
    echo ""
    echo "  Found device(s) but not authorized:"
    echo "$RAW_DEVICES"
    echo ""
    echo "  Check your device — you may need to accept the USB debugging prompt."
    exit 1
fi

# Parse device lines into arrays
typeset -a DEVICE_IDS=()
typeset -a DEVICE_MODELS=()

while IFS= read -r line; do
    # Format: "DEVICE_ID\tdevice" or "DEVICE_ID device"
    device_id=$(echo "$line" | awk '{print $1}')
    [[ -z "$device_id" ]] && continue

    # Try to get device model name from adb
    model=$("$ADB" -s "$device_id" shell getprop ro.product.model 2>/dev/null | tr -d '\r\n' || echo "Unknown")
    [[ -z "$model" ]] && model="Unknown"

    DEVICE_IDS+=("$device_id")
    DEVICE_MODELS+=("$model")
done <<< "$DEVICE_LINES"

if [[ ${#DEVICE_IDS[@]} -eq 0 ]]; then
    error "Could not parse any device from adb output."
    exit 1
fi

# Interactive device selection
echo ""
info "Found ${#DEVICE_IDS[@]} connected device(s):"
echo ""

for i in $(seq 1 ${#DEVICE_IDS[@]}); do
    # Detect connection type
    CONN_TYPE="USB"
    if echo "${DEVICE_IDS[$i]}" | grep -qE ':[0-9]+$'; then
        CONN_TYPE="WiFi"
    fi
    echo -e "  ${CYAN}$i)${NC} ${BOLD}${DEVICE_MODELS[$i]}${NC} ${YELLOW}[${CONN_TYPE}]${NC}"
    echo -e "     Device ID: ${DEVICE_IDS[$i]}"
    echo ""
done

# Auto-select if only one device
if [[ ${#DEVICE_IDS[@]} -eq 1 ]]; then
    SELECTED=1
    echo -e "  → Auto-selected: ${BOLD}${DEVICE_MODELS[1]}${NC}"
else
    echo -n "Select device (1-${#DEVICE_IDS[@]}): "
    read SELECTED
    if [[ ! "$SELECTED" =~ ^[0-9]+$ ]] || [[ "$SELECTED" -lt 1 ]] || [[ "$SELECTED" -gt ${#DEVICE_IDS[@]} ]]; then
        error "Invalid selection."
        exit 1
    fi
fi

SELECTED_ID="${DEVICE_IDS[$SELECTED]}"
SELECTED_MODEL="${DEVICE_MODELS[$SELECTED]}"

echo ""
ok "Selected: ${BOLD}$SELECTED_MODEL${NC} ($SELECTED_ID)"

# ── Step 3: Check Metro Bundler (optional for release builds) ──────────────

header "Step 3 — Metro Bundler"

if curl -s http://localhost:8081/status > /dev/null 2>&1; then
    ok "Metro bundler is running on port 8081"
    echo "  (Not required for release builds — JS is bundled inside the APK)"
else
    warn "Metro bundler is not running."
    echo "  (Not required for release builds — JS is bundled inside the APK)"
    echo "  Continuing with build and deploy..."
fi

# ── Step 4: Build & Deploy (productionRelease) ─────────────────────────────

header "Step 4 — Building & Deploying Production APK"

info "Building productionRelease APK and deploying to ${BOLD}$SELECTED_MODEL${NC}..."
echo "  (signed with release-upload-key.keystore)"
echo ""

cd "$PROJECT_DIR"

# Use react-native run-android with:
#   --mode productionRelease  → production flavor + release build type
#   --deviceId                → targets specific device, skips emulator launch
npx react-native run-android \
    --mode productionRelease \
    --deviceId "$SELECTED_ID" \
    2>&1 | tee /tmp/react-native-android-prod.log
RC=${pipestatus[1]:-0}

if [[ $RC -ne 0 ]]; then
    error "Deployment failed. Check /tmp/react-native-android-prod.log for details."
    warn "Possible causes:"
    echo "  - Device not connected or unauthorized"
    echo "  - Build error (check Gradle output above)"
    echo "  - Keystore issue (check android/app/keystore.properties)"
    echo "  - Missing Android SDK components"
    echo "  - Insufficient storage on device"
    exit 1
fi

echo ""
ok "${BOLD}Success!${NC} Production APK deployed to ${BOLD}$SELECTED_MODEL${NC}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🏭  Flavor:    Production"
echo "  📱  Device:    ${BOLD}$SELECTED_MODEL${NC}"
echo "  🔑  Signed:    release-upload-key.keystore"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── Step 5: Show Device Logs ────────────────────────────────────────────────

header "Step 5 — Device Logs (live stream)"

info "Showing live device logs. Press ${BOLD}Ctrl+C${NC} to stop."
echo ""

# Run log-android to display device logs in real-time
# Use ANDROID_SERIAL to target the selected device (adb reads this env var natively)
ANDROID_SERIAL="$SELECTED_ID" npx react-native log-android
