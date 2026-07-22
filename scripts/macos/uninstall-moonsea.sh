#!/bin/zsh

set -euo pipefail

INSTALL_ROOT="${MOONSEA_INSTALL_ROOT:-$HOME/Library/Application Support/MoonseaCodex}"
APPLICATIONS_DIR="${MOONSEA_APPLICATIONS_DIR:-$HOME/Applications}"
DESKTOP_DIR="${MOONSEA_DESKTOP_DIR:-$HOME/Desktop}"
LAUNCHER_APP="$APPLICATIONS_DIR/Codex 月海版.app"
DESKTOP_LAUNCHER="$DESKTOP_DIR/Codex 月海版.app"
REMOVE_USER_DATA="${MOONSEA_REMOVE_USER_DATA:-0}"
MANAGER_PID_PATH="$INSTALL_ROOT/manager.pid"

if [[ "${INSTALL_ROOT:t}" != "MoonseaCodex" ]]; then
  echo "错误：拒绝卸载非 MoonseaCodex 目录：$INSTALL_ROOT" >&2
  exit 1
fi

if [[ -z "${MOONSEA_NONINTERACTIVE:-}" && "$REMOVE_USER_DATA" != "1" ]]; then
  echo "是否同时删除月海版的登录、壁纸和设置？"
  read "ANSWER?输入 Y 完全删除，直接回车则保留："
  [[ "$ANSWER" == [Yy] ]] && REMOVE_USER_DATA=1
fi

if /usr/bin/pgrep -f "$INSTALL_ROOT/builds/Moonsea-Codex-" >/dev/null 2>&1; then
  echo "错误：请先关闭 Codex 月海版，再重新运行卸载脚本。" >&2
  exit 1
fi

if [[ -f "$MANAGER_PID_PATH" ]]; then
  MANAGER_PID="$(/bin/cat "$MANAGER_PID_PATH")"
  if [[ "$MANAGER_PID" =~ ^[0-9]+$ ]]; then
    MANAGER_COMMAND="$(/bin/ps -p "$MANAGER_PID" -o command= 2>/dev/null || true)"
    if [[ "$MANAGER_COMMAND" == *"$INSTALL_ROOT"* ]]; then
      /bin/kill "$MANAGER_PID" 2>/dev/null || true
    fi
  fi
fi

[[ ! -L "$DESKTOP_LAUNCHER" ]] || /bin/rm -- "$DESKTOP_LAUNCHER"
[[ ! -d "$LAUNCHER_APP" ]] || /bin/rm -rf -- "$LAUNCHER_APP"

if [[ -d "$INSTALL_ROOT" ]]; then
  if [[ "$REMOVE_USER_DATA" == "1" ]]; then
    /bin/rm -rf -- "$INSTALL_ROOT"
  else
    /bin/rm -rf -- \
      "$INSTALL_ROOT/builds" \
      "$INSTALL_ROOT/releases" \
      "$INSTALL_ROOT/updates" \
      "$INSTALL_ROOT/install.plist" \
      "$INSTALL_ROOT/Start-Moonsea-macOS.command" \
      "$INSTALL_ROOT/MoonseaManager" \
      "$INSTALL_ROOT/MoonseaManager.mjs" \
      "$INSTALL_ROOT/manager.pid" \
      "$INSTALL_ROOT/manager.log" \
      "$INSTALL_ROOT/site"
  fi
fi

echo "卸载完成。官方 Codex 没有被修改。"
if [[ "$REMOVE_USER_DATA" != "1" ]]; then
  echo "月海版的登录、壁纸和设置已保留。"
fi
