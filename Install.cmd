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
) else (
  echo 安装完成，接下来只做两步：
  echo 1. 打开桌面的“Codex 月海版”
  echo 2. 回到月海主题官网，选择皮肤并点击“应用到 Codex”
)
echo.
pause
exit /b %MOONSEA_EXIT%
