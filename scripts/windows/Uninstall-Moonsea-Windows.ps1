[CmdletBinding()]
param(
    [string]$InstallRoot,
    [string]$DesktopPath,
    [switch]$RemoveUserData,
    [switch]$NonInteractive
)

$ErrorActionPreference = "Stop"
if ([string]::IsNullOrWhiteSpace($InstallRoot)) {
    $InstallRoot = if ($env:MOONSEA_INSTALL_ROOT) { $env:MOONSEA_INSTALL_ROOT } else { Join-Path $env:LOCALAPPDATA "MoonseaCodex" }
}
if ([string]::IsNullOrWhiteSpace($DesktopPath)) {
    $DesktopPath = if ($env:MOONSEA_DESKTOP_PATH) { $env:MOONSEA_DESKTOP_PATH } else { [Environment]::GetFolderPath("Desktop") }
}
$InstallRoot = [System.IO.Path]::GetFullPath($InstallRoot)
$DesktopPath = [System.IO.Path]::GetFullPath($DesktopPath)
if ([System.IO.Path]::GetFileName($InstallRoot) -ne "MoonseaCodex") {
    throw "Refusing to uninstall a non-MoonseaCodex directory: $InstallRoot"
}

if (-not $NonInteractive -and -not $RemoveUserData) {
    $answer = Read-Host "Also remove Moonsea login, wallpaper, and settings? Type Y to remove them, or press Enter to keep them"
    $RemoveUserData = $answer -match "^[Yy]$"
}

$buildsRoot = Join-Path $InstallRoot "builds"
$running = @(Get-CimInstance Win32_Process -Filter "Name = 'ChatGPT.exe'" -ErrorAction SilentlyContinue | Where-Object {
    $_.ExecutablePath -and $_.ExecutablePath.StartsWith($buildsRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)
})
if ($running.Count -gt 0) {
    throw "Close Moonsea Codex, then run the uninstaller again."
}

$shortcutName = "Codex " + [char]0x6708 + [char]0x6D77 + [char]0x7248 + ".lnk"
$shortcutPath = Join-Path $DesktopPath $shortcutName
if (Test-Path -LiteralPath $shortcutPath) {
    Remove-Item -LiteralPath $shortcutPath -Force
}

if (Test-Path -LiteralPath $InstallRoot -PathType Container) {
    if ($RemoveUserData) {
        Remove-Item -LiteralPath $InstallRoot -Recurse -Force
    }
    else {
        foreach ($name in @("builds", "install.json", "Start-Moonsea-Windows.ps1")) {
            $target = Join-Path $InstallRoot $name
            if (Test-Path -LiteralPath $target) {
                Remove-Item -LiteralPath $target -Recurse -Force
            }
        }
    }
}

Write-Host "Moonsea Codex was removed. The official app was not changed."
if (-not $RemoveUserData) {
    Write-Host "Moonsea login, wallpaper, and settings were kept."
}
