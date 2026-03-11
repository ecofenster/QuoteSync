<# 
QuoteSync Handover System — Setup + Snapshot Generator (v2)
Creates/updates:
  - web\_handover\HANDOVER.md
  - web\_handover\CONTEXT.json
  - web\_handover\SNAPSHOT.txt
  - web\_handover\PATCHLOG.md (if missing)

Rules:
  - Run from: PS C:\Github\QuoteSync\web\ps1_patches>
  - Auto-detect web root
  - Backup any overwritten handover files to web\_backups\<timestamp>\_handover\
  - Does NOT start/stop dev server
#>

param(
  [string]$Note = ""
)

$ErrorActionPreference = "Stop"

function Fail($m) { Write-Host "ERROR: $m" -ForegroundColor Red; throw $m }
function Ok($m)   { Write-Host "OK: $m" -ForegroundColor Green }
function Warn($m) { Write-Host "WARN: $m" -ForegroundColor Yellow }

$runDir = (Get-Location).Path
Write-Host "Run directory: $runDir"

# Detect web root by walking up until package.json found
$here = $runDir
$webRoot = $null
for ($i=0; $i -lt 10; $i++) {
  if (Test-Path (Join-Path $here "package.json")) { $webRoot = $here; break }
  $parent = Split-Path $here -Parent
  if ($parent -eq $here -or [string]::IsNullOrWhiteSpace($parent)) { break }
  $here = $parent
}
if (-not $webRoot) { Fail "Could not detect web root (package.json not found walking up from $runDir). Run from ...\web\ps1_patches." }

Ok "Detected web root: $webRoot"

$handoverDir = Join-Path $webRoot "_handover"
$backupDirRoot = Join-Path $webRoot "_backups"
$ts = Get-Date -Format "yyyyMMdd_HHmmss"

# Ensure directories
if (-not (Test-Path $handoverDir)) { New-Item -ItemType Directory -Path $handoverDir | Out-Null; Ok "Created: $handoverDir" } else { Ok "Exists: $handoverDir" }
if (-not (Test-Path $backupDirRoot)) { New-Item -ItemType Directory -Path $backupDirRoot | Out-Null; Ok "Created: $backupDirRoot" } else { Ok "Exists: $backupDirRoot" }

# Backup existing handover files if they exist
$handoverBackupDir = Join-Path (Join-Path $backupDirRoot $ts) "_handover"
$existing = @("HANDOVER.md","CONTEXT.json","SNAPSHOT.txt","PATCHLOG.md") | Where-Object { Test-Path (Join-Path $handoverDir $_) }
if ($existing.Count -gt 0) {
  New-Item -ItemType Directory -Path $handoverBackupDir -Force | Out-Null
  foreach ($f in $existing) {
    Copy-Item -Path (Join-Path $handoverDir $f) -Destination (Join-Path $handoverBackupDir $f) -Force
  }
  Ok "Backed up existing _handover files -> $handoverBackupDir"
} else {
  Ok "No existing _handover files to back up."
}

# --- Write HANDOVER.md ---
$handoverContent = @'
# QuoteSync — Development Handover (2026-03-04 Savepoint)

## Project
- **QuoteSync CRM / Estimating platform**
- **Repository location:** `C:\Github\QuoteSync\web`
- **Patch scripts location:** `C:\Github\QuoteSync\web\ps1_patches`
- **Backups:** `C:\Github\QuoteSync\web\_backups`

## Current Status
The application is running correctly via:
- `npm run dev`

Vite dev server is stable.

## Recent work completed

### Estimate Picker
Tabs implemented:
- Client info tab
- Estimates tab
- Orders tab
- Client notes tab
- File attachments tab

Estimate actions row implemented.

Buttons present:
- Send
- Add Follow Up
- Status (custom dropdown)
- Open

#### Status behaviour
| Status | Pill colour |
|---|---|
| Open | black |
| Order | green |
| Lost | red |

Dropdown menu items are neutral (white background).  
Colour only appears after selection on the pill.

### Follow Ups System
Features implemented:
- ✔ Add follow-up from estimate
- ✔ Follow-ups listed by date
- ✔ Multiple follow-ups per day supported
- ✔ Clicking a follow-up populates the detail pane
- ✔ Email + phone call flags stored
- ✔ Future integration planned with client notes

