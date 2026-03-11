# QuoteSync - Restore from a chosen _backups folder (handles flattened backup filenames)
# Run from: PS C:\Github\QuoteSync\web\ps1_patches>
# NOTE: This script does NOT run npm run dev.

$ErrorActionPreference = "Stop"

function Ok($m){ Write-Host "OK: $m" -ForegroundColor Green }
function Warn($m){ Write-Host "WARN: $m" -ForegroundColor Yellow }
function Fail($m){ Write-Host "ERROR: $m" -ForegroundColor Red; throw $m }

$runDir = (Get-Location).Path
Write-Host "Run directory: $runDir"

# Detect web root:
# - If run from ...\web\ps1_patches, web root is parent
# - Otherwise, walk up until we find src\App.tsx
function Find-WebRoot([string]$start){
  $p = Resolve-Path $start | Select-Object -ExpandProperty Path
  while ($true) {
    if (Test-Path (Join-Path $p "src\App.tsx")) { return $p }
    $parent = Split-Path $p -Parent
    if ($parent -eq $p -or [string]::IsNullOrWhiteSpace($parent)) { break }
    $p = $parent
  }
  return $null
}

$webRoot = $null
# common case: run from ps1_patches
$parent = Resolve-Path (Join-Path $runDir "..") -ErrorAction SilentlyContinue
if ($parent) {
  $maybe = $parent.Path
  if (Test-Path (Join-Path $maybe "src\App.tsx")) { $webRoot = $maybe }
}
if (-not $webRoot) { $webRoot = Find-WebRoot $runDir }
if (-not $webRoot) { Fail "Could not detect web root (folder containing src\App.tsx). Run from PS C:\Github\QuoteSync\web\ps1_patches>" }

Ok "Detected web root: $webRoot"

$backupsRoot = Join-Path $webRoot "_backups"
if (-not (Test-Path $backupsRoot)) { Fail "Missing backups folder: $backupsRoot" }

# ===== Choose which backup to restore =====
# Change this if you want a different restore point
$restoreName = "20260303_133002"

$restoreDir = Join-Path $backupsRoot $restoreName
if (-not (Test-Path $restoreDir)) {
  Fail "Restore folder not found: $restoreDir"
}
Ok "Restore source: $restoreDir"

# Files we expect to restore (add/remove as needed)
$targets = @(
  "src\App.tsx",
  "src\features\estimatePicker\EstimatePickerFeature.tsx",
  "src\features\estimatePicker\EstimatePickerTabs.tsx"
)

function Flatten-Rel([string]$rel){
  return ($rel -replace '[\\\/:]', '_')
}

function Find-BackupFile([string]$rel){
  $p1 = Join-Path $restoreDir $rel
  if (Test-Path $p1) { return $p1 }

  $flat = Flatten-Rel $rel
  $p2 = Join-Path $restoreDir $flat
  if (Test-Path $p2) { return $p2 }

  # Fallback glob (last resort)
  $leaf = Split-Path $rel -Leaf
  $hits = Get-ChildItem -Path $restoreDir -File -Filter "*$leaf*" -ErrorAction SilentlyContinue
  if ($hits.Count -eq 1) { return $hits[0].FullName }
  if ($hits.Count -gt 1) {
    Warn "Multiple candidates in backup for $rel: $($hits.Name -join ', ')"
  }
  return $null
}

# Emergency snapshot of current files BEFORE we change anything
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$emergencyDir = Join-Path $backupsRoot ("EMERGENCY_BEFORE_RESTORE_" + $stamp)
New-Item -ItemType Directory -Path $emergencyDir | Out-Null
Ok "Emergency backup folder: $emergencyDir"

foreach ($rel in $targets) {
  $abs = Join-Path $webRoot $rel
  if (Test-Path $abs) {
    $dst = Join-Path $emergencyDir (Flatten-Rel $rel)
    Copy-Item $abs $dst -Force
    Ok "Saved current -> $dst"
  } else {
    Warn "Current file missing (skipped emergency backup): $rel"
  }
}

# Restore files from selected backup
foreach ($rel in $targets) {
  $src = Find-BackupFile $rel
  if (-not $src) { Fail "Could not locate '$rel' in restore folder (neither original path nor flattened). Restore folder: $restoreDir" }

  $dst = Join-Path $webRoot $rel
  $dstDir = Split-Path $dst -Parent
  if (-not (Test-Path $dstDir)) { New-Item -ItemType Directory -Path $dstDir -Force | Out-Null }

  Copy-Item $src $dst -Force
  Ok "RESTORED: $rel <= $(Split-Path $src -Leaf)"
}

# Create a post-restore savepoint (so we can revert quickly)
$postDir = Join-Path $backupsRoot ("RESTORED_" + $restoreName + "_" + $stamp)
New-Item -ItemType Directory -Path $postDir | Out-Null
foreach ($rel in $targets) {
  $abs = Join-Path $webRoot $rel
  if (Test-Path $abs) {
    $dst = Join-Path $postDir (Flatten-Rel $rel)
    Copy-Item $abs $dst -Force
  }
}
Ok "Post-restore savepoint: $postDir"

Write-Host ""
Ok "DONE. Refresh the browser. If Open is still blank, copy the first real error line from the console (not just the React overlay header)."
