# QuoteSync patch v3: Replace Follow Ups stub render with FollowUpsFeature (very robust matcher)
# - App.tsx already has FollowUpsFeature import inserted by prior patch (or this script will insert if missing).
# - This script ONLY replaces the render block for the Follow Ups menu, matching on:
#     {menu === "follow_ups" && view === "customers" && ( ... )}
#   regardless of indentation/contents.
#
# IMPORTANT: Does NOT run npm run dev.
#
# Run from: PS C:\Github\QuoteSync\web\ps1_patches>
#   Unblock-File .\THIS_SCRIPT.ps1
#   pwsh -ExecutionPolicy Bypass -File .\THIS_SCRIPT.ps1

$ErrorActionPreference = "Stop"
function Fail($m){ Write-Host "ERROR: $m" -ForegroundColor Red; throw $m }
function Ok($m)  { Write-Host "OK: $m" -ForegroundColor Green }
function Warn($m){ Write-Host "WARN: $m" -ForegroundColor Yellow }

$runDir = (Get-Location).Path
Write-Host ("Run directory: " + $runDir)

$webRoot = Resolve-Path (Join-Path $runDir "..") | Select-Object -ExpandProperty Path
if (-not (Test-Path (Join-Path $webRoot "package.json"))) { Fail "Could not detect web root (package.json not found) at: $webRoot" }
Ok ("Detected web root: " + $webRoot)

$backupsRoot = Join-Path $webRoot "_backups"
New-Item -ItemType Directory -Force -Path $backupsRoot | Out-Null
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = Join-Path $backupsRoot $stamp
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
Ok ("Backup folder: " + $backupDir)

$appRel = "src\App.tsx"
$appPath = Join-Path $webRoot $appRel
if (-not (Test-Path $appPath)) { Fail "Missing file: $appPath" }
Copy-Item -Force $appPath (Join-Path $backupDir "App.tsx")
Ok ("Backed up " + $appRel)

$txt = Get-Content -Raw -Encoding UTF8 $appPath

# Ensure import exists (insert after last import)
$import = 'import FollowUpsFeature from "./features/followUps/FollowUpsFeature";'
if ($txt -notmatch [regex]::Escape($import)) {
  $lines = $txt -split "`r?`n"
  $lastImport = -1
  for ($i=0; $i -lt $lines.Length; $i++) {
    if ($lines[$i] -match '^\s*import\s+.+;\s*$') { $lastImport = $i }
  }
  if ($lastImport -lt 0) { Fail "No import statements found in App.tsx (unexpected)." }

  $newLines = @()
  for ($i=0; $i -lt $lines.Length; $i++) {
    $newLines += $lines[$i]
    if ($i -eq $lastImport) { $newLines += $import }
  }
  $txt = ($newLines -join "`r`n")
  Ok "Inserted FollowUpsFeature import after last import"
} else {
  Ok "FollowUpsFeature import already present (skipped)"
}

# Replace follow_ups render block
$pattern = '(?s)\{menu\s*===\s*"follow_ups"\s*&&\s*view\s*===\s*"customers"\s*&&\s*\([\s\S]*?\)\s*\}'
$rx = [regex]::new($pattern)

if (-not $rx.IsMatch($txt)) {
  Fail 'Could not find a render block matching: {menu === "follow_ups" && view === "customers" && ( ... )}'
}

$replacement = @'
{menu === "follow_ups" && view === "customers" && (
              <FollowUpsFeature
                clients={clients}
                onOpenClient={(clientId) => {
                  setEstimatePickerClientId(clientId);
                  setView("estimate_picker");
                }}
              />
            )}
'@

$txt = $rx.Replace($txt, $replacement, 1)
Ok "Replaced Follow Ups render block with FollowUpsFeature"

Set-Content -Path $appPath -Value $txt -Encoding UTF8
Ok ("Wrote " + $appRel)

Write-Host ""
Write-Host "DONE. Refresh the browser (dev server not restarted)." -ForegroundColor Cyan
