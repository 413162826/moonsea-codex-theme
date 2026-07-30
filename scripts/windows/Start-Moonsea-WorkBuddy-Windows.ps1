[CmdletBinding()]
param(
    [switch]$ForceRestart
)

$ErrorActionPreference = "Stop"

# 月海 WorkBuddy 助手：锁定客户端身份与本地服务端口（与 Codex 版 17321 区分）。
# 这两个变量会被启动的月海助手（manager）子进程继承。
$env:MOONSEA_CLIENT = "workbuddy"
$env:MOONSEA_MANAGER_PORT = "17322"

function Get-OfficialVersion([string]$AppPath, [string]$DetectedVersion) {
    $version = $DetectedVersion
    if ([string]::IsNullOrWhiteSpace($version) -and $AppPath -match "OpenAI\.Codex_([^_]+)_") {
        $version = $Matches[1]
    }
    if ([string]::IsNullOrWhiteSpace($version)) {
        $executable = Join-Path $AppPath "WorkBuddy.exe"
        if (Test-Path -LiteralPath $executable -PathType Leaf) {
            $version = (Get-Item -LiteralPath $executable).VersionInfo.ProductVersion
        }
    }
    if ([string]::IsNullOrWhiteSpace($version)) { $version = "unknown" }
    return [regex]::Replace($version, "[^A-Za-z0-9._-]", "-")
}

function Find-LatestOfficialWorkBuddy {
    if ($env:MOONSEA_SOURCE_APP) {
        $sourceApp = [System.IO.Path]::GetFullPath($env:MONSEA_SOURCE_APP)
        if (-not (Test-Path -LiteralPath (Join-Path $sourceApp "resources\app.asar") -PathType Leaf)) {
            throw "MOONSEA_SOURCE_APP is not a valid official WorkBuddy app."
        }
        return [pscustomobject]@{
            Path = $sourceApp
            Version = Get-OfficialVersion $sourceApp $null
        }
    }

    # WorkBuddy 是独立安装的 Electron 应用（非 Microsoft Store），默认安装路径：
    #   %LOCALAPPDATA%\Programs\WorkBuddy\
    $defaultPath = Join-Path $env:LOCALAPPDATA "Programs\WorkBuddy"
    $searchPath = if ($env:MOONSEA_OFFICIAL_PATH) { $env:MOONSEA_OFFICIAL_PATH } else { $defaultPath }
    $fullPath = [System.IO.Path]::GetFullPath($searchPath)
    if (Test-Path -LiteralPath (Join-Path $fullPath "resources\app.asar") -PathType Leaf) {
        return [pscustomobject]@{
            Path = $fullPath
            Version = Get-OfficialVersion $fullPath $null
        }
    }

    throw "Official WorkBuddy was not found. Install and open the official app once, then retry."
}
        Version = Get-OfficialVersion $appPath ([string]$package.Version)
    }
}

function Get-ActiveMainProcesses([string]$ActiveBuild) {
    return @(Get-CimInstance Win32_Process -Filter "Name = 'WorkBuddy.exe'" -ErrorAction SilentlyContinue | Where-Object {
        $_.ExecutablePath -and
        $_.ExecutablePath.StartsWith($ActiveBuild + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase) -and
        $_.CommandLine -notmatch "\s--type=" -and
        $_.CommandLine -match "--remote-debugging-port=0"
    })
}

function Wait-ForActiveMainProcess([string]$ActiveBuild, [int]$TimeoutMilliseconds = 15000) {
    $deadline = [DateTime]::UtcNow.AddMilliseconds($TimeoutMilliseconds)
    do {
        $active = @(Get-ActiveMainProcesses $ActiveBuild)
        if ($active.Count -gt 0) { return $active[0] }
        Start-Sleep -Milliseconds 100
    } while ([DateTime]::UtcNow -lt $deadline)
    throw "The Moonsea app started, but its main process did not become ready."
}

$installRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$manifestPath = Join-Path $installRoot "install.json"
$buildsRoot = [System.IO.Path]::GetFullPath((Join-Path $installRoot "builds")).TrimEnd([System.IO.Path]::DirectorySeparatorChar)
if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
    throw "Moonsea installation data is missing. Run the installer again."
}

