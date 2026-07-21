@echo off
chcp 65001 >nul
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\Uninstall-Moonsea-Windows.ps1"
set "MOONSEA_EXIT=%ERRORLEVEL%"
echo.
if not "%MOONSEA_EXIT%"=="0" echo 卸载没有完成，请查看上面的错误信息。
pause
exit /b %MOONSEA_EXIT%
