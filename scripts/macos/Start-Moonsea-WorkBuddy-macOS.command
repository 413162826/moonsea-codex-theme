#!/bin/zsh

set -euo pipefail

export MOONSEA_CLIENT="workbuddy"
export MOONSEA_MANAGER_PORT="17322"

INSTALL_ROOT="${MOONSEA_INSTALL_ROOT:-$HOME/Library/Application Support/MoonseaWorkBuddy}"
MANIFEST_PATH="$INSTALL_ROOT/install.plist"
BUILDS_ROOT="$INSTALL_ROOT/builds"

fail() {
  print -u2 -- "错误：$1"
  exit 1
}

[[ -f "$MANIFEST_PATH" ]] || fail "月海版安装信息不存在，请重新运行安装脚本。"
CLIENT="$(/usr/bin/plutil -extract client raw -o - "$MANIFEST_PATH" 2>/dev/null || true)"
[[ "$CLIENT" == "workbuddy" ]] || fail "安装信息不属于 WorkBuddy 月海版。"
ACTIVE_BUILD="$(/usr/bin/plutil -extract activeBuild raw -o - "$MANIFEST_PATH")"
PROFILE_PATH="$(/usr/bin/plutil -extract profilePath raw -o - "$MANIFEST_PATH")"
CONFIG_PATH="$(/usr/bin/plutil -extract configPath raw -o - "$MANIFEST_PATH")"
MANAGER_PATH="$(/usr/bin/plutil -extract managerPath raw -o - "$MANIFEST_PATH")"
APP_EXECUTABLE="$ACTIVE_BUILD/Contents/MacOS/WorkBuddy"
DEVTOOLS_PORT_PATH="$PROFILE_PATH/DevToolsActivePort"
CDP_PORT="${MOONSEA_CDP_PORT:-17323}"

case "$ACTIVE_BUILD" in
  "$BUILDS_ROOT"/Moonsea-WorkBuddy-*.app) ;;
  *) fail "安装信息中的应用路径无效。" ;;
esac
[[ -x "$APP_EXECUTABLE" ]] || fail "WorkBuddy 月海版不存在，请重新运行安装脚本。"
[[ -f "$MANAGER_PATH" ]] || fail "月海助手不存在，请重新运行安装脚本。"
[[ "$CDP_PORT" =~ ^[0-9]+$ && "$CDP_PORT" -ge 1 && "$CDP_PORT" -le 65535 ]] \
  || fail "WorkBuddy 调试端口无效。"
/bin/mkdir -p "$PROFILE_PATH" "$CONFIG_PATH"

moonsea_processes() {
  /bin/ps ax -o pid=,command= \
    | /usr/bin/grep -F "$BUILDS_ROOT/Moonsea-WorkBuddy-" \
    | /usr/bin/grep -v grep \
    || true
}

active_main_pid() {
  /bin/ps ax -o pid=,command= \
    | /usr/bin/grep -F "$APP_EXECUTABLE" \
    | /usr/bin/grep -v -- "--type=" \
    | /usr/bin/awk -v executable="$APP_EXECUTABLE" '
        {
          pid=$1
          $1=""
          sub(/^[[:space:]]+/, "", $0)
          if ($0 == executable) {
            print pid
            exit
          }
        }
      '
}

renderer_ready() {
  /usr/bin/curl -fsS --max-time 1 "http://127.0.0.1:$CDP_PORT/json/list" 2>/dev/null \
    | /usr/bin/grep -q '/renderer/index\.html'
}

stop_moonsea() {
  local processes="$1"
  print -r -- "$processes" | while read -r process_id _; do
    [[ -z "$process_id" ]] || /bin/kill -9 "$process_id" 2>/dev/null || true
  done
  for attempt in {1..50}; do
    [[ -z "$(moonsea_processes)" ]] && return 0
    /bin/sleep 0.1
  done
  fail "旧版 WorkBuddy 月海版没有及时关闭。"
}

