[CmdletBinding()]
param(
    [string]$PackageRoot
)

$ErrorActionPreference = "Stop"
$sourceRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
if ([string]::IsNullOrWhiteSpace($PackageRoot)) { $PackageRoot = $sourceRoot }
$PackageRoot = [System.IO.Path]::GetFullPath($PackageRoot)
$testRoot = Join-Path $sourceRoot ".build\windows-updater-smoke"
$sourceApp = Join-Path $testRoot "Official-Windows"
$installRoot = Join-Path $testRoot "MoonseaCodex"
$desktopPath = Join-Path $testRoot "Desktop"
$legacyPackage = Join-Path $testRoot "legacy-package"
$updatePackage = Join-Path $testRoot "update-package"
$archivePath = Join-Path $installRoot "updates\Moonsea-Codex-test-Windows-x64.zip"
$expectedVersion = [string](Get-Content -LiteralPath (Join-Path $PackageRoot "package.json") -Raw -Encoding UTF8 | ConvertFrom-Json).version
$builderPath = if (Test-Path -LiteralPath (Join-Path $PackageRoot "tools\moonsea-builder.exe")) {
    Join-Path $PackageRoot "tools\moonsea-builder.exe"
}
else {
    Join-Path $PackageRoot "tools\moonsea-builder.mjs"
}
$managerPath = if (Test-Path -LiteralPath (Join-Path $PackageRoot "tools\moonsea-manager.exe")) {
    Join-Path $PackageRoot "tools\moonsea-manager.exe"
}
else {
    Join-Path $PackageRoot "tools\moonsea-manager.mjs"
}
$managerPort = 18321
$previousManagerPort = $env:MOONSEA_MANAGER_PORT
$previousNonInteractive = $env:MOONSEA_NONINTERACTIVE
$previousHealthAttempts = $env:MOONSEA_UPDATE_HEALTH_ATTEMPTS
$previousSkipShortcut = $env:MOONSEA_SKIP_SHORTCUT

function Stop-TestManager {
    $pidPath = Join-Path $installRoot "manager.pid"
    if (-not (Test-Path -LiteralPath $pidPath -PathType Leaf)) { return }
    $pidText = (Get-Content -LiteralPath $pidPath -Raw -Encoding UTF8).Trim()
    if ($pidText -match "^\d+$") { Stop-Process -Id ([int]$pidText) -Force -ErrorAction SilentlyContinue }
}

