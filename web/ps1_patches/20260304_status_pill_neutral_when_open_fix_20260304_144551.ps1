# QuoteSync hotfix: Make Status pill neutral (white) while dropdown menu is OPEN
# You currently have the custom status dropdown; options are coloured, but the pill stays orange/green/red even while open.
# This patch changes the pill style to:
#   statusMenuForEstimateId === String(e.id) ? neutralStyle : qsOutcomeStyle(outcome)
#
# IMPORTANT:
# - Creates timestamped backup under web\_backups\...
# - Does NOT run npm run dev.
#
# Run from: PS C:\Github\QuoteSync\web\ps1_patches>
#   Unblock-File .\20260304_status_pill_neutral_when_open_fix_20260304_144551.ps1
#   pwsh -ExecutionPolicy Bypass -File .\20260304_status_pill_neutral_when_open_fix_20260304_144551.ps1

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

# Find the first pill style spread of qsOutcomeStyle(outcome) inside the custom status button.
# Anchor on aria-label="Status" and the next occurrence of ...qsOutcomeStyle(outcome),
$anchor = 'aria-label="Status"'
$ai = $txt.IndexOf($anchor)
if ($ai -lt 0) { Fail 'Could not find aria-label="Status" (custom status menu not found).' }

$needle = '...qsOutcomeStyle(outcome),'
$ni = $txt.IndexOf($needle, $ai)
if ($ni -lt 0) { Fail 'Could not find "...qsOutcomeStyle(outcome)," after the Status button anchor.' }

$replacement = '...(statusMenuForEstimateId === String(e.id) ? { background: "#fff", color: "#111827", fontWeight: 800, border: "1px solid #e4e4e7" } : qsOutcomeStyle(outcome)),'

$txt2 = $txt.Substring(0, $ni) + $replacement + $txt.Substring($ni + $needle.Length)

if ($txt2 -eq $orig) { Fail "No change applied." }

Set-Content -Path $path -Value $txt2 -Encoding UTF8
Ok "Updated Status pill to be neutral while menu is open"
Ok ("Wrote " + $rel)

Write-Host ""
Write-Host "DONE. Refresh the browser." -ForegroundColor Cyan
Write-Host ("Backup: " + $backupDir) -ForegroundColor Cyan
