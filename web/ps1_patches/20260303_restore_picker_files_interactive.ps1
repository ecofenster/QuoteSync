# =========================
# QuoteSync - Restore from _backups (flattened or structured) + emergency backup
# Run from: PS C:\Github\QuoteSync\web\ps1_patches>
# =========================
$ErrorActionPreference = "Stop"

function Ok($m){ Write-Host "OK: $m" -ForegroundColor Green }
function Warn($m){ Write-Host "WARN: $m" -ForegroundColor Yellow }
function Fail($m){ Write-Host "ERROR: $m" -ForegroundColor Red; throw $m }

$runDir = (Get-Location).Path
Write-Host "Run directory: $runDir"

# Detect web root reliably (works whether you ran from ...\web or ...\web\ps1_patches)
function Detect-WebRoot([string]$start){
  $candidates = @(
    $start,
    (Join-Path $start ".."),
    (Join-Path $start "..\..")
  ) | ForEach-Object { try { (Resolve-Path $_).Path } catch { $null } } | Where-Object { $_ }

  foreach($p in $candidates){
    if (Test-Path (Join-Path $p "src\App.tsx")) { return $p }
  }
  return $null
}

$webRoot = Detect-WebRoot $runDir
if (-not $webRoot) { Fail "Could not detect web root. Expected to find src\App.tsx in current/parent folders." }
Ok "Detected web root: $webRoot"

$backupsRoot = Join-Path $webRoot "_backups"
if (!(Test-Path $backupsRoot)) { Fail "Missing backups folder: $backupsRoot" }

# List backups (newest first)
$dirs = Get-ChildItem $backupsRoot -Directory | Sort-Object LastWriteTime -Descending
if ($dirs.Count -eq 0) { Fail "No backup folders found under: $backupsRoot" }

Write-Host ""
Write-Host "Available backups (newest first):"
$max = [Math]::Min(20, $dirs.Count)
for($i=0; $i -lt $max; $i++){
  $d = $dirs[$i]
  "{0,2}) {1}   {2}" -f ($i+1), $d.Name, ($d.LastWriteTime.ToString("yyyy-MM-dd HH:mm:ss")) | Write-Host
}

Write-Host ""
$choiceRaw = Read-Host "Pick a backup number to restore (1-$max)"
$choice = 0
if (-not [int]::TryParse($choiceRaw, [ref]$choice)) { Fail "Invalid choice (not a number): $choiceRaw" }
if ($choice -lt 1 -or $choice -gt $max) { Fail "Choice out of range: $choice (expected 1-$max)" }

$restoreDir = $dirs[$choice-1].FullName
Ok "Chosen restore folder: $restoreDir"

# Always make an emergency backup of current state before overwriting
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$emergency = Join-Path $backupsRoot ("EMERGENCY_BEFORE_RESTORE_" + $stamp)
New-Item -ItemType Directory -Path $emergency | Out-Null
Ok "Emergency backup folder: $emergency"

function Backup-File($rel){
  $src = Join-Path $webRoot $rel
  if (!(Test-Path $src)) { Warn "Current file missing (skip backup): $rel"; return }
  $dstName = ($rel -replace '[\\\/:]', '_')
  $dst = Join-Path $emergency $dstName
  Copy-Item $src $dst -Force
  Ok "Backed up current $rel -> $dstName"
}

function Find-In-Backup($rel){
  # 1) Structured path exists?
  $p1 = Join-Path $restoreDir $rel
  if (Test-Path $p1) { return $p1 }

  # 2) Flattened name exists? e.g. src_App.tsx
  $flat = ($rel -replace '[\\\/:]', '_')
  $p2 = Join-Path $restoreDir $flat
  if (Test-Path $p2) { return $p2 }

  # 3) Search anywhere inside restoreDir for either structured tail or flat filename
  $leaf = Split-Path $rel -Leaf
  $hits = @()
  try {
    $hits = Get-ChildItem -Path $restoreDir -Recurse -File -ErrorAction SilentlyContinue |
      Where-Object { $_.Name -ieq $leaf -or $_.Name -ieq $flat }
  } catch { }

  if ($hits.Count -eq 1) { return $hits[0].FullName }
  if ($hits.Count -gt 1) {
    Warn ("Multiple candidates in backup for {0}: {1}" -f $rel, ($hits.Name -join ", "))
    # prefer flat name if present
    $flatHit = $hits | Where-Object { $_.Name -ieq $flat } | Select-Object -First 1
    if ($flatHit) { return $flatHit.FullName }
    return ($hits | Select-Object -First 1).FullName
  }
  return $null
}

function Restore-File($rel){
  $src = Find-In-Backup $rel
  if (-not $src) { Fail ("Could not locate '{0}' inside restore folder: {1}" -f $rel, $restoreDir) }

  $dst = Join-Path $webRoot $rel
  $dstDir = Split-Path $dst -Parent
  if (!(Test-Path $dstDir)) { New-Item -ItemType Directory -Path $dstDir -Force | Out-Null }

  Copy-Item $src $dst -Force
  Ok ("Restored {0} <- {1}" -f $rel, (Split-Path $src -Leaf))
}

# Files involved in the current breakage (Estimate Picker / Open flow)
$targets = @(
  "src\App.tsx",
  "src\features\estimatePicker\EstimatePickerFeature.tsx",
  "src\features\estimatePicker\EstimatePickerTabs.tsx"
)

Write-Host ""
Write-Host "Restoring target files:"
$targets | ForEach-Object { Write-Host " - $_" }

$targets | ForEach-Object { Backup-File $_ }
$targets | ForEach-Object { Restore-File $_ }

Write-Host ""
Ok "Restore complete."

Write-Host ""
Write-Host "Next:"
Write-Host "  1) Browser hard refresh (Ctrl+F5)."
Write-Host "  2) If you still see 'An error occurred in <App>', open DevTools Console and paste the FIRST red error line with file + line number."
Write-Host ""
Ok "Done."
