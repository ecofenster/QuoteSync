# QuoteSync patch: Keep Status pill neutral while dropdown menu is open; apply colour only after selection
# Applies to the custom Status menu (Phase: per-option coloured options).
#
# Behavior:
# - When the status menu is OPEN for an estimate: pill shows neutral (white) style
# - When menu is CLOSED: pill shows outcome colour (Open=orange, Order=green, Lost=red)
#
# IMPORTANT:
# - Creates timestamped backup under web\_backups\...
# - Does NOT run npm run dev.
#
# Run from: PS C:\Github\QuoteSync\web\ps1_patches>
#   Unblock-File .\20260304_status_pill_neutral_while_menu_open_20260304_143134.ps1
#   pwsh -ExecutionPolicy Bypass -File .\20260304_status_pill_neutral_while_menu_open_20260304_143134.ps1

$ErrorActionPreference = "Stop"
function Fail($m){ Write-Host "ERROR: $m" -ForegroundColor Red; throw $m }
function Ok($m)  { Write-Host "OK: $m" -ForegroundColor Green }

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

# We expect the custom menu pill style currently contains:
#   ...qsOutcomeStyle(outcome),
# Replace it with a conditional so pill stays neutral while open.
$needle = '...qsOutcomeStyle(outcome),'
if ($txt -notlike "*$needle*") {
  Fail "Could not find the Status pill style anchor (...qsOutcomeStyle(outcome),). Are you still using the custom menu patch? If not, tell me and I’ll target the native select."
}

$replacement = '...(statusMenuForEstimateId === String(e.id) ? { background: "#fff", color: "#111827", fontWeight: 800, border: "1px solid #e4e4e7" } : qsOutcomeStyle(outcome)),'

# Replace only the first occurrence inside the custom menu block (safest).
$idx = $txt.IndexOf($needle)
$txt = $txt.Substring(0, $idx) + $replacement + $txt.Substring($idx + $needle.Length)

Set-Content -Path $path -Value $txt -Encoding UTF8
Ok ("Wrote " + $rel)

Write-Host ""
Write-Host "DONE. Refresh the browser." -ForegroundColor Cyan
Write-Host ("Backup: " + $backupDir) -ForegroundColor Cyan
