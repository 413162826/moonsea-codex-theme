#!/bin/zsh

set -euo pipefail

INSTALL_ROOT="${MOONSEA_INSTALL_ROOT:-$HOME/Library/Application Support/MoonseaCodex}"
MANIFEST_PATH="$INSTALL_ROOT/install.plist"
BUILDS_ROOT="$INSTALL_ROOT/builds"

[[ -f "$MANIFEST_PATH" ]] || { echo "月海版安装信息不存在，请重新运行安装脚本。" >&2; exit 1; }
ACTIVE_BUILD="$(/usr/bin/plutil -extract activeBuild raw -o - "$MANIFEST_PATH")"
PROFILE_PATH="$(/usr/bin/plutil -extract profilePath raw -o - "$MANIFEST_PATH")"
case "$ACTIVE_BUILD" in
  "$BUILDS_ROOT"/Moonsea-Codex-*.app) ;;
  *) echo "安装信息中的应用路径无效。" >&2; exit 1 ;;
esac
[[ -d "$ACTIVE_BUILD" ]] || { echo "月海版应用不存在，请重新运行安装脚本。" >&2; exit 1; }
/bin/mkdir -p "$PROFILE_PATH"
/usr/bin/open -na "$ACTIVE_BUILD" --args "--user-data-dir=$PROFILE_PATH"
