# QuoteSync hotfix: Fix JSX braces for Status label + coloured dropdown (EstimatePickerTabs.tsx)
# Symptom: Unexpected token in style=... because injected JSX used invalid style braces / object literal.
# Fixes:
#  - style={{...}} for the two new <div> wrappers
#  - style={{ ...qsOutcomeStyle(outcome), ... }} for the <select>
#
# IMPORTANT:
# - Creates timestamped backup under web\_backups\...
# - Does NOT run npm run dev.
#
# Run from: PS C:\Github\QuoteSync\web\ps1_patches>
#   Unblock-File .\20260304_fix_status_dropdown_jsx_braces_20260304_133433.ps1
#   pwsh -ExecutionPolicy Bypass -File .\20260304_fix_status_dropdown_jsx_braces_20260304_133433.ps1

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

# 1) Fix wrapper div styles (missing double braces)
$txt = $txt.Replace('<div style={ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }>', '<div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>')
$txt = $txt.Replace('<div style={ fontSize: 12, fontWeight: 900, color: "#111827", paddingLeft: 2 }>', '<div style={{ fontSize: 12, fontWeight: 900, color: "#111827", paddingLeft: 2 }}>')

# 2) Fix select style: ensure object literal is inside double braces
# from: style={ ...qsOutcomeStyle(outcome), height: 34, ... }
# to:   style={{ ...qsOutcomeStyle(outcome), height: 34, ... }}
$txt = [regex]::Replace($txt, 'style=\{\s*\.\.\.qsOutcomeStyle\(([^)]*)\)\s*,', 'style={{ ...qsOutcomeStyle($1),', 1)

# Ensure it ends with }}>
$txt = $txt.Replace('outline: "none" }}>', 'outline: "none" }}>')
$txt = $txt.Replace('outline: "none" }>', 'outline: "none" }}>')

if ($txt -eq $orig) { Fail "No changes applied — expected broken JSX patterns not found. Paste lines ~540-560 of EstimatePickerTabs.tsx and I’ll target the exact block." }

Set-Content -Path $path -Value $txt -Encoding UTF8
Ok ("Wrote " + $rel)

Write-Host ""
Write-Host "DONE. Refresh the browser." -ForegroundColor Cyan
Write-Host ("Backup: " + $backupDir) -ForegroundColor Cyan
