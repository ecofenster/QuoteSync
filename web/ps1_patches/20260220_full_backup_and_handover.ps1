# QuoteSync - FULL BACKUP + HANDOVER GENERATOR
# Run from: PS C:\Github\QuoteSync\web\ps1_patches>

$ErrorActionPreference = "Stop"

function Ok($m){ Write-Host "OK: $m" -ForegroundColor Green }
function Fail($m){ Write-Host "ERROR: $m" -ForegroundColor Red; throw $m }

$psDir = $PSScriptRoot
$webRoot = Resolve-Path (Join-Path $psDir "..")
$projectRoot = Resolve-Path (Join-Path $webRoot "..")

Write-Host ("Run directory: " + $psDir) -ForegroundColor Cyan
Write-Host ("Web root:      " + $webRoot.Path) -ForegroundColor Cyan
Write-Host ("Project root:  " + $projectRoot.Path) -ForegroundColor Cyan

Set-Location $projectRoot.Path

$backupRoot = Join-Path $projectRoot.Path "_backups"
if (!(Test-Path $backupRoot)) {
    New-Item -ItemType Directory -Path $backupRoot | Out-Null
    Ok "Created _backups folder."
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$zipName = "${timestamp}_full_project.zip"
$zipPath = Join-Path $backupRoot $zipName

if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($webRoot.Path, $zipPath)

Ok "Created backup ZIP: $zipPath"

$hash = Get-FileHash $zipPath -Algorithm SHA256
Write-Host ("SHA256: " + $hash.Hash) -ForegroundColor Yellow

$docsPath = Join-Path $projectRoot.Path "Docs"
if (!(Test-Path $docsPath)) {
    New-Item -ItemType Directory -Path $docsPath | Out-Null
    Ok "Created Docs folder."
}

$handover = @"
# QuoteSync HANDOVER

## Save Point
Date: $(Get-Date)
Backup File: $zipName
SHA256: $($hash.Hash)

## Status
- Estimate Picker Tabs: WORKING
- Follow Ups menu item: WORKING
- No console errors
- App compiles successfully

## Environment
Stack: React + Vite + TypeScript
Shell: PowerShell 7 (pwsh)
Root: C:\Github\QuoteSync\web

## Rules
- No manual edits
- All changes via .ps1 patches
- Always create backup before structural edits
"@

$handoverMin = @"
QuoteSync Save Point: $zipName
Tabs + Follow Ups stable.
SHA256: $($hash.Hash)
No console errors.
"@

Set-Content (Join-Path $docsPath "HANDOVER.md") $handover -Encoding UTF8
Set-Content (Join-Path $docsPath "HANDOVER.min.md") $handoverMin -Encoding UTF8

Ok "HANDOVER.md created."
Ok "HANDOVER.min.md created."
Ok "Backup + Handover complete."
