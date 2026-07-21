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
Start-Process -FilePath $app -ArgumentList "--user-data-dir=`"$profilePath`""