## UI Behaviour
Estimate list row includes:
- Email
- Follow up
- Estimate status
- Open estimate

Follow-up UI:
- Left panel: Follow-up list
- Bottom panel: Selected follow-up details

## Important Development Rules (MUST be followed)
1) **No manual edits requested from user.**  
   All changes must be delivered as **PowerShell patch scripts**. User runs scripts only.

2) Scripts must always:
   - run from: `PS C:\Github\QuoteSync\web\ps1_patches>`
   - detect web root automatically
   - create backups before modifying files

3) Always create backup before modifying files:
   - Backup location: `C:\Github\QuoteSync\web\_backups`

4) JSX must never be corrupted:
   - `style={ ... }` ❌
   - `style={{ ... }}` ✅  
   PowerShell patches must preserve **double braces**.

5) Never replace files with placeholders.  
   Patches must modify existing code only.

## Architecture Direction
QuoteSync will become:
1) Standalone app
2) WordPress plugin
3) Licensed SaaS
4) SQL backend (future)

## Next Development Phase
### Phase: Data Model Stabilisation
Goals:
1) Lock TypeScript models
2) Remove any usage
3) Centralise models in: `src/models/types.ts`

Then:
- Phase 2: Validation layer
- Phase 3: Database persistence

## Known Safe Baseline
Savepoint created: **2026-03-04**  
Backup location: `C:\Github\QuoteSync\web\_backups` (contains full project zip)

## Files recently edited
Primary:
- `src/features/estimatePicker/EstimatePickerTabs.tsx`

Related:
- `FollowUpsFeature.tsx`
- `EstimatePickerFeature.tsx`
- `App.tsx`

## First step in the new chat
Assistant must:
1) Confirm project state
2) Verify the savepoint
3) Ensure no JSX corruption
4) Continue development safely

## Optional (recommended next improvement)
Refactor `EstimatePickerTabs` and split into:
- `EstimateRowActions.tsx`
- `EstimateStatusDropdown.tsx`
- `EstimateSendModal.tsx`

This prevents the huge file from causing JSX corruption again.

'@
Set-Content -Path (Join-Path $handoverDir "HANDOVER.md") -Value $handoverContent -Encoding UTF8
Ok "Wrote: _handover\HANDOVER.md"

# --- Write CONTEXT.json ---
$contextJson = @'
{
  "project": "QuoteSync CRM / Estimating platform",
  "repo_root": "C:\\Github\\QuoteSync\\web",
  "patch_dir": "C:\\Github\\QuoteSync\\web\\ps1_patches",
  "backup_dir": "C:\\Github\\QuoteSync\\web\\_backups",
  "handover_dir": "C:\\Github\\QuoteSync\\web\\_handover",
  "savepoint": "2026-03-04",
  "rules": [
    "No manual edits requested from user; deliver PowerShell patch scripts only.",
    "Scripts run from PS C:\\Github\\QuoteSync\\web\\ps1_patches and auto-detect web root.",
    "Always backup before modifying files into C:\\Github\\QuoteSync\\web\\_backups.",
    "Never corrupt JSX; preserve style={{ ... }} double braces.",
    "Never replace files with placeholders; patch real existing code only."
  ],
  "hot_files": [
    "src\\models\\types.ts",
    "src\\App.tsx",
    "src\\features\\estimatePicker\\EstimatePickerTabs.tsx",
    "src\\features\\estimatePicker\\EstimatePickerFeature.tsx",
    "src\\features\\followUps\\FollowUpsFeature.tsx"
  ]
}
'@
Set-Content -Path (Join-Path $handoverDir "CONTEXT.json") -Value $contextJson -Encoding UTF8
Ok "Wrote: _handover\CONTEXT.json"

# --- Ensure PATCHLOG.md ---
$patchLogPath = Join-Path $handoverDir "PATCHLOG.md"
if (-not (Test-Path $patchLogPath)) {
  $pl = @"
# QuoteSync Patch Log

Each entry should include:
- Date/time
- Patch script filename
- Summary of change
- Files changed

---
"@
  Set-Content -Path $patchLogPath -Value $pl -Encoding UTF8
  Ok "Created: _handover\PATCHLOG.md"
} else {
  Ok "Exists: _handover\PATCHLOG.md"
}

