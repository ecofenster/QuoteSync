# QuoteSync hotfix: Repair corrupted Status dropdown <select> (EstimatePickerTabs.tsx)
# Fixes the invalid JSX:
#   onChange={(ev) = style={{ ... }} { ... }}
# by replacing the entire <select ...>...</select> block (the one with value={outcome}) with a known-good version.
#
# IMPORTANT:
# - Creates timestamped backup under web\_backups\...
# - Does NOT run npm run dev.
#
# Run from: PS C:\Github\QuoteSync\web\ps1_patches>
#   Unblock-File .\20260304_fix_status_dropdown_select_syntax_20260304_140520.ps1
#   pwsh -ExecutionPolicy Bypass -File .\20260304_fix_status_dropdown_select_syntax_20260304_140520.ps1

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

# Locate the Status select block by searching for value={outcome} within a <select ...> ... </select>
$needle = "value={outcome}"
$pos = $txt.IndexOf($needle)
if ($pos -lt 0) { Fail "Could not find the Status dropdown (value={outcome}) in EstimatePickerTabs.tsx" }

$selStart = $txt.LastIndexOf("<select", $pos)
if ($selStart -lt 0) { Fail "Could not find '<select' start for Status dropdown." }

$selEnd = $txt.IndexOf("</select>", $pos)
if ($selEnd -lt 0) { Fail "Could not find '</select>' end for Status dropdown." }
$selEnd = $selEnd + 9 # length of </select>

$before = $txt.Substring(0, $selStart)
$after  = $txt.Substring($selEnd)

$replacement = @'
<select
                value={outcome}
                style={{ ...qsOutcomeStyle(outcome), height: 34, padding: "0 10px", borderRadius: 999, outline: "none" }}
                onChange={(ev) => {
                  const v = ev.currentTarget.value as EstimateOutcome;
                  setEstimateOutcomeById((prev) => ({ ...prev, [e.id]: v }));
                }}
              >
                <option value="Open">Open</option>
                <option value="Order">Order</option>
                <option value="Lost">Lost</option>
              </select>
'@

$txt2 = $before + $replacement + $after

Set-Content -Path $path -Value $txt2 -Encoding UTF8
Ok ("Wrote " + $rel)

Write-Host ""
Write-Host "DONE. Refresh the browser." -ForegroundColor Cyan
Write-Host ("Backup: " + $backupDir) -ForegroundColor Cyan
