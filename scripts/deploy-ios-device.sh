#!/bin/zsh
# ============================================================================
# deploy-ios-device.sh — Interactive iOS Device Deploy
# ============================================================================
# Bypasses Xcode 16 devicectl bug (CoreDeviceError 1002 "No provider was found")
# by using xcodebuild for compilation + ios-deploy for installation.
#
# Usage:
#   ./scripts/deploy-ios-device.sh
#
# Dependencies:
#   - Xcode + xcodebuild
#   - React Native (node_modules)
#
# Environment:
#   - Ensure your iPhone is connected via USB and unlocked
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
    # Kill background Metro process if we started it
    if [[ -n "${METRO_PID:-}" ]]; then
        info "Stopping Metro bundler (PID: $METRO_PID)..."
        kill "$METRO_PID" 2>/dev/null || true
    fi
}
trap cleanup EXIT

# ── Step 1: Check Prerequisites ─────────────────────────────────────────────

header "Step 1 — Verifying Prerequisites"

# Check xcodebuild
if ! command -v xcodebuild &>/dev/null; then
    error "xcodebuild not found. Is Xcode installed?"
    exit 1
fi
ok "xcodebuild (Xcode $(xcodebuild -version 2>/dev/null | head -1 | awk '{print $2}'))"

# Check node_modules
if [[ ! -f "$PROJECT_DIR/node_modules/.package-lock.json" ]] && [[ ! -f "$PROJECT_DIR/node_modules/.yarn-integrity" ]] && [[ ! -f "$PROJECT_DIR/node_modules/.yarn-state.yml" ]]; then
    warn "node_modules may not be installed. Run: yarn install"
fi

# ── Step 2: List Connected Devices (Interactive Selection) ─────────────────
# Supports both USB-connected (xctrace) and wirelessly paired (devicectl) devices

header "Step 2 — Scanning for Connected iOS Devices"

# ── 2a: Get available devices from devicectl (supports wireless + USB) ─────
# devicectl is the modern Xcode 16+ tool for device management
# Format: Name  Hostname  Identifier  State  Model
DEVICECTL_RAW=$(xcrun devicectl list devices 2>/dev/null || true)

# Parse devicectl output for available devices (lines with "available" in state column)
# Skip header lines (starting with "Name" or "---")
# devicectl output format (space-separated columns):
#   Name  Hostname  Identifier(UDID)  State  Model
#   LinのiPhone  Lins-iPhone.coredevice.local  XXXX-XXXX  available  iPhone 15 Pro Max
AVAILABLE_NAMES=()
AVAILABLE_UDIDS=()
if echo "$DEVICECTL_RAW" | grep -qE '[[:space:]]available[[:space:]\(]'; then
    while IFS= read -r line; do
        [[ -z "$line" ]] && continue
        # Skip header/separator lines
        echo "$line" | grep -qE '^(Name|---)' && continue
        # Match "available" state (with leading space to not match "unavailable")
        echo "$line" | grep -qE '[[:space:]]available[[:space:]\(]' || continue
        
        # Extract device name: everything before the hostname column (.coredevice.local)
        dev_name=$(echo "$line" | sed -E 's/[[:space:]]+[a-zA-Z0-9._-]+\.coredevice\.local.*//')
        [[ -z "$dev_name" ]] && continue
        
        # Extract UDID directly from devicectl output using UUID pattern
        # This avoids fragile cross-referencing with xctrace for name matching
        dev_udid=$(echo "$line" | grep -oE '[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}' || true)
        [[ -z "$dev_udid" ]] && continue
        
        AVAILABLE_NAMES+=("$dev_name")
        AVAILABLE_UDIDS+=("$dev_udid")
    done <<< "$DEVICECTL_RAW"
fi

# ── 2b: Get UDIDs from xctrace (includes offline devices) ──────────────────
# xctrace lists ALL known devices; we cross-reference by name
# Format: Name (OSVersion) (UDID)
XCTRACE_RAW=$(xcrun xctrace list devices 2>/dev/null || true)

# Parse xctrace output to build name→UDID mapping (using parallel arrays for compatibility)
# Extract all device lines from both "== Devices ==" and "== Devices Offline ==" sections
XCTRACE_ALL=$(echo "$XCTRACE_RAW" | grep -E '\([0-9]+\.[0-9.]+[^)]*\)\s+\([a-fA-F0-9-]+\)' || true)

typeset -a XCTRACE_NAMES=()
typeset -a XCTRACE_UDIDS=()
typeset -a XCTRACE_OS=()

