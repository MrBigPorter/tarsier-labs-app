#!/bin/zsh
# ============================================================================
# setup-codepush-keys.sh — Interactive CodePush Key Setup
# ============================================================================
# Prompts for a CodePush access token, logs into the self-hosted server,
# retrieves all 4 deployment keys, and auto-fills them into:
#   - android/app/build.gradle (staging + production flavors)
#   - ios/Config/Test.xcconfig  (TarsierTest-ios Staging key)
#   - ios/Config/Prod.xcconfig  (Tarsier-ios Production key)
#
# Usage:
#   ./scripts/setup-codepush-keys.sh
#   make codepush-setup-keys        ← recommended
#
# Prerequisites:
#   - code-push-standalone CLI installed globally
#   - Self-hosted CodePush server running at https://codepush.joyminis.com
#   - Access token (generate via: make codepush-create-key SSH_HOST=root@<vps-ip>)
# ============================================================================

set -e

# ── Volta Node bin (code-push-standalone lives here) ──────────────────────
# Makefile sets NODE_BIN := /Users/porter/.volta/tools/image/node/24.14.1/bin
# Ensure it's in PATH so code-push-standalone is found
export PATH="/Users/porter/.volta/tools/image/node/24.14.1/bin:$PATH"

# ── Paths ─────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

ANDROID_BUILD_GRADLE="$PROJECT_DIR/android/app/build.gradle"
IOS_TEST_XCCONFIG="$PROJECT_DIR/ios/Config/Test.xcconfig"
IOS_PROD_XCCONFIG="$PROJECT_DIR/ios/Config/Prod.xcconfig"

CODEPUSH_SERVER_URL="https://codepush.joyminis.com"

# ── Colors ────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

info()  { printf "${CYAN}ℹ️  %s${NC}\n" "$*"; }
ok()    { printf "${GREEN}✅ %s${NC}\n" "$*"; }
warn()  { printf "${YELLOW}⚠️  %s${NC}\n" "$*"; }
err()   { printf "${RED}❌ %s${NC}\n" "$*"; }

# ── Prerequisites ─────────────────────────────────────────────────────────

info "Checking prerequisites..."

if ! command -v code-push-standalone &>/dev/null; then
  err "code-push-standalone CLI not found!"
  echo ""
  echo "  Install it globally:"
  echo "    npm install -g code-push-standalone"
  echo ""
  exit 1
fi
ok "code-push-standalone found: $(which code-push-standalone)"

# ── Prompt for Access Token ───────────────────────────────────────────────

echo ""
info "You need a CodePush access token to login."
info "If you don't have one, generate it on the VPS:"
echo "    make codepush-create-key SSH_HOST=root@<vps-ip> ADMIN_PASSWORD=your-password"
echo ""

printf "${YELLOW}🔑 Paste your CodePush Access Token:${NC} "
read -rs TOKEN
echo ""

if [ -z "$TOKEN" ]; then
  err "No token provided. Aborting."
  exit 1
fi

ok "Token received (${#TOKEN} characters)"

# ── Login ─────────────────────────────────────────────────────────────────

echo ""
info "Logging in to CodePush server at $CODEPUSH_SERVER_URL..."

LOGIN_OUTPUT=$(code-push-standalone login "$CODEPUSH_SERVER_URL" --accessKey "$TOKEN" 2>&1) || true
if echo "$LOGIN_OUTPUT" | grep -qi "error" && ! echo "$LOGIN_OUTPUT" | grep -qi "already logged in"; then
  err "Login failed: $LOGIN_OUTPUT"
  exit 1
fi
ok "Logged in successfully"

# ── Helper: ensure app exists on server ────────────────────────────────────
# NOTE: code-push-standalone CLI's "app add" doesn't send the "os" and
# "platform" fields required by the self-hosted server. We use curl directly
# against the REST API instead.

