[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$InstallRoot,
    [Parameter(Mandatory = $true)][string]$PackagePath,
    [Parameter(Mandatory = $true)][int]$ManagerPid,
    [Parameter(Mandatory = $true)][string]$CurrentVersion,
    [Parameter(Mandatory = $true)][string]$TargetVersion,
    [Parameter(Mandatory = $true)][string]$ReadyPath
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

function Stop-InstalledManager([string]$Root) {
    $pidPath = Join-Path $Root "manager.pid"
    if (-not (Test-Path -LiteralPath $pidPath -PathType Leaf)) { return }
    $pidText = (Get-Content -LiteralPath $pidPath -Raw -Encoding UTF8).Trim()
    if ($pidText -notmatch "^\d+$") { return }
    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $pidText" -ErrorAction SilentlyContinue
    if ($null -ne $process -and $process.CommandLine -and $process.CommandLine.IndexOf($Root, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
        Stop-Process -Id ([int]$pidText) -Force -ErrorAction SilentlyContinue
    }
    Remove-Item -LiteralPath $pidPath -Force -ErrorAction SilentlyContinue
}

function Stop-MoonseaApp([string]$BuildsRoot) {
    $resolvedBuilds = (Get-FullPath $BuildsRoot).TrimEnd([System.IO.Path]::DirectorySeparatorChar)
    $processes = @(Get-CimInstance Win32_Process -Filter "Name = 'ChatGPT.exe'" -ErrorAction SilentlyContinue | Where-Object {
        $_.ExecutablePath -and $_.ExecutablePath.StartsWith($resolvedBuilds + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)
    })
    foreach ($process in $processes) {
        Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
    }
    for ($attempt = 0; $attempt -lt 50; $attempt++) {
        $remaining = @(Get-CimInstance Win32_Process -Filter "Name = 'ChatGPT.exe'" -ErrorAction SilentlyContinue | Where-Object {
            $_.ExecutablePath -and $_.ExecutablePath.StartsWith($resolvedBuilds + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)
        })
        if ($remaining.Count -eq 0) { return }
        Start-Sleep -Milliseconds 100
    }
    throw "The previous Moonsea app did not close in time."
}

function Wait-ForManager([string]$ExpectedVersion) {
    $managerPort = if ($env:MOONSEA_MANAGER_PORT) { [int]$env:MOONSEA_MANAGER_PORT } else { 17321 }
    $healthAttempts = if ($env:MOONSEA_UPDATE_HEALTH_ATTEMPTS) { [int]$env:MOONSEA_UPDATE_HEALTH_ATTEMPTS } else { 120 }
    for ($attempt = 0; $attempt -lt $healthAttempts; $attempt++) {
        try {
            $status = Invoke-RestMethod -Uri "http://127.0.0.1:$managerPort/api/status" -Headers @{ Host = "127.0.0.1:$managerPort" } -TimeoutSec 1
            if ($status.ok -and $status.appVersion -eq $ExpectedVersion) { return $true }
        }
        catch { }
        Start-Sleep -Milliseconds 250
    }
    return $false
}

$InstallRoot = Get-FullPath $InstallRoot
$PackagePath = Get-FullPath $PackagePath
$ReadyPath = Get-FullPath $ReadyPath
$updatesRoot = Join-Path $InstallRoot "updates"
$buildsRoot = Join-Path $InstallRoot "builds"
$manifestPath = Join-Path $InstallRoot "install.json"
$launcherPath = Join-Path $InstallRoot "Start-Moonsea-Windows.ps1"
$extractRoot = Join-Path $updatesRoot "extract-$TargetVersion"
$rollbackRoot = Join-Path $updatesRoot "rollback-$CurrentVersion-to-$TargetVersion"
$logPath = Join-Path $updatesRoot "update.log"
$resultPath = Join-Path $updatesRoot "update-result.json"

Assert-ChildPath $PackagePath $updatesRoot "Update package"
Assert-ChildPath $ReadyPath $updatesRoot "Updater ready marker"
Assert-ChildPath $extractRoot $updatesRoot "Extraction directory"
Assert-ChildPath $rollbackRoot $updatesRoot "Rollback directory"
if ($CurrentVersion -notmatch "^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$") { throw "Current version is invalid." }
if ($TargetVersion -notmatch "^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$") { throw "Target version is invalid." }
if (-not (Test-Path -LiteralPath $PackagePath -PathType Leaf)) { throw "The downloaded update package is missing." }
if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) { throw "The installation manifest is missing." }

New-Item -ItemType Directory -Path $updatesRoot -Force | Out-Null
Start-Transcript -LiteralPath $logPath -Append | Out-Null
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($resultPath, (@{
    status = "installing"
    currentVersion = $CurrentVersion
    targetVersion = $TargetVersion
} | ConvertTo-Json -Compress), $utf8NoBom)
[System.IO.File]::WriteAllText($ReadyPath, "ready", $utf8NoBom)
try {
    for ($attempt = 0; $attempt -lt 50; $attempt++) {
        if ($null -eq (Get-Process -Id $ManagerPid -ErrorAction SilentlyContinue)) { break }
        Start-Sleep -Milliseconds 100
    }
    Stop-InstalledManager $InstallRoot

    if (Test-Path -LiteralPath $rollbackRoot) { Remove-Item -LiteralPath $rollbackRoot -Recurse -Force }
    New-Item -ItemType Directory -Path $rollbackRoot -Force | Out-Null
    Copy-Item -LiteralPath $manifestPath -Destination (Join-Path $rollbackRoot "install.json") -Force
    if (Test-Path -LiteralPath $launcherPath -PathType Leaf) {
        Copy-Item -LiteralPath $launcherPath -Destination (Join-Path $rollbackRoot "Start-Moonsea-Windows.ps1") -Force
    }
    $previousManifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json

    Stop-MoonseaApp $buildsRoot
    if (Test-Path -LiteralPath $extractRoot) { Remove-Item -LiteralPath $extractRoot -Recurse -Force }
    New-Item -ItemType Directory -Path $extractRoot -Force | Out-Null
    Expand-Archive -LiteralPath $PackagePath -DestinationPath $extractRoot -Force

    $packageRoots = @($extractRoot)
    $packageRoots += @(Get-ChildItem -LiteralPath $extractRoot -Directory | Select-Object -ExpandProperty FullName)
    $packageRoot = $packageRoots | Where-Object {
        Test-Path -LiteralPath (Join-Path $_ "scripts\windows\Install-Moonsea-Windows.ps1") -PathType Leaf
    } | Select-Object -First 1
    if ([string]::IsNullOrWhiteSpace($packageRoot)) { throw "The update package does not contain a Windows installer." }

    $installer = Join-Path $packageRoot "scripts\windows\Install-Moonsea-Windows.ps1"
    & $installer -SourceApp ([string]$previousManifest.sourceApp) -InstallRoot $InstallRoot -SkipLaunch
    & $launcherPath
    if (-not (Wait-ForManager $TargetVersion)) { throw "The new Moonsea manager did not pass its startup check." }

    $currentManifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $keepReleases = @([string]$previousManifest.releasePath, [string]$currentManifest.releasePath) | Where-Object { $_ }
    $keepBuilds = @([string]$previousManifest.activeBuild, [string]$currentManifest.activeBuild) | Where-Object { $_ }
    $releasesRoot = Join-Path $InstallRoot "releases"
    if (Test-Path -LiteralPath $releasesRoot -PathType Container) {
        foreach ($directory in Get-ChildItem -LiteralPath $releasesRoot -Directory) {
            if ($keepReleases -notcontains $directory.FullName) { Remove-Item -LiteralPath $directory.FullName -Recurse -Force }
        }
    }
    if (Test-Path -LiteralPath $buildsRoot -PathType Container) {
        foreach ($directory in Get-ChildItem -LiteralPath $buildsRoot -Directory) {
            if ($keepBuilds -notcontains $directory.FullName) { Remove-Item -LiteralPath $directory.FullName -Recurse -Force }
        }
    }
    Remove-Item -LiteralPath $extractRoot -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $PackagePath -Force -ErrorAction SilentlyContinue
    [System.IO.File]::WriteAllText($resultPath, (@{
        status = "succeeded"
        currentVersion = $CurrentVersion
        targetVersion = $TargetVersion
    } | ConvertTo-Json -Compress), $utf8NoBom)
    Write-Output "Moonsea update completed: $CurrentVersion -> $TargetVersion"
}
catch {
    Stop-InstalledManager $InstallRoot
    $rollbackManifest = Join-Path $rollbackRoot "install.json"
    $rollbackLauncher = Join-Path $rollbackRoot "Start-Moonsea-Windows.ps1"
    if (Test-Path -LiteralPath $rollbackManifest -PathType Leaf) {
        Copy-Item -LiteralPath $rollbackManifest -Destination $manifestPath -Force
    }
    if (Test-Path -LiteralPath $rollbackLauncher -PathType Leaf) {
        Copy-Item -LiteralPath $rollbackLauncher -Destination $launcherPath -Force
    }
    [System.IO.File]::WriteAllText($resultPath, (@{
        status = "failed"
        currentVersion = $CurrentVersion
        targetVersion = $TargetVersion
    } | ConvertTo-Json -Compress), $utf8NoBom)
    if (Test-Path -LiteralPath $launcherPath -PathType Leaf) {
        & $launcherPath
    }
    if (-not $env:MOONSEA_NONINTERACTIVE) {
        Add-Type -AssemblyName PresentationFramework
        [System.Windows.MessageBox]::Show(
            "Moonsea could not finish the update and restored the previous version. Details: $($_.Exception.Message)",
            "Moonsea update failed",
            [System.Windows.MessageBoxButton]::OK,
            [System.Windows.MessageBoxImage]::Warning
        ) | Out-Null
    }
    throw
}
finally {
    Stop-Transcript | Out-Null
}
