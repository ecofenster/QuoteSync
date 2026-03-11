# QuoteSync emergency restore: revert EstimatePickerTabs.tsx from latest backup
# Purpose: fix runtime crash "estimatePickerTab is not defined" by rolling back the file to last known good in _backups.
#
# Run from: PS C:\Github\QuoteSync\web\ps1_patches>
#   Unblock-File .\THIS_SCRIPT.ps1
#   pwsh -ExecutionPolicy Bypass -File .\THIS_SCRIPT.ps1

$ErrorActionPreference = "Stop"

function Fail($m){ Write-Host "ERROR: $m" -ForegroundColor Red; throw $m }
function Ok($m){ Write-Host "OK: $m" -ForegroundColor Green }
function Warn($m){ Write-Host "WARN: $m" -ForegroundColor Yellow }

$runDir = (Get-Location).Path
Write-Host ("Run directory: " + $runDir)

$webRoot = Resolve-Path (Join-Path $runDir "..") | Select-Object -ExpandProperty Path
if (-not (Test-Path (Join-Path $webRoot "package.json"))) { Fail "Could not detect web root (package.json not found) at: $webRoot" }
Ok ("Detected web root: " + $webRoot)

$targetRel = "src\features\estimatePicker\EstimatePickerTabs.tsx"
$targetPath = Join-Path $webRoot $targetRel
if (-not (Test-Path $targetPath)) { Fail "Missing target file: $targetPath" }

$backupsRoot = Join-Path $webRoot "_backups"
if (-not (Test-Path $backupsRoot)) { Fail "Backups folder not found: $backupsRoot" }

# Find latest backup folder that contains a backed-up EstimatePickerTabs.tsx
$backupFiles = Get-ChildItem -Path $backupsRoot -Directory -ErrorAction Stop |
  Sort-Object Name -Descending |
  ForEach-Object {
    $candidate = Join-Path $_.FullName "EstimatePickerTabs.tsx"
    if (Test-Path $candidate) {
      [PSCustomObject]@{ Folder = $_.FullName; File = $candidate }
    }
  }

if (-not $backupFiles -or $backupFiles.Count -eq 0) {
  Fail "No backup file found at web\_backups\<stamp>\EstimatePickerTabs.tsx. Cannot restore."
}

$pick = $backupFiles | Select-Object -First 1
Ok ("Latest candidate backup: " + $pick.File)

# Safety: create a new backup of CURRENT target before restoring
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$restoreBackupDir = Join-Path $backupsRoot ("RESTORE_" + $stamp)
New-Item -ItemType Directory -Force -Path $restoreBackupDir | Out-Null
Copy-Item -Force $targetPath (Join-Path $restoreBackupDir "EstimatePickerTabs.tsx")
Ok ("Backed up CURRENT file to: " + (Join-Path $restoreBackupDir "EstimatePickerTabs.tsx"))

# Restore
Copy-Item -Force $pick.File $targetPath
Ok ("Restored " + $targetRel + " from: " + $pick.Folder)

Write-Host ""
Write-Host "Starting dev server..." -ForegroundColor Cyan
Push-Location $webRoot
try { npm run dev } finally { Pop-Location }

Write-Host ""
Write-Host "DONE" -ForegroundColor Cyan
Write-Host "If the app is back up, please upload the CURRENT EstimatePickerTabs.tsx so we can re-apply the notes/files fixes without reintroducing the crash." -ForegroundColor Cyan
