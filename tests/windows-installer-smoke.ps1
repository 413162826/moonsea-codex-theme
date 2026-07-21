$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$testRoot = Join-Path $projectRoot ".build\windows-installer-smoke"
$sourceApp = Join-Path $testRoot "Official-Windows"
$installRoot = Join-Path $testRoot "MoonseaCodex"
$desktopPath = Join-Path $testRoot "Desktop"
$builder = Join-Path $projectRoot "tools\moonsea-builder.mjs"
$installer = Join-Path $projectRoot "scripts\windows\Install-Moonsea-Windows.ps1"
$uninstaller = Join-Path $projectRoot "scripts\windows\Uninstall-Moonsea-Windows.ps1"

if (Test-Path -LiteralPath $testRoot) {
    Remove-Item -LiteralPath $testRoot -Recurse -Force
}
New-Item -ItemType Directory -Path $testRoot | Out-Null
try {
    node (Join-Path $projectRoot "tests\create-fixture.mjs") windows $sourceApp | Out-Null
    & $installer -SourceApp $sourceApp -InstallRoot $installRoot -DesktopPath $desktopPath -BuilderPath $builder -SkipShortcut -SkipLaunch
    $manifestPath = Join-Path $installRoot "install.json"
    if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) { throw "Manifest was not created" }
    $manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
    node $builder --verify $manifest.activeBuild | Out-Null
    & $uninstaller -InstallRoot $installRoot -DesktopPath $desktopPath -NonInteractive
    if (Test-Path -LiteralPath (Join-Path $installRoot "builds")) { throw "Default uninstall did not remove builds" }
    if (-not (Test-Path -LiteralPath (Join-Path $installRoot "BrowserProfile"))) { throw "Default uninstall did not preserve user data" }

    & $installer -SourceApp $sourceApp -InstallRoot $installRoot -DesktopPath $desktopPath -BuilderPath $builder -SkipShortcut -SkipLaunch
    & $uninstaller -InstallRoot $installRoot -DesktopPath $desktopPath -NonInteractive -RemoveUserData
    if (Test-Path -LiteralPath $installRoot) { throw "Full uninstall did not remove the install root" }
    Write-Host "Windows install, update, and uninstall smoke test passed"
}
finally {
    if (Test-Path -LiteralPath $testRoot) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force
    }
}