if (Test-Path -LiteralPath $testRoot) { Remove-Item -LiteralPath $testRoot -Recurse -Force }
New-Item -ItemType Directory -Path $testRoot -Force | Out-Null
try {
    node (Join-Path $sourceRoot "tests\create-fixture.mjs") windows $sourceApp | Out-Null
    Copy-Item -LiteralPath (Join-Path $env:SystemRoot "System32\where.exe") -Destination (Join-Path $sourceApp "ChatGPT.exe") -Force
    $env:MOONSEA_MANAGER_PORT = [string]$managerPort
    $env:MOONSEA_NONINTERACTIVE = "1"
    $env:MOONSEA_UPDATE_HEALTH_ATTEMPTS = "8"
    $env:MOONSEA_SKIP_SHORTCUT = "1"

    New-Item -ItemType Directory -Path (Join-Path $legacyPackage "scripts\windows") -Force | Out-Null
    Copy-Item -Path (Join-Path $PackageRoot "scripts\windows\*") -Destination (Join-Path $legacyPackage "scripts\windows") -Force
    Copy-Item -LiteralPath (Join-Path $PackageRoot "site") -Destination $legacyPackage -Recurse -Force
    $legacyMetadata = Get-Content -LiteralPath (Join-Path $PackageRoot "package.json") -Raw -Encoding UTF8 | ConvertFrom-Json
    $legacyMetadata.version = "1.3.9"
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText((Join-Path $legacyPackage "package.json"), ($legacyMetadata | ConvertTo-Json -Depth 5), $utf8NoBom)

    $legacyInstaller = Join-Path $legacyPackage "scripts\windows\Install-Moonsea-Windows.ps1"
    & $legacyInstaller `
        -SourceApp $sourceApp `
        -InstallRoot $installRoot `
        -DesktopPath $desktopPath `
        -BuilderPath $builderPath `
        -ManagerPath $managerPath `
        -SkipShortcut `
        -SkipLaunch
    $legacyManifest = Get-Content -LiteralPath (Join-Path $installRoot "install.json") -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($legacyManifest.appVersion -ne "1.3.9") { throw "Legacy installation was not created" }

    New-Item -ItemType Directory -Path (Join-Path $updatePackage "scripts\windows") -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $updatePackage "tools") -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $PackageRoot "package.json") -Destination $updatePackage
    Copy-Item -LiteralPath (Join-Path $PackageRoot "site") -Destination $updatePackage -Recurse
    Copy-Item -LiteralPath (Join-Path $PackageRoot "theme") -Destination $updatePackage -Recurse
    Copy-Item -LiteralPath (Join-Path $PackageRoot "assets") -Destination $updatePackage -Recurse
    Copy-Item -Path (Join-Path $PackageRoot "scripts\windows\*") -Destination (Join-Path $updatePackage "scripts\windows")
    Copy-Item -Path (Join-Path $PackageRoot "tools\moonsea-builder.*") -Destination (Join-Path $updatePackage "tools")
    Copy-Item -Path (Join-Path $PackageRoot "tools\moonsea-manager.*") -Destination (Join-Path $updatePackage "tools")
    New-Item -ItemType Directory -Path (Split-Path -Parent $archivePath) -Force | Out-Null
    Compress-Archive -Path (Join-Path $updatePackage "*") -DestinationPath $archivePath -Force
    $updater = Join-Path $legacyManifest.releasePath "scripts\windows\Update-Moonsea-Windows.ps1"
    & $updater `
        -InstallRoot $installRoot `
        -PackagePath $archivePath `
        -ManagerPid 999999 `
        -CurrentVersion "1.3.9" `
        -TargetVersion $expectedVersion

    $currentManifest = Get-Content -LiteralPath (Join-Path $installRoot "install.json") -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($currentManifest.appVersion -ne $expectedVersion) { throw "Updater did not activate the new version" }
    if (-not (Test-Path -LiteralPath $currentManifest.managerPath -PathType Leaf)) { throw "Updated manager is missing" }
    if (-not (Test-Path -LiteralPath $currentManifest.updaterPath -PathType Leaf)) { throw "Updated updater is missing" }
    $status = Invoke-RestMethod -Uri "http://127.0.0.1:$managerPort/api/status" -Headers @{ Host = "127.0.0.1:$managerPort" } -TimeoutSec 2
    if ($status.appVersion -ne $expectedVersion) { throw "Updated manager did not report the expected version" }

    Compress-Archive -Path (Join-Path $updatePackage "*") -DestinationPath $archivePath -Force
    $managerPid = [int](Get-Content -LiteralPath (Join-Path $installRoot "manager.pid") -Raw -Encoding UTF8)
    $rollbackTriggered = $false
    try {
        & $currentManifest.updaterPath `
            -InstallRoot $installRoot `
            -PackagePath $archivePath `
            -ManagerPid $managerPid `
            -CurrentVersion $expectedVersion `
            -TargetVersion "9.9.9"
    }
    catch {
        $rollbackTriggered = $true
    }
    if (-not $rollbackTriggered) { throw "Failed startup did not trigger rollback" }
    $rolledBackManifest = Get-Content -LiteralPath (Join-Path $installRoot "install.json") -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($rolledBackManifest.appVersion -ne $expectedVersion) { throw "Rollback did not restore the previous manifest" }
    $rollbackReady = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        try {
            $rollbackStatus = Invoke-RestMethod -Uri "http://127.0.0.1:$managerPort/api/status" -Headers @{ Host = "127.0.0.1:$managerPort" } -TimeoutSec 1
            if ($rollbackStatus.appVersion -eq $expectedVersion) { $rollbackReady = $true; break }
        }
        catch { Start-Sleep -Milliseconds 100 }
    }
    if (-not $rollbackReady) { throw "Rollback manager did not restart" }
    Write-Host "Windows application update smoke test passed"
}
finally {
    Stop-TestManager
    Get-CimInstance Win32_Process -Filter "Name = 'ChatGPT.exe'" -ErrorAction SilentlyContinue | Where-Object {
        $_.ExecutablePath -and $_.ExecutablePath.StartsWith($testRoot, [System.StringComparison]::OrdinalIgnoreCase)
    } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    $env:MOONSEA_MANAGER_PORT = $previousManagerPort
    $env:MOONSEA_NONINTERACTIVE = $previousNonInteractive
    $env:MOONSEA_UPDATE_HEALTH_ATTEMPTS = $previousHealthAttempts
    $env:MOONSEA_SKIP_SHORTCUT = $previousSkipShortcut
    if (Test-Path -LiteralPath $testRoot) { Remove-Item -LiteralPath $testRoot -Recurse -Force }
}
