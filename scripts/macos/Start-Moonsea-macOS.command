#!/bin/zsh

set -euo pipefail

INSTALL_ROOT="${MOONSEA_INSTALL_ROOT:-$HOME/Library/Application Support/MoonseaCodex}"
MANIFEST_PATH="$INSTALL_ROOT/install.plist"
BUILDS_ROOT="$INSTALL_ROOT/builds"

[[ -f "$MANIFEST_PATH" ]] || { echo "月海版安装信息不存在，请重新运行安装脚本。" >&2; exit 1; }
ACTIVE_BUILD="$(/usr/bin/plutil -extract activeBuild raw -o - "$MANIFEST_PATH")"
PROFILE_PATH="$(/usr/bin/plutil -extract profilePath raw -o - "$MANIFEST_PATH")"
MANAGER_PATH="$(/usr/bin/plutil -extract managerPath raw -o - "$MANIFEST_PATH")"
case "$ACTIVE_BUILD" in
  "$BUILDS_ROOT"/Moonsea-Codex-*.app) ;;
  *) echo "安装信息中的应用路径无效。" >&2; exit 1 ;;
esac
[[ -d "$ACTIVE_BUILD" ]] || { echo "月海版应用不存在，请重新运行安装脚本。" >&2; exit 1; }
[[ -f "$MANAGER_PATH" ]] || { echo "月海助手不存在，请重新运行安装脚本。" >&2; exit 1; }
/bin/mkdir -p "$PROFILE_PATH"

RUNNING_MOONSEA="$(/bin/ps ax -o pid=,command= | /usr/bin/grep -F "$BUILDS_ROOT/Moonsea-Codex-" | /usr/bin/grep -v grep || true)"
STALE_MOONSEA="$(print -r -- "$RUNNING_MOONSEA" | /usr/bin/grep -Fv "$ACTIVE_BUILD" || true)"
if [[ -n "$STALE_MOONSEA" ]]; then
  CHOICE="$(/usr/bin/osascript <<'APPLESCRIPT'
button returned of (display dialog "检测到旧版 Codex 月海版正在运行。\n\n关闭旧版后才能启动新的主题连接。未保存的任务请先保存。" with title "Codex 月海版需要重启" buttons {"暂不", "关闭旧版并打开新版"} default button "关闭旧版并打开新版" with icon note)
APPLESCRIPT
)"
  [[ "$CHOICE" == "关闭旧版并打开新版" ]] || exit 0
  print -r -- "$RUNNING_MOONSEA" | while read -r PROCESS_ID _; do
    [[ -z "$PROCESS_ID" ]] || /bin/kill -9 "$PROCESS_ID" 2>/dev/null || true
  done
  for ATTEMPT in {1..30}; do
    REMAINING_MOONSEA="$(/bin/ps ax -o command= | /usr/bin/grep -F "$BUILDS_ROOT/Moonsea-Codex-" | /usr/bin/grep -v grep || true)"
    [[ -z "$REMAINING_MOONSEA" ]] && break
    /bin/sleep 0.1
  done
fi

/bin/rm -f -- "$PROFILE_PATH/DevToolsActivePort"
/usr/bin/open -na "$ACTIVE_BUILD" --args \
  "--user-data-dir=$PROFILE_PATH" \
  "--remote-debugging-address=127.0.0.1" \
  "--remote-debugging-port=0"
if [[ "$MANAGER_PATH" == *.mjs ]]; then
  /usr/bin/nohup /usr/bin/env node "$MANAGER_PATH" \
    --install-root "$INSTALL_ROOT" --profile-path "$PROFILE_PATH" \
    >"$INSTALL_ROOT/manager.log" 2>&1 &
else
  /usr/bin/nohup "$MANAGER_PATH" \
    --install-root "$INSTALL_ROOT" --profile-path "$PROFILE_PATH" \
    >"$INSTALL_ROOT/manager.log" 2>&1 &
fi
