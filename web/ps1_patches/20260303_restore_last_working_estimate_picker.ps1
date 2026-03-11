# =========================
# QuoteSync - EMERGENCY RESTORE (Estimate Picker)
# Restores App.tsx + EstimatePickerFeature/Tabs from the most recent backup
# where ALL of those files exist, and makes a fresh backup of the current broken state first.
#
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
if ($runDir -match '\\web\\ps1_patches$') {
  $webRoot = (Resolve-Path (Join-Path $runDir "..")).Path
} elseif ($runDir -match '\\web$') {
  $webRoot = $runDir
} else {
  # best effort: walk up until we see src\App.tsx
  $p = $runDir
  for ($i=0; $i -lt 6; $i++) {
    if (Test-Path (Join-Path $p "src\App.tsx")) { $webRoot = $p; break }
    $p = Split-Path $p -Parent
  }
}
if (-not $webRoot) { Fail "Could not detect web root. Expected to be run from ...\web\ps1_patches or ...\web" }
Ok "Detected web root: $webRoot"

$backupsRoot = Join-Path $webRoot "_backups"
if (-not (Test-Path $backupsRoot)) { Fail "Backups folder not found: $backupsRoot" }

# Target files (live)
$appLive   = Join-Path $webRoot "src\App.tsx"
$featLive  = Join-Path $webRoot "src\features\estimatePicker\EstimatePickerFeature.tsx"
$tabsLive  = Join-Path $webRoot "src\features\estimatePicker\EstimatePickerTabs.tsx"

# Make a backup of CURRENT state first
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$emBackup = Join-Path $backupsRoot ("EMERGENCY_RESTORE_" + $stamp)
New-Item -ItemType Directory -Path $emBackup | Out-Null
Ok "Created emergency backup folder: $emBackup"

function Backup-LiveFile([string]$path){
  if (Test-Path $path) {
    $name = ($path.Substring($webRoot.Length + 1) -replace '[\\\/:]', '_')
    Copy-Item $path (Join-Path $emBackup $name) -Force
    Ok "Backed up current -> $name"
  } else {
    Warn "Live file missing (skipping backup): $path"
  }
}

Backup-LiveFile $appLive
Backup-LiveFile $featLive
Backup-LiveFile $tabsLive

# Find most recent backup folder that contains snapshots of ALL 3 files
$backupDirs = Get-ChildItem -Path $backupsRoot -Directory | Sort-Object LastWriteTime -Descending
if (-not $backupDirs -or $backupDirs.Count -eq 0) { Fail "No backup folders found under: $backupsRoot" }

function Find-Snapshot([string]$dir,[string[]]$candidates){
  foreach ($c in $candidates) {
    $p = Join-Path $dir $c
    if (Test-Path $p) { return $p }
  }
  return $null
}

$chosen = $null
$chosenApp = $null
$chosenFeat = $null
$chosenTabs = $null

foreach ($d in $backupDirs) {
  $dir = $d.FullName

  # Common snapshot naming used by our scripts
  $appSnap  = Find-Snapshot $dir @(
    "src_App.tsx",
    "App.tsx",
    "src\App.tsx"
  )

  $featSnap = Find-Snapshot $dir @(
    "src_features_estimatePicker_EstimatePickerFeature.tsx",
    "EstimatePickerFeature.tsx",
    "src\features\estimatePicker\EstimatePickerFeature.tsx"
  )

  $tabsSnap = Find-Snapshot $dir @(
    "src_features_estimatePicker_EstimatePickerTabs.tsx",
    "EstimatePickerTabs.tsx",
    "src\features\estimatePicker\EstimatePickerTabs.tsx"
  )

  if ($appSnap -and $featSnap -and $tabsSnap) {
    $chosen = $dir
    $chosenApp = $appSnap
    $chosenFeat = $featSnap
    $chosenTabs = $tabsSnap
    break
  }
}

if (-not $chosen) {
  # Fallback: at least restore App.tsx
  foreach ($d in $backupDirs) {
    $dir = $d.FullName
    $appSnap  = Find-Snapshot $dir @("src_App.tsx","App.tsx","src\App.tsx")
    if ($appSnap) {
      $chosen = $dir
      $chosenApp = $appSnap
      break
    }
  }
}

if (-not $chosenApp) { Fail "Could not find any App.tsx snapshot in backups." }

Ok "Chosen restore point: $chosen"
Ok " - App snapshot:  $chosenApp"
if ($chosenFeat) { Ok " - Feature snap:  $chosenFeat" } else { Warn " - Feature snap:  (not found) — App only restore" }
if ($chosenTabs) { Ok " - Tabs snap:     $chosenTabs" } else { Warn " - Tabs snap:     (not found) — App only restore" }

# Ensure directories exist
New-Item -ItemType Directory -Path (Split-Path $appLive -Parent) -Force | Out-Null
New-Item -ItemType Directory -Path (Split-Path $featLive -Parent) -Force | Out-Null
New-Item -ItemType Directory -Path (Split-Path $tabsLive -Parent) -Force | Out-Null

# Restore
Copy-Item $chosenApp $appLive -Force
Ok "RESTORED: src\App.tsx"

if ($chosenFeat) {
  Copy-Item $chosenFeat $featLive -Force
  Ok "RESTORED: src\features\estimatePicker\EstimatePickerFeature.tsx"
}
if ($chosenTabs) {
  Copy-Item $chosenTabs $tabsLive -Force
  Ok "RESTORED: src\features\estimatePicker\EstimatePickerTabs.tsx"
}

# Print quick sanity checks (file sizes)
function Stat($p){
  if (Test-Path $p) {
    $fi = Get-Item $p
    "{0} bytes  {1}" -f $fi.Length, $p
  } else {
    "MISSING  $p"
  }
}
Write-Host ""
Write-Host "Sanity check (sizes):"
Write-Host (" - " + (Stat $appLive))
Write-Host (" - " + (Stat $featLive))
Write-Host (" - " + (Stat $tabsLive))

Write-Host ""
Ok "DONE. Refresh the browser. If still blank, tell me which backup folder was chosen above + paste the FIRST red error line from Vite."
