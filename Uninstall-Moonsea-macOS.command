#!/bin/zsh

SCRIPT_DIR="${0:A:h}"
/bin/zsh "$SCRIPT_DIR/scripts/macos/uninstall-moonsea.sh"
STATUS=$?
if [[ -t 0 ]]; then
  echo
  read "?按回车关闭窗口。"
fi
exit $STATUS
