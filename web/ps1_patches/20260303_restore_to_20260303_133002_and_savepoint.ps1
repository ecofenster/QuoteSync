# =========================
# QuoteSync EMERGENCY RESTORE (to 20260303_133002) + Save Point
# Restores the last known "working again" Estimate Picker set
# Run from: PS C:\Github\QuoteSync\web\ps1_patches>
# =========================

$ErrorActionPreference = "Stop"

function Ok($m){ Write-Host "OK: $m" -ForegroundColor Green }
function Warn($m){ Write-Host "WARN: $m" -ForegroundColor Yellow }
function Fail($m){ Write-Host "ERROR: $m" -ForegroundColor Red; throw $m }

$runDir = (Get-Location).Path
Write-Host "Run directory: $runDir"

# Detect web root
$webRoot = $null
if (Test-Path (Join-Path $runDir "..\src\App.tsx")) {
  $webRoot = (Resolve-Path (Join-Path $runDir "..")).Path
} elseif (Test-Path (Join-Path $runDir "src\App.tsx")) {
  $webRoot = (Resolve-Path $runDir).Path
} else {
  Fail "Could not detect web root. Expected to run from ...\web\ps1_patches or ...\web"
}
Ok "Detected web root: $webRoot"

$backupRoot = Join-Path $webRoot "_backups"
if (!(Test-Path $backupRoot)) { Fail "Missing backups folder: $backupRoot" }

# Source restore point (known-good for 'working again' earlier today)
$sourceName = "20260303_133002"
$sourceDir = Join-Path $backupRoot $sourceName
if (!(Test-Path $sourceDir)) {
  $recent = Get-ChildItem $backupRoot -Directory | Sort-Object LastWriteTime -Descending | Select-Object -First 12 -ExpandProperty Name
  Fail ("Restore source not found: {0}. Available (newest): {1}" -f $sourceDir, ($recent -join ", "))
}
Ok "Using restore source: $sourceDir"

# Create a fresh restore backup of CURRENT files (so we can undo this restore if needed)
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$restoreBackup = Join-Path $backupRoot ("RESTORE_" + $stamp)
New-Item -ItemType Directory -Path $restoreBackup | Out-Null
Ok "Created safety backup folder: $restoreBackup"

function Backup-CurrentFile([string]$rel){
  $src = Join-Path $webRoot $rel
  if (!(Test-Path $src)) { Warn "Current file missing (skipped backup): $rel"; return }
  $dstName = ($rel -replace '[\\\/:]', '_')
  $dst = Join-Path $restoreBackup $dstName
  Copy-Item $src $dst -Force
  Ok "Backed up current: $rel -> $dst"
}

function Find-BackupFile([string]$folder,[string]$rel){
  $needle1 = ($rel -replace '[\\\/:]', '_')
  $base = [IO.Path]::GetFileName($rel)

  # Prefer exact underscore-name matches, else fallback to basename matches
  $candidates = Get-ChildItem $folder -File -Recurse -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -eq $needle1 -or $_.Name -eq $base -or $_.Name -like "*$needle1*" -or $_.Name -like "*$base*" } |
    Sort-Object LastWriteTime -Descending

  if ($candidates.Count -lt 1) { return $null }
  return $candidates[0].FullName
}

function Restore-FromBackup([string]$rel){
  $srcBackup = Find-BackupFile $sourceDir $rel
  if (!$srcBackup) { Fail "Could not locate '$rel' inside restore folder: $sourceDir" }

  $dst = Join-Path $webRoot $rel
  $dstDir = Split-Path $dst -Parent
  if (!(Test-Path $dstDir)) { New-Item -ItemType Directory -Path $dstDir -Force | Out-Null }

  Copy-Item $srcBackup $dst -Force
  Ok "Restored: $rel <= $(Split-Path $srcBackup -Leaf)"
}

# Files we restore for Estimate Picker stability
$files = @(
  "src\App.tsx",
  "src\features\estimatePicker\EstimatePickerFeature.tsx",
  "src\features\estimatePicker\EstimatePickerTabs.tsx"
)

# 1) Backup current versions
foreach ($f in $files) { Backup-CurrentFile $f }

# 2) Restore from known-good folder
foreach ($f in $files) { Restore-FromBackup $f }

Ok "DONE. Refresh the browser (Vite will auto-reload)."
Ok "If still broken, paste the FIRST red error line from the Vite terminal (not the browser console)."
Ok ("Safety backup of the pre-restore files: {0}" -f $restoreBackup)
