[CmdletBinding()]
param(
    [switch]$NonInteractive,
    [switch]$DryRun,
    [string]$UserName = '',
    [ValidateSet('Ask', 'Yes', 'No')]
    [string]$InstallDependencies = 'Ask',
    [string]$RestoreBackupPath = '',
    [ValidateSet('Ask', 'Yes', 'No')]
    [string]$CreateDesktopShortcut = 'Ask',
    [ValidateSet('Ask', 'Yes', 'No')]
    [string]$StartAfterInstall = 'Ask',
    [ValidateSet('Ask', 'Yes', 'No')]
    [string]$OpenBrowser = 'Ask',
    [string]$NodeCommand = 'node',
    [string]$NpmCommand = 'npm.cmd'
)

$ErrorActionPreference = 'Stop'
$ProjectDirectory = $PSScriptRoot
$AppUrl = 'http://127.0.0.1:4317'

function Resolve-Choice {
    param([string]$Value, [string]$Prompt, [bool]$Default)
    if ($Value -eq 'Yes') { return $true }
    if ($Value -eq 'No') { return $false }
    if ($NonInteractive) { return $Default }
    $suffix = if ($Default) { '[Y/n]' } else { '[y/N]' }
    $answer = (Read-Host "$Prompt $suffix").Trim()
    if (-not $answer) { return $Default }
    return $answer -match '^(?i:y|yes)$'
}

function Assert-NodeVersion {
    try { $rawVersion = & $NodeCommand --version 2>$null }
    catch { throw 'Node.js 24 or newer is required. Install it from https://nodejs.org/ and run this installer again.' }
    if ($LASTEXITCODE -ne 0 -or -not $rawVersion) {
        throw 'Node.js 24 or newer is required. Install it from https://nodejs.org/ and run this installer again.'
    }
    try { $version = [version](($rawVersion | Select-Object -First 1).Trim() -replace '^v', '') }
    catch { throw "Could not read the Node.js version from '$rawVersion'. Node.js 24 or newer is required." }
    if ($version.Major -lt 24) {
        throw "Node.js 24 or newer is required. Found $version."
    }
    return $version
}

function Invoke-NpmStep {
    param([string[]]$Arguments, [string]$Description)
    Write-Host "`n$Description" -ForegroundColor Cyan
    & $NpmCommand @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Description failed with exit code $LASTEXITCODE." }
}

function Test-StudyApp {
    try {
        $snapshot = Invoke-RestMethod -Uri "$AppUrl/api/bootstrap" -Method Get -TimeoutSec 2
        return $null -ne $snapshot.questions
    }
    catch { return $false }
}

function Wait-ForStudyApp {
    param([Diagnostics.Process]$ServerProcess, [string]$Purpose)
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        Start-Sleep -Milliseconds 500
        if (Test-StudyApp) { return }
        if ($ServerProcess.HasExited) { break }
    }
    throw "The local production server did not become ready for $Purpose."
}

function Read-InstallerUserName {
    param([bool]$HasExistingData)
    while ($true) {
        if ($HasExistingData) { Write-Host 'Enter your name (leave blank to keep existing): ' -NoNewline }
        else { Write-Host 'Enter your name: ' -NoNewline }
        $value = (Read-Host).Trim()
        if ($value -or $HasExistingData) { return $value }
        Write-Host 'A name is required for the first installation.' -ForegroundColor Yellow
    }
}

function Set-StudyUserName {
    param([string]$Name)
    $serverProcess = $null
    try {
        if (-not (Test-StudyApp)) {
            $serverProcess = Start-Process -FilePath $NodeCommand -ArgumentList 'server/index.mjs' -WorkingDirectory $ProjectDirectory -WindowStyle Hidden -PassThru
            Wait-ForStudyApp $serverProcess 'profile setup'
        }
        $headers = @{ 'X-Study-Client' = 'local' }
        $body = @{ name = $Name } | ConvertTo-Json -Compress
        $null = Invoke-RestMethod -Uri "$AppUrl/api/settings" -Method Put -Headers $headers -ContentType 'application/json' -Body $body -TimeoutSec 30
        Write-Host "Dashboard name saved as $Name." -ForegroundColor Green
    }
    finally {
        if ($serverProcess -and -not $serverProcess.HasExited) {
            Stop-Process -Id $serverProcess.Id -Force -ErrorAction SilentlyContinue
            $serverProcess.WaitForExit(5000) | Out-Null
        }
    }
}

