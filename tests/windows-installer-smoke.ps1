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
$launcher = Join-Path $PackageRoot "Install.cmd"
$expectedVersion = [string](Get-Content -LiteralPath (Join-Path $PackageRoot "package.json") -Raw -Encoding UTF8 | ConvertFrom-Json).version
$managerPort = 18320
$previousManagerPort = $env:MOONSEA_MANAGER_PORT
$previousInstallRoot = $env:MOONSEA_INSTALL_ROOT
$previousSourceApp = $env:MOONSEA_SOURCE_APP
$previousDesktopPath = $env:MOONSEA_DESKTOP_PATH
$previousNonInteractive = $env:MOONSEA_NONINTERACTIVE
$previousSkipShortcut = $env:MOONSEA_SKIP_SHORTCUT
$previousSkipLaunch = $env:MOONSEA_SKIP_LAUNCH

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
    $env:MOONSEA_MANAGER_PORT = [string]$managerPort
    $env:MOONSEA_INSTALL_ROOT = $installRoot
    $env:MOONSEA_DESKTOP_PATH = $desktopPath
    $env:MOONSEA_NONINTERACTIVE = "1"
    $env:MOONSEA_SKIP_SHORTCUT = "1"
    $env:MOONSEA_SKIP_LAUNCH = "1"
    node (Join-Path $sourceRoot "tests\create-fixture.mjs") windows $sourceApp | Out-Null
    $env:MOONSEA_SOURCE_APP = $sourceApp
    Push-Location $PackageRoot
    try {
        $launcherOutput = @(& cmd.exe /d /c "Install.cmd" 2>&1)
        $launcherExitCode = $LASTEXITCODE
    }
    finally {
        Pop-Location
    }
    if ($launcherExitCode -ne 0) {
        throw "Install.cmd failed with exit code $launcherExitCode`n$($launcherOutput -join [Environment]::NewLine)"
    }
    $localizedSuccess = [string][char]0x5B89 + [char]0x88C5 + [char]0x5B8C + [char]0x6210
    if (($launcherOutput -join "`n") -notmatch $localizedSuccess) {
        throw "Install.cmd did not display the localized success message"
    }
    $launcherResultPath = Join-Path $installRoot "logs\install-result.json"
    if (-not (Test-Path -LiteralPath $launcherResultPath -PathType Leaf)) { throw "Install.cmd did not write its result file" }
    $launcherResult = Get-Content -LiteralPath $launcherResultPath -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($launcherResult.status -ne "succeeded") { throw "Install.cmd did not persist its success result" }
    if (-not (Test-Path -LiteralPath $launcherResult.logPath -PathType Leaf)) { throw "Install.cmd did not keep its installation log" }
    $manifestPath = Join-Path $installRoot "install.json"
    if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) { throw "Manifest was not created" }
    $manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($manifest.edition -ne "standard") { throw "Installer did not select the standard edition" }
    if ($manifest.schemaVersion -ne 2 -or $manifest.appVersion -ne $expectedVersion) { throw "Installer did not write the application version" }
    if (-not (Test-Path -LiteralPath $manifest.managerPath -PathType Leaf)) { throw "Manager was not installed" }
    if (-not (Test-Path -LiteralPath $manifest.updaterPath -PathType Leaf)) { throw "Updater was not installed" }
    if (-not (Test-Path -LiteralPath (Join-Path $manifest.releasePath "site\index.html") -PathType Leaf)) { throw "Website was not installed" }
    if (-not (Test-Path -LiteralPath (Join-Path $manifest.releasePath "admin\index.html") -PathType Leaf)) { throw "Admin studio was not installed" }
    if (-not (Test-Path -LiteralPath (Join-Path $manifest.releasePath "assets\admin-drafts\mint-academy.png") -PathType Leaf)) { throw "Admin drafts were not installed" }
    $managerArguments = "--install-root `"$installRoot`" --profile-path `"$($manifest.profilePath)`""
    if ([System.IO.Path]::GetExtension([string]$manifest.managerPath) -eq ".mjs") {
        Start-Process -FilePath "node" -ArgumentList "`"$($manifest.managerPath)`" $managerArguments" -WindowStyle Hidden
    }
    else {
        Start-Process -FilePath $manifest.managerPath -ArgumentList $managerArguments -WindowStyle Hidden
    }
    $managerReady = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        try {
            $catalog = Invoke-RestMethod -Uri "http://127.0.0.1:$managerPort/api/themes" -Headers @{ Host = "127.0.0.1:$managerPort" } -TimeoutSec 1
            if ($catalog.ok -and $catalog.themes.Count -ge 4) { $managerReady = $true; break }
        }
        catch { Start-Sleep -Milliseconds 100 }
    }
    if (-not $managerReady) { throw "Installed manager did not serve the theme website" }
    & $installer -SourceApp $sourceApp -InstallRoot $installRoot -DesktopPath $desktopPath -BuilderPath $BuilderPath -SkipShortcut -SkipLaunch
    Invoke-TestBuilder -Arguments @("--verify", $manifest.activeBuild)
    & $uninstaller -InstallRoot $installRoot -DesktopPath $desktopPath -NonInteractive
    if (Test-Path -LiteralPath (Join-Path $installRoot "builds")) { throw "Default uninstall did not remove builds" }
    if (Test-Path -LiteralPath (Join-Path $installRoot "releases")) { throw "Default uninstall did not remove release files" }
    if (-not (Test-Path -LiteralPath (Join-Path $installRoot "BrowserProfile"))) { throw "Default uninstall did not preserve user data" }

    & $installer -SourceApp $sourceApp -InstallRoot $installRoot -DesktopPath $desktopPath -BuilderPath $BuilderPath -SkipShortcut -SkipLaunch
    & $uninstaller -InstallRoot $installRoot -DesktopPath $desktopPath -NonInteractive -RemoveUserData
    if (Test-Path -LiteralPath $installRoot) { throw "Full uninstall did not remove the install root" }

    $failureRoot = Join-Path $testRoot "failed-install"
    $env:MOONSEA_INSTALL_ROOT = $failureRoot
    $env:MOONSEA_SOURCE_APP = Join-Path $testRoot "missing-official-app"
    Push-Location $PackageRoot
    try {
        $failureOutput = @(& cmd.exe /d /c "Install.cmd" 2>&1)
        $failureExitCode = $LASTEXITCODE
    }
    finally {
        Pop-Location
    }
    if ($failureExitCode -eq 0) { throw "Install.cmd did not return a failure exit code" }
    $failureResultPath = Join-Path $failureRoot "logs\install-result.json"
    if (-not (Test-Path -LiteralPath $failureResultPath -PathType Leaf)) { throw "Failed Install.cmd did not write its result file" }
    $failureResult = Get-Content -LiteralPath $failureResultPath -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($failureResult.status -ne "failed" -or [string]::IsNullOrWhiteSpace([string]$failureResult.error)) {
        throw "Failed Install.cmd did not persist a user-facing error"
    }
    if ([string]::IsNullOrWhiteSpace([string]$failureResult.technicalError)) {
        throw "Failed Install.cmd did not persist its technical error"
    }
    if (-not (Test-Path -LiteralPath $failureResult.logPath -PathType Leaf)) { throw "Failed Install.cmd did not keep its installation log" }
    Write-Host "Windows install, update, and uninstall smoke test passed"
}
finally {
    $env:MOONSEA_MANAGER_PORT = $previousManagerPort
    $env:MOONSEA_INSTALL_ROOT = $previousInstallRoot
    $env:MOONSEA_SOURCE_APP = $previousSourceApp
    $env:MOONSEA_DESKTOP_PATH = $previousDesktopPath
    $env:MOONSEA_NONINTERACTIVE = $previousNonInteractive
    $env:MOONSEA_SKIP_SHORTCUT = $previousSkipShortcut
    $env:MOONSEA_SKIP_LAUNCH = $previousSkipLaunch
    if (Test-Path -LiteralPath $testRoot) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force
    }
}
