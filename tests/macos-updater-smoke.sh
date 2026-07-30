#!/bin/zsh

set -euo pipefail

SOURCE_ROOT="${0:A:h:h}"
PACKAGE_ROOT="${MOONSEA_TEST_PACKAGE_ROOT:-$SOURCE_ROOT}"
CLIENT="${MOONSEA_TEST_CLIENT:-codex}"
[[ "$CLIENT" == "codex" || "$CLIENT" == "workbuddy" ]]
TEST_ROOT="$SOURCE_ROOT/.build/macos-updater-smoke"
SOURCE_APP="$TEST_ROOT/Official.app"
if [[ "$CLIENT" == "workbuddy" ]]; then
  INSTALL_ROOT="$TEST_ROOT/MoonseaWorkBuddy"
  INSTALLER_NAME="install-moonsea-workbuddy.sh"
  ARCHIVE_NAME="Moonsea-WorkBuddy-test-macOS.zip"
else
  INSTALL_ROOT="$TEST_ROOT/MoonseaCodex"
  INSTALLER_NAME="install-moonsea.sh"
  ARCHIVE_NAME="Moonsea-Codex-test-macOS.zip"
fi
APPLICATIONS_DIR="$TEST_ROOT/Applications"
DESKTOP_DIR="$TEST_ROOT/Desktop"
LEGACY_PACKAGE="$TEST_ROOT/legacy-package"
UPDATE_PACKAGE="$TEST_ROOT/update-package"
ARCHIVE_PATH="$INSTALL_ROOT/updates/$ARCHIVE_NAME"
READY_PATH="$INSTALL_ROOT/updates/updater-smoke.ready"
EXPECTED_VERSION="$(/usr/bin/sed -nE 's/^[[:space:]]*"version"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/p' "$PACKAGE_ROOT/package.json" | /usr/bin/head -n 1)"
MANAGER_PORT=18321
FAKE_APP_PID=""
FAKE_CDP_PID=""

stop_test_manager() {
  local pid_path="$INSTALL_ROOT/manager.pid"
  [[ -f "$pid_path" ]] || return 0
  local manager_pid="$(/bin/cat "$pid_path")"
  [[ ! "$manager_pid" =~ ^[0-9]+$ ]] || /bin/kill -9 "$manager_pid" 2>/dev/null || true
}

stop_fake_app() {
  [[ ! "$FAKE_APP_PID" =~ ^[0-9]+$ ]] || /bin/kill -9 "$FAKE_APP_PID" 2>/dev/null || true
  [[ ! "$FAKE_CDP_PID" =~ ^[0-9]+$ ]] || /bin/kill -9 "$FAKE_CDP_PID" 2>/dev/null || true
}

/bin/rm -rf -- "$TEST_ROOT"
/bin/mkdir -p "$TEST_ROOT" "$APPLICATIONS_DIR" "$DESKTOP_DIR"
trap 'stop_test_manager; stop_fake_app; /bin/rm -rf -- "$TEST_ROOT"' EXIT

node "$SOURCE_ROOT/tests/create-fixture.mjs" macos "$SOURCE_APP" "$CLIENT" >/dev/null
/bin/mkdir -p "$LEGACY_PACKAGE/scripts/macos" "$LEGACY_PACKAGE/tools"
/bin/cp "$PACKAGE_ROOT/package.json" "$LEGACY_PACKAGE/package.json"
/usr/bin/sed -i '' -E 's/"version"[[:space:]]*:[[:space:]]*"[^"]+"/"version": "1.3.9"/' "$LEGACY_PACKAGE/package.json"
/usr/bin/ditto "$PACKAGE_ROOT/site" "$LEGACY_PACKAGE/site"
/usr/bin/ditto "$PACKAGE_ROOT/admin" "$LEGACY_PACKAGE/admin"
/usr/bin/ditto "$PACKAGE_ROOT/assets" "$LEGACY_PACKAGE/assets"
/bin/cp "$PACKAGE_ROOT/scripts/macos/"* "$LEGACY_PACKAGE/scripts/macos/"
/bin/cp "$PACKAGE_ROOT/tools/moonsea-builder"* "$LEGACY_PACKAGE/tools/"
/bin/cp "$PACKAGE_ROOT/tools/moonsea-manager"* "$LEGACY_PACKAGE/tools/"
/bin/chmod +x "$LEGACY_PACKAGE/scripts/macos/"* "$LEGACY_PACKAGE/tools/moonsea-builder"* "$LEGACY_PACKAGE/tools/moonsea-manager"*

