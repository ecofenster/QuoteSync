# QuoteSync patch: Fix FollowUpsFeature integration in App.tsx (robust import + render replacement)
# - The previous patch wrote FollowUpsFeature.tsx but failed to locate a specific import anchor.
# - This patch inserts the import after the LAST import statement (robust).
# - Replaces the Follow Ups "Coming soon" Card block with <FollowUpsFeature ... /> (robust regex).
#
# IMPORTANT: Does NOT run npm run dev (per your preference).
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

# 1) Ensure import exists (insert after the last import line)
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
    if ($i -eq $lastImport) {
      $newLines += $import
    }
  }
  $txt = ($newLines -join "`r`n")
  Ok "Inserted FollowUpsFeature import after last import"
} else {
  Ok "FollowUpsFeature import already present (skipped)"
}

# 2) Replace Follow Ups stub Card with FollowUpsFeature component
$pattern = '(?s)\{menu\s*===\s*"follow_ups"\s*&&\s*view\s*===\s*"customers"\s*&&\s*\(\s*<Card\b.*?<H2>\s*Follow\s*Ups\s*<\/H2>.*?Coming\s*soon\..*?<\/Card>\s*\)\s*\)\s*\}'
$rx = [regex]::new($pattern)

if (-not $rx.IsMatch($txt)) {
  # Fallback: match any Card block inside follow_ups section (if wording changed slightly)
  $pattern2 = '(?s)\{menu\s*===\s*"follow_ups"\s*&&\s*view\s*===\s*"customers"\s*&&\s*\(\s*<Card\b.*?<\/Card>\s*\)\s*\)\s*\}'
  $rx2 = [regex]::new($pattern2)
  if (-not $rx2.IsMatch($txt)) {
    Fail "Could not find the Follow Ups stub block to replace in App.tsx (menu === follow_ups)."
  } else {
    $rx = $rx2
    Warn "Used fallback matcher for Follow Ups stub (wording differed)."
  }
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
Ok "Replaced Follow Ups stub with FollowUpsFeature render"

Set-Content -Path $appPath -Value $txt -Encoding UTF8
Ok ("Wrote " + $appRel)

Write-Host ""
Write-Host "DONE. Refresh the browser (dev server not restarted)." -ForegroundColor Cyan
