# QuoteSync hotfix: Repair misplaced FollowUpsFeature import in App.tsx
# Symptom: "Unexpected keyword 'import'" because the FollowUpsFeature import was inserted INSIDE another import block.
# Fix:
#  - Remove ANY existing line importing FollowUpsFeature.
#  - Insert a single correct import AFTER the last top-level import statement in App.tsx.
#
# IMPORTANT: Does NOT run npm run dev.
#
# Run from: PS C:\Github\QuoteSync\web\ps1_patches>
#   Unblock-File .\20260304_fix_app_followups_import_misplaced_20260304_115712.ps1
#   pwsh -ExecutionPolicy Bypass -File .\20260304_fix_app_followups_import_misplaced_20260304_115712.ps1

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

# 1) Remove any existing FollowUpsFeature import line(s) (wherever they landed)
$txt2 = ($txt -split "`r?`n") | Where-Object { $_ -notmatch 'FollowUpsFeature\s+from\s+"\.\/features\/followUps\/FollowUpsFeature"' } | ForEach-Object { $_ }
$txt2 = ($txt2 -join "`r`n")

# 2) Insert the correct import after the last import statement.
$importLine = 'import FollowUpsFeature from "./features/followUps/FollowUpsFeature";'

# Find last "import ..." line OR closing line of a multiline import like `} from "...";`
$lines = $txt2 -split "`r?`n"
$last = -1
for ($i=0; $i -lt $lines.Length; $i++) {
  if ($lines[$i] -match '^[\s]*import\s+.+;[\s]*$') { $last = $i; continue }
  if ($lines[$i] -match '^[\s]*\}\s*from\s*["\'].+["\'];[\s]*$') { $last = $i; continue }
}
if ($last -lt 0) { Fail "Could not locate import section in App.tsx." }

# Avoid double insert if already present (after removals it should not be present)
$newLines = New-Object System.Collections.Generic.List[string]
for ($i=0; $i -lt $lines.Length; $i++) {
  $newLines.Add($lines[$i])
  if ($i -eq $last) {
    $newLines.Add($importLine)
  }
}
$final = ($newLines -join "`r`n")

# 3) Sanity: ensure exactly 1 occurrence
$count = ([regex]::Matches($final, [regex]::Escape($importLine))).Count
if ($count -ne 1) { Fail "Import fix failed: expected exactly 1 FollowUpsFeature import, found $count" }

Set-Content -Path $appPath -Value $final -Encoding UTF8
Ok ("Wrote " + $appRel)

Write-Host ""
Write-Host "DONE. Refresh the browser (dev server not restarted)." -ForegroundColor Cyan
Write-Host "Backup: $backupDir" -ForegroundColor Cyan
