#!/bin/zsh

set -euo pipefail

SOURCE_ROOT="${0:A:h:h}"
PACKAGE_ROOT="${MOONSEA_TEST_PACKAGE_ROOT:-$SOURCE_ROOT}"
BUILDER_PATH="${MOONSEA_TEST_BUILDER_PATH:-$PACKAGE_ROOT/tools/moonsea-builder.mjs}"
TEST_ROOT="$SOURCE_ROOT/.build/macos-installer-smoke"
SOURCE_APP="$TEST_ROOT/Official.app"
INSTALL_ROOT="$TEST_ROOT/MoonseaCodex"
APPLICATIONS_DIR="$TEST_ROOT/Applications"
DESKTOP_DIR="$TEST_ROOT/Desktop"

rm -rf "$TEST_ROOT"
mkdir -p "$TEST_ROOT" "$APPLICATIONS_DIR" "$DESKTOP_DIR"
trap 'rm -rf "$TEST_ROOT"' EXIT

run_builder() {
  if [[ "$BUILDER_PATH" == *.mjs ]]; then
    node "$BUILDER_PATH" "$@"
  else
    "$BUILDER_PATH" "$@"
  fi
}

node "$SOURCE_ROOT/tests/create-fixture.mjs" macos "$SOURCE_APP" >/dev/null
export MOONSEA_SOURCE_APP="$SOURCE_APP"
export MOONSEA_INSTALL_ROOT="$INSTALL_ROOT"
export MOONSEA_APPLICATIONS_DIR="$APPLICATIONS_DIR"
export MOONSEA_DESKTOP_DIR="$DESKTOP_DIR"
export MOONSEA_BUILDER_PATH="$BUILDER_PATH"
export MOONSEA_SKIP_CODESIGN=1
export MOONSEA_SKIP_LAUNCHER_APP=1
export MOONSEA_SKIP_LAUNCH=1

zsh "$PACKAGE_ROOT/scripts/macos/install-moonsea.sh"
ACTIVE_BUILD="$(plutil -extract activeBuild raw -o - "$INSTALL_ROOT/install.plist")"
[[ "$(plutil -extract edition raw -o - "$INSTALL_ROOT/install.plist")" == "standard" ]]
MANAGER_PATH="$(plutil -extract managerPath raw -o - "$INSTALL_ROOT/install.plist")"
[[ -f "$MANAGER_PATH" ]]
[[ -f "$INSTALL_ROOT/site/index.html" ]]
if [[ "$MANAGER_PATH" == *.mjs ]]; then
  node "$MANAGER_PATH" --install-root "$INSTALL_ROOT" --profile-path "$INSTALL_ROOT/BrowserProfile" >/dev/null 2>&1 &
else
  "$MANAGER_PATH" --install-root "$INSTALL_ROOT" --profile-path "$INSTALL_ROOT/BrowserProfile" >/dev/null 2>&1 &
fi
MANAGER_READY=0
for _ in {1..30}; do
  if /usr/bin/curl --silent --fail http://127.0.0.1:17321/api/themes >/dev/null; then
    MANAGER_READY=1
    break
  fi
  sleep 0.1
done
[[ $MANAGER_READY -eq 1 ]]
zsh "$PACKAGE_ROOT/scripts/macos/install-moonsea.sh"
run_builder --verify "$ACTIVE_BUILD" >/dev/null

MOONSEA_NONINTERACTIVE=1 zsh "$PACKAGE_ROOT/scripts/macos/uninstall-moonsea.sh"
[[ ! -d "$INSTALL_ROOT/builds" ]]
[[ ! -d "$INSTALL_ROOT/site" ]]
[[ -d "$INSTALL_ROOT/BrowserProfile" ]]

zsh "$PACKAGE_ROOT/scripts/macos/install-moonsea.sh"
MOONSEA_NONINTERACTIVE=1 MOONSEA_REMOVE_USER_DATA=1 zsh "$PACKAGE_ROOT/scripts/macos/uninstall-moonsea.sh"
[[ ! -e "$INSTALL_ROOT" ]]

echo "macOS 安装更新与卸载冒烟测试通过"
