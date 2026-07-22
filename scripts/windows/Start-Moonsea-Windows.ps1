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
