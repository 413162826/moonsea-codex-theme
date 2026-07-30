@echo off
setlocal
chcp 65001 >nul
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\Uninstall-Moonsea-WorkBuddy-Windows.ps1"
set "MOONSEA_EXIT=%ERRORLEVEL%"
if not defined MOONSEA_NONINTERACTIVE pause >nul
exit /b %MOONSEA_EXIT%
