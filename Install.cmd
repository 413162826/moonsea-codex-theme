@echo off
chcp 65001 >nul
title 月海助手安装
echo 正在安装月海助手，请不要关闭窗口...
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\Install-Moonsea-Windows.ps1" -SkipLaunch
set "MOONSEA_EXIT=%ERRORLEVEL%"
echo.
if not "%MOONSEA_EXIT%"=="0" (
  echo 安装没有完成，请查看上面的错误信息。
)
echo.
pause
exit /b %MOONSEA_EXIT%
