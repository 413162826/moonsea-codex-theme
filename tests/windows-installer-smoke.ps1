[CmdletBinding()]
param(
    [string]$PackageRoot,
    [string]$BuilderPath
)

$ErrorActionPreference = "Stop"

$sourceRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
if ([string]::IsNullOrWhiteSpace($PackageRoot)) { $PackageRoot = $sourceRoot }
if ([string]::IsNullOrWhiteSpace($BuilderPath)) { $BuilderPath = Join-Path $PackageRoot "tools\moonsea-builder.mjs" }
$PackageRoot = [System.IO.Path]::GetFullPath($PackageRoot)
$BuilderPath = [System.IO.Path]::GetFullPath($BuilderPath)
$testRoot = Join-Path $sourceRoot ".build\windows-installer-smoke"
$sourceApp = Join-Path $testRoot "Official-Windows"
$installRoot = Join-Path $testRoot "MoonseaCodex"
$desktopPath = Join-Path $testRoot "Desktop"
$installer = Join-Path $PackageRoot "scripts\windows\Install-Moonsea-Windows.ps1"
$uninstaller = Join-Path $PackageRoot "scripts\windows\Uninstall-Moonsea-Windows.ps1"

function Invoke-TestBuilder([string[]]$Arguments) {
    if ([System.IO.Path]::GetExtension($BuilderPath) -eq ".mjs") {
        & node $BuilderPath @Arguments
    }
    else {
        & $BuilderPath @Arguments
    }
    if ($LASTEXITCODE -ne 0) { throw "Builder failed with exit code $LASTEXITCODE" }
}

if (Test-Path -LiteralPath $testRoot) {
    Remove-Item -LiteralPath $testRoot -Recurse -Force
}
New-Item -ItemType Directory -Path $testRoot | Out-Null
try {
    node (Join-Path $sourceRoot "tests\create-fixture.mjs") windows $sourceApp | Out-Null
    & $installer -SourceApp $sourceApp -InstallRoot $installRoot -DesktopPath $desktopPath -BuilderPath $BuilderPath -SkipShortcut -SkipLaunch
    $manifestPath = Join-Path $installRoot "install.json"
    if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) { throw "Manifest was not created" }
    $manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
    Invoke-TestBuilder -Arguments @("--verify", $manifest.activeBuild)
    & $uninstaller -InstallRoot $installRoot -DesktopPath $desktopPath -NonInteractive
    if (Test-Path -LiteralPath (Join-Path $installRoot "builds")) { throw "Default uninstall did not remove builds" }
    if (-not (Test-Path -LiteralPath (Join-Path $installRoot "BrowserProfile"))) { throw "Default uninstall did not preserve user data" }

    & $installer -SourceApp $sourceApp -InstallRoot $installRoot -DesktopPath $desktopPath -BuilderPath $BuilderPath -SkipShortcut -SkipLaunch
    & $uninstaller -InstallRoot $installRoot -DesktopPath $desktopPath -NonInteractive -RemoveUserData
    if (Test-Path -LiteralPath $installRoot) { throw "Full uninstall did not remove the install root" }
    Write-Host "Windows install, update, and uninstall smoke test passed"
}
finally {
    if (Test-Path -LiteralPath $testRoot) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force
    }
}
