[CmdletBinding()]
param(
    [switch]$ForceRestart
)

$ErrorActionPreference = "Stop"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$env:MOONSEA_CLIENT = "workbuddy"
$env:MOONSEA_MANAGER_PORT = "17322"

function Get-FullPath([string]$Path) {
    return [System.IO.Path]::GetFullPath($Path)
}

function Test-OfficialWorkBuddyPath([string]$AppPath) {
    if ([string]::IsNullOrWhiteSpace($AppPath)) { return $false }
    $fullPath = Get-FullPath $AppPath
    return (
        (Test-Path -LiteralPath (Join-Path $fullPath "WorkBuddy.exe") -PathType Leaf) -and
        (Test-Path -LiteralPath (Join-Path $fullPath "resources\app.asar") -PathType Leaf)
    )
}

function Get-OfficialVersion([string]$AppPath, [string]$DetectedVersion) {
    $version = (Get-Item -LiteralPath (Join-Path $AppPath "WorkBuddy.exe")).VersionInfo.ProductVersion
    if ([string]::IsNullOrWhiteSpace($version)) { $version = $DetectedVersion }
    if ([string]::IsNullOrWhiteSpace($version)) { $version = "unknown" }
    return [regex]::Replace($version, "[^A-Za-z0-9._-]", "-")
}

function Get-PathFromDisplayIcon([string]$DisplayIcon) {
    if ([string]::IsNullOrWhiteSpace($DisplayIcon)) { return $null }
    $iconPath = $DisplayIcon.Trim()
    if ($iconPath.StartsWith('"')) {
        $closingQuote = $iconPath.IndexOf('"', 1)
        if ($closingQuote -lt 2) { return $null }
        $iconPath = $iconPath.Substring(1, $closingQuote - 1)
    }
    else {
        $iconPath = $iconPath -replace ",\d+$", ""
    }
    if ([System.IO.Path]::GetFileName($iconPath) -ne "WorkBuddy.exe") { return $null }
    return Split-Path -Parent $iconPath
}

function Find-LatestOfficialWorkBuddy {
    $explicitPath = if ($env:MOONSEA_SOURCE_APP) {
        $env:MOONSEA_SOURCE_APP
    }
    elseif ($env:MOONSEA_OFFICIAL_PATH) {
        $env:MOONSEA_OFFICIAL_PATH
    }
    else {
        $null
    }
    if ($explicitPath) {
        $fullPath = Get-FullPath $explicitPath
        if (-not (Test-OfficialWorkBuddyPath $fullPath)) {
            throw "The configured source is not a valid official WorkBuddy app: $fullPath"
        }
        return [pscustomobject]@{
            Path = $fullPath
            Version = Get-OfficialVersion $fullPath $null
        }
    }

    $uninstallRoot = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*"
    $registrations = @(Get-ItemProperty $uninstallRoot -ErrorAction SilentlyContinue | Where-Object {
        [string]$_.DisplayName -match "^WorkBuddy(?:\s+\d+(?:\.\d+){1,3})?$"
    })
    $candidates = @()
    foreach ($registration in $registrations) {
        $candidatePath = Get-PathFromDisplayIcon ([string]$registration.DisplayIcon)
        if ($candidatePath -and (Test-OfficialWorkBuddyPath $candidatePath)) {
            $candidates += [pscustomobject]@{
                Path = Get-FullPath $candidatePath
                Version = Get-OfficialVersion $candidatePath ([string]$registration.DisplayVersion)
            }
        }
    }
    $uniqueCandidates = @($candidates | Sort-Object Path -Unique)
    if ($uniqueCandidates.Count -ne 1) {
        throw "Expected one official WorkBuddy registration, found $($uniqueCandidates.Count)."
    }
    return $uniqueCandidates[0]
}

function Get-ActiveMainProcesses([string]$ActiveBuild) {
    $activeProcesses = @(Get-CimInstance Win32_Process -Filter "Name = 'WorkBuddy.exe'" -ErrorAction SilentlyContinue | Where-Object {
        $_.ExecutablePath -and
        $_.ExecutablePath.StartsWith($ActiveBuild + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)
    })
    $activeProcessIds = @($activeProcesses | ForEach-Object { [int]$_.ProcessId })
    return @($activeProcesses | Where-Object {
        [int]$_.ParentProcessId -notin $activeProcessIds
    })
}

