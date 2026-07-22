#!/bin/zsh

set -euo pipefail

INSTALL_ROOT=""
PACKAGE_PATH=""
MANAGER_PID=""
CURRENT_VERSION=""
TARGET_VERSION=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --install-root) INSTALL_ROOT="$2"; shift 2 ;;
    --package-path) PACKAGE_PATH="$2"; shift 2 ;;
    --manager-pid) MANAGER_PID="$2"; shift 2 ;;
    --current-version) CURRENT_VERSION="$2"; shift 2 ;;
    --target-version) TARGET_VERSION="$2"; shift 2 ;;
    *) print -u2 -- "Unknown updater argument: $1"; exit 1 ;;
  esac
done

fail() {
  print -u2 -- "Moonsea update failed: $1"
  exit 1
}

[[ -n "$INSTALL_ROOT" && -n "$PACKAGE_PATH" && -n "$MANAGER_PID" ]] || fail "required arguments are missing"
[[ "$CURRENT_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[A-Za-z0-9.-]+)?$ ]] || fail "current version is invalid"
[[ "$TARGET_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[A-Za-z0-9.-]+)?$ ]] || fail "target version is invalid"

INSTALL_ROOT="${INSTALL_ROOT:A}"
PACKAGE_PATH="${PACKAGE_PATH:A}"
UPDATES_ROOT="$INSTALL_ROOT/updates"
BUILDS_ROOT="$INSTALL_ROOT/builds"
MANIFEST_PATH="$INSTALL_ROOT/install.plist"
LAUNCHER_PATH="$INSTALL_ROOT/Start-Moonsea-macOS.command"
EXTRACT_ROOT="$UPDATES_ROOT/extract-$TARGET_VERSION"
ROLLBACK_ROOT="$UPDATES_ROOT/rollback-$CURRENT_VERSION-to-$TARGET_VERSION"
LOG_PATH="$UPDATES_ROOT/update.log"
MANAGER_PORT="${MOONSEA_MANAGER_PORT:-17321}"

case "$PACKAGE_PATH" in "$UPDATES_ROOT"/*) ;; *) fail "package path is outside the update directory" ;; esac
case "$EXTRACT_ROOT" in "$UPDATES_ROOT"/*) ;; *) fail "extraction path is outside the update directory" ;; esac
[[ -f "$PACKAGE_PATH" ]] || fail "downloaded package is missing"
[[ -f "$MANIFEST_PATH" ]] || fail "installation manifest is missing"
/bin/mkdir -p "$UPDATES_ROOT"
exec >>"$LOG_PATH" 2>&1

stop_manager() {
  local pid_path="$INSTALL_ROOT/manager.pid"
  [[ -f "$pid_path" ]] || return 0
  local pid="$(/bin/cat "$pid_path")"
  if [[ "$pid" =~ ^[0-9]+$ ]]; then
    local command="$(/bin/ps -p "$pid" -o command= 2>/dev/null || true)"
    [[ "$command" != *"$INSTALL_ROOT"* ]] || /bin/kill -9 "$pid" 2>/dev/null || true
  fi
  /bin/rm -f -- "$pid_path"
}

stop_moonsea_app() {
  local processes="$(/bin/ps ax -o pid=,command= | /usr/bin/grep -F "$BUILDS_ROOT/Moonsea-Codex-" | /usr/bin/grep -v grep || true)"
  if [[ -n "$processes" ]]; then
    print -r -- "$processes" | while read -r process_id _; do
      [[ -z "$process_id" ]] || /bin/kill -9 "$process_id" 2>/dev/null || true
    done
  fi
  for attempt in {1..50}; do
    local remaining="$(/bin/ps ax -o command= | /usr/bin/grep -F "$BUILDS_ROOT/Moonsea-Codex-" | /usr/bin/grep -v grep || true)"
    [[ -z "$remaining" ]] && return 0
    /bin/sleep 0.1
  done
  print -u2 -- "The previous Moonsea app did not close in time."
  return 1
}

wait_for_manager() {
  local health_attempts="${MOONSEA_UPDATE_HEALTH_ATTEMPTS:-120}"
  for ((attempt = 1; attempt <= health_attempts; attempt++)); do
    local response="$(/usr/bin/curl -fsS --max-time 1 "http://127.0.0.1:$MANAGER_PORT/api/status" 2>/dev/null || true)"
    local version="$(print -r -- "$response" | /usr/bin/sed -nE 's/.*"appVersion":"([^"]+)".*/\1/p')"
    [[ "$version" == "$TARGET_VERSION" ]] && return 0
    /bin/sleep 0.25
  done
  return 1
}

restore_previous() {
  stop_manager
  [[ ! -f "$ROLLBACK_ROOT/install.plist" ]] || /bin/cp "$ROLLBACK_ROOT/install.plist" "$MANIFEST_PATH"
  [[ ! -f "$ROLLBACK_ROOT/Start-Moonsea-macOS.command" ]] || {
    /bin/cp "$ROLLBACK_ROOT/Start-Moonsea-macOS.command" "$LAUNCHER_PATH"
    /bin/chmod +x "$LAUNCHER_PATH"
  }
  if [[ -f "$LAUNCHER_PATH" ]]; then
    /usr/bin/nohup /bin/zsh "$LAUNCHER_PATH" >/dev/null 2>&1 &
  fi
}

cleanup_old_directories() {
  local root="$1"
  local keep_a="$2"
  local keep_b="$3"
  [[ -d "$root" ]] || return 0
  for directory in "$root"/*(N/); do
    [[ "$directory" == "$keep_a" || "$directory" == "$keep_b" ]] || /bin/rm -rf -- "$directory"
  done
}

for attempt in {1..50}; do
  /bin/kill -0 "$MANAGER_PID" 2>/dev/null || break
  /bin/sleep 0.1
done
stop_manager

/bin/rm -rf -- "$ROLLBACK_ROOT"
/bin/mkdir -p "$ROLLBACK_ROOT"
/bin/cp "$MANIFEST_PATH" "$ROLLBACK_ROOT/install.plist"
[[ ! -f "$LAUNCHER_PATH" ]] || /bin/cp "$LAUNCHER_PATH" "$ROLLBACK_ROOT/Start-Moonsea-macOS.command"
PREVIOUS_RELEASE="$(/usr/bin/plutil -extract releasePath raw -o - "$MANIFEST_PATH" 2>/dev/null || true)"
PREVIOUS_BUILD="$(/usr/bin/plutil -extract activeBuild raw -o - "$MANIFEST_PATH" 2>/dev/null || true)"
SOURCE_APP="$(/usr/bin/plutil -extract sourceApp raw -o - "$MANIFEST_PATH")"

perform_update() {
  stop_moonsea_app || return 1
  /bin/rm -rf -- "$EXTRACT_ROOT"
  /bin/mkdir -p "$EXTRACT_ROOT" || return 1
  /usr/bin/ditto -x -k "$PACKAGE_PATH" "$EXTRACT_ROOT" || return 1

  PACKAGE_ROOT=""
  if [[ -f "$EXTRACT_ROOT/scripts/macos/install-moonsea.sh" ]]; then
    PACKAGE_ROOT="$EXTRACT_ROOT"
  else
    for candidate in "$EXTRACT_ROOT"/*(N/); do
      if [[ -f "$candidate/scripts/macos/install-moonsea.sh" ]]; then
        PACKAGE_ROOT="$candidate"
        break
      fi
    done
  fi
  if [[ -z "$PACKAGE_ROOT" ]]; then
    print -u2 -- "The package does not contain a macOS installer."
    return 1
  fi

  MOONSEA_INSTALL_ROOT="$INSTALL_ROOT" MOONSEA_SOURCE_APP="$SOURCE_APP" MOONSEA_SKIP_LAUNCH=1 \
    /bin/zsh "$PACKAGE_ROOT/scripts/macos/install-moonsea.sh" || return 1
  /usr/bin/nohup /bin/zsh "$LAUNCHER_PATH" >/dev/null 2>&1 &
  wait_for_manager || return 1
}

if perform_update; then
  CURRENT_RELEASE="$(/usr/bin/plutil -extract releasePath raw -o - "$MANIFEST_PATH")"
  CURRENT_BUILD="$(/usr/bin/plutil -extract activeBuild raw -o - "$MANIFEST_PATH")"
  cleanup_old_directories "$INSTALL_ROOT/releases" "$PREVIOUS_RELEASE" "$CURRENT_RELEASE"
  cleanup_old_directories "$BUILDS_ROOT" "$PREVIOUS_BUILD" "$CURRENT_BUILD"
  /bin/rm -rf -- "$EXTRACT_ROOT"
  /bin/rm -f -- "$PACKAGE_PATH"
  print -r -- "Moonsea update completed: $CURRENT_VERSION -> $TARGET_VERSION"
else
  restore_previous
  if [[ -z "${MOONSEA_NONINTERACTIVE:-}" ]]; then
    /usr/bin/osascript -e 'display dialog "月海更新没有完成，已经恢复到上一版本。请稍后重试。" with title "月海更新失败" buttons {"知道了"} default button "知道了" with icon caution' >/dev/null 2>&1 || true
  fi
  exit 1
fi
