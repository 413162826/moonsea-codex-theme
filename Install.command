#!/bin/zsh

SCRIPT_DIR="${0:A:h}"
export MOONSEA_SKIP_LAUNCH=1
/bin/zsh "$SCRIPT_DIR/scripts/macos/install-moonsea.sh"
STATUS=$?
echo
if [[ $STATUS -ne 0 ]]; then
  echo "安装没有完成，请查看上面的错误信息。"
fi
if [[ -t 0 ]]; then
  echo
  read "?按回车关闭窗口。"
fi
exit $STATUS
