#!/bin/zsh
# ============================================================================
# deploy-android-device.sh — Interactive Android Device Deploy + Auto Logs
# ============================================================================
# Deploys to a connected Android device via USB and automatically shows
# device logs in the same terminal (no need for a second terminal).
#
# Usage:
#   ./scripts/deploy-android-device.sh
#
# Dependencies:
#   - Android SDK (adb)
#   - React Native (node_modules)
#
# Environment:
#   - Ensure your Android device is connected via USB with USB debugging enabled
#   - Metro bundler should be running (yarn start) OR script starts it
# ============================================================================

set -euo pipefail

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

cleanup() {
    if [[ -n "${METRO_PID:-}" ]]; then
        info "Stopping Metro bundler (PID: $METRO_PID)..."
        kill "$METRO_PID" 2>/dev/null || true
    fi
}
trap cleanup EXIT

# ── Step 1: Check Prerequisites ─────────────────────────────────────────────

header "Step 1 — Verifying Prerequisites"

# Check adb
if ! command -v adb &>/dev/null; then
    error "adb not found. Is Android SDK installed?"
    echo "  Ensure ANDROID_HOME is set and platform-tools is in PATH."
    exit 1
fi
ok "adb found"

# Check node_modules
if [[ ! -f "$PROJECT_DIR/node_modules/.package-lock.json" ]] && [[ ! -f "$PROJECT_DIR/node_modules/.yarn-integrity" ]] && [[ ! -f "$PROJECT_DIR/node_modules/.yarn-state.yml" ]]; then
    warn "node_modules may not be installed. Run: yarn install"
fi

# ── Step 2: List Connected Android Devices ─────────────────────────────────

header "Step 2 — Scanning for Connected Android Devices"

RAW_DEVICES=$(adb devices | tail -n +2 | grep -v '^$' || true)

if [[ -z "$RAW_DEVICES" ]]; then
    error "No Android devices found."
    echo ""
    echo "  Make sure your device is connected via USB with USB debugging enabled."
    echo "  Check with: adb devices"
    exit 1
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
    model=$(adb -s "$device_id" shell getprop ro.product.model 2>/dev/null | tr -d '\r\n' || echo "Unknown")
    [[ -z "$model" ]] && model="Unknown"
    
    DEVICE_IDS+=("$device_id")
    DEVICE_MODELS+=("$model")
done <<< "$DEVICE_LINES"

if [[ ${#DEVICE_IDS[@]} -eq 0 ]]; then
    error "Could not parse any device from adb output."
    exit 1
fi

# Interactive device selection
# NOTE: zsh arrays are 1-indexed, so indices start at 1
echo ""
info "Found ${#DEVICE_IDS[@]} connected device(s):"
echo ""

for i in $(seq 1 ${#DEVICE_IDS[@]}); do
    echo -e "  ${CYAN}$i)${NC} ${BOLD}${DEVICE_MODELS[$i]}${NC}"
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

# ── Step 3: Start / Check Metro Bundler ─────────────────────────────────────

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

# ── Step 4: Deploy to Device ────────────────────────────────────────────────

header "Step 4 — Deploying to Device"

info "Deploying to ${BOLD}$SELECTED_MODEL${NC} ($SELECTED_ID)..."
echo ""

cd "$PROJECT_DIR"

# Use react-native run-android with the selected device ID
npx react-native run-android \
    --deviceId "$SELECTED_ID" \
    2>&1 | tee /tmp/react-native-android.log
RC=${pipestatus[1]:-0}

if [[ $RC -ne 0 ]]; then
    error "Deployment failed. Check /tmp/react-native-android.log for details."
    warn "Possible causes:"
    echo "  - Device not connected or unauthorized"
    echo "  - Build error (check Android gradle build)"
    echo "  - Missing Android SDK components"
    exit 1
fi

echo ""
ok "${BOLD}Success!${NC} App deployed to ${BOLD}$SELECTED_MODEL${NC}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  📱  App → ${BOLD}$SELECTED_MODEL${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── Step 5: Show Device Logs ────────────────────────────────────────────────

header "Step 5 — Device Logs (live stream)"

info "Showing live device logs. Press ${BOLD}Ctrl+C${NC} to stop."
echo ""

# Run log-android to display device logs in real-time
# Filters to show only our app's logs for readability
# This will keep running until user presses Ctrl+C
npx react-native log-android