$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$official = Find-LatestOfficialWorkBuddy
if ([string]$manifest.officialVersion -ne [string]$official.Version -or
    -not [string]::Equals(
        [System.IO.Path]::GetFullPath([string]$manifest.sourceApp),
        [string]$official.Path,
        [System.StringComparison]::OrdinalIgnoreCase
    )) {
    $payloadInstaller = Join-Path $installRoot "payload\scripts\windows\Install-Moonsea-WorkBuddy-Windows.ps1"
    if (-not (Test-Path -LiteralPath $payloadInstaller -PathType Leaf)) {
        throw "Moonsea update files are incomplete. Install the latest Moonsea version again."
    }
    & $payloadInstaller -SourceApp ([string]$official.Path) -InstallRoot $installRoot -SkipLaunch
    $manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
}
$activeBuild = [System.IO.Path]::GetFullPath([string]$manifest.activeBuild)
if (-not $activeBuild.StartsWith($buildsRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "The active app path in the installation data is invalid."
}
$app = Join-Path $activeBuild "WorkBuddy.exe"
if (-not (Test-Path -LiteralPath $app -PathType Leaf)) {
    throw "The Moonsea app is missing. Run the installer again."
}
$profilePath = [System.IO.Path]::GetFullPath([string]$manifest.profilePath)
New-Item -ItemType Directory -Path $profilePath -Force | Out-Null
$managerPath = [System.IO.Path]::GetFullPath([string]$manifest.managerPath)
if (-not $managerPath.StartsWith($installRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "The manager path in the installation data is invalid."
}
if (-not (Test-Path -LiteralPath $managerPath -PathType Leaf)) {
    throw "The Moonsea manager is missing. Run the installer again."
}

$runningMoonsea = @(Get-CimInstance Win32_Process -Filter "Name = 'WorkBuddy.exe'" -ErrorAction SilentlyContinue | Where-Object {
    $_.ExecutablePath -and $_.ExecutablePath.StartsWith($buildsRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)
})
$runningMain = @($runningMoonsea | Where-Object { $_.CommandLine -notmatch "\s--type=" })
$staleMain = @($runningMain | Where-Object {
    -not $_.ExecutablePath.StartsWith($activeBuild + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase) -or
    $_.CommandLine -notmatch "--remote-debugging-port=0"
})
if ($staleMain.Count -gt 0) {
    if (-not $ForceRestart) {
        Add-Type -AssemblyName PresentationFramework
        $restartMessage = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("5qOA5rWL5Yiw5pen54mIIENvZGV4IOaciOa1t+eJiOato+WcqOi/kOihjOOAggoK5YWz6Zet5pen54mI5ZCO5omN6IO95ZCv5Yqo5paw55qE5Li76aKY6L+e5o6l44CC5pyq5L+d5a2Y55qE5Lu75Yqh6K+35YWI5L+d5a2Y44CCCgrmmK/lkKbnjrDlnKjlhbPpl63ml6fniYjlubbmiZPlvIDmlrDniYjvvJ8="))
        $restartTitle = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("Q29kZXgg5pyI5rW354mI6ZyA6KaB6YeN5ZCv"))
        $choice = [System.Windows.MessageBox]::Show(
            $restartMessage,
            $restartTitle,
            [System.Windows.MessageBoxButton]::YesNo,
            [System.Windows.MessageBoxImage]::Information
        )
        if ($choice -ne [System.Windows.MessageBoxResult]::Yes) { exit 0 }
    }
    foreach ($process in $runningMoonsea) {
        Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
    }
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        $remaining = @(Get-CimInstance Win32_Process -Filter "Name = 'WorkBuddy.exe'" -ErrorAction SilentlyContinue | Where-Object {
            $_.ExecutablePath -and $_.ExecutablePath.StartsWith($buildsRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)
        })
        if ($remaining.Count -eq 0) { break }
        Start-Sleep -Milliseconds 100
    }
}

if ($env:MOONSEA_SKIP_LAUNCH) {
    exit 0
}

$activeMain = @(Get-ActiveMainProcesses $activeBuild)
$requestedAppProcessId = 0
if ($env:MOONSEA_APP_PID -and [int]::TryParse($env:MOONSEA_APP_PID, [ref]$requestedAppProcessId)) {
    if ($null -eq (Get-Process -Id $requestedAppProcessId -ErrorAction SilentlyContinue)) {
        throw "MOONSEA_APP_PID does not reference a running process."
    }
    $appProcessId = $requestedAppProcessId
}
elseif ($activeMain.Count -gt 0) {
    $appProcessId = [int]$activeMain[0].ProcessId
}
else {
    $devToolsPortPath = Join-Path $profilePath "DevToolsActivePort"
    if (Test-Path -LiteralPath $devToolsPortPath) {
        Remove-Item -LiteralPath $devToolsPortPath -Force
    }
    Start-Process -FilePath $app -ArgumentList @(
        "--user-data-dir=`"$profilePath`"",
        "--remote-debugging-address=127.0.0.1",
        "--remote-debugging-port=0"
    ) | Out-Null
    $appProcessId = [int](Wait-ForActiveMainProcess $activeBuild).ProcessId
}

$managerArguments = "--install-root `"$installRoot`" --profile-path `"$profilePath`" --app-pid $appProcessId"
if ([System.IO.Path]::GetExtension($managerPath) -eq ".mjs") {
    Start-Process -FilePath "node" -ArgumentList "`"$managerPath`" $managerArguments" -WindowStyle Hidden
}
else {
    Start-Process -FilePath $managerPath -ArgumentList $managerArguments -WindowStyle Hidden
}
