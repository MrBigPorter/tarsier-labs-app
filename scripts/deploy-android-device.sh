#!/bin/zsh
# ============================================================================
# deploy-android-device.sh — Interactive Android Device Deploy + Auto Logs
# ============================================================================
# Deploys to a connected Android device via USB or WiFi and automatically shows
# device logs in the same terminal (no need for a second terminal).
#
# Usage:
#   ./scripts/deploy-android-device.sh
#
# Dependencies:
#   - Android SDK (adb)
#   - React Native (node_modules)
#
# WiFi (Wireless Debugging) — One-Time Setup:
#   1. On your Android device: Settings → Developer Options → Wireless debugging → ON
#   2. Tap "Pair device with pairing code" → note the IP:port and 6-digit code
#   3. Enter them when prompted
#
#   ✅ After pairing once, the script remembers the connection.
#      Subsequent runs auto-reconnect — no need to pair again!
#
# Environment:
#   - Metro bundler should be running (yarn start) OR script starts it
#   - For WiFi: device must be on the same network as this computer
#   - Uses --host 0.0.0.0 so Metro accepts connections from any LAN IP
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
    # ── No devices found → offer WiFi pairing ────────────────────────────
    error "No Android devices found via USB or existing ADB connection."
    echo ""
    echo "  Options to connect your device:"
    echo ""
    echo "  ${BOLD}[1]${NC} Connect over WiFi (Wireless debugging) — recommended"
    echo "     (Only need to pair once — subsequent runs reconnect automatically)"
    echo "  ${BOLD}[2]${NC} Connect over USB  — plug in your device now then re-run"
    echo "  ${BOLD}[3]${NC} Quit"
    echo ""
    echo -n "Select [1/2/3]: "
    read CONNECT_CHOICE

    if [[ "$CONNECT_CHOICE" == "1" ]]; then
        # ── WiFi pairing workflow ────────────────────────────────────────
        header "Step 2a — WiFi ADB Pairing"

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
            exit 1
        fi

        echo -n "  ${BOLD}Step B${NC} — Enter the 6-digit ${BOLD}pairing code${NC} (input hidden): "
        read -s PAIR_CODE
        echo ""

        echo ""
        info "Pairing with $PAIR_HOST..."
        "$ADB" pair "$PAIR_HOST" "$PAIR_CODE" 2>&1 || {
            error "Pairing failed. Make sure:"
            echo "    • Device and computer are on the same WiFi network"
            echo "    • You entered the IP:Port correctly (e.g. 192.168.100.50:39725)"
            echo "    • You entered the 6-digit code correctly (expires after a while)"
            echo "    • Wireless debugging is enabled on the device"
            echo ""
            echo "  Retry manually with:"
            echo "    $ADB pair $PAIR_HOST <code>"
            exit 1
        }
        ok "Device paired successfully!"

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
        else
            error "Connection failed: $CONNECT_RESULT"
            echo "  Retry with: $ADB connect $CONNECT_HOST"
            exit 1
        fi
        echo ""

        # Refresh device list
        RAW_DEVICES=$("$ADB" devices | tail -n +2 | grep -v '^$' || true)

        # Get the LAN IP for Metro dev server hint
        LAN_IP=$(ipconfig getifaddr en0 2>/dev/null || \
                 ifconfig en0 2>/dev/null | awk '/inet /{print $2}' || \
                 ifconfig 2>/dev/null | awk '/inet / && !/127.0.0.1/{print $2; exit}')
        if [[ -n "$LAN_IP" ]]; then
            echo ""
            warn "IMPORTANT — Configure Metro dev server on device:"
            echo ""
            echo "  Since you're using WiFi, you need to set the debug server:"
            echo "    1. Shake the device → Dev Menu → ${BOLD}Settings${NC}"
            echo "    2. Set ${BOLD}Debug server host & port for device${NC} to:"
            echo "       ${CYAN}${LAN_IP}:8081${NC}"
            echo "    3. Press Back → select ${BOLD}Reload${NC}"
            echo ""
        fi

    elif [[ "$CONNECT_CHOICE" == "2" ]]; then
        error "USB not detected."
        echo "  Please connect your device via USB with USB debugging enabled."
        echo "  Then accept the USB debugging prompt on your device."
        echo "  Once connected, re-run: make dev-android-device"
        echo ""
        echo "  If still not detected:"
        echo "    $ADB kill-server && $ADB start-server && $ADB devices"
        exit 1
    else
        info "Exiting."
        exit 0
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
SELECTED_ADDR="${DEVICE_IDS[$SELECTED]}"
IS_WIFI=false
if echo "$SELECTED_ADDR" | grep -qE ':[0-9]+$'; then
    IS_WIFI=true
