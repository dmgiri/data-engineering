[CmdletBinding()]
param(
    [switch]$OpenBrowser,
    [switch]$CheckOnly,
    [string]$NodeCommand = 'node',
    [string]$NpmCommand = 'npm.cmd'
)

$ErrorActionPreference = 'Stop'
$ProjectDirectory = $PSScriptRoot
$AppUrl = 'http://127.0.0.1:4317'

function Test-StudyApp {
    try {
        $snapshot = Invoke-RestMethod -Uri "$AppUrl/api/bootstrap" -Method Get -TimeoutSec 2
        return $null -ne $snapshot.questions
    }
    catch { return $false }
}

function Test-AppPort {
    $client = New-Object Net.Sockets.TcpClient
    try {
        $pending = $client.BeginConnect('127.0.0.1', 4317, $null, $null)
        if (-not $pending.AsyncWaitHandle.WaitOne(500)) { return $false }
        $client.EndConnect($pending)
        return $true
    }
    catch { return $false }
    finally { $client.Close() }
}

try {
    $buildEntry = Join-Path $ProjectDirectory 'build/index.html'
    if (-not (Test-Path -LiteralPath $buildEntry -PathType Leaf)) {
        throw 'Production build not found. Run .\install.ps1 first.'
    }

    $rawVersion = & $NodeCommand --version 2>$null
    if ($LASTEXITCODE -ne 0 -or -not $rawVersion) { throw 'Node.js 24 or newer is required.' }
    $version = [version](($rawVersion | Select-Object -First 1).Trim() -replace '^v', '')
    if ($version.Major -lt 24) { throw "Node.js 24 or newer is required. Found $version." }

    if (Test-StudyApp) {
        Write-Host "Engineer Prep is already running at $AppUrl" -ForegroundColor Green
        if ($OpenBrowser -and -not $CheckOnly) { Start-Process $AppUrl }
        exit 0
    }
    if (Test-AppPort) { throw 'Port 4317 is already used by another application. Close it and try again.' }

    if ($CheckOnly) {
        Write-Host 'Production application is ready to start.' -ForegroundColor Green
        exit 0
    }

    Write-Host "Starting Engineer Prep at $AppUrl" -ForegroundColor Cyan
    Write-Host 'Keep this window open. Press Ctrl+C here to stop the application.'
    if ($OpenBrowser) {
        $null = Start-Job -ScriptBlock {
            param($Url)
            for ($attempt = 0; $attempt -lt 30; $attempt++) {
                Start-Sleep -Milliseconds 500
                try {
                    $null = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
                    Start-Process $Url
                    return
                }
                catch { }
            }
        } -ArgumentList $AppUrl
    }

    Push-Location $ProjectDirectory
    try {
        & $NpmCommand run serve
        if ($LASTEXITCODE -ne 0) { throw "Production server stopped with exit code $LASTEXITCODE." }
    }
    finally { Pop-Location }
}
catch {
    Write-Error $_.Exception.Message
    exit 1
}

