#!/bin/zsh

set -euo pipefail

SCRIPT_DIR="${0:A:h}"
PROJECT_ROOT="${SCRIPT_DIR:h:h}"
BUILDER_PATH="${MOONSEA_BUILDER_PATH:-$PROJECT_ROOT/tools/moonsea-builder}"
if [[ -n "${MOONSEA_MANAGER_PATH:-}" ]]; then
  MANAGER_PATH="$MOONSEA_MANAGER_PATH"
elif [[ -x "$PROJECT_ROOT/tools/moonsea-manager" ]]; then
  MANAGER_PATH="$PROJECT_ROOT/tools/moonsea-manager"
else
  MANAGER_PATH="$PROJECT_ROOT/tools/moonsea-manager.mjs"
fi
INSTALL_ROOT="${MOONSEA_INSTALL_ROOT:-$HOME/Library/Application Support/MoonseaCodex}"
BUILDS_ROOT="$INSTALL_ROOT/builds"
PROFILE_PATH="$INSTALL_ROOT/BrowserProfile"
MANIFEST_PATH="$INSTALL_ROOT/install.plist"
START_SOURCE="$SCRIPT_DIR/Start-Moonsea-macOS.command"
START_INSTALLED="$INSTALL_ROOT/Start-Moonsea-macOS.command"
SITE_SOURCE="$PROJECT_ROOT/site"
ADMIN_SOURCE="$PROJECT_ROOT/admin"
DRAFT_SOURCE="$PROJECT_ROOT/assets/admin-drafts"
if [[ "$MANAGER_PATH" == *.mjs ]]; then
  MANAGER_FILE_NAME="MoonseaManager.mjs"
else
  MANAGER_FILE_NAME="MoonseaManager"
fi
PACKAGE_METADATA="$PROJECT_ROOT/package.json"
UPDATER_SOURCE="$SCRIPT_DIR/update-moonsea.sh"
APPLICATIONS_DIR="${MOONSEA_APPLICATIONS_DIR:-$HOME/Applications}"
DESKTOP_DIR="${MOONSEA_DESKTOP_DIR:-$HOME/Desktop}"
LAUNCHER_APP="$APPLICATIONS_DIR/Codex 月海版.app"
DESKTOP_LAUNCHER="$DESKTOP_DIR/Codex 月海版.app"

fail() {
  echo "错误：$1" >&2
  exit 1
}

is_valid_app() {
  [[ -d "$1" && -f "$1/Contents/Resources/app.asar" ]]
}

find_official_app() {
  if [[ -n "${MOONSEA_SOURCE_APP:-}" ]]; then
    print -r -- "$MOONSEA_SOURCE_APP"
    return
  fi
  local candidate
  for candidate in \
    "/Applications/ChatGPT.app" \
    "$HOME/Applications/ChatGPT.app" \
    "/Applications/Codex.app" \
    "$HOME/Applications/Codex.app"; do
    if is_valid_app "$candidate"; then
      print -r -- "$candidate"
      return
    fi
  done
  if [[ -x /usr/bin/osascript ]]; then
    /usr/bin/osascript -e 'POSIX path of (choose application with prompt "请选择官方 ChatGPT 或 Codex")' | sed 's:/$::'
    return
  fi
  fail "没有找到官方 Codex。请先安装并启动一次官方客户端。"
}

safe_remove_build() {
  local target="$1"
  case "$target" in
    "$BUILDS_ROOT"/Moonsea-Codex-*) /bin/rm -rf -- "$target" ;;
    *) fail "拒绝清理异常目录：$target" ;;
  esac
}

run_builder() {
  if [[ "$BUILDER_PATH" == *.mjs ]]; then
    /usr/bin/env node "$BUILDER_PATH" "$@"
  else
    "$BUILDER_PATH" "$@"
  fi
}

if [[ "$BUILDER_PATH" == *.mjs ]]; then
  [[ -f "$BUILDER_PATH" ]] || fail "没有找到开发构建器：$BUILDER_PATH"
else
  [[ -x "$BUILDER_PATH" ]] || fail "安装文件不完整，请重新下载并完整解压 macOS 安装包。"
fi
[[ -f "$START_SOURCE" ]] || fail "启动脚本缺失：$START_SOURCE"
[[ -f "$MANAGER_PATH" ]] || fail "月海助手缺失：$MANAGER_PATH"
[[ -f "$SITE_SOURCE/index.html" ]] || fail "月海网页资源缺失：$SITE_SOURCE"
[[ -f "$ADMIN_SOURCE/index.html" ]] || fail "月海管理员资源缺失：$ADMIN_SOURCE"
[[ -d "$DRAFT_SOURCE" ]] || fail "月海管理员样稿缺失：$DRAFT_SOURCE"
[[ -f "$PACKAGE_METADATA" ]] || fail "月海安装包缺少版本信息：$PACKAGE_METADATA"
[[ -f "$UPDATER_SOURCE" ]] || fail "月海更新程序缺失：$UPDATER_SOURCE"

