# QuoteSync hotfix v3: Make Status pill neutral (white) while dropdown menu is OPEN
# This version is tolerant of markup differences. It searches near the custom status dropdown toggle
# and patches whichever of these patterns it finds first:
#   A) style={{ ...qsOutcomeStyle(outcome), ... }}
#   B) style={{ ...qsOutcomeStyle(outcome) ... }}   (no trailing comma)
#   C) style={qsOutcomeStyle(outcome)}
#
# IMPORTANT:
# - Creates timestamped backup under web\_backups\...
# - Does NOT run npm run dev.
#
# Run from: PS C:\Github\QuoteSync\web\ps1_patches>
#   Unblock-File .\20260304_status_pill_neutral_when_open_fix_v3_20260304_150435.ps1
#   pwsh -ExecutionPolicy Bypass -File .\20260304_status_pill_neutral_when_open_fix_v3_20260304_150435.ps1

$ErrorActionPreference = "Stop"
function Fail($m){ Write-Host "ERROR: $m" -ForegroundColor Red; throw $m }
function Ok($m)  { Write-Host "OK: $m" -ForegroundColor Green }
function Warn($m){ Write-Host "WARN: $m" -ForegroundColor Yellow }

$runDir = (Get-Location).Path
Write-Host ("Run directory: " + $runDir)

$webRoot = Resolve-Path (Join-Path $runDir "..") | Select-Object -ExpandProperty Path
if (-not (Test-Path (Join-Path $webRoot "package.json"))) { Fail "Could not detect web root (package.json not found) at: $webRoot" }
Ok ("Detected web root: " + $webRoot)

$rel = "src\features\estimatePicker\EstimatePickerTabs.tsx"
$path = Join-Path $webRoot $rel
if (-not (Test-Path $path)) { Fail "Missing file: $path" }

# Backup
$backupsRoot = Join-Path $webRoot "_backups"
New-Item -ItemType Directory -Force -Path $backupsRoot | Out-Null
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = Join-Path $backupsRoot $stamp
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
Ok ("Backup folder: " + $backupDir)

Copy-Item -Force $path (Join-Path $backupDir "EstimatePickerTabs.tsx")
Ok ("Backed up " + $rel)

$txt = Get-Content -Raw -Encoding UTF8 $path
$orig = $txt

# Ensure the neutral style expression string we want to use:
$neutralExpr = '{ background: "#fff", color: "#111827", fontWeight: 800, border: "1px solid #e4e4e7" }'

# Find the custom status dropdown region by the toggle handler:
$toggle = "setStatusMenuForEstimateId("
$ai = $txt.IndexOf($toggle)
if ($ai -lt 0) { Fail "Could not find custom status dropdown toggle: $toggle" }

# Search a window after toggle for qsOutcomeStyle(outcome)
$windowLen = 4000
$start = $ai
$end = [Math]::Min($txt.Length, $start + $windowLen)
$window = $txt.Substring($start, $end - $start)

$patched = $false

# Pattern C: style={qsOutcomeStyle(outcome)}
$patC = 'style=\{\s*qsOutcomeStyle\(\s*outcome\s*\)\s*\}'
$mC = [regex]::Match($window, $patC)
if ($mC.Success) {
  $old = $mC.Value
  $new = 'style={statusMenuForEstimateId === String(e.id) ? ' + $neutralExpr + ' : qsOutcomeStyle(outcome)}'
  $window = $window.Replace($old, $new)
  $patched = $true
}

if (-not $patched) {
  # Pattern A/B: spread inside style object: ...qsOutcomeStyle(outcome)
  $needle = '...qsOutcomeStyle(outcome)'
  $idx = $window.IndexOf($needle)
  if ($idx -ge 0) {
    $replacement = '...(statusMenuForEstimateId === String(e.id) ? ' + $neutralExpr + ' : qsOutcomeStyle(outcome))'
    $window = $window.Substring(0, $idx) + $replacement + $window.Substring($idx + $needle.Length)
    $patched = $true
  }
}

if (-not $patched) {
  # Fallback: any qsOutcomeStyle(outcome) in window (without spread)
  $needle2 = 'qsOutcomeStyle(outcome)'
  $idx2 = $window.IndexOf($needle2)
  if ($idx2 -ge 0) {
    # replace first occurrence with conditional
    $replacement2 = '(statusMenuForEstimateId === String(e.id) ? ' + $neutralExpr + ' : qsOutcomeStyle(outcome))'
    $window = $window.Substring(0, $idx2) + $replacement2 + $window.Substring($idx2 + $needle2.Length)
    $patched = $true
  }
}

if (-not $patched) {
  Fail "Could not locate qsOutcomeStyle(outcome) usage near the status dropdown. Paste the status pill block (the div that shows Open/Order/Lost) and I will target it exactly."
}

# Stitch back
$txt2 = $txt.Substring(0, $start) + $window + $txt.Substring($end)

Set-Content -Path $path -Value $txt2 -Encoding UTF8
Ok "Updated Status pill: neutral while menu is open (patched successfully)"
Ok ("Wrote " + $rel)

Write-Host ""
Write-Host "DONE. Refresh the browser." -ForegroundColor Cyan
Write-Host ("Backup: " + $backupDir) -ForegroundColor Cyan