fi

echo ""
ok "Selected: ${BOLD}$SELECTED_MODEL${NC} ($SELECTED_ID)"

# ── Step 3: USB-only — Offer adb reverse port forwarding ────────────────────

if [[ "$IS_WIFI" == false ]]; then
    header "Step 2b — USB Port Forwarding (adb reverse)"

    echo "  USB detected! Setting up port forwarding so Metro is reachable..."
    if "$ADB" -s "$SELECTED_ID" reverse tcp:8081 tcp:8081 2>/dev/null; then
        ok "Port forwarding: device:8081 → localhost:8081 (adb reverse)"
    else
        warn "Could not set up port forwarding (adb reverse failed)."
        echo "  Metro is already listening on 0.0.0.0:8081, so WiFi devices can still connect."
    fi
    echo ""
fi

if [[ "$IS_WIFI" == true ]]; then
    # ── WiFi: Show LAN IP hint again ──────────────────────────────────────
    LAN_IP=$(ipconfig getifaddr en0 2>/dev/null || \
             ifconfig en0 2>/dev/null | awk '/inet /{print $2}' || \
             ifconfig 2>/dev/null | awk '/inet / && !/127.0.0.1/{print $2; exit}')
    if [[ -n "$LAN_IP" ]]; then
        warn "Metro dev server must be configured on the device:"
        echo "    1. Shake device → Dev Menu → Settings"
        echo "    2. Debug server host & port for device → ${CYAN}${LAN_IP}:8081${NC}"
        echo "    3. Back → Reload"
        echo ""
    fi
fi

# ── Step 4: Start / Check Metro Bundler ─────────────────────────────────────

header "Step 3 — Metro Bundler"

if curl -s http://localhost:8081/status > /dev/null 2>&1; then
    ok "Metro bundler is already running on port 8081"
else
    warn "Metro bundler is not running."
    echo -n "  Start Metro now? [Y/n]: "
    read START_METRO
    if [[ "$START_METRO" =~ ^[Nn] ]]; then
        info "Please start Metro in another terminal:"
        echo "  cd $PROJECT_DIR && yarn start"
        info "Then re-run this script."
        exit 0
    fi

    info "Starting Metro bundler in background..."
    cd "$PROJECT_DIR" && yarn start > /tmp/metro-bundler.log 2>&1 &
    METRO_PID=$!
    ok "Metro started (PID: $METRO_PID)"

    info "Waiting for Metro to be ready..."
    for i in $(seq 1 30); do
        if curl -s http://localhost:8081/status > /dev/null 2>&1; then
            ok "Metro is ready!"
            break
        fi
        if [[ $i -eq 30 ]]; then
            error "Metro did not start within 30 seconds. Check /tmp/metro-bundler.log"
            exit 1
        fi
        sleep 1
    done
fi

# ── Step 5: Deploy to Device ────────────────────────────────────────────────

header "Step 4 — Deploying to Device"

info "Deploying to ${BOLD}$SELECTED_MODEL${NC} ($SELECTED_ID)..."
echo ""

cd "$PROJECT_DIR"

# Use react-native run-android with the selected device ID
# NOTE: --mode stagingDebug is required because the project has multiple product
# flavors (staging, production). Without it, Gradle can't resolve the ambiguous
# task name "installDebug".
npx react-native run-android \
    --deviceId "$SELECTED_ID" \
    --mode stagingDebug \
    2>&1 | tee /tmp/react-native-android.log
RC=${pipestatus[1]:-0}

if [[ $RC -ne 0 ]]; then
    error "Deployment failed. Check /tmp/react-native-android.log for details."
    warn "Possible causes:"
    echo "  - Device not connected or unauthorized"
    echo "  - Build error (check Android gradle build)"
    echo "  - Missing Android SDK components"
    echo "  - For WiFi: check that the debug server host is set correctly"
    exit 1
fi

echo ""
ok "${BOLD}Success!${NC} App deployed to ${BOLD}$SELECTED_MODEL${NC}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  📱  App → ${BOLD}$SELECTED_MODEL${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── Step 6: Show Device Logs ────────────────────────────────────────────────

header "Step 5 — Device Logs (live stream)"

info "Showing live device logs. Press ${BOLD}Ctrl+C${NC} to stop."
echo ""

# Run log-android to display device logs in real-time
# Use ANDROID_SERIAL to target the selected device (adb reads this env var natively)
ANDROID_SERIAL="$SELECTED_ID" npx react-native log-android