while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    
    # Extract UDID: last parenthesized group containing hex chars + optional dashes
    udid=$(echo "$line" | grep -oE '\([a-fA-F0-9-]+\)' | tail -1 | tr -d '()')
    [[ -z "$udid" ]] && continue
    
    # Extract OS version: group before the UDID, looks like (X.Y.Z) or (X.Y)
    os_ver=$(echo "$line" | grep -oE '\([0-9]+\.[0-9.]+[^)]*\)' | grep -v -E '\([a-fA-F0-9]{40}\)' | tail -1 | tr -d '()')
    [[ -z "$os_ver" ]] && continue
    
    # Extract name: everything before the OS version group
    name=$(echo "$line" | sed -E "s/[[:space:]]+\($os_ver\)[[:space:]]+\($udid\)$//" | sed -E 's/^[[:space:]]*//;s/[[:space:]]*$//')
    [[ -z "$name" ]] && continue
    
    XCTRACE_NAMES+=("$name")
    XCTRACE_UDIDS+=("$udid")
    XCTRACE_OS+=("$os_ver")
done <<< "$XCTRACE_ALL"

# Helper: look up UDID by device name from xctrace arrays
lookup_udid() {
    local search_name="$1" idx=0
    for ((idx=1; idx <= ${#XCTRACE_NAMES[@]}; idx++)); do
        if [[ "${XCTRACE_NAMES[$idx]:-}" == "$search_name" ]]; then
            echo "${XCTRACE_UDIDS[$idx]:-}"
            return 0
        fi
    done
    return 1
}

lookup_os() {
    local search_name="$1" idx=0
    for ((idx=1; idx <= ${#XCTRACE_NAMES[@]}; idx++)); do
        if [[ "${XCTRACE_NAMES[$idx]:-}" == "$search_name" ]]; then
            echo "${XCTRACE_OS[$idx]:-}"
            return 0
        fi
    done
    return 1
}

# ── 2c: Cross-reference & build device list ─────────────────────────────────
typeset -a DEVICE_NAMES=()
typeset -a DEVICE_UDIDS=()
typeset -a DEVICE_OS=()
typeset -a DEVICE_CONNECTIONS=()

# First, add devices detected as available via devicectl (wireless + USB)
# We use xctrace to get the REAL hardware UDID (needed for deployment).
# devicectl's Identifier column is a CoreDevice UUID, NOT the hardware UDID
# that ios-deploy / react-native run-ios expects.
# Cross-reference by name; unmatched devices are silently skipped.
for i in $(seq 1 ${#AVAILABLE_NAMES[@]}); do
    dev_name="${AVAILABLE_NAMES[$i]}"
    
    # Look up real hardware UDID from xctrace by name
    # `|| true` prevents `return 1` (from "not found") triggering set -e in zsh
    dev_udid=$(lookup_udid "$dev_name" || true)
    [[ -z "$dev_udid" ]] && continue
    
    # Try to get OS version from xctrace (optional, for display)
    os_ver=$(lookup_os "$dev_name" || true)
    
    DEVICE_NAMES+=("$dev_name")
    DEVICE_UDIDS+=("$dev_udid")
    DEVICE_OS+=("${os_ver:-Unknown}")
    DEVICE_CONNECTIONS+=("wireless")
done

# If devicectl didn't return any results, fall back to xctrace online devices only
if [[ ${#DEVICE_NAMES[@]} -eq 0 ]]; then
    info "No wirelessly paired devices found via devicectl, checking USB..."
    
    # Fall back to original xctrace behavior — extract "== Devices ==" section only
    XCTRACE_ONLINE=$(echo "$XCTRACE_RAW" | sed -n '/^== Devices ==$/,/^== /p' | tail -n +2 | sed '$d')
    XCTRACE_ONLINE=$(echo "$XCTRACE_ONLINE" | sed '1d' | grep -v '^[[:space:]]*$' || true)
    
    if [[ -n "$XCTRACE_ONLINE" ]]; then
        while IFS= read -r line; do
            [[ -z "$line" ]] && continue
            udid=$(echo "$line" | grep -oE '\([a-fA-F0-9-]+\)' | tail -1 | tr -d '()')
            [[ -z "$udid" ]] && continue
            os_ver=$(echo "$line" | grep -oE '\([0-9]+\.[0-9.]+[^)]*\)' | grep -v -E '\([a-fA-F0-9]{40}\)' | tail -1 | tr -d '()')
            [[ -z "$os_ver" ]] && continue
            name=$(echo "$line" | sed -E "s/[[:space:]]+\($os_ver\)[[:space:]]+\($udid\)$//" | sed -E 's/^[[:space:]]*//;s/[[:space:]]*$//')
            [[ -z "$name" ]] && continue
            
            DEVICE_NAMES+=("$name")
            DEVICE_UDIDS+=("$udid")
            DEVICE_OS+=("$os_ver")
            DEVICE_CONNECTIONS+=("USB")
        done <<< "$XCTRACE_ONLINE"
    fi
fi

if [[ ${#DEVICE_NAMES[@]} -eq 0 ]]; then
    error "No connected iOS devices found."
    echo ""
    echo "  Make sure your iPhone is:"
    echo "    • Connected via USB and unlocked (for USB detection)"
    echo "    • Or paired wirelessly via Xcode → Window → Devices & Simulators"
    echo ""
    echo "  Check manually with:"
    echo "    xcrun devicectl list devices"
    echo "    xcrun xctrace list devices"
    exit 1
fi

# Interactive device selection
# NOTE: zsh arrays are 1-indexed, so indices start at 1
echo ""
info "Found ${#DEVICE_NAMES[@]} device(s) available for deployment:"
echo ""

for i in $(seq 1 ${#DEVICE_NAMES[@]}); do
    conn_icon="🔌"
    [[ "${DEVICE_CONNECTIONS[$i]}" == "wireless" ]] && conn_icon="📶"
    echo -e "  ${CYAN}$i)${NC} ${BOLD}${DEVICE_NAMES[$i]}${NC}"
    echo -e "     iOS ${DEVICE_OS[$i]}  •  UDID: ${DEVICE_UDIDS[$i]}  ${conn_icon} ${DEVICE_CONNECTIONS[$i]}"
    echo ""
done

# Auto-select if only one device
if [[ ${#DEVICE_NAMES[@]} -eq 1 ]]; then
    SELECTED=1
    echo -e "  → Auto-selected: ${BOLD}${DEVICE_NAMES[1]}${NC}"
else
    echo -n "Select device (1-${#DEVICE_NAMES[@]}): "
    read SELECTED
    if [[ ! "$SELECTED" =~ ^[0-9]+$ ]] || [[ "$SELECTED" -lt 1 ]] || [[ "$SELECTED" -gt ${#DEVICE_NAMES[@]} ]]; then
        error "Invalid selection."
        exit 1
    fi
fi

SELECTED_NAME="${DEVICE_NAMES[$SELECTED]}"
SELECTED_UDID="${DEVICE_UDIDS[$SELECTED]}"
SELECTED_OS="${DEVICE_OS[$SELECTED]}"
SELECTED_CONN="${DEVICE_CONNECTIONS[$SELECTED]}"

echo ""
ok "Selected: ${BOLD}$SELECTED_NAME${NC} (iOS $SELECTED_OS, ${SELECTED_CONN})"

# ── Step 3: Start / Check Metro Bundler ─────────────────────────────────────

header "Step 3 — Metro Bundler"

# Check if Metro is already running
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
    
    # Wait for Metro to be ready
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

# ── Step 4: Build & Deploy with react-native run-ios ────────────────────────

header "Step 4 — Building & Deploying App"

info "Deploying to ${BOLD}$SELECTED_NAME${NC} ($SELECTED_UDID)..."
echo ""

cd "$PROJECT_DIR"

# Use react-native run-ios with the selected device UDID
# This handles codegen, xcodebuild AND installation in one step
# Avoids auto-selecting (which happens with --device "name") by passing UDID
npx react-native run-ios \
    --device "$SELECTED_UDID" \
    2>&1 | tee /tmp/react-native-ios-deploy.log
RC=${pipestatus[1]:-0}

if [[ $RC -ne 0 ]]; then
    error "Deployment failed. Check /tmp/react-native-ios-deploy.log for details."
    warn "Possible causes:"
    echo "  - Device is locked (unlock it)"
    echo "  - Device not trusted this computer (tap 'Trust' on device)"
    echo "  - Free developer profile limit reached (Settings → General → VPN & Device Management → delete old profiles)"
    echo "  - App already installed with different signing (delete old app first)"
    echo "  - Metro bundler issue"
    exit 1
fi

echo ""
ok "${BOLD}Success!${NC} App deployed to ${BOLD}$SELECTED_NAME${NC}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  📱  App → ${BOLD}$SELECTED_NAME${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── Step 5: How to View Device Logs ─────────────────────────────────────────

header "Step 5 — Viewing Device Logs"

ok "${BOLD}App deployed!${NC} ${BOLD}$SELECTED_NAME${NC} is running the app."
echo ""
echo "To view ${BOLD}console.log${NC} from your app, use Fusebox DevTools:"
echo ""
echo "  ${CYAN}1) Fusebox DevTools (recommended)${NC}"
echo "     In the Metro terminal, press ${BOLD}j${NC} → browser opens"
echo "     → Console tab shows all console.log output"
echo ""
echo "  ${CYAN}2) Standalone React DevTools${NC}"
echo "     Run in another terminal:  npx react-devtools"
echo "     Shows component tree + Console logs in standalone window"
echo ""
echo "  ${CYAN}3) Xcode Device Console (native logs only)${NC}"
echo "     Window → Devices & Simulators → Select ${BOLD}$SELECTED_NAME${NC}"
echo "     → Open Console (shows native iOS logs)"
echo ""
echo "  ${CYAN}4) Tarsier Logger${NC}"
echo "     Tap the app icon 3 times → opens logger UI with live filters"
echo ""
info "Script complete. Press ${BOLD}Ctrl+C${NC} to exit."
