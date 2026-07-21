#!/bin/zsh

SCRIPT_DIR="${0:A:h}"
/bin/zsh "$SCRIPT_DIR/scripts/macos/install-moonsea.sh"
STATUS=$?
if [[ $STATUS -ne 0 && -t 0 ]]; then
  echo
  read "?安装没有完成。按回车关闭窗口。"
fi
exit $STATUS