function Get-MoonseaProcesses([string]$BuildsRoot) {
    return @(Get-CimInstance Win32_Process -Filter "Name = 'WorkBuddy.exe'" -ErrorAction SilentlyContinue | Where-Object {
        $_.ExecutablePath -and
        $_.ExecutablePath.StartsWith($BuildsRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)
    })
}

function Get-FreeLoopbackPort {
    $listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, 0)
    try {
        $listener.Start()
        return [int]$listener.LocalEndpoint.Port
    }
    finally {
        $listener.Stop()
    }
}

function Get-DevToolsPort([string]$ProfilePath) {
    $portPath = Join-Path $ProfilePath "DevToolsActivePort"
    if (-not (Test-Path -LiteralPath $portPath -PathType Leaf)) { return 0 }
    $firstLine = (Get-Content -LiteralPath $portPath -Encoding UTF8 | Select-Object -First 1)
    $port = 0
    if (-not [int]::TryParse($firstLine, [ref]$port)) { return 0 }
    if ($port -lt 1 -or $port -gt 65535) { return 0 }
    return $port
}

function Test-RendererEndpoint([int]$Port) {
    if ($Port -lt 1) { return $false }
    try {
        $targets = @(Invoke-RestMethod -Uri "http://127.0.0.1:$Port/json/list" -TimeoutSec 1)
        return @($targets | Where-Object {
            [string]$_.type -eq "page" -and [string]$_.url -match "/renderer/index\.html(?:[?#]|$)"
        }).Count -gt 0
    }
    catch {
        return $false
    }
}

function Wait-ForRenderer([int]$Port, [int]$TimeoutMilliseconds = 60000) {
    $deadline = [DateTime]::UtcNow.AddMilliseconds($TimeoutMilliseconds)
    do {
        if (Test-RendererEndpoint $Port) { return }
        Start-Sleep -Milliseconds 150
    } while ([DateTime]::UtcNow -lt $deadline)
    throw "WorkBuddy started, but its renderer debugging endpoint did not become ready."
}

function Wait-ForActiveMainProcess([string]$ActiveBuild, [int]$TimeoutMilliseconds = 15000) {
    $deadline = [DateTime]::UtcNow.AddMilliseconds($TimeoutMilliseconds)
    do {
        $active = @(Get-ActiveMainProcesses $ActiveBuild)
        if ($active.Count -gt 0) { return $active[0] }
        Start-Sleep -Milliseconds 100
    } while ([DateTime]::UtcNow -lt $deadline)
    throw "WorkBuddy started, but its main process did not become ready."
}

function Stop-MoonseaProcesses([object[]]$Processes) {
    foreach ($process in $Processes) {
        Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
    }
    for ($attempt = 0; $attempt -lt 50; $attempt++) {
        $remaining = @($Processes | Where-Object {
            $null -ne (Get-Process -Id $_.ProcessId -ErrorAction SilentlyContinue)
        })
        if ($remaining.Count -eq 0) { return }
        Start-Sleep -Milliseconds 100
    }
    throw "Could not stop the previous Moonsea WorkBuddy process."
}

$installRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$manifestPath = Join-Path $installRoot "install.json"
$buildsRoot = (Get-FullPath (Join-Path $installRoot "builds")).TrimEnd([System.IO.Path]::DirectorySeparatorChar)
if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
    throw "Moonsea installation data is missing. Run the installer again."
}