APP_VERSION="$(/usr/bin/sed -nE 's/^[[:space:]]*"version"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/p' "$PACKAGE_METADATA" | /usr/bin/head -n 1)"
[[ "$APP_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[A-Za-z0-9.-]+)?$ ]] || fail "月海安装包版本无效：$APP_VERSION"
RELEASES_ROOT="$INSTALL_ROOT/releases"
RELEASE_ROOT="$RELEASES_ROOT/$APP_VERSION"
RELEASE_STAGING="$RELEASES_ROOT/$APP_VERSION-staging"
MANAGER_INSTALLED="$RELEASE_ROOT/$MANAGER_FILE_NAME"
UPDATER_INSTALLED="$RELEASE_ROOT/scripts/macos/update-moonsea.sh"

MANAGER_PID_PATH="$INSTALL_ROOT/manager.pid"
if [[ -f "$MANAGER_PID_PATH" ]]; then
  PREVIOUS_MANAGER_PID="$(/bin/cat "$MANAGER_PID_PATH")"
  if [[ "$PREVIOUS_MANAGER_PID" =~ ^[0-9]+$ ]]; then
    PREVIOUS_MANAGER_COMMAND="$(/bin/ps -p "$PREVIOUS_MANAGER_PID" -o command= 2>/dev/null || true)"
    if [[ "$PREVIOUS_MANAGER_COMMAND" == *"$INSTALL_ROOT"* ]]; then
      /bin/kill "$PREVIOUS_MANAGER_PID" 2>/dev/null || true
    fi
  fi
  /bin/rm -f -- "$MANAGER_PID_PATH"
fi

SOURCE_APP="$(find_official_app)"
SOURCE_APP="${SOURCE_APP%/}"
is_valid_app "$SOURCE_APP" || fail "所选应用不是有效的官方 Codex：$SOURCE_APP"

OFFICIAL_VERSION="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$SOURCE_APP/Contents/Info.plist" 2>/dev/null || true)"
[[ -n "$OFFICIAL_VERSION" ]] || OFFICIAL_VERSION="unknown"
OFFICIAL_VERSION="${OFFICIAL_VERSION//[^A-Za-z0-9._-]/-}"
THEME_VERSION="$(run_builder --edition standard --theme-version | tail -n 1)"
[[ "$THEME_VERSION" =~ ^[a-f0-9]{12}$ ]] || fail "无法读取主题版本：$THEME_VERSION"

BUILD_NAME="Moonsea-Codex-standard-$OFFICIAL_VERSION-$THEME_VERSION"
ACTIVE_BUILD="$BUILDS_ROOT/$BUILD_NAME.app"
STAGING_BUILD="$BUILDS_ROOT/$BUILD_NAME-staging.app"

/bin/mkdir -p "$BUILDS_ROOT" "$PROFILE_PATH" "$APPLICATIONS_DIR" "$RELEASES_ROOT"

NEEDS_BUILD=1
if [[ -d "$ACTIVE_BUILD" ]]; then
  if run_builder --edition standard --verify "$ACTIVE_BUILD" >/dev/null; then
    NEEDS_BUILD=0
    echo "当前版本已经安装，正在刷新启动入口…"
  else
    safe_remove_build "$ACTIVE_BUILD"
  fi
fi

if [[ $NEEDS_BUILD -eq 1 ]]; then
  [[ ! -e "$STAGING_BUILD" ]] || safe_remove_build "$STAGING_BUILD"
  echo "正在复制官方客户端…"
  /usr/bin/ditto "$SOURCE_APP" "$STAGING_BUILD"
  if ! run_builder --edition standard --patch "$STAGING_BUILD"; then
    safe_remove_build "$STAGING_BUILD"
    fail "写入月海主题失败"
  fi
  if [[ -z "${MOONSEA_SKIP_CODESIGN:-}" ]]; then
    echo "正在完成本机签名…"
    /usr/bin/codesign --force --deep --sign - "$STAGING_BUILD"
    /usr/bin/codesign --verify --deep --strict "$STAGING_BUILD"
  fi
  /bin/mv "$STAGING_BUILD" "$ACTIVE_BUILD"
fi

INSTALLED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
if [[ -f "$MANIFEST_PATH" ]]; then
  PREVIOUS_INSTALLED_AT="$(/usr/bin/plutil -extract installedAt raw -o - "$MANIFEST_PATH" 2>/dev/null || true)"
  [[ -z "$PREVIOUS_INSTALLED_AT" ]] || INSTALLED_AT="$PREVIOUS_INSTALLED_AT"
fi
RELEASE_BACKUP=""
if [[ -e "$RELEASE_ROOT" ]]; then
  RELEASE_BACKUP="$RELEASES_ROOT/$APP_VERSION-replaced"
  /bin/rm -rf -- "$RELEASE_BACKUP"
  /bin/mv "$RELEASE_ROOT" "$RELEASE_BACKUP"
fi
/bin/rm -rf -- "$RELEASE_STAGING"
if ! {
  /bin/mkdir -p "$RELEASE_STAGING/scripts/macos"
  /bin/cp "$MANAGER_PATH" "$RELEASE_STAGING/$MANAGER_FILE_NAME"
  [[ "$MANAGER_FILE_NAME" == *.mjs ]] || /bin/chmod +x "$RELEASE_STAGING/$MANAGER_FILE_NAME"
  /usr/bin/ditto "$SITE_SOURCE" "$RELEASE_STAGING/site"
  /usr/bin/ditto "$ADMIN_SOURCE" "$RELEASE_STAGING/admin"
  /bin/mkdir -p "$RELEASE_STAGING/assets"
  /usr/bin/ditto "$DRAFT_SOURCE" "$RELEASE_STAGING/assets/admin-drafts"
  /bin/cp "$UPDATER_SOURCE" "$RELEASE_STAGING/scripts/macos/update-moonsea.sh"
  /bin/chmod +x "$RELEASE_STAGING/scripts/macos/update-moonsea.sh"
  /bin/mv "$RELEASE_STAGING" "$RELEASE_ROOT"
}; then
  /bin/rm -rf -- "$RELEASE_STAGING"
  if [[ -n "$RELEASE_BACKUP" && -e "$RELEASE_BACKUP" && ! -e "$RELEASE_ROOT" ]]; then
    /bin/mv "$RELEASE_BACKUP" "$RELEASE_ROOT"
  fi
  fail "写入月海版本文件失败"
fi
[[ -z "$RELEASE_BACKUP" ]] || /bin/rm -rf -- "$RELEASE_BACKUP"

TEMP_MANIFEST="$INSTALL_ROOT/install.plist.tmp"
/usr/bin/plutil -create xml1 "$TEMP_MANIFEST"
/usr/bin/plutil -insert schemaVersion -integer 2 "$TEMP_MANIFEST"
/usr/bin/plutil -insert platform -string "macos" "$TEMP_MANIFEST"
/usr/bin/plutil -insert edition -string "standard" "$TEMP_MANIFEST"
/usr/bin/plutil -insert appVersion -string "$APP_VERSION" "$TEMP_MANIFEST"
/usr/bin/plutil -insert themeVersion -string "$THEME_VERSION" "$TEMP_MANIFEST"
/usr/bin/plutil -insert officialVersion -string "$OFFICIAL_VERSION" "$TEMP_MANIFEST"
/usr/bin/plutil -insert sourceApp -string "$SOURCE_APP" "$TEMP_MANIFEST"
/usr/bin/plutil -insert activeBuild -string "$ACTIVE_BUILD" "$TEMP_MANIFEST"
/usr/bin/plutil -insert profilePath -string "$PROFILE_PATH" "$TEMP_MANIFEST"
/usr/bin/plutil -insert managerPath -string "$MANAGER_INSTALLED" "$TEMP_MANIFEST"
/usr/bin/plutil -insert updaterPath -string "$UPDATER_INSTALLED" "$TEMP_MANIFEST"
/usr/bin/plutil -insert releasePath -string "$RELEASE_ROOT" "$TEMP_MANIFEST"
/usr/bin/plutil -insert managerPort -integer 17321 "$TEMP_MANIFEST"
/usr/bin/plutil -insert installedAt -string "$INSTALLED_AT" "$TEMP_MANIFEST"
/usr/bin/plutil -insert updatedAt -string "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$TEMP_MANIFEST"
/bin/mv "$TEMP_MANIFEST" "$MANIFEST_PATH"

/bin/cp "$START_SOURCE" "$START_INSTALLED"
/bin/chmod +x "$START_INSTALLED"

if [[ -z "${MOONSEA_SKIP_LAUNCHER_APP:-}" ]]; then
  [[ ! -e "$LAUNCHER_APP" ]] || /bin/rm -rf -- "$LAUNCHER_APP"
  /usr/bin/osacompile -o "$LAUNCHER_APP" "$SCRIPT_DIR/MoonseaLauncher.applescript"
  if [[ -d "$DESKTOP_DIR" ]]; then
    if [[ -L "$DESKTOP_LAUNCHER" ]]; then
      /bin/rm -- "$DESKTOP_LAUNCHER"
    elif [[ -e "$DESKTOP_LAUNCHER" ]]; then
      fail "桌面已存在同名文件，未覆盖：$DESKTOP_LAUNCHER"
    fi
    /bin/ln -s "$LAUNCHER_APP" "$DESKTOP_LAUNCHER"
  fi
fi

echo
echo "安装完成：Codex 月海版"
echo "接下来只做两步："
echo "1. 打开桌面的“Codex 月海版”"
echo "2. 回到月海主题官网，选择皮肤并点击“应用到 Codex”"

if [[ -z "${MOONSEA_SKIP_LAUNCH:-}" ]]; then
  /bin/zsh "$START_INSTALLED"
fi
