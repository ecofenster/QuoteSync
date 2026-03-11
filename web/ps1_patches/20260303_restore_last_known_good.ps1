# QuoteSync - Restore last known-good Estimate Picker state (App + EstimatePicker files)
# Run from: PS C:\Github\QuoteSync\web\ps1_patches>
# (This script will auto-detect the web root and restore from the most recent suitable _backups folder.)

$ErrorActionPreference = "Stop"

function Ok($m){ Write-Host "OK: $m" -ForegroundColor Green }
function Warn($m){ Write-Host "WARN: $m" -ForegroundColor Yellow }
function Fail($m){ Write-Host "ERROR: $m" -ForegroundColor Red; throw $m }

$runDir = (Get-Location).Path
Write-Host "Run directory: $runDir"

# -------------------------
# Detect web root by walking up a few levels until we find src\App.tsx
# -------------------------
$probe = $runDir
$webRoot = $null
for ($i=0; $i -lt 6; $i++){
  if (Test-Path (Join-Path $probe "src\App.tsx")){
    $webRoot = $probe
    break
  }
  $parent = Split-Path $probe -Parent
  if ($parent -eq $probe) { break }
  $probe = $parent
}
if (-not $webRoot) { Fail "Could not detect web root (folder containing src\App.tsx) from: $runDir" }
Ok "Detected web root: $webRoot"

$backupsRoot = Join-Path $webRoot "_backups"
if (-not (Test-Path $backupsRoot)) { Fail "Missing _backups folder: $backupsRoot" }

# -------------------------
# Create an emergency snapshot of CURRENT (possibly broken) files before restoring
# -------------------------
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$emergency = Join-Path $backupsRoot ("EMERGENCY_BEFORE_RESTORE_" + $stamp)
New-Item -ItemType Directory -Path $emergency | Out-Null
Ok "Emergency snapshot folder: $emergency"

function Try-Backup($rel){
  $src = Join-Path $webRoot $rel
  if (Test-Path $src){
    $dstName = ($rel -replace '[\\\/:]', '_')
    Copy-Item $src (Join-Path $emergency $dstName) -Force
    Ok "Snapshotted $rel"
  } else {
    Warn "Snapshot skip (missing): $rel"
  }
}

Try-Backup "src\App.tsx"
Try-Backup "src\features\estimatePicker\EstimatePickerFeature.tsx"
Try-Backup "src\features\estimatePicker\EstimatePickerTabs.tsx"
Try-Backup "src\features\estimatePicker\EstimatePickerTabs.tsx"
Try-Backup "src\features\estimatePicker\EstimatePickerTabs.tsx"

# -------------------------
# Choose best restore folder
# Priority:
#  1) Most recent folder starting with EMERGENCY_RESTORE_
#  2) Otherwise most recent folder that contains src_App.tsx AND estimate picker backups
#  3) Otherwise most recent folder that contains src_App.tsx
# -------------------------
$dirs = Get-ChildItem -Path $backupsRoot -Directory | Sort-Object Name -Descending
if ($dirs.Count -eq 0) { Fail "No backup folders found under: $backupsRoot" }

function Has-File($dir, $name){
  return Test-Path (Join-Path $dir.FullName $name)
}

$restoreDir = $null

# 1) EMERGENCY_RESTORE_*
$restoreDir = $dirs | Where-Object { $_.Name -like "EMERGENCY_RESTORE_*" } | Select-Object -First 1

# 2) Most recent full set
if (-not $restoreDir){
  $restoreDir = $dirs | Where-Object {
    (Has-File $_ "src_App.tsx") -and
    (Has-File $_ "src_features_estimatePicker_EstimatePickerFeature.tsx") -and
    (Has-File $_ "src_features_estimatePicker_EstimatePickerTabs.tsx")
  } | Select-Object -First 1
}

# 3) At least App.tsx
if (-not $restoreDir){
  $restoreDir = $dirs | Where-Object { Has-File $_ "src_App.tsx" } | Select-Object -First 1
}

if (-not $restoreDir){ Fail "Could not find any backup folder containing src_App.tsx under: $backupsRoot" }

Ok "Selected restore folder: $($restoreDir.FullName)"

# -------------------------
# Restore helper
# -------------------------
function Restore-FromBackup($backupFileName, $destRel){
  $src = Join-Path $restoreDir.FullName $backupFileName
  if (-not (Test-Path $src)) {
    Warn "Restore skip (not present in selected folder): $backupFileName"
    return
  }
  $dest = Join-Path $webRoot $destRel
  $destDir = Split-Path $dest -Parent
  if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir | Out-Null }
  Copy-Item $src $dest -Force
  Ok "Restored $destRel from $backupFileName"
}

# Restore core files (only if present in selected folder)
Restore-FromBackup "src_App.tsx" "src\App.tsx"
Restore-FromBackup "src_features_estimatePicker_EstimatePickerFeature.tsx" "src\features\estimatePicker\EstimatePickerFeature.tsx"
Restore-FromBackup "src_features_estimatePicker_EstimatePickerTabs.tsx" "src\features\estimatePicker\EstimatePickerTabs.tsx"

Write-Host ""
Ok "DONE: Restore applied."
Write-Host "Next: refresh the browser. (No need to restart npm run dev if it's already running.)"
Write-Host "If it still errors, tell me the newest folder name under: $backupsRoot"