function Restore-StudyBackup {
    param([string]$BackupPath)
    $raw = Get-Content -LiteralPath $BackupPath -Raw
    try { $null = $raw | ConvertFrom-Json }
    catch { throw "Backup is not valid JSON: $BackupPath" }

    $serverProcess = $null
    try {
        if (-not (Test-StudyApp)) {
            $serverProcess = Start-Process -FilePath $NodeCommand -ArgumentList 'server/index.mjs' -WorkingDirectory $ProjectDirectory -WindowStyle Hidden -PassThru
            Wait-ForStudyApp $serverProcess 'backup restoration'
        }
        $headers = @{ 'X-Study-Client' = 'local' }
        $null = Invoke-RestMethod -Uri "$AppUrl/api/import" -Method Post -Headers $headers -ContentType 'application/json' -Body $raw -TimeoutSec 30
        Write-Host 'Backup restored successfully.' -ForegroundColor Green
    }
    finally {
        if ($serverProcess -and -not $serverProcess.HasExited) {
            Stop-Process -Id $serverProcess.Id -Force -ErrorAction SilentlyContinue
            $serverProcess.WaitForExit(5000) | Out-Null
        }
    }
}

function New-StudyShortcut {
    $desktop = [Environment]::GetFolderPath('Desktop')
    $shortcutPath = Join-Path $desktop 'Engineer Prep.lnk'
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = Join-Path $PSHOME 'powershell.exe'
    $launcher = Join-Path $ProjectDirectory 'start-app.ps1'
    $shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$launcher`" -OpenBrowser"
    $shortcut.WorkingDirectory = $ProjectDirectory
    $shortcut.Description = 'Start Engineer Prep locally'
    $shortcut.Save()
    Write-Host "Desktop shortcut created: $shortcutPath" -ForegroundColor Green
}

try {
    Write-Host 'Engineer Prep - production installer' -ForegroundColor Magenta
    Write-Host "Location: $ProjectDirectory"
    $nodeVersion = Assert-NodeVersion
    Write-Host "Node.js $nodeVersion detected."

    $hasExistingData = Test-Path -LiteralPath (Join-Path $ProjectDirectory '.data/study.sqlite') -PathType Leaf
    $name = $UserName.Trim()
    if (-not $NonInteractive -and -not $name) { $name = Read-InstallerUserName $hasExistingData }
    if ($name.Length -gt 40) { throw 'Your name must be 40 characters or fewer.' }

    $install = Resolve-Choice $InstallDependencies 'Install dependencies now?' $true
    $shortcut = Resolve-Choice $CreateDesktopShortcut 'Create a desktop shortcut?' $false
    $start = Resolve-Choice $StartAfterInstall 'Start the application after installation?' $true
    $open = if ($start) { Resolve-Choice $OpenBrowser 'Open the application in your browser?' $true } else { $false }

    $backup = $RestoreBackupPath
    if (-not $backup -and -not $NonInteractive) {
        if (Resolve-Choice 'Ask' 'Restore a study backup?' $false) {
            $backup = (Read-Host 'Enter the full path to the backup JSON file').Trim('"')
        }
    }
    if ($backup) {
        $backup = [IO.Path]::GetFullPath($backup)
        if (-not (Test-Path -LiteralPath $backup -PathType Leaf)) { throw "Backup file not found: $backup" }
    }

    if ($DryRun) {
        Write-Host "`nPRODUCTION INSTALLATION PLAN" -ForegroundColor Yellow
        Write-Host "Project: $ProjectDirectory"
        Write-Host "Preserve data: $(Join-Path $ProjectDirectory '.data')"
        Write-Host "User name: $(if ($name) { $name } else { 'keep existing' })"
        Write-Host "Dependencies: $(if ($install) { "$NpmCommand install" } else { 'skip' })"
        Write-Host "Build: $NpmCommand run build"
        Write-Host "Restore backup: $(if ($backup) { $backup } else { 'no' })"
        Write-Host "Desktop shortcut: $(if ($shortcut) { 'create' } else { 'no' })"
        Write-Host "Start application: $(if ($start) { 'yes' } else { 'no' })"
        Write-Host "Open browser: $(if ($open) { 'yes' } else { 'no' })"
        exit 0
    }

    Push-Location $ProjectDirectory
    try {
        if ($install) { Invoke-NpmStep @('install') 'Installing production dependencies...' }
        Invoke-NpmStep @('run', 'build') 'Building the production application...'
        if ($backup) { Restore-StudyBackup $backup }
        if ($name) { Set-StudyUserName $name }
        if ($shortcut) { New-StudyShortcut }
    }
    finally { Pop-Location }

    Write-Host "`nInstallation complete. Your existing .data folder was preserved." -ForegroundColor Green
    Write-Host "Application URL: $AppUrl"
    if ($start) {
        $launcher = Join-Path $ProjectDirectory 'start-app.ps1'
        $arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$launcher`""
        if ($open) { $arguments += ' -OpenBrowser' }
        Start-Process -FilePath (Join-Path $PSHOME 'powershell.exe') -ArgumentList $arguments -WorkingDirectory $ProjectDirectory
        Write-Host 'The production application is starting in a separate window.'
    }
}
catch {
    Write-Error $_.Exception.Message
    exit 1
}
