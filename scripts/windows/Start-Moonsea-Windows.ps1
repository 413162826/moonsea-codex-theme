$ErrorActionPreference = "Stop"

$installRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$manifestPath = Join-Path $installRoot "install.json"
$buildsRoot = [System.IO.Path]::GetFullPath((Join-Path $installRoot "builds")).TrimEnd([System.IO.Path]::DirectorySeparatorChar)
if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
    throw "Moonsea installation data is missing. Run the installer again."
}

$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$activeBuild = [System.IO.Path]::GetFullPath([string]$manifest.activeBuild)
if (-not $activeBuild.StartsWith($buildsRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "The active app path in the installation data is invalid."
}
$app = Join-Path $activeBuild "ChatGPT.exe"
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

$runningMoonsea = @(Get-CimInstance Win32_Process -Filter "Name = 'ChatGPT.exe'" -ErrorAction SilentlyContinue | Where-Object {
    $_.ExecutablePath -and $_.ExecutablePath.StartsWith($buildsRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)
})
$runningMain = @($runningMoonsea | Where-Object { $_.CommandLine -notmatch "\s--type=" })
$staleMain = @($runningMain | Where-Object {
    -not $_.ExecutablePath.StartsWith($activeBuild + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase) -or
    $_.CommandLine -notmatch "--remote-debugging-port=0"
})
if ($staleMain.Count -gt 0) {
    Add-Type -AssemblyName PresentationFramework
    $choice = [System.Windows.MessageBox]::Show(
        "检测到旧版 Codex 月海版正在运行。`n`n关闭旧版后才能启动新的主题连接。未保存的任务请先保存。`n`n是否现在关闭旧版并打开新版？",
        "Codex 月海版需要重启",
        [System.Windows.MessageBoxButton]::YesNo,
        [System.Windows.MessageBoxImage]::Information
    )
    if ($choice -ne [System.Windows.MessageBoxResult]::Yes) { exit 0 }
    foreach ($process in $runningMoonsea) {
        Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
    }
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        $remaining = @(Get-CimInstance Win32_Process -Filter "Name = 'ChatGPT.exe'" -ErrorAction SilentlyContinue | Where-Object {
            $_.ExecutablePath -and $_.ExecutablePath.StartsWith($buildsRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)
        })
        if ($remaining.Count -eq 0) { break }
        Start-Sleep -Milliseconds 100
    }
}

$devToolsPortPath = Join-Path $profilePath "DevToolsActivePort"
if (Test-Path -LiteralPath $devToolsPortPath) {
    Remove-Item -LiteralPath $devToolsPortPath -Force
}

Start-Process -FilePath $app -ArgumentList @(
    "--user-data-dir=`"$profilePath`"",
    "--remote-debugging-address=127.0.0.1",
    "--remote-debugging-port=0"
)

$managerArguments = "--install-root `"$installRoot`" --profile-path `"$profilePath`""
if ([System.IO.Path]::GetExtension($managerPath) -eq ".mjs") {
    Start-Process -FilePath "node" -ArgumentList "`"$managerPath`" $managerArguments" -WindowStyle Hidden
}
else {
    Start-Process -FilePath $managerPath -ArgumentList $managerArguments -WindowStyle Hidden
}