export MOONSEA_SOURCE_APP="$SOURCE_APP"
export MOONSEA_INSTALL_ROOT="$INSTALL_ROOT"
export MOONSEA_APPLICATIONS_DIR="$APPLICATIONS_DIR"
export MOONSEA_DESKTOP_DIR="$DESKTOP_DIR"
export MOONSEA_SKIP_CODESIGN=1
export MOONSEA_SKIP_LAUNCHER_APP=1
export MOONSEA_SKIP_LAUNCH=1
export MOONSEA_SKIP_APP_LAUNCH=1
export MOONSEA_NONINTERACTIVE=1
export MOONSEA_MANAGER_PORT="$MANAGER_PORT"
export MOONSEA_CLIENT="$CLIENT"
if [[ "$CLIENT" == "workbuddy" ]]; then
  export MOONSEA_CDP_PORT=17323
  node "$SOURCE_ROOT/tests/fake-cdp-server.mjs" "$MOONSEA_CDP_PORT" >/dev/null 2>&1 &
  FAKE_CDP_PID="$!"
fi
/bin/sleep 120 &
FAKE_APP_PID="$!"
export MOONSEA_APP_PID="$FAKE_APP_PID"

/bin/zsh "$LEGACY_PACKAGE/scripts/macos/$INSTALLER_NAME"
[[ "$(/usr/bin/plutil -extract appVersion raw -o - "$INSTALL_ROOT/install.plist")" == "1.3.9" ]]

/bin/mkdir -p "$UPDATE_PACKAGE/scripts/macos" "$UPDATE_PACKAGE/tools" "${ARCHIVE_PATH:h}"
/bin/cp "$PACKAGE_ROOT/package.json" "$UPDATE_PACKAGE/package.json"
/usr/bin/ditto "$PACKAGE_ROOT/site" "$UPDATE_PACKAGE/site"
/usr/bin/ditto "$PACKAGE_ROOT/admin" "$UPDATE_PACKAGE/admin"
/usr/bin/ditto "$PACKAGE_ROOT/theme" "$UPDATE_PACKAGE/theme"
/usr/bin/ditto "$PACKAGE_ROOT/assets" "$UPDATE_PACKAGE/assets"
/bin/cp "$PACKAGE_ROOT/scripts/macos/"* "$UPDATE_PACKAGE/scripts/macos/"
/bin/cp "$PACKAGE_ROOT/tools/moonsea-builder"* "$UPDATE_PACKAGE/tools/"
/bin/cp "$PACKAGE_ROOT/tools/moonsea-manager"* "$UPDATE_PACKAGE/tools/"
/bin/chmod +x "$UPDATE_PACKAGE/scripts/macos/"* "$UPDATE_PACKAGE/tools/moonsea-builder"* "$UPDATE_PACKAGE/tools/moonsea-manager"*
/usr/bin/ditto -c -k --keepParent "$UPDATE_PACKAGE" "$ARCHIVE_PATH"

UPDATER_PATH="$(/usr/bin/plutil -extract updaterPath raw -o - "$INSTALL_ROOT/install.plist")"
/bin/zsh "$UPDATER_PATH" \
  --install-root "$INSTALL_ROOT" \
  --package-path "$ARCHIVE_PATH" \
  --manager-pid 999999 \
  --current-version 1.3.9 \
  --target-version "$EXPECTED_VERSION" \
  --ready-path "$READY_PATH"

[[ -f "$READY_PATH" ]] || { echo "Updater did not publish its ready marker" >&2; exit 1; }
/usr/bin/grep -q '"status":"succeeded"' "$INSTALL_ROOT/updates/update-result.json" || {
  echo "Updater did not persist its success result" >&2
  exit 1
}

[[ "$(/usr/bin/plutil -extract appVersion raw -o - "$INSTALL_ROOT/install.plist")" == "$EXPECTED_VERSION" ]]
MANAGER_PATH="$(/usr/bin/plutil -extract managerPath raw -o - "$INSTALL_ROOT/install.plist")"
UPDATED_UPDATER="$(/usr/bin/plutil -extract updaterPath raw -o - "$INSTALL_ROOT/install.plist")"
[[ -f "$MANAGER_PATH" && -x "$UPDATED_UPDATER" ]]
STATUS="$(/usr/bin/curl -fsS --max-time 2 "http://127.0.0.1:$MANAGER_PORT/api/status")"
print -r -- "$STATUS" | /usr/bin/grep -F "\"appVersion\":\"$EXPECTED_VERSION\"" >/dev/null
print -r -- "macOS application update smoke test passed"
