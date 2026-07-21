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
run_builder --verify "$ACTIVE_BUILD" >/dev/null

MOONSEA_NONINTERACTIVE=1 zsh "$PACKAGE_ROOT/scripts/macos/uninstall-moonsea.sh"
[[ ! -d "$INSTALL_ROOT/builds" ]]
[[ -d "$INSTALL_ROOT/BrowserProfile" ]]

zsh "$PACKAGE_ROOT/scripts/macos/install-moonsea.sh"
MOONSEA_NONINTERACTIVE=1 MOONSEA_REMOVE_USER_DATA=1 zsh "$PACKAGE_ROOT/scripts/macos/uninstall-moonsea.sh"
[[ ! -e "$INSTALL_ROOT" ]]

echo "macOS 安装更新与卸载冒烟测试通过"
