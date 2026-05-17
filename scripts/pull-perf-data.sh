#!/bin/bash
# ──────────────────────────────────────────────────────────────────────────────
# pull-perf-data.sh — Export performance data from simulator/emulator
#
# Usage:
#   ./scripts/pull-perf-data.sh ios      # Pull from iOS Simulator
#   ./scripts/pull-perf-data.sh android  # Pull from Android Emulator
#
# Exports all .cpuprofile files from the device cache directory to a local
# timestamped folder, ready to import into Chrome DevTools.
#
# Chrome DevTools: Performance → Load (load .cpuprofile) → Flame graph
# ──────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Configuration ───────────────────────────────────────────────────────────

OUTPUT_DIR="/tmp/perf-data-$(date +%Y%m%d-%H%M%S)"

# ── Colors ──────────────────────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# ── Help ────────────────────────────────────────────────────────────────────

usage() {
  echo "Usage: $0 [ios|android]"
  echo ""
  echo "Export CPU profile files from simulator/emulator."
  echo ""
  echo "Examples:"
  echo "  $0 ios          # Pull from iOS Simulator"
  echo "  $0 android      # Pull from Android Emulator"
  exit 1
}

if [ $# -ne 1 ]; then
  usage
fi

PLATFORM="$1"

# ── iOS ─────────────────────────────────────────────────────────────────────

pull_ios() {
  echo -e "${CYAN}📱 Pulling performance data from iOS Simulator...${NC}"

  # Find the app container for the simulator
  CONTAINER=$(xcrun simctl get_app_container booted com.frontendblogmobile data 2>/dev/null || true)

  if [ -z "$CONTAINER" ]; then
    echo -e "${YELLOW}⚠️  No booted simulator found or app not installed.${NC}"
    echo "   Please ensure:"
    echo "   1. iOS Simulator is running"
    echo "   2. The app has been built and installed"
    echo "   3. The app has generated some .cpuprofile files"
    exit 1
  fi

  CACHE_DIR="${CONTAINER}/Library/Caches"
  echo -e "   App container: ${CONTAINER}"

  mkdir -p "$OUTPUT_DIR"

  # Copy all perf-*.cpuprofile files
  PROFILE_COUNT=0
  for f in "$CACHE_DIR"/perf-jank-*.cpuprofile; do
    if [ -f "$f" ]; then
      cp "$f" "$OUTPUT_DIR/"
      PROFILE_COUNT=$((PROFILE_COUNT + 1))
    fi
  done

  if [ "$PROFILE_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✅ Pulled ${PROFILE_COUNT} profile(s) to: ${OUTPUT_DIR}${NC}"
    ls -lh "$OUTPUT_DIR"
    echo ""
    echo -e "${CYAN}   Open in Chrome DevTools:${NC}"
    echo -e "   ➜  Chrome DevTools → Performance tab → Load (🎚️ icon)"
    echo -e "   ➜  Select one of the .cpuprofile files"
    echo -e "   ➜  View the flame graph"
  else
    echo -e "${YELLOW}⚠️  No perf-jank-*.cpuprofile files found in iOS cache.${NC}"
    echo "   The app may not have detected jank yet, or profiles were cleaned up."
    rmdir "$OUTPUT_DIR" 2>/dev/null || true
    exit 0
  fi
}

# ── Android ─────────────────────────────────────────────────────────────────

pull_android() {
  echo -e "${CYAN}🤖 Pulling performance data from Android Emulator...${NC}"

  # Check if device is available
  if ! adb devices 2>/dev/null | grep -q "device$"; then
    echo -e "${YELLOW}⚠️  No Android device/emulator connected.${NC}"
    echo "   Please ensure:"
    echo "   1. Android Emulator is running"
    echo "   2. The app has been built and installed (adb install ...)"
    exit 1
  fi

  mkdir -p "$OUTPUT_DIR"

  # List all profile files in app cache
  PROFILE_FILES=$(adb exec-out run-as com.frontendblogmobile sh -c 'ls /data/data/com.frontendblogmobile/caches/perf-jank-*.cpuprofile 2>/dev/null' || true)

  if [ -z "$PROFILE_FILES" ]; then
    echo -e "${YELLOW}⚠️  No perf-jank-*.cpuprofile files found in Android cache.${NC}"
    echo "   The app may not have detected jank yet."
    rmdir "$OUTPUT_DIR" 2>/dev/null || true
    exit 0
  fi

  PROFILE_COUNT=0
  echo "$PROFILE_FILES" | while read -r file; do
    if [ -n "$file" ]; then
      BASENAME=$(basename "$file")
      adb exec-out run-as com.frontendblogmobile sh -c "cat $file" > "$OUTPUT_DIR/$BASENAME" 2>/dev/null
      PROFILE_COUNT=$((PROFILE_COUNT + 1))
    fi
  done

  # Count actual files
  FINAL_COUNT=$(ls "$OUTPUT_DIR"/*.cpuprofile 2>/dev/null | wc -l)

  if [ "$FINAL_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✅ Pulled ${FINAL_COUNT} profile(s) to: ${OUTPUT_DIR}${NC}"
    ls -lh "$OUTPUT_DIR"
    echo ""
    echo -e "${CYAN}   Open in Chrome DevTools:${NC}"
    echo -e "   ➜  Chrome DevTools → Performance tab → Load (🎚️ icon)"
    echo -e "   ➜  Select one of the .cpuprofile files"
    echo -e "   ➜  View the flame graph"
  else
    echo -e "${YELLOW}⚠️  Failed to pull profile files.${NC}"
    rmdir "$OUTPUT_DIR" 2>/dev/null || true
  fi
}

# ── Main ────────────────────────────────────────────────────────────────────

case "$PLATFORM" in
  ios)
    pull_ios
    ;;
  android)
    pull_android
    ;;
  *)
    usage
    ;;
esac
