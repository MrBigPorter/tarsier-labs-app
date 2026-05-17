#!/bin/bash
# ──────────────────────────────────────────────────────────────────────────────
# check-bundle-size.sh — Production bundle size budget check
#
# Usage:
#   ./scripts/check-bundle-size.sh
#
# Builds the iOS production JS bundle (dev=false) and checks its size against
# the configured budget.
#
# Exit codes:
#   0 — Bundle is within budget
#   1 — Bundle exceeds hard budget (failure for CI)
# ──────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Configuration ───────────────────────────────────────────────────────────

# Budget in KB (2.5 MB = 2560 KB, leave headroom for growth)
BUDGET_KB=2560

# Warning threshold as percentage of budget (85% = warn at ~2176 KB)
WARN_PERCENT=85

# ── Colors ──────────────────────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ── Build Bundle ────────────────────────────────────────────────────────────

echo -e "${CYAN}📦 Building production JS bundle...${NC}"

BUNDLE_OUTPUT=/tmp/main.jsbundle
SOURCE_MAP_OUTPUT=/tmp/main.jsbundle.map

yarn react-native bundle \
  --platform ios \
  --dev false \
  --entry-file index.js \
  --bundle-output "$BUNDLE_OUTPUT" \
  --sourcemap-output "$SOURCE_MAP_OUTPUT" \
  --assets-dest /tmp/assets 2>/dev/null

# ── Measure ─────────────────────────────────────────────────────────────────

if [ -f "$BUNDLE_OUTPUT" ]; then
  SIZE_BYTES=$(stat -f%z "$BUNDLE_OUTPUT" 2>/dev/null || stat -c%s "$BUNDLE_OUTPUT" 2>/dev/null)
  SIZE_KB=$((SIZE_BYTES / 1024))
else
  echo -e "${RED}❌ Bundle file not found at $BUNDLE_OUTPUT${NC}"
  exit 1
fi

# ── Check Budget ────────────────────────────────────────────────────────────

WARN_KB=$((BUDGET_KB * WARN_PERCENT / 100))

echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  Bundle Size:   ${SIZE_KB} KB"
echo -e "  Budget:        ${BUDGET_KB} KB"
echo -e "  Warning at:    ${WARN_KB} KB"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ "$SIZE_KB" -gt "$BUDGET_KB" ]; then
  echo -e "${RED}❌ FAIL: Bundle size ${SIZE_KB}KB exceeds budget ${BUDGET_KB}KB${NC}"
  echo -e "${RED}   Optimize the bundle or increase the budget.${NC}"
  echo ""
  echo -e "${YELLOW}   Tip: Check which modules contribute most:${NC}"
  echo -e "   yarn react-native bundle --platform ios --dev false --entry-file index.js \\"
  echo -e "     --bundle-output /tmp/main.jsbundle --sourcemap-output /tmp/main.jsbundle.map"
  echo -e "   npx source-map-explorer /tmp/main.jsbundle"
  exit 1
elif [ "$SIZE_KB" -gt "$WARN_KB" ]; then
  echo -e "${YELLOW}⚠️  WARN: Bundle size ${SIZE_KB}KB is approaching budget (${WARN_KB}KB warn threshold)${NC}"
  echo -e "${YELLOW}   Consider reviewing dependencies.${NC}"
  exit 0
else
  echo -e "${GREEN}✅ PASS: Bundle size ${SIZE_KB}KB within budget${NC}"
  exit 0
fi
