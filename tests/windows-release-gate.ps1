[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$PreviousSetupPath,
    [Parameter(Mandatory = $true)]
    [string]$CandidateSetupPath,
    [Parameter(Mandatory = $true)]
    [string]$CandidateVersion,
    [switch]$AllowSystemChanges
)

$ErrorActionPreference = "Stop"
$sourceRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$testRoot = Join-Path $sourceRoot ".build\windows-release-gate"
$customRoot = Join-Path $testRoot "custom install\MoonseaCodex"
$defaultRoot = Join-Path $env:LOCALAPPDATA "MoonseaCodex"
$sourceApp = Join-Path $testRoot "Official-Windows"
$fakeCodexOutput = Join-Path $testRoot "fake-codex"
$evidencePath = Join-Path $testRoot "evidence.json"
$fixturePort = 18420
$managerPort = 18421
$fixtureServer = $null

if ($env:GITHUB_ACTIONS -ne "true" -or -not $AllowSystemChanges) {
    throw "This release gate may only run in GitHub Actions with -AllowSystemChanges."
}
if (Test-Path -LiteralPath $defaultRoot) {
    throw "The runner is not clean: $defaultRoot already exists."
}

$PreviousSetupPath = [System.IO.Path]::GetFullPath($PreviousSetupPath)
$CandidateSetupPath = [System.IO.Path]::GetFullPath($CandidateSetupPath)
foreach ($setupPath in @($PreviousSetupPath, $CandidateSetupPath)) {
    if (-not (Test-Path -LiteralPath $setupPath -PathType Leaf)) {
        throw "Setup file does not exist: $setupPath"
    }
}

function Invoke-Setup([string]$SetupPath, [string]$InstallRoot, [string]$LogPath) {
    $process = Start-Process -FilePath $SetupPath -ArgumentList @(
        "/VERYSILENT",
        "/SUPPRESSMSGBOXES",
        "/NORESTART",
        "/NOICONS",
        "/DIR=`"$InstallRoot`"",
        "/LOG=`"$LogPath`""
    ) -WindowStyle Hidden -Wait -PassThru
    if ($process.ExitCode -ne 0) {
        $log = if (Test-Path -LiteralPath $LogPath) {
            Get-Content -LiteralPath $LogPath -Raw -Encoding UTF8
        } else {
            "Setup log was not created."
        }
        throw "Setup failed with exit code $($process.ExitCode).`n$log"
    }
}

function Get-Manifest([string]$InstallRoot) {
    $path = Join-Path $InstallRoot "install.json"
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Missing install manifest: $path"
    }
    return Get-Content -LiteralPath $path -Raw -Encoding UTF8 | ConvertFrom-Json
}

function Wait-Until([scriptblock]$Condition, [int]$TimeoutSeconds, [string]$FailureMessage) {
    $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
    do {
        try {
            $value = & $Condition
            if ($null -ne $value -and $value -ne $false) { return $value }
        } catch { }
        Start-Sleep -Milliseconds 250
    } while ([DateTime]::UtcNow -lt $deadline)
    throw $FailureMessage
}

function Invoke-ManagerApi([string]$Method, [string]$Path) {
    $parameters = @{
        Method = $Method
        Uri = "http://127.0.0.1:$managerPort$Path"
        Headers = @{ Host = "127.0.0.1:$managerPort" }
        TimeoutSec = 5
    }
    if ($Method -eq "POST") {
        $parameters.ContentType = "application/json"
        $parameters.Body = "{}"
    }
    return Invoke-RestMethod @parameters
}

function Stop-TestProcesses {
    $roots = @(
        [System.IO.Path]::GetFullPath($testRoot),
        [System.IO.Path]::GetFullPath($defaultRoot)
    )
    Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
        $process = $_
        $roots | Where-Object {
            ($process.ExecutablePath -and $process.ExecutablePath.StartsWith(
                $_ + [System.IO.Path]::DirectorySeparatorChar,
                [System.StringComparison]::OrdinalIgnoreCase
            )) -or
            ($process.CommandLine -and $process.CommandLine.IndexOf(
                $_,
                [System.StringComparison]::OrdinalIgnoreCase
            ) -ge 0)
        }
    } | ForEach-Object {
        Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    }
}