RUNNING_MOONSEA="$(moonsea_processes)"
APP_PID="${MOONSEA_APP_PID:-$(active_main_pid)}"
if [[ -n "${MOONSEA_APP_PID:-}" ]]; then
  [[ "$APP_PID" =~ ^[0-9]+$ ]] && /bin/kill -0 "$APP_PID" 2>/dev/null \
    || fail "MOONSEA_APP_PID 没有指向正在运行的进程。"
fi
STORED_PORT=""
if [[ -f "$DEVTOOLS_PORT_PATH" ]]; then
  STORED_PORT="$(/usr/bin/head -n 1 "$DEVTOOLS_PORT_PATH")"
fi
NEEDS_RESTART=0
[[ -z "$RUNNING_MOONSEA" ]] || {
  [[ "$RUNNING_MOONSEA" != *"$ACTIVE_BUILD"* ]] && NEEDS_RESTART=1
  [[ "$STORED_PORT" != "$CDP_PORT" ]] && NEEDS_RESTART=1
  renderer_ready || NEEDS_RESTART=1
}
[[ -z "${MOONSEA_FORCE_RESTART:-}" ]] || NEEDS_RESTART=1

if [[ $NEEDS_RESTART -eq 1 && -n "$RUNNING_MOONSEA" ]]; then
  if [[ -z "${MOONSEA_FORCE_RESTART:-}" ]]; then
    CHOICE="$(/usr/bin/osascript <<'APPLESCRIPT'
button returned of (display dialog "检测到旧版 WorkBuddy 月海版正在运行。\n\n关闭旧版后才能启动新的主题连接。未保存的任务请先保存。" with title "WorkBuddy 月海版需要重启" buttons {"暂不", "关闭旧版并打开新版"} default button "关闭旧版并打开新版" with icon note)
APPLESCRIPT
)"
    [[ "$CHOICE" == "关闭旧版并打开新版" ]] || exit 0
  fi
  stop_moonsea "$RUNNING_MOONSEA"
  APP_PID=""
fi

if [[ -z "$APP_PID" && -z "${MOONSEA_SKIP_APP_LAUNCH:-}" ]]; then
  if /usr/sbin/lsof -nP -iTCP:"$CDP_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    fail "WorkBuddy 调试端口 $CDP_PORT 已被其他程序占用。"
  fi
  /bin/rm -f -- "$DEVTOOLS_PORT_PATH"
  (
    cd "$ACTIVE_BUILD/Contents/MacOS"
    WORKBUDDY_REMOTE_DEBUGGING_PORT="$CDP_PORT" \
    WORKBUDDY_USER_DATA_DIR="$PROFILE_PATH" \
    WORKBUDDY_CONFIG_DIR="$CONFIG_PATH" \
      /usr/bin/nohup "$APP_EXECUTABLE" >"$INSTALL_ROOT/workbuddy.log" 2>&1 &
  )
  for attempt in {1..100}; do
    APP_PID="$(active_main_pid)"
    [[ -z "$APP_PID" ]] || break
    /bin/sleep 0.1
  done
fi
[[ "$APP_PID" =~ ^[0-9]+$ ]] || fail "WorkBuddy 月海版没有成功启动，助手不会驻留后台。"

for attempt in {1..240}; do
  if renderer_ready; then
    print -r -- "$CDP_PORT" >"$DEVTOOLS_PORT_PATH"
    break
  fi
  /bin/sleep 0.25
done
renderer_ready || fail "WorkBuddy 已启动，但主题连接没有准备好。"

if [[ "$MANAGER_PATH" == *.mjs ]]; then
  /usr/bin/nohup /usr/bin/env node "$MANAGER_PATH" \
    --install-root "$INSTALL_ROOT" --profile-path "$PROFILE_PATH" --app-pid "$APP_PID" \
    >"$INSTALL_ROOT/manager.log" 2>&1 &
else
  /usr/bin/nohup "$MANAGER_PATH" \
    --install-root "$INSTALL_ROOT" --profile-path "$PROFILE_PATH" --app-pid "$APP_PID" \
    >"$INSTALL_ROOT/manager.log" 2>&1 &
fi