$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
if ([string]$manifest.client -ne "workbuddy") {
    throw "The installation data does not belong to Moonsea WorkBuddy."
}
$official = Find-LatestOfficialWorkBuddy
if ([string]$manifest.officialVersion -ne [string]$official.Version -or
    -not [string]::Equals(
        (Get-FullPath ([string]$manifest.sourceApp)),
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

$activeBuild = Get-FullPath ([string]$manifest.activeBuild)
if (-not $activeBuild.StartsWith($buildsRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "The active app path in the installation data is invalid."
}
$app = Join-Path $activeBuild "WorkBuddy.exe"
if (-not (Test-Path -LiteralPath $app -PathType Leaf)) {
    throw "Moonsea WorkBuddy is missing. Run the installer again."
}
$profilePath = Get-FullPath ([string]$manifest.profilePath)
$configPath = Get-FullPath ([string]$manifest.configPath)
New-Item -ItemType Directory -Path $profilePath -Force | Out-Null
New-Item -ItemType Directory -Path $configPath -Force | Out-Null
$managerPath = Get-FullPath ([string]$manifest.managerPath)
if (-not $managerPath.StartsWith($installRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "The manager path in the installation data is invalid."
}
if (-not (Test-Path -LiteralPath $managerPath -PathType Leaf)) {
    throw "The Moonsea manager is missing. Run the installer again."
}

$runningMoonsea = @(Get-MoonseaProcesses $buildsRoot)
$activeMain = @(Get-ActiveMainProcesses $activeBuild)
$devToolsPort = Get-DevToolsPort $profilePath
$mustRestart = $ForceRestart -or
    @($runningMoonsea | Where-Object {
        -not $_.ExecutablePath.StartsWith($activeBuild + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)
    }).Count -gt 0 -or
    ($activeMain.Count -gt 0 -and -not (Test-RendererEndpoint $devToolsPort))

if ($mustRestart -and $runningMoonsea.Count -gt 0) {
    if (-not $ForceRestart) {
        Add-Type -AssemblyName PresentationFramework
        $message = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("5qOA5rWL5Yiw5pen54mI5pyI5rW3IFdvcmtCdWRkeSDmraPlnKjov5DooYzjgIIKCuWFs+mXreaXp+eJiOWQjuaJjeiDveWQr+WKqOaWsOeahOS4u+mimOi/nuaOpeOAguacquS/neWtmOeahOS7u+WKoeivt+WFiOS/neWtmOOAggoK5piv5ZCm546w5Zyo5YWz6Zet5pen54mI5bm25omT5byA5paw54mI77yf"))
        $title = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("5pyI5rW3IFdvcmtCdWRkeSDpnIDopoHph43lkK8="))
        $choice = [System.Windows.MessageBox]::Show(
            $message,
            $title,
            [System.Windows.MessageBoxButton]::YesNo,
            [System.Windows.MessageBoxImage]::Information
        )
        if ($choice -ne [System.Windows.MessageBoxResult]::Yes) { exit 0 }
    }
    Stop-MoonseaProcesses $runningMoonsea
    $activeMain = @()
}

if ($env:MOONSEA_SKIP_LAUNCH) { exit 0 }

$requestedAppProcessId = 0
if ($env:MOONSEA_APP_PID -and [int]::TryParse($env:MOONSEA_APP_PID, [ref]$requestedAppProcessId)) {
    $requestedProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $requestedAppProcessId" -ErrorAction SilentlyContinue
    if ($null -eq $requestedProcess -or
        -not $requestedProcess.ExecutablePath.StartsWith($activeBuild + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "MOONSEA_APP_PID does not reference the active Moonsea WorkBuddy process."
    }
    $appProcessId = $requestedAppProcessId
}
elseif ($activeMain.Count -gt 0) {
    $appProcessId = [int]$activeMain[0].ProcessId
}
else {
    $devToolsPort = Get-FreeLoopbackPort
    $devToolsPortPath = Join-Path $profilePath "DevToolsActivePort"
    Remove-Item -LiteralPath $devToolsPortPath -Force -ErrorAction SilentlyContinue
    $env:WORKBUDDY_REMOTE_DEBUGGING_PORT = [string]$devToolsPort
    $env:WORKBUDDY_USER_DATA_DIR = $profilePath
    $env:WORKBUDDY_CONFIG_DIR = $configPath
    Start-Process -FilePath $app -WorkingDirectory $activeBuild | Out-Null
    $appProcessId = [int](Wait-ForActiveMainProcess $activeBuild).ProcessId
    Wait-ForRenderer $devToolsPort
    [System.IO.File]::WriteAllText($devToolsPortPath, "$devToolsPort`n", $utf8NoBom)
}

if (-not (Test-RendererEndpoint $devToolsPort)) {
    throw "Moonsea WorkBuddy is running without an available renderer debugging endpoint."
}
$managerArguments = "--install-root `"$installRoot`" --profile-path `"$profilePath`" --app-pid $appProcessId"
if ([System.IO.Path]::GetExtension($managerPath) -eq ".mjs") {
    Start-Process -FilePath "node" -ArgumentList "`"$managerPath`" $managerArguments" -WindowStyle Hidden
}
else {
    Start-Process -FilePath $managerPath -ArgumentList $managerArguments -WindowStyle Hidden
}
