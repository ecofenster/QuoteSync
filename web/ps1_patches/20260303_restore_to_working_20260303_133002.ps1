# =========================
# QuoteSync - Restore to known working backup (flattened backups supported)
# Run from: PS C:\Github\QuoteSync\web\ps1_patches>
# =========================

$ErrorActionPreference = "Stop"

function Ok($m){ Write-Host "OK: $m" -ForegroundColor Green }
function Warn($m){ Write-Host "WARN: $m" -ForegroundColor Yellow }
function Fail($m){ Write-Host "ERROR: $m" -ForegroundColor Red; throw $m }

$runDir = (Get-Location).Path
Write-Host "Run directory: $runDir"

# Detect web root (ps1_patches is under web)
$webRoot = Resolve-Path (Join-Path $PSScriptRoot "..") | Select-Object -ExpandProperty Path
if (-not (Test-Path (Join-Path $webRoot "src\App.tsx"))) {
  # If script executed from elsewhere, try using current directory assumption
  $maybe = Resolve-Path (Join-Path $runDir "..") | Select-Object -ExpandProperty Path
  if (Test-Path (Join-Path $maybe "src\App.tsx")) { $webRoot = $maybe }
}
if (-not (Test-Path (Join-Path $webRoot "src\App.tsx"))) {
  Fail "Could not detect web root. Expected src\App.tsx under: $webRoot"
}
Ok "Detected web root: $webRoot"

$backupsRoot = Join-Path $webRoot "_backups"
if (-not (Test-Path $backupsRoot)) { Fail "Missing backups folder: $backupsRoot" }

# Target backup folder (the one you listed as ~13:30 and confirmed working after Phase4H2)
$target = Join-Path $backupsRoot "20260303_133002"
if (-not (Test-Path $target)) { Fail "Target backup folder not found: $target" }
Ok "Target backup: $target"

# Create an emergency backup of current files before restoring
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$emergency = Join-Path $backupsRoot ("EMERGENCY_BEFORE_RESTORE_" + $stamp)
New-Item -ItemType Directory -Path $emergency | Out-Null
Ok "Emergency backup folder: $emergency"

function Backup-Now([string]$rel){
  $src = Join-Path $webRoot $rel
  if (-not (Test-Path $src)) { Warn "Skip backup (missing): $rel"; return }
  $flat = ($rel -replace '[\\\/:]', '_')
  Copy-Item $src (Join-Path $emergency $flat) -Force
  Ok "Backed up current ${rel} -> $(Join-Path $emergency $flat)"
}

function Restore-From([string]$rel){
  $dst = Join-Path $webRoot $rel
  $flat = ($rel -replace '[\\\/:]', '_')

  $cand1 = Join-Path $target $rel
  $cand2 = Join-Path $target $flat

  $src = $null
  if (Test-Path $cand1) { $src = $cand1 }
  elseif (Test-Path $cand2) { $src = $cand2 }
  else {
    # fallback: search by leaf name
    $leaf = Split-Path $rel -Leaf
    $hits = Get-ChildItem -Path $target -File -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.Name -eq $leaf -or $_.Name -like "*$leaf*" }
    if ($hits.Count -eq 1) { $src = $hits[0].FullName }
    elseif ($hits.Count -gt 1) {
      $src = ($hits | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName
      Warn ("Multiple candidates in backup for {0}; using newest: {1}" -f $rel, (Split-Path $src -Leaf))
    } else {
      Fail ("Could not locate '{0}' in backup folder (checked '{1}' and '{2}')" -f $rel, $cand1, $cand2)
    }
  }

  $dstDir = Split-Path $dst -Parent
  if (-not (Test-Path $dstDir)) { New-Item -ItemType Directory -Path $dstDir | Out-Null }

  Copy-Item $src $dst -Force
  Ok ("Restored {0} <- {1}" -f $rel, (Split-Path $src -Leaf))
}

$files = @(
  "src\App.tsx",
  "src\features\estimatePicker\EstimatePickerFeature.tsx",
  "src\features\estimatePicker\EstimatePickerTabs.tsx"
)

foreach($f in $files){ Backup-Now $f }
foreach($f in $files){ Restore-From $f }

# Quick sanity checks (fail fast if the restored files look truncated)
$appTxt = Get-Content (Join-Path $webRoot "src\App.tsx") -Raw -Encoding UTF8
if ($appTxt -notmatch 'export\s+default\s+function\s+App') { Warn "App.tsx: could not find 'export default function App' (check file if issues persist)." }
if ($appTxt.Length -lt 2000) { Warn "App.tsx: looks unusually short ($($appTxt.Length) chars). Possible truncation." }

$tabsTxt = Get-Content (Join-Path $webRoot "src\features\estimatePicker\EstimatePickerTabs.tsx") -Raw -Encoding UTF8
if ($tabsTxt -match '\}\>\{children\}\<\/') { Warn "EstimatePickerTabs.tsx: found stray '}>{children}</' pattern (should NOT be present). File may still be corrupted." }

Ok "RESTORE COMPLETE."
Write-Host "Next: refresh the browser tab running Vite (or just let HMR reload)."
