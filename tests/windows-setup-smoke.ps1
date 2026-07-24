[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$SetupPath
)

$ErrorActionPreference = "Stop"
$sourceRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$testRoot = Join-Path $sourceRoot ".build\windows-setup-smoke"
$sourceApp = Join-Path $testRoot "Official-Windows"
$installRoot = Join-Path $testRoot "MoonseaCodex"
$setupLog = Join-Path $testRoot "setup.log"
$updateLog = Join-Path $testRoot "update.log"
$managerPort = 18321

$previousManagerPort = $env:MOONSEA_MANAGER_PORT
$previousSourceApp = $env:MOONSEA_SOURCE_APP
$previousSkipLaunch = $env:MOONSEA_SKIP_LAUNCH

$SetupPath = [System.IO.Path]::GetFullPath($SetupPath)
if (-not (Test-Path -LiteralPath $SetupPath -PathType Leaf)) {
    throw "Setup.exe does not exist: $SetupPath"
}
if (Test-Path -LiteralPath $testRoot) {
    Remove-Item -LiteralPath $testRoot -Recurse -Force
}
New-Item -ItemType Directory -Path $testRoot -Force | Out-Null

try {
    node (Join-Path $sourceRoot "tests\create-fixture.mjs") windows $sourceApp | Out-Null
    $env:MOONSEA_MANAGER_PORT = [string]$managerPort
    $env:MOONSEA_SOURCE_APP = $sourceApp
    $env:MOONSEA_SKIP_LAUNCH = "1"

    $setupProcess = Start-Process `
        -FilePath $SetupPath `
        -ArgumentList @(
            "/VERYSILENT",
            "/SUPPRESSMSGBOXES",
            "/NORESTART",
            "/NOICONS",
            "/DIR=`"$installRoot`"",
            "/LOG=`"$setupLog`""
        ) `
        -WindowStyle Hidden `
        -Wait `
        -PassThru
    $setupExitCode = $setupProcess.ExitCode
    if ($setupExitCode -ne 0) {
        $log = if (Test-Path -LiteralPath $setupLog) {
            Get-Content -LiteralPath $setupLog -Raw -Encoding UTF8
        }
        else {
            "Setup log was not created."
        }
        throw "Setup.exe failed with exit code $setupExitCode`n$log"
    }

    $manifestPath = Join-Path $installRoot "install.json"
    $launcherPath = Join-Path $installRoot "MoonseaLauncher.exe"
    $uninstallerPath = Join-Path $installRoot "unins000.exe"
    if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
        throw "Setup.exe did not create install.json"
    }
    if (-not (Test-Path -LiteralPath $launcherPath -PathType Leaf)) {
        throw "Setup.exe did not install MoonseaLauncher.exe"
    }
    if (-not (Test-Path -LiteralPath $uninstallerPath -PathType Leaf)) {
        throw "Setup.exe did not register its uninstaller"
    }

    $manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
    if (-not (Test-Path -LiteralPath $manifest.activeBuild -PathType Container)) {
        throw "Setup.exe did not create a valid Moonsea Codex build"
    }
    if (-not (Test-Path -LiteralPath $manifest.managerPath -PathType Leaf)) {
        throw "Setup.exe did not install the manager"
    }

    $uninstallEntry = Get-ItemProperty `
        "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*" `
        -ErrorAction SilentlyContinue |
        Where-Object {
            [string]$_.InstallLocation -eq ($installRoot + "\")
        } |
        Select-Object -First 1
    if ($null -eq $uninstallEntry) {
        throw "Setup.exe did not register Moonsea Codex in Windows Apps"
    }

    $profileMarker = Join-Path $installRoot "BrowserProfile\keep-after-update.txt"
    Set-Content -LiteralPath $profileMarker -Value "preserve" -Encoding ASCII
    $installedAt = [string]$manifest.installedAt
    $updateProcess = Start-Process `
        -FilePath $SetupPath `
        -ArgumentList @(
            "/VERYSILENT",
            "/SUPPRESSMSGBOXES",
            "/NORESTART",
            "/CLOSEAPPLICATIONS",
            "/MOONSEAUPDATE",
            "/DIR=`"$installRoot`"",
            "/LOG=`"$updateLog`""
        ) `
        -WindowStyle Hidden `
        -Wait `
        -PassThru
    if ($updateProcess.ExitCode -ne 0) {
        throw "Setup.exe silent update failed with exit code $($updateProcess.ExitCode)"
    }
    $updatedManifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
    if ([string]$updatedManifest.installedAt -ne $installedAt) {
        throw "Setup.exe silent update replaced the original installation identity"
    }
    if (-not (Test-Path -LiteralPath $profileMarker -PathType Leaf)) {
        throw "Setup.exe silent update did not preserve the browser profile"
    }

    $uninstallProcess = Start-Process `
        -FilePath $uninstallerPath `
        -ArgumentList @("/VERYSILENT", "/SUPPRESSMSGBOXES", "/NORESTART") `
        -WindowStyle Hidden `
        -Wait `
        -PassThru
    if ($uninstallProcess.ExitCode -ne 0) {
        throw "The Windows uninstaller failed with exit code $($uninstallProcess.ExitCode)"
    }
    if (Test-Path -LiteralPath (Join-Path $installRoot "payload")) {
        throw "The Windows uninstaller left application payload files behind"
    }
    if (Test-Path -LiteralPath (Join-Path $installRoot "builds")) {
        throw "The Windows uninstaller left patched Codex builds behind"
    }
    if (-not (Test-Path -LiteralPath (Join-Path $installRoot "BrowserProfile"))) {
        throw "The Windows uninstaller did not preserve user settings"
    }

    Write-Host "Windows Setup.exe install and system uninstall smoke test passed"
}
finally {
    $env:MOONSEA_MANAGER_PORT = $previousManagerPort
    $env:MOONSEA_SOURCE_APP = $previousSourceApp
    $env:MOONSEA_SKIP_LAUNCH = $previousSkipLaunch
    if (Test-Path -LiteralPath $testRoot) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force
    }
}
