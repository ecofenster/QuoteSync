# =========================
# QuoteSync - Savepoint + Handover (working Estimate Picker)
# Run from: PS C:\Github\QuoteSync\web\ps1_patches>
# Then:
#   Unblock-File .\20260303_savepoint_and_handover.ps1
#   pwsh -ExecutionPolicy Bypass -File .\20260303_savepoint_and_handover.ps1
# =========================

$ErrorActionPreference = "Stop"
function Ok($m){ Write-Host "OK: $m" -ForegroundColor Green }
function Warn($m){ Write-Host "WARN: $m" -ForegroundColor Yellow }
function Fail($m){ Write-Host "ERROR: $m" -ForegroundColor Red; throw $m }

$runDir = (Get-Location).Path
Write-Host "Run directory: $runDir"

# Detect web root
$webRoot = $null
if (Test-Path (Join-Path $runDir "src\App.tsx")) {
  $webRoot = $runDir
} elseif ($runDir -like "*\web\ps1_patches") {
  $webRoot = Resolve-Path (Join-Path $runDir "..") | Select-Object -ExpandProperty Path
} elseif ($runDir -like "*\ps1_patches") {
  $maybe = Resolve-Path (Join-Path $runDir "..") | Select-Object -ExpandProperty Path
  if (Test-Path (Join-Path $maybe "src\App.tsx")) { $webRoot = $maybe }
}

if (-not $webRoot) { Fail "Could not detect web root. Expected to find src\App.tsx. Run from: PS C:\Github\QuoteSync\web\ps1_patches>" }
Ok "Detected web root: $webRoot"

# Backup folder
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupsRoot = Join-Path $webRoot "_backups"
if (-not (Test-Path $backupsRoot)) { New-Item -ItemType Directory -Path $backupsRoot | Out-Null }

$backupName = "${stamp}_SAVEPOINT_working_estimate_picker"
$backupDir  = Join-Path $backupsRoot $backupName
New-Item -ItemType Directory -Path $backupDir | Out-Null
Ok "Savepoint folder: $backupDir"

function Copy-Rel([string]$rel, [bool]$required = $false){
  $src = Join-Path $webRoot $rel
  if (!(Test-Path $src)) {
    if ($required) { Fail "Missing required file: $rel" }
    Warn "Missing optional file: $rel"
    return
  }
  $dstName = ($rel -replace '[\\\/:]', '_')
  $dst = Join-Path $backupDir $dstName
  Copy-Item $src $dst -Force
  Ok "Saved $rel -> $dstName"
}

# Required core files (current issue area)
Copy-Rel "src\App.tsx" $true
Copy-Rel "src\features\estimatePicker\EstimatePickerFeature.tsx" $true
Copy-Rel "src\features\estimatePicker\EstimatePickerTabs.tsx" $true

# Helpful context files (optional)
Copy-Rel "src\models\types.ts" $false
Copy-Rel "src\data\defaultClients.ts" $false
Copy-Rel "src\data\defaultCatalog.ts" $false
Copy-Rel "src\data\defaultEstimateDefaults.ts" $false
Copy-Rel "src\admin\DefaultsEditor.tsx" $false
Copy-Rel "src\admin\GridEditor.tsx" $false

# Environment info
$envLines = @()
$envLines += "Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
$envLines += "Web root: $webRoot"
try { $envLines += "Node: $((node -v) 2>$null)" } catch {}
try { $envLines += "npm:  $((npm -v) 2>$null)" } catch {}
try {
  $branch = (git -C $webRoot rev-parse --abbrev-ref HEAD) 2>$null
  $commit = (git -C $webRoot rev-parse --short HEAD) 2>$null
  if ($branch) { $envLines += "Branch: $branch" }
  if ($commit) { $envLines += "Commit:  $commit" }
} catch {}

# Handover content
$handover = @"
# QuoteSync Handover (savepoint: $backupName)

## Status
- App is **working again** after recent breakages.
- **Customers → Client Database → Open** now loads the **Estimate Picker** screen and shows **Client Info** (tabs visible).
- Recent failures included:
  - App.tsx truncation errors (Vite “Unexpected token … at EOF”).
  - EstimatePickerTabs.tsx stray duplicated JSX lines causing parser errors.
  - Runtime error: **pendingPickerClientId is not defined** (blank screen in App).

## What was fixed (today)
- Fixed Estimate Picker tab component syntax issues (stray duplicated lines like `}}>{children}</div>;` and similar).
- Fixed runtime crash by ensuring `pendingPickerClientId` is defined/guarded in App.tsx (so Open doesn’t crash the App component).
- Restored the Estimate Picker flow so selecting a client and clicking **Open** reliably enters the picker view.

## Current working files in this savepoint
- src\App.tsx
- src\features\estimatePicker\EstimatePickerFeature.tsx
- src\features\estimatePicker\EstimatePickerTabs.tsx

(Additional context files were copied if present.)

## Known issues / next stabilisation tasks
- Confirm "Open / Back / New Estimate" flows for multiple clients.
- Confirm tab switching: Client Info / Estimates / Orders / Client Notes / Files.
- Confirm no hidden runtime errors in console while navigating.
- Tighten backup/restore scripts so they always find flattened backup filenames.

## Rules (do not break)
- **NO manual edits by user** (Ecofenster only runs provided scripts).
- Always provide a **real .ps1 file** for download (not inline “create the file yourself”).
- Scripts must be run from: **PS C:\Github\QuoteSync\web\ps1_patches>**
- Run steps every time:
  1) `Unblock-File .\NAME.ps1`
  2) `pwsh -ExecutionPolicy Bypass -File .\NAME.ps1`
- **Backup before every change** (timestamped under `web\_backups\...`).
- Do not change UI layout without explicit approval.

## Environment
$($envLines -join "`r`n")
"@

$handoverMin = @"
QuoteSync savepoint: $backupName
Working: Customers → Client Database → Open shows Estimate Picker with Client Info.
Fixed: parser breaks in EstimatePickerTabs.tsx + runtime crash pendingPickerClientId undefined.
Savepoint files: App.tsx, EstimatePickerFeature.tsx, EstimatePickerTabs.tsx (plus optional context).
Rules: scripts-only, run from web\ps1_patches, Unblock-File then pwsh, backup before changes, no layout changes without approval.
Env: $($envLines -join " | ")
"@

# Write handover files into backup folder
$handoverPath = Join-Path $backupDir "HANDOVER.md"
$handoverMinPath = Join-Path $backupDir "HANDOVER.min.md"
Set-Content -Path $handoverPath -Value $handover -Encoding UTF8
Set-Content -Path $handoverMinPath -Value $handoverMin -Encoding UTF8
Ok "Wrote HANDOVER.md and HANDOVER.min.md into savepoint folder."

# Also write to central Docs folder (optional)
$docsRoot = Join-Path (Resolve-Path (Join-Path $webRoot "..") | Select-Object -ExpandProperty Path) "Docs"
try {
  if (-not (Test-Path $docsRoot)) { New-Item -ItemType Directory -Path $docsRoot | Out-Null }
  $docsH = Join-Path $docsRoot ("HANDOVER_$backupName.md")
  $docsHm = Join-Path $docsRoot ("HANDOVER_$backupName.min.md")
  Set-Content -Path $docsH -Value $handover -Encoding UTF8
  Set-Content -Path $docsHm -Value $handoverMin -Encoding UTF8
  Ok "Also wrote handover files to: $docsRoot"
} catch {
  Warn "Could not write to Docs folder (non-fatal): $($_.Exception.Message)"
}

Ok "DONE. Savepoint created: $backupDir"
