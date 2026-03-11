# QuoteSync hotfix v2: Make Status pill neutral (white) while dropdown menu is OPEN
# Previous patch looked for aria-label="Status" but your current custom menu doesn't include that attribute.
# This version anchors on the custom menu toggle handler: setStatusMenuForEstimateId(
# and then patches the first occurrence of ...qsOutcomeStyle(outcome), AFTER that anchor.
#
# IMPORTANT:
# - Creates timestamped backup under web\_backups\...
# - Does NOT run npm run dev.
#
# Run from: PS C:\Github\QuoteSync\web\ps1_patches>
#   Unblock-File .\20260304_status_pill_neutral_when_open_fix_v2_20260304_145841.ps1
#   pwsh -ExecutionPolicy Bypass -File .\20260304_status_pill_neutral_when_open_fix_v2_20260304_145841.ps1

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

$toggleAnchor = "setStatusMenuForEstimateId("
$ai = $txt.IndexOf($toggleAnchor)
if ($ai -lt 0) { Fail "Could not find custom status menu toggle anchor: $toggleAnchor" }

$needle = "...qsOutcomeStyle(outcome),"
$ni = $txt.IndexOf($needle, $ai)
if ($ni -lt 0) { Fail "Could not find '$needle' after the toggle anchor. The custom menu structure may have changed." }

$replacement = '...(statusMenuForEstimateId === String(e.id) ? { background: "#fff", color: "#111827", fontWeight: 800, border: "1px solid #e4e4e7" } : qsOutcomeStyle(outcome)),'

$txt2 = $txt.Substring(0, $ni) + $replacement + $txt.Substring($ni + $needle.Length)

if ($txt2 -eq $orig) { Fail "No change applied." }

Set-Content -Path $path -Value $txt2 -Encoding UTF8
Ok "Updated Status pill to be neutral while menu is open"
Ok ("Wrote " + $rel)

Write-Host ""
Write-Host "DONE. Refresh the browser." -ForegroundColor Cyan
Write-Host ("Backup: " + $backupDir) -ForegroundColor Cyan
