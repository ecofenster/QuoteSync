# QuoteSync hotfix: FollowUpsFeature - define selectedFollowUp (fix "selectedFollowUp is not defined")
# - Adds/repairs selectedId state, selectedFollowUp memo, and previousForClient memo.
# - Ensures react imports include useMemo/useEffect/useState.
#
# IMPORTANT: Does NOT run npm run dev.
#
# Run from: PS C:\Github\QuoteSync\web\ps1_patches>
#   Unblock-File .\20260304_fix_followups_selectedFollowUp_not_defined_20260304_120941.ps1
#   pwsh -ExecutionPolicy Bypass -File .\20260304_fix_followups_selectedFollowUp_not_defined_20260304_120941.ps1

$ErrorActionPreference = "Stop"
function Fail($m){ Write-Host "ERROR: $m" -ForegroundColor Red; throw $m }
function Ok($m)  { Write-Host "OK: $m" -ForegroundColor Green }
function Warn($m){ Write-Host "WARN: $m" -ForegroundColor Yellow }

$runDir = (Get-Location).Path
Write-Host ("Run directory: " + $runDir)

$webRoot = Resolve-Path (Join-Path $runDir "..") | Select-Object -ExpandProperty Path
if (-not (Test-Path (Join-Path $webRoot "package.json"))) { Fail "Could not detect web root (package.json not found) at: $webRoot" }
Ok ("Detected web root: " + $webRoot)

$fuRel  = "src\features\followUps\FollowUpsFeature.tsx"
$fuPath = Join-Path $webRoot $fuRel
if (-not (Test-Path $fuPath)) { Fail "Missing file: $fuPath" }

# Backup
$backupsRoot = Join-Path $webRoot "_backups"
New-Item -ItemType Directory -Force -Path $backupsRoot | Out-Null
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = Join-Path $backupsRoot $stamp
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
Ok ("Backup folder: " + $backupDir)

Copy-Item -Force $fuPath (Join-Path $backupDir "FollowUpsFeature.tsx")
Ok ("Backed up " + $fuRel)

$txt = Get-Content -Raw -Encoding UTF8 $fuPath

# 1) Ensure React hook imports include useMemo/useEffect/useState
# Handles either: import React, { ... } from "react"; OR import { ... } from "react";
if ($txt -match 'from "react";') {
  if ($txt -match 'import\s+React\s*,\s*\{') {
    # Add missing hooks inside the braces
    $txt = [regex]::Replace($txt, 'import\s+React\s*,\s*\{([^}]*)\}\s+from\s+"react";', {
      param($m)
      $inner = $m.Groups[1].Value
      $need = @("useMemo","useEffect","useState")
      foreach ($n in $need) {
        if ($inner -notmatch "(^|,)\s*$n\s*(,|$)") { $inner = ($inner.Trim() + ", " + $n).Trim() }
      }
      'import React, {' + $inner + '} from "react";'
    }, 1)
  } elseif ($txt -match 'import\s+\{') {
    $txt = [regex]::Replace($txt, 'import\s+\{([^}]*)\}\s+from\s+"react";', {
      param($m)
      $inner = $m.Groups[1].Value
      $need = @("useMemo","useEffect","useState")
      foreach ($n in $need) {
        if ($inner -notmatch "(^|,)\s*$n\s*(,|$)") { $inner = ($inner.Trim() + ", " + $n).Trim() }
      }
      'import {' + $inner + '} from "react";'
    }, 1)
  }
}

# 2) Ensure selectedId state exists (insert after items state)
if ($txt -notmatch '\bconst\s+\[selectedId,\s*setSelectedId\]\s*=\s*useState') {
  $anchor = 'const [items, setItems] = useState<FollowUp[]>(() => loadFollowUps());'
  if ($txt -notmatch [regex]::Escape($anchor)) {
    Fail "Could not find items state anchor to insert selectedId. Please upload FollowUpsFeature.tsx if structure changed."
  }
  $insert = $anchor + "`r`n  const [selectedId, setSelectedId] = useState<string | null>(null);"
  $txt = $txt.Replace($anchor, $insert)
  Ok "Inserted selectedId state"
} else {
  Ok "selectedId state already present"
}

# 3) Ensure selectedFollowUp memo exists
if ($txt -notmatch '\bconst\s+selectedFollowUp\s*=\s*useMemo') {
  # Insert after dayItems definition (safe and near usage)
  $anchor2 = 'const dayItems = itemsByDay.get(selectedISO) ?? [];'
  if ($txt -notmatch [regex]::Escape($anchor2)) {
    # fallback insert near selectedISO
    $anchor2 = 'const selectedISO = useMemo('
    if ($txt -notmatch [regex]::Escape($anchor2)) { Fail "Could not find suitable insertion point for selectedFollowUp memo." }
    $pos = $txt.IndexOf($anchor2)
    $txt = $txt.Insert($pos, "  const dayItems = itemsByDay.get(selectedISO) ?? [];`r`n`r`n")
    $anchor2 = 'const dayItems = itemsByDay.get(selectedISO) ?? [];'
  }
  $snippet = @'
  const selectedFollowUp = useMemo(() => items.find((x) => x.id === selectedId) ?? null, [items, selectedId]);

  const previousForClient = useMemo(() => {
    if (!selectedFollowUp) return [] as FollowUp[];
    return items
      .filter((x) => x.clientId === selectedFollowUp.clientId)
      .slice()
      .sort((a, b) => (a.dueDateISO < b.dueDateISO ? 1 : -1));
  }, [items, selectedFollowUp]);

'@
  $txt = $txt.Replace($anchor2, $anchor2 + "`r`n`r`n" + $snippet)
  Ok "Inserted selectedFollowUp + previousForClient memos"
} else {
  Ok "selectedFollowUp memo already present"
  if ($txt -notmatch '\bconst\s+previousForClient\s*=\s*useMemo') {
    Warn "selectedFollowUp exists but previousForClient missing; inserting previousForClient."
    $anchor3 = 'const selectedFollowUp = useMemo(() => items.find((x) => x.id === selectedId) ?? null, [items, selectedId]);'
    if ($txt -notmatch [regex]::Escape($anchor3)) { Fail "Could not find selectedFollowUp line to insert previousForClient." }
    $snippet2 = @'

  const previousForClient = useMemo(() => {
    if (!selectedFollowUp) return [] as FollowUp[];
    return items
      .filter((x) => x.clientId === selectedFollowUp.clientId)
      .slice()
      .sort((a, b) => (a.dueDateISO < b.dueDateISO ? 1 : -1));
  }, [items, selectedFollowUp]);

'@
    $txt = $txt.Replace($anchor3, $anchor3 + $snippet2)
    Ok "Inserted previousForClient memo"
  } else {
    Ok "previousForClient memo already present"
  }
}

Set-Content -Path $fuPath -Value $txt -Encoding UTF8
Ok ("Wrote " + $fuRel)

Write-Host ""
Write-Host "DONE. Refresh the browser." -ForegroundColor Cyan
Write-Host ("Backup: " + $backupDir) -ForegroundColor Cyan
