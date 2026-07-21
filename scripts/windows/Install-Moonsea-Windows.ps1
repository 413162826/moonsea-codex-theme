[CmdletBinding()]
param(
    [string]$SourceApp,
    [string]$InstallRoot,
    [string]$DesktopPath,
    [string]$BuilderPath,
    [switch]$SkipShortcut,
    [switch]$SkipLaunch
)

$ErrorActionPreference = "Stop"

function Get-FullPath([string]$Path) {
    return [System.IO.Path]::GetFullPath($Path)
}

function Assert-ChildPath([string]$Path, [string]$Parent, [string]$Label) {
    $fullPath = Get-FullPath $Path
    $fullParent = (Get-FullPath $Parent).TrimEnd([System.IO.Path]::DirectorySeparatorChar)
    if (-not $fullPath.StartsWith($fullParent + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "$Label is outside the allowed directory: $fullPath"
    }
}

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent (Split-Path -Parent $scriptRoot)
if ([string]::IsNullOrWhiteSpace($InstallRoot)) {
    $InstallRoot = if ($env:MOONSEA_INSTALL_ROOT) { $env:MOONSEA_INSTALL_ROOT } else { Join-Path $env:LOCALAPPDATA "MoonseaCodex" }
}
if ([string]::IsNullOrWhiteSpace($DesktopPath)) {
    $DesktopPath = if ($env:MOONSEA_DESKTOP_PATH) { $env:MOONSEA_DESKTOP_PATH } else { [Environment]::GetFolderPath("Desktop") }
}
if ([string]::IsNullOrWhiteSpace($BuilderPath)) {
    $BuilderPath = Join-Path $projectRoot "tools\moonsea-builder.exe"
}

$InstallRoot = Get-FullPath $InstallRoot
$DesktopPath = Get-FullPath $DesktopPath
$BuilderPath = Get-FullPath $BuilderPath
$buildsRoot = Join-Path $InstallRoot "builds"
$profilePath = Join-Path $InstallRoot "BrowserProfile"
$manifestPath = Join-Path $InstallRoot "install.json"
$installedLauncherPath = Join-Path $InstallRoot "Start-Moonsea-Windows.ps1"
$launcherSourcePath = Join-Path $scriptRoot "Start-Moonsea-Windows.ps1"

if (-not (Test-Path -LiteralPath $BuilderPath -PathType Leaf)) {
    throw "Windows builder not found. Download and fully extract the Windows package from GitHub Releases."
}
if (-not (Test-Path -LiteralPath $launcherSourcePath -PathType Leaf)) {
    throw "Launcher script is missing: $launcherSourcePath"
}

function Invoke-MoonseaBuilder([string[]]$Arguments, [switch]$Capture) {
    if ([System.IO.Path]::GetExtension($BuilderPath) -eq ".mjs") {
        $output = & node $BuilderPath @Arguments
    }
    else {
        $output = & $BuilderPath @Arguments
    }
    if ($LASTEXITCODE -ne 0) {
        throw "Moonsea builder failed with exit code $LASTEXITCODE"
    }
    if ($Capture) { return @($output) }
    $output | ForEach-Object { Write-Host $_ }
}

function Find-OfficialCodexApp {
    if (-not [string]::IsNullOrWhiteSpace($SourceApp)) {
        return [pscustomobject]@{ Path = (Get-FullPath $SourceApp); Version = $null }
    }
    if ($env:MOONSEA_SOURCE_APP) {
        return [pscustomobject]@{ Path = (Get-FullPath $env:MOONSEA_SOURCE_APP); Version = $null }
    }

    $packages = @()
    $namedPackage = Get-AppxPackage -Name OpenAI.Codex -ErrorAction SilentlyContinue
    if ($null -ne $namedPackage) { $packages += $namedPackage }
    if ($packages.Count -eq 0) {
        $packages += Get-AppxPackage | Where-Object {
            $_.Name -match "OpenAI|ChatGPT|Codex"
        }
    }
    foreach ($package in $packages | Sort-Object Version -Descending -Unique) {
        $candidate = Join-Path $package.InstallLocation "app"
        if (Test-Path -LiteralPath (Join-Path $candidate "resources\app.asar") -PathType Leaf) {
            return [pscustomobject]@{ Path = $candidate; Version = [string]$package.Version }
        }
    }
    throw "Official Codex was not found. Install and open the official app once, then retry."
}

function Get-AppVersion([string]$AppPath, [string]$DetectedVersion) {
    $version = $DetectedVersion
    if ([string]::IsNullOrWhiteSpace($version)) {
        $executable = Join-Path $AppPath "ChatGPT.exe"
        if (Test-Path -LiteralPath $executable -PathType Leaf) {
            $version = (Get-Item -LiteralPath $executable).VersionInfo.ProductVersion
        }
    }
    if ([string]::IsNullOrWhiteSpace($version)) { $version = "unknown" }
    return [regex]::Replace($version, "[^A-Za-z0-9._-]", "-")
}

$official = Find-OfficialCodexApp
$SourceApp = Get-FullPath $official.Path
if (-not (Test-Path -LiteralPath (Join-Path $SourceApp "resources\app.asar") -PathType Leaf)) {
    throw "The selected directory is not a valid official Codex app: $SourceApp"
}

$themeVersionOutput = Invoke-MoonseaBuilder -Arguments @("--theme-version") -Capture
$themeVersion = ($themeVersionOutput | Select-Object -Last 1).Trim()
if ($themeVersion -notmatch "^[a-f0-9]{12}$") {
    throw "Could not read the theme version: $themeVersion"
}
$officialVersion = Get-AppVersion $SourceApp $official.Version
$buildName = "Moonsea-Codex-$officialVersion-$themeVersion"
$activeBuild = Join-Path $buildsRoot $buildName
$stagingBuild = Join-Path $buildsRoot "$buildName-staging"
Assert-ChildPath $activeBuild $buildsRoot "Active build"
Assert-ChildPath $stagingBuild $buildsRoot "Staging build"

New-Item -ItemType Directory -Path $InstallRoot -Force | Out-Null
New-Item -ItemType Directory -Path $buildsRoot -Force | Out-Null
New-Item -ItemType Directory -Path $profilePath -Force | Out-Null

$needsBuild = $true
if (Test-Path -LiteralPath $activeBuild -PathType Container) {
    try {
        Invoke-MoonseaBuilder -Arguments @("--verify", $activeBuild)
        $needsBuild = $false
        Write-Host "This version is already installed. Refreshing the launcher..."
    }
    catch {
        Remove-Item -LiteralPath $activeBuild -Recurse -Force
    }
}

if ($needsBuild) {
    if (Test-Path -LiteralPath $stagingBuild) {
        Remove-Item -LiteralPath $stagingBuild -Recurse -Force
    }
    New-Item -ItemType Directory -Path $stagingBuild | Out-Null
    Write-Host "Copying the official app..."
    & robocopy $SourceApp $stagingBuild /E /COPY:DAT /DCOPY:DAT /R:2 /W:1 /NFL /NDL /NJH /NJS /NP | Out-Null
    $robocopyExit = $LASTEXITCODE
    if ($robocopyExit -ge 8) {
        Remove-Item -LiteralPath $stagingBuild -Recurse -Force -ErrorAction SilentlyContinue
        throw "Could not copy the official app. Robocopy exit code: $robocopyExit"
    }
    try {
        Invoke-MoonseaBuilder -Arguments @("--patch", $stagingBuild)
        Move-Item -LiteralPath $stagingBuild -Destination $activeBuild
    }
    catch {
        if (Test-Path -LiteralPath $stagingBuild) {
            Remove-Item -LiteralPath $stagingBuild -Recurse -Force -ErrorAction SilentlyContinue
        }
        throw
    }
}

$installedAt = (Get-Date).ToUniversalTime().ToString("o")
if (Test-Path -LiteralPath $manifestPath -PathType Leaf) {
    try {
        $previousManifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($previousManifest.installedAt) { $installedAt = [string]$previousManifest.installedAt }
    }
    catch { }
}
$manifest = [ordered]@{
    schemaVersion = 1
    platform = "windows"
    themeVersion = $themeVersion
    officialVersion = $officialVersion
    sourceApp = $SourceApp
    activeBuild = $activeBuild
    profilePath = $profilePath
    installedAt = $installedAt
    updatedAt = (Get-Date).ToUniversalTime().ToString("o")
}
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($manifestPath, ($manifest | ConvertTo-Json -Depth 4), $utf8NoBom)
Copy-Item -LiteralPath $launcherSourcePath -Destination $installedLauncherPath -Force

if (-not $SkipShortcut -and -not $env:MOONSEA_SKIP_SHORTCUT) {
    New-Item -ItemType Directory -Path $DesktopPath -Force | Out-Null
    $shortcutName = "Codex " + [char]0x6708 + [char]0x6D77 + [char]0x7248 + ".lnk"
    $shortcutPath = Join-Path $DesktopPath $shortcutName
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
    $shortcut.Arguments = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$installedLauncherPath`""
    $shortcut.WorkingDirectory = $InstallRoot
    $shortcut.IconLocation = "$(Join-Path $activeBuild 'ChatGPT.exe'),0"
    $shortcut.Save()
}

Write-Host ""
Write-Host "Moonsea Codex installation completed."
Write-Host "Run this installer again whenever a theme update is available."

if (-not $SkipLaunch -and -not $env:MOONSEA_SKIP_LAUNCH) {
    & $installedLauncherPath
}