function Sha256File($p) {
  if (-not (Test-Path $p)) { return $null }
  return (Get-FileHash -Path $p -Algorithm SHA256).Hash
}

function Write-Snapshot($webRoot) {
  $handoverDir = Join-Path $webRoot "_handover"
  $snapshotPath = Join-Path $handoverDir "SNAPSHOT.txt"

  # Git info (optional)
  $gitBranch = $null; $gitSha = $null; $gitDirty = $null
  if (Test-Path (Join-Path $webRoot ".git")) {
    try {
      $gitBranch = (& git -C $webRoot rev-parse --abbrev-ref HEAD) 2>$null
      $gitSha    = (& git -C $webRoot rev-parse --short HEAD) 2>$null
      $gitDirty  = (& git -C $webRoot status --porcelain) 2>$null
    } catch { }
  }

  # Node/npm
  $nodev = $null; $npmv = $null
  try { $nodev = (& node -v) 2>$null } catch { $nodev = "<node not found>" }
  try { $npmv  = (& npm -v) 2>$null } catch { $npmv  = "<npm not found>" }

  # Tree (src only)
  $srcPath = Join-Path $webRoot "src"
  if (-not (Test-Path $srcPath)) { Fail "src folder not found at $srcPath" }

  $hotFiles = @(
    "src\models\types.ts",
    "src\App.tsx",
    "src\features\estimatePicker\EstimatePickerTabs.tsx",
    "src\features\estimatePicker\EstimatePickerFeature.tsx",
    "src\features\followUps\FollowUpsFeature.tsx"
  )

  $hotReport = @()
  foreach ($rel in $hotFiles) {
    $abs = Join-Path $webRoot $rel
    $hash = Sha256File $abs
    $exists = Test-Path $abs
    $hotReport += [pscustomobject]@{ Path=$rel; Exists=$exists; SHA256=($hash ?? "") }
  }

  $treeLines = @()
  $items = Get-ChildItem -Path $srcPath -Recurse -File | Sort-Object FullName
  foreach ($it in $items) {
    $rel = $it.FullName.Substring($webRoot.Length).TrimStart('\')
    $treeLines += ("{0}  {1}" -f $it.Length, $rel)
  }

  $snap = @()
  $snap += "QuoteSync SNAPSHOT"
  $snap += "Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
  $snap += "WebRoot: $webRoot"
  $snap += "RunDir: $runDir"
  $snap += ""
  $snap += "Environment:"
  $snap += "  Node: $nodev"
  $snap += "  npm : $npmv"
  if ($gitBranch) {
    $snap += "  GitBranch: $gitBranch"
    $snap += "  GitSHA   : $gitSha"
    $snap += ("  GitDirty : " + ( [string]::IsNullOrWhiteSpace($gitDirty) ? "clean" : "CHANGES" ))
  } else {
    $snap += "  Git: <not detected>"
  }
  $snap += ""
  $snap += "Hot files (SHA256):"
  foreach ($h in $hotReport) {
    $snap += ("  - {0} | exists={1} | {2}" -f $h.Path, $h.Exists, ($h.SHA256))
  }
  $snap += ""
  $snap += "src tree (bytes  relativePath):"
  $snap += $treeLines

  Set-Content -Path $snapshotPath -Value ($snap -join "`r`n") -Encoding UTF8
  Ok "Wrote: _handover\SNAPSHOT.txt"
}

Write-Snapshot -webRoot $webRoot

# Optional note into PATCHLOG
if (-not [string]::IsNullOrWhiteSpace($Note)) {
  $entry = @()
  $entry += ""
  $entry += "## $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
  $entry += $Note
  Add-Content -Path $patchLogPath -Value ($entry -join "`r`n") -Encoding UTF8
  Ok "Appended note to: _handover\PATCHLOG.md"
}

Ok "Handover system setup complete."
Write-Host ""
Write-Host "For new chats upload: _handover\HANDOVER.md + _handover\SNAPSHOT.txt + _handover\CONTEXT.json" -ForegroundColor Cyan
Write-Host ""
