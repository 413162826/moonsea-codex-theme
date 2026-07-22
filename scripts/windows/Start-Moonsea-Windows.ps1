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
    $restartMessage = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("5qOA5rWL5Yiw5pen54mIIENvZGV4IOaciOa1t+eJiOato+WcqOi/kOihjOOAggoK5YWz6Zet5pen54mI5ZCO5omN6IO95ZCv5Yqo5paw55qE5Li76aKY6L+e5o6l44CC5pyq5L+d5a2Y55qE5Lu75Yqh6K+35YWI5L+d5a2Y44CCCgrmmK/lkKbnjrDlnKjlhbPpl63ml6fniYjlubbmiZPlvIDmlrDniYjvvJ8="))
    $restartTitle = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("Q29kZXgg5pyI5rW354mI6ZyA6KaB6YeN5ZCv"))
    $choice = [System.Windows.MessageBox]::Show(
        $restartMessage,
        $restartTitle,
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