function Remove-TestRoot([string]$Path, [string]$ExpectedPath) {
    $resolved = [System.IO.Path]::GetFullPath($Path).TrimEnd("\")
    $expected = [System.IO.Path]::GetFullPath($ExpectedPath).TrimEnd("\")
    if (-not [string]::Equals($resolved, $expected, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to remove unexpected path: $resolved"
    }
    if (Test-Path -LiteralPath $resolved) {
        Remove-Item -LiteralPath $resolved -Recurse -Force
    }
}

try {
    New-Item -ItemType Directory -Path $testRoot -Force | Out-Null
    node (Join-Path $sourceRoot "tests\create-fixture.mjs") windows $sourceApp | Out-Null
    dotnet publish (Join-Path $sourceRoot "tests\fixtures\fake-codex\FakeCodex.csproj") `
        -c Release `
        -o $fakeCodexOutput `
        --nologo | Out-Host
    Copy-Item -LiteralPath (Join-Path $fakeCodexOutput "ChatGPT.exe") `
        -Destination (Join-Path $sourceApp "ChatGPT.exe") -Force

    $env:MOONSEA_SOURCE_APP = $sourceApp
    $env:MOONSEA_SKIP_LAUNCH = "1"
    $env:MOONSEA_SKIP_SHORTCUT = "1"
    Invoke-Setup $PreviousSetupPath $customRoot (Join-Path $testRoot "previous-custom.log")
    Invoke-Setup $PreviousSetupPath $defaultRoot (Join-Path $testRoot "previous-default.log")

    $customBefore = Get-Manifest $customRoot
    $defaultBefore = Get-Manifest $defaultRoot
    if ($customBefore.appVersion -eq $CandidateVersion) {
        throw "Previous Setup unexpectedly has the candidate version."
    }
    $defaultUpdatedAt = [string]$defaultBefore.updatedAt
    $profileMarker = Join-Path $customRoot "BrowserProfile\release-gate.marker"
    $adminMarker = Join-Path $customRoot "admin-access.enabled"
    New-Item -ItemType Directory -Path (Split-Path -Parent $profileMarker) -Force | Out-Null
    [System.IO.File]::WriteAllText($profileMarker, "preserve")
    [System.IO.File]::WriteAllText($adminMarker, "enabled")

    Remove-Item Env:\MOONSEA_SKIP_LAUNCH -ErrorAction SilentlyContinue
    $env:MOONSEA_MANAGER_PORT = [string]$managerPort
    $env:MOONSEA_UPDATE_MANIFEST_URL = "http://127.0.0.1:$fixturePort/update.json"
    $fixtureServer = Start-Process -FilePath "node" -ArgumentList @(
        "`"$(Join-Path $sourceRoot "tests\update-fixture-server.mjs")`"",
        "--port", [string]$fixturePort,
        "--file", "`"$CandidateSetupPath`"",
        "--version", $CandidateVersion
    ) -WindowStyle Hidden -PassThru
    Wait-Until {
        Invoke-RestMethod -Uri "http://127.0.0.1:$fixturePort/update.json" -TimeoutSec 2
    } 15 "The update fixture server did not start." | Out-Null

    $oldApp = Join-Path $customBefore.activeBuild "ChatGPT.exe"
    Start-Process -FilePath $oldApp -ArgumentList @(
        "--user-data-dir=`"$($customBefore.profilePath)`"",
        "--remote-debugging-address=127.0.0.1",
        "--remote-debugging-port=0"
    ) -WindowStyle Hidden | Out-Null
    $oldMain = Wait-Until {
        Get-CimInstance Win32_Process -Filter "Name = 'ChatGPT.exe'" -ErrorAction SilentlyContinue |
            Where-Object {
                $_.ExecutablePath -and
                $_.ExecutablePath.StartsWith(
                    [string]$customBefore.activeBuild,
                    [System.StringComparison]::OrdinalIgnoreCase
                ) -and
                $_.CommandLine -match "--moonsea-fixture-main"
            } |
            Select-Object -First 1
    } 15 "The fake Codex main process did not start."

    Start-Process -FilePath ([string]$customBefore.managerPath) -ArgumentList @(
        "--install-root", "`"$customRoot`"",
        "--profile-path", "`"$($customBefore.profilePath)`"",
        "--app-pid", [string]$oldMain.ProcessId
    ) -WindowStyle Hidden | Out-Null
    $oldStatus = Wait-Until {
        $response = Invoke-ManagerApi "GET" "/api/status"
        if ($response.appVersion -eq $customBefore.appVersion) { return $response }
        return $false
    } 20 "The previous manager did not start."

    $available = Wait-Until {
        $response = Invoke-ManagerApi "GET" "/api/update/status"
        if ($response.update.status -eq "available") { return $response.update }
        return $false
    } 30 "The previous manager did not discover the candidate update."
    Invoke-ManagerApi "POST" "/api/update/download" | Out-Null
    $ready = Wait-Until {
        $response = Invoke-ManagerApi "GET" "/api/update/status"
        if ($response.update.status -eq "ready") { return $response.update }
        if ($response.update.status -eq "error") {
            throw "Candidate download failed: $($response.update.error)"
        }
        return $false
    } 180 "The candidate Setup was not downloaded and verified before the deadline."

    try {
        Invoke-ManagerApi "POST" "/api/update/install" | Out-Null
    } catch {
        # The manager intentionally shuts down after accepting installation.
    }

    $customAfter = Wait-Until {
        $manifest = Get-Manifest $customRoot
        if ($manifest.appVersion -eq $CandidateVersion) { return $manifest }
        return $false
    } 240 "The candidate was not installed into the original custom directory."
    $newStatus = Wait-Until {
        $response = Invoke-ManagerApi "GET" "/api/status"
        if ($response.appVersion -eq $CandidateVersion) { return $response }
        return $false
    } 60 "The candidate manager did not restart."

    $defaultAfter = Get-Manifest $defaultRoot
    if ($defaultAfter.appVersion -ne $defaultBefore.appVersion -or
        [string]$defaultAfter.updatedAt -ne $defaultUpdatedAt) {
        throw "The candidate incorrectly updated the stale default installation."
    }
    if (-not (Test-Path -LiteralPath $profileMarker -PathType Leaf) -or
        -not (Test-Path -LiteralPath $adminMarker -PathType Leaf)) {
        throw "The update did not preserve profile or admin markers."
    }

    $customProcesses = @(Get-CimInstance Win32_Process -Filter "Name = 'ChatGPT.exe'" |
        Where-Object {
            $_.ExecutablePath -and
            $_.ExecutablePath.StartsWith(
                [string]$customAfter.activeBuild,
                [System.StringComparison]::OrdinalIgnoreCase
            ) -and
            $_.CommandLine -match "--moonsea-fixture-main"
        })
    $defaultProcesses = @(Get-CimInstance Win32_Process -Filter "Name = 'ChatGPT.exe'" |
        Where-Object {
            $_.ExecutablePath -and
            $_.ExecutablePath.StartsWith(
                [string]$defaultAfter.activeBuild,
                [System.StringComparison]::OrdinalIgnoreCase
            )
        })
    if ($customProcesses.Count -ne 1) {
        throw "Expected exactly one candidate Codex main process, found $($customProcesses.Count)."
    }
    if ($defaultProcesses.Count -ne 0) {
        throw "The stale default installation was started."
    }

    $appProcessId = [int]$customProcesses[0].ProcessId
    $managerPid = [int](Get-Content -LiteralPath (Join-Path $customRoot "manager.pid") -Raw -Encoding UTF8)
    $managerProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $managerPid"
    if ($null -eq $managerProcess) {
        throw "The candidate manager process is not running."
    }
    Stop-Process -Id $appProcessId -Force
    Wait-Until {
        if ($null -eq (Get-Process -Id $managerPid -ErrorAction SilentlyContinue)) {
            return $true
        }
        return $false
    } 10 "The candidate manager did not exit with the real Codex main process." | Out-Null

    $setupLogPath = Join-Path $customRoot "updates\setup-$CandidateVersion.log"
    $setupLog = Get-Content -LiteralPath $setupLogPath -Raw -Encoding UTF8
    if ($setupLog.IndexOf($customRoot, [System.StringComparison]::OrdinalIgnoreCase) -lt 0) {
        throw "The Setup log does not confirm the original custom directory."
    }

    $evidence = [ordered]@{
        previousVersion = [string]$customBefore.appVersion
        candidateVersion = [string]$customAfter.appVersion
        customInstallRoot = $customRoot
        staleDefaultVersion = [string]$defaultAfter.appVersion
        activeBuild = [string]$customAfter.activeBuild
        appProcessId = $appProcessId
        managerProcessId = $managerPid
        managerAppProcessId = $appProcessId
        profilePreserved = $true
        adminAccessPreserved = $true
        candidateSha256 = (Get-FileHash -LiteralPath $CandidateSetupPath -Algorithm SHA256).Hash.ToLowerInvariant()
        completedAt = (Get-Date).ToUniversalTime().ToString("o")
    }
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText(
        $evidencePath,
        ($evidence | ConvertTo-Json -Depth 4),
        $utf8NoBom
    )
    Write-Host "Windows release gate passed. Evidence: $evidencePath"
}
finally {
    if ($null -ne $fixtureServer) {
        Stop-Process -Id $fixtureServer.Id -Force -ErrorAction SilentlyContinue
    }
    Stop-TestProcesses
    Remove-TestRoot $defaultRoot (Join-Path $env:LOCALAPPDATA "MoonseaCodex")
    Remove-Item Env:\MOONSEA_SOURCE_APP -ErrorAction SilentlyContinue
    Remove-Item Env:\MOONSEA_SKIP_LAUNCH -ErrorAction SilentlyContinue
    Remove-Item Env:\MOONSEA_SKIP_SHORTCUT -ErrorAction SilentlyContinue
    Remove-Item Env:\MOONSEA_MANAGER_PORT -ErrorAction SilentlyContinue
    Remove-Item Env:\MOONSEA_UPDATE_MANIFEST_URL -ErrorAction SilentlyContinue
}
