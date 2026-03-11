# QuoteSync hotfix v2: Repair misplaced FollowUpsFeature import in App.tsx (NO regex quoting hazards)
# Symptom: "Unexpected keyword 'import'" because the FollowUpsFeature import was inserted inside another import block.
# Fix:
#  - Remove ANY existing line that imports FollowUpsFeature.
#  - Insert a single correct import AFTER the last top-level import statement or closing "} from ...;" line.
#
# IMPORTANT: Does NOT run npm run dev.
#
# Run from: PS C:\Github\QuoteSync\web\ps1_patches>
#   Unblock-File .\20260304_fix_app_followups_import_misplaced_v2_20260304_120334.ps1
#   pwsh -ExecutionPolicy Bypass -File .\20260304_fix_app_followups_import_misplaced_v2_20260304_120334.ps1

$ErrorActionPreference = "Stop"
function Fail($m){ Write-Host "ERROR: $m" -ForegroundColor Red; throw $m }
function Ok($m)  { Write-Host "OK: $m" -ForegroundColor Green }

$runDir = (Get-Location).Path
Write-Host ("Run directory: " + $runDir)

$webRoot = Resolve-Path (Join-Path $runDir "..") | Select-Object -ExpandProperty Path
if (-not (Test-Path (Join-Path $webRoot "package.json"))) { Fail "Could not detect web root (package.json not found) at: $webRoot" }
Ok ("Detected web root: " + $webRoot)

$appRel = "src\App.tsx"
$appPath = Join-Path $webRoot $appRel
if (-not (Test-Path $appPath)) { Fail "Missing file: $appPath" }

# Backup
$backupsRoot = Join-Path $webRoot "_backups"
New-Item -ItemType Directory -Force -Path $backupsRoot | Out-Null
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = Join-Path $backupsRoot $stamp
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
Ok ("Backup folder: " + $backupDir)

Copy-Item -Force $appPath (Join-Path $backupDir "App.tsx")
Ok ("Backed up " + $appRel)

$txt = Get-Content -Raw -Encoding UTF8 $appPath
$lines = $txt -split "`r?`n"

$importLine = 'import FollowUpsFeature from "./features/followUps/FollowUpsFeature";'

# 1) Remove any existing FollowUpsFeature import line anywhere
$lines2 = New-Object System.Collections.Generic.List[string]
foreach ($ln in $lines) {
  if ($ln -like '*FollowUpsFeature*from*"./features/followUps/FollowUpsFeature"*') { continue }
  $lines2.Add($ln)
}

# 2) Find last import section line
$last = -1
for ($i=0; $i -lt $lines2.Count; $i++) {
  $ln = $lines2[$i].Trim()

  if ($ln.StartsWith("import ")) { $last = $i; continue }

  # Also treat a multiline import terminator like: } from "./x";
  if (($ln.StartsWith("}") -or $ln.StartsWith("}}") -or $ln.StartsWith("}}}")) -and ($ln -like '* from "*' -or $ln -like "* from '*")) {
    if ($ln.EndsWith('";') -or $ln.EndsWith("';")) { $last = $i; continue }
  }
}

if ($last -lt 0) { Fail "Could not locate import section in App.tsx." }

# 3) Insert after $last
$finalLines = New-Object System.Collections.Generic.List[string]
for ($i=0; $i -lt $lines2.Count; $i++) {
  $finalLines.Add($lines2[$i])
  if ($i -eq $last) { $finalLines.Add($importLine) }
}

$final = ($finalLines -join "`r`n")

# 4) Ensure exactly one occurrence
$count = 0
foreach ($ln in ($final -split "`r?`n")) {
  if ($ln.Trim() -eq $importLine) { $count++ }
}
if ($count -ne 1) { Fail "Import fix failed: expected exactly 1 FollowUpsFeature import, found $count" }

Set-Content -Path $appPath -Value $final -Encoding UTF8
Ok ("Wrote " + $appRel)

Write-Host ""
Write-Host "DONE. Refresh the browser (dev server not restarted)." -ForegroundColor Cyan
Write-Host ("Backup: " + $backupDir) -ForegroundColor Cyan
