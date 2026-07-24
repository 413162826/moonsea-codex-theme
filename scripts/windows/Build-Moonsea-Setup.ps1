[CmdletBinding()]
param(
    [string]$OutputDirectory,
    [switch]$SkipTests
)

$ErrorActionPreference = "Stop"
$sourceRoot = [System.IO.Path]::GetFullPath(
    (Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)))
)
if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
    $OutputDirectory = Join-Path $sourceRoot ".build\windows-release"
}
$OutputDirectory = [System.IO.Path]::GetFullPath($OutputDirectory)
$buildRoot = Join-Path $sourceRoot ".build"
if (-not $OutputDirectory.StartsWith(
    $buildRoot + [System.IO.Path]::DirectorySeparatorChar,
    [System.StringComparison]::OrdinalIgnoreCase
)) {
    throw "Windows release output must stay inside .build: $OutputDirectory"
}

$stage = Join-Path $OutputDirectory "Moonsea-Codex-Windows-x64"
$launcherOutput = Join-Path $OutputDirectory "launcher"
$setupOutput = Join-Path $OutputDirectory "setup"
foreach ($target in @($stage, $launcherOutput, $setupOutput)) {
    if (Test-Path -LiteralPath $target) {
        Remove-Item -LiteralPath $target -Recurse -Force
    }
    New-Item -ItemType Directory -Path $target -Force | Out-Null
}
New-Item -ItemType Directory -Path (Join-Path $stage "tools") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $stage "scripts\windows") -Force | Out-Null

$packageMetadata = Get-Content -LiteralPath (Join-Path $sourceRoot "package.json") -Raw -Encoding UTF8 | ConvertFrom-Json
$version = [string]$packageMetadata.version
$bunCommand = Get-Command bun.exe -ErrorAction SilentlyContinue
$bunPath = if ($null -ne $bunCommand) {
    $bunCommand.Source
}
else {
    Join-Path $env:LOCALAPPDATA "Microsoft\WinGet\Links\bun.exe"
}
if (-not (Test-Path -LiteralPath $bunPath -PathType Leaf)) {
    throw "Bun is required to compile Windows executables."
}

$isccCandidates = @(
    (Join-Path $env:LOCALAPPDATA "Programs\Inno Setup 6\ISCC.exe"),
    "C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
)
$isccPath = $isccCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $isccPath) { throw "Inno Setup 6 is required to build Setup.exe." }

Push-Location $sourceRoot
try {
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "Moonsea build failed." }

    Copy-Item -LiteralPath @(
        (Join-Path $sourceRoot "README.md"),
        (Join-Path $sourceRoot "LICENSE"),
        (Join-Path $sourceRoot "ASSET-LICENSE.md"),
        (Join-Path $sourceRoot "package.json"),
        (Join-Path $sourceRoot "Install.cmd"),
        (Join-Path $sourceRoot "Uninstall.cmd")
    ) -Destination $stage
    foreach ($directory in @("theme", "assets", "site", "admin")) {
        Copy-Item -LiteralPath (Join-Path $sourceRoot $directory) -Destination $stage -Recurse
    }
    Copy-Item -Path (Join-Path $sourceRoot "scripts\windows\*") -Destination (Join-Path $stage "scripts\windows")

    & $bunPath build ".\src\build-static.mjs" --compile --target=bun-windows-x64 --outfile (Join-Path $stage "tools\moonsea-builder.exe")
    if ($LASTEXITCODE -ne 0) { throw "Moonsea builder compilation failed." }
    & $bunPath build ".\src\manager.mjs" --compile --target=bun-windows-x64 --outfile (Join-Path $stage "tools\moonsea-manager.exe")
    if ($LASTEXITCODE -ne 0) { throw "Moonsea manager compilation failed." }

    dotnet publish ".\installer\windows\launcher\MoonseaLauncher.csproj" `
        -c Release `
        -o $launcherOutput `
        --nologo
    if ($LASTEXITCODE -ne 0) { throw "Moonsea launcher compilation failed." }

    $env:MOONSEA_PROJECT_ROOT = $stage
    & (Join-Path $stage "tools\moonsea-builder.exe") --theme-version | Out-Null
    Remove-Item Env:MOONSEA_PROJECT_ROOT

    if (-not $SkipTests) {
        & ".\tests\windows-installer-smoke.ps1" `
            -PackageRoot $stage `
            -BuilderPath (Join-Path $stage "tools\moonsea-builder.exe")
    }

    & $isccPath `
        "/DAppVersion=$version" `
        "/DPackageRoot=$stage" `
        "/DLauncherPath=$(Join-Path $launcherOutput 'MoonseaLauncher.exe')" `
        "/O$setupOutput" `
        ".\installer\windows\Moonsea.iss"
    if ($LASTEXITCODE -ne 0) { throw "Inno Setup compilation failed." }

    $setupPath = Join-Path $setupOutput "Moonsea-Codex-Windows-x64-Setup.exe"
    if (-not $SkipTests) {
        & ".\tests\windows-setup-smoke.ps1" -SetupPath $setupPath
    }
    Write-Output $setupPath
}
finally {
    Pop-Location
    Remove-Item Env:MOONSEA_PROJECT_ROOT -ErrorAction SilentlyContinue
}
