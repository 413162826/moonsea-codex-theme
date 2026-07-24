[CmdletBinding()]
param(
    [string]$InstallRoot,
    [switch]$SkipShortcut,
    [switch]$SkipLaunch
)

$ErrorActionPreference = "Stop"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
try {
    [Console]::InputEncoding = $utf8NoBom
    [Console]::OutputEncoding = $utf8NoBom
}
catch { }
$OutputEncoding = $utf8NoBom

function Decode-Text([string]$Value) {
    return [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($Value))
}

function Get-FriendlyError([string]$TechnicalError) {
    if ($TechnicalError -match "Official Codex was not found|not a valid official Codex app") {
        return Decode-Text "5pyq5om+5Yiw5pyJ5pWI55qEIENvZGV4IOWumOaWueW6lOeUqOOAguivt+WFiOWuieijheW5tuaJk+W8gOS4gOasoeWumOaWuSBDb2RleO+8jOeEtuWQjumHjeivleOAgg=="
    }
    if ($TechnicalError -match "package is incomplete|script is missing|resources are missing|manager is missing") {
        return Decode-Text "5a6J6KOF5YyF5LiN5a6M5pW044CC6K+36YeN5paw5LiL6L295bm25a6M5pW06Kej5Y6L5ZCO5YaN6K+V44CC"
    }
    if ($TechnicalError -match "copy the official app|Robocopy") {
        return Decode-Text "5aSN5Yi2IENvZGV4IOaWh+S7tuWksei0peOAguivt+ajgOafpeejgeebmOepuumXtOWSjOWuieWFqOi9r+S7tuWQjumHjeivleOAgg=="
    }
    if ($TechnicalError -match "builder failed|theme version") {
        return Decode-Text "55Sf5oiQ5pyI5rW354mI5aSx6LSl44CC6K+35p+l55yL5a6M5pW05pel5b+X5ZCO6YeN6K+V44CC"
    }
    return Decode-Text "5a6J6KOF6L+H56iL5Lit5Y+R55Sf6ZSZ6K+v44CC6K+35p+l55yL5a6M5pW05pel5b+X5ZCO6YeN6K+V44CC"
}

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$packageRoot = Split-Path -Parent (Split-Path -Parent $scriptRoot)
$installerPath = Join-Path $scriptRoot "Install-Moonsea-Windows.ps1"
$installRoot = if (-not [string]::IsNullOrWhiteSpace($InstallRoot)) {
    [System.IO.Path]::GetFullPath($InstallRoot)
}
elseif ($env:MOONSEA_INSTALL_ROOT) {
    [System.IO.Path]::GetFullPath($env:MOONSEA_INSTALL_ROOT)
}
else {
    Join-Path $env:LOCALAPPDATA "MoonseaCodex"
}
$logsRoot = Join-Path $installRoot "logs"
$startedAt = (Get-Date).ToUniversalTime()
$logPath = Join-Path $logsRoot ("install-" + $startedAt.ToString("yyyyMMdd-HHmmss") + ".log")
$resultPath = Join-Path $logsRoot "install-result.json"

function Write-InstallResult([string]$Status, [string]$ErrorMessage, [string]$TechnicalError) {
    New-Item -ItemType Directory -Path $logsRoot -Force | Out-Null
    $appVersion = $null
    $manifestPath = Join-Path $installRoot "install.json"
    if (Test-Path -LiteralPath $manifestPath -PathType Leaf) {
        try {
            $appVersion = [string](Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json).appVersion
        }
        catch { }
    }
    $result = [ordered]@{
        schemaVersion = 1
        status = $Status
        appVersion = $appVersion
        startedAt = $startedAt.ToString("o")
        finishedAt = (Get-Date).ToUniversalTime().ToString("o")
        logPath = $logPath
        error = $ErrorMessage
        technicalError = $TechnicalError
    }
    [System.IO.File]::WriteAllText(
        $resultPath,
        ($result | ConvertTo-Json -Depth 3),
        $utf8NoBom
    )
}

New-Item -ItemType Directory -Path $logsRoot -Force | Out-Null
try {
    [Console]::Title = Decode-Text "5pyI5rW35Yqp5omL5a6J6KOF"
}
catch { }
Write-Host (Decode-Text "5q2j5Zyo5a6J6KOF5pyI5rW35Yqp5omL77yM6K+35LiN6KaB5YWz6Zet56qX5Y+jLi4u")
Write-Host ""

$transcriptStarted = $false
$exitCode = 0
try {
    Start-Transcript -LiteralPath $logPath -Force | Out-Null
    $transcriptStarted = $true
    if (-not (Test-Path -LiteralPath $installerPath -PathType Leaf)) {
        throw "Installer script is missing: $installerPath"
    }
    & $installerPath -InstallRoot $installRoot -SkipShortcut:$SkipShortcut -SkipLaunch:$SkipLaunch
    Write-InstallResult "succeeded" $null $null
    Write-Host ""
    Write-Host (Decode-Text "5a6J6KOF5a6M5oiQ") -ForegroundColor Green
    Write-Host (Decode-Text "5omT5byA5qGM6Z2i55qE4oCcQ29kZXgg5pyI5rW354mI4oCd5Y2z5Y+v57un57ut5L2/55So44CC")
}
catch {
    $exitCode = 1
    $technicalError = $_.Exception.Message
    $errorMessage = Get-FriendlyError $technicalError
    Write-InstallResult "failed" $errorMessage $technicalError
    if (-not $transcriptStarted) {
        [System.IO.File]::WriteAllText($logPath, $technicalError, $utf8NoBom)
    }
    Write-Host ""
    Write-Host (Decode-Text "5a6J6KOF5rKh5pyJ5a6M5oiQ") -ForegroundColor Red
    Write-Host $errorMessage -ForegroundColor Red
}
finally {
    if ($transcriptStarted) {
        try { Stop-Transcript | Out-Null } catch { }
    }
}

Write-Host ""
Write-Host ((Decode-Text "5a6M5pW05pel5b+X77ya") + $logPath)
if (-not $env:MOONSEA_NONINTERACTIVE) {
    Write-Host (Decode-Text "5oyJ5Lu75oSP6ZSu5YWz6Zet56qX5Y+j44CC")
}
exit $exitCode