ensure_app() {
  local app="$1"
  local os="$2"       # iOS | Android
  local platform="$3" # React-Native | Cordova
  
  # Check if app already exists via API
  local list_response
  list_response=$(curl -s "${CODEPUSH_SERVER_URL}/apps/" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Accept: application/json" 2>&1)
  
  if echo "$list_response" | grep -q "\"name\":\"${app}\""; then
    return 0
  fi
  
  # App doesn't exist — create it via API
  warn "App '$app' not found — creating..."
  local create_response
  create_response=$(curl -s -X POST "${CODEPUSH_SERVER_URL}/apps/" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json" \
    -d "{\"name\":\"${app}\",\"os\":\"${os}\",\"platform\":\"${platform}\"}" 2>&1)
  
  if echo "$create_response" | grep -q "\"name\":\"${app}\""; then
    ok "App '$app' created (os=$os, platform=$platform)"
    return 0
  fi
  
  err "Failed to create app '$app': $create_response"
  return 1
}

# ── Helper: get deployment key via REST API ──────────────────────────────

get_key() {
  local app="$1"
  local deployment="$2"
  
  # Fetch deployments via REST API (returns {"deployments":[...]} with name + key)
  local response
  response=$(curl -s "${CODEPUSH_SERVER_URL}/apps/${app}/deployments/" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Accept: application/json" 2>&1) || true
  
  # Parse JSON to find the matching deployment key
  # Expected: {"deployments":[{"name":"Staging","key":"abc..."},{"name":"Production","key":"xyz..."}]}
  local key
  key=$(echo "$response" | python3 -c "
import sys, json
data = json.load(sys.stdin)
deployments = data.get('deployments') or data
for d in deployments:
    if d.get('name') == '${deployment}':
        print(d.get('key', ''))
        break
" 2>/dev/null) || true
  
  if [ -z "$key" ]; then
    err "Could not extract '$deployment' key from app '$app'"
    echo "  Server response: $response"
    return 1
  fi
  
  echo "$key"
}

# ── Ensure apps exist & get keys ──────────────────────────────────────────

echo ""
info "Ensuring all CodePush apps exist on server..."
echo ""

# Format: "AppName:OS:Platform"
APP_DEFS=(
  "TarsierTest-ios:iOS:React-Native"
  "TarsierTest-android:Android:React-Native"
  "Tarsier-ios:iOS:React-Native"
  "Tarsier-android:Android:React-Native"
)

for entry in "${APP_DEFS[@]}"; do
  app="${entry%%:*}"
  rest="${entry#*:}"
  os="${rest%%:*}"
  platform="${rest##*:}"
  
  printf "  ${CYAN}🔍${NC} Checking app: %-25s ... " "$app"
  if ensure_app "$app" "$os" "$platform"; then
    echo "${GREEN}✓${NC}"
  else
    echo "${RED}FAILED${NC}"
    exit 1
  fi
done

echo ""
info "Retrieving deployment keys..."
echo ""

declare -A KEYS

# Define what we need: app:deployment:variable_name
KEY_DEFS=(
  "TarsierTest-ios:Staging:IOS_TEST"
  "TarsierTest-android:Staging:ANDROID_TEST"
  "Tarsier-ios:Production:IOS_PROD"
  "Tarsier-android:Production:ANDROID_PROD"
)

for entry in "${KEY_DEFS[@]}"; do
  app="${entry%%:*}"
  rest="${entry#*:}"
  deployment="${rest%%:*}"
  var_name="${rest##*:}"
  
  printf "  ${CYAN}📡${NC} Fetching %-25s %-12s ... " "$app" "$deployment"
  key=$(get_key "$app" "$deployment")
  if [ $? -ne 0 ] || [ -z "$key" ]; then
    echo "${RED}FAILED${NC}"
    exit 1
  fi
  KEYS[$var_name]="$key"
  echo "${GREEN}✓${NC}"
done

echo ""
ok "All 4 deployment keys retrieved"

# ── Show keys (masked) ────────────────────────────────────────────────────

mask() {
  local s="$1"
  if [ ${#s} -le 8 ]; then
    echo "${s:0:2}...${s: -2}"
  else
    echo "${s:0:4}...${s: -4}"
  fi
}

echo ""
info "Deployment keys (masked):"
echo "  TarsierTest-ios (Staging):    $(mask ${KEYS[IOS_TEST]})"
echo "  TarsierTest-android (Staging): $(mask ${KEYS[ANDROID_TEST]})"
echo "  Tarsier-ios (Production):     $(mask ${KEYS[IOS_PROD]})"
echo "  Tarsier-android (Production):  $(mask ${KEYS[ANDROID_PROD]})"
echo ""

# ── Backup original files ─────────────────────────────────────────────────

info "Creating backups (.bak)..."
cp "$ANDROID_BUILD_GRADLE" "${ANDROID_BUILD_GRADLE}.bak"
cp "$IOS_TEST_XCCONFIG" "${IOS_TEST_XCCONFIG}.bak"
cp "$IOS_PROD_XCCONFIG" "${IOS_PROD_XCCONFIG}.bak"
ok "Backups created: *.bak"

# ── Update android/app/build.gradle ────────────────────────────────────────

info "Updating android/app/build.gradle..."

# Staging flavor placeholder
sed -i '' \
  "s/\"CODEPUSH_KEY_TEST_PLACEHOLDER\"/\"${KEYS[ANDROID_TEST]}\"/" \
  "$ANDROID_BUILD_GRADLE"

# Production flavor placeholder
sed -i '' \
  "s/\"CODEPUSH_KEY_PRODUCTION_PLACEHOLDER\"/\"${KEYS[ANDROID_PROD]}\"/" \
  "$ANDROID_BUILD_GRADLE"

ok "android/app/build.gradle updated"

# ── Update ios/Config/Test.xcconfig ────────────────────────────────────────

info "Updating ios/Config/Test.xcconfig..."
sed -i '' \
  "s/\$(CODEPUSH_KEY_TEST)/${KEYS[IOS_TEST]}/g" \
  "$IOS_TEST_XCCONFIG"
ok "ios/Config/Test.xcconfig updated"

# ── Update ios/Config/Prod.xcconfig ────────────────────────────────────────

info "Updating ios/Config/Prod.xcconfig..."
sed -i '' \
  "s/\$(CODEPUSH_KEY_PRODUCTION)/${KEYS[IOS_PROD]}/g" \
  "$IOS_PROD_XCCONFIG"
ok "ios/Config/Prod.xcconfig updated"

# ── Show diff ──────────────────────────────────────────────────────────────

echo ""
info "Changes made (vs original backups):"
echo ""

diff_files=(
  "$ANDROID_BUILD_GRADLE"
  "$IOS_TEST_XCCONFIG"
  "$IOS_PROD_XCCONFIG"
)

for file in "${diff_files[@]}"; do
  backup="${file}.bak"
  if [ -f "$backup" ]; then
    echo "━━━ ${file#$PROJECT_DIR/} ━━━"
    diff_output=$(diff --unified=2 "$backup" "$file" 2>/dev/null || true)
    if [ -n "$diff_output" ]; then
      echo "$diff_output"
    else
      echo "  (no changes)"
    fi
    echo ""
  fi
done

# ── Cleanup ────────────────────────────────────────────────────────────────

echo ""
info "Cleaning up backups..."
rm -f "${ANDROID_BUILD_GRADLE}.bak" "${IOS_TEST_XCCONFIG}.bak" "${IOS_PROD_XCCONFIG}.bak"
ok "Backups removed"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
ok "CodePush keys configured successfully!"
echo ""
echo "  Next steps:"
echo "    1. Build a test flavor to verify: make build-test-android"
echo "    2. Release a test OTA update: make codepush-release-staging"
echo "    3. Test on device: make run-test-android"
echo ""
echo "  To view deployment keys later: make codepush-keys"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
