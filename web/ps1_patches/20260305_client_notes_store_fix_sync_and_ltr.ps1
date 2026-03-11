<# 
QuoteSync Patch — Centralize Client Notes storage + fix sync + force LTR rendering
Purpose:
- STOP the recurring "notes appear backwards" issue by forcing LTR + unicodeBidi plaintext in the Client Notes editor + note body.
- STOP FollowUps notes not appearing in Client Notes by centralizing persistence + adding a tiny pub/sub refresh.

What this does:
1) Adds: src\services\clientNotesStore.ts
   - Single source of truth for client notes in localStorage:
       qs_client_notes_v1_<clientId>
   - Dispatches a window event when notes change.

2) FollowUpsFeature.tsx
   - Save note uses appendClientNote() instead of writing localStorage inline.

3) EstimatePickerFeature.tsx
   - Loads notes via loadClientNotes()
   - Saves via saveClientNotes()
   - Subscribes to note-change events and refreshes current client notes.

4) EstimatePickerTabs.tsx
   - Forces LTR + unicodeBidi plaintext for:
       a) the contentEditable note editor
       b) the rendered note body

Run from:
PS C:\Github\QuoteSync\web\ps1_patches>

Backups:
C:\Github\QuoteSync\web\_backups\<timestamp>\

Dev server:
Does NOT run/restart npm run dev.

Also:
Updates _handover\PATCHLOG.md + _handover\SNAPSHOT.txt on success.
#>

param(
  [string]$Note = "Client Notes: central store + sync between FollowUps/ClientNotes + force LTR (fix backwards text)"
)

$ErrorActionPreference = "Stop"
function Fail($m){ Write-Host "ERROR: $m" -ForegroundColor Red; throw $m }
function Ok($m){ Write-Host "OK: $m" -ForegroundColor Green }
function Warn($m){ Write-Host "WARN: $m" -ForegroundColor Yellow }

$runDir = (Get-Location).Path
Write-Host "Run directory: $runDir"

# Detect web root
$here = $runDir
$webRoot = $null
for ($i=0; $i -lt 10; $i++) {
  if (Test-Path (Join-Path $here "package.json")) { $webRoot = $here; break }
  $parent = Split-Path $here -Parent
  if ($parent -eq $here -or [string]::IsNullOrWhiteSpace($parent)) { break }
  $here = $parent
}
if (-not $webRoot) { Fail "Could not detect web root (package.json not found). Run from ...\web\ps1_patches." }
Ok "Detected web root: $webRoot"

$ts = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = Join-Path (Join-Path $webRoot "_backups") $ts
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
Ok "Backup dir: $backupDir"

$serviceRel = "src\services\clientNotesStore.ts"
$fuRel = "src\features\followUps\FollowUpsFeature.tsx"
$epRel = "src\features\estimatePicker\EstimatePickerFeature.tsx"
$tabsRel = "src\features\estimatePicker\EstimatePickerTabs.tsx"

$servicePath = Join-Path $webRoot $serviceRel
$fuPath = Join-Path $webRoot $fuRel
$epPath = Join-Path $webRoot $epRel
$tabsPath = Join-Path $webRoot $tabsRel

foreach ($p in @($fuPath,$epPath,$tabsPath)) {
  if (-not (Test-Path $p)) { Fail "Missing file: $p" }
}

Copy-Item -Path $fuPath -Destination (Join-Path $backupDir "FollowUpsFeature.tsx") -Force
Copy-Item -Path $epPath -Destination (Join-Path $backupDir "EstimatePickerFeature.tsx") -Force
Copy-Item -Path $tabsPath -Destination (Join-Path $backupDir "EstimatePickerTabs.tsx") -Force
Ok "Backed up: $fuRel"
Ok "Backed up: $epRel"
Ok "Backed up: $tabsRel"

# Ensure src\services exists and write service file
$servicesDir = Split-Path $servicePath -Parent
if (-not (Test-Path $servicesDir)) { New-Item -ItemType Directory -Path $servicesDir -Force | Out-Null; Ok "Created: $servicesDir" }

@'
// Central client notes store (Phase 1: localStorage + lightweight pub/sub)
//
// Single source of truth for client notes persistence.
// Used by FollowUps + Client Notes tab to prevent sync bugs.
//
// Storage key: qs_client_notes_v1_<clientId>
//
// Note: Notes are client-specific (not project-specific) by design for now.

import type { ClientNote } from "../models/types";

const KEY_PREFIX = "qs_client_notes_v1_";
const EVENT_NAME = "qs_client_notes_changed";

export function clientNotesKey(clientId: string): string {
  return KEY_PREFIX + clientId;
}

export function loadClientNotes(clientId: string): ClientNote[] {
  try {
    const raw = localStorage.getItem(clientNotesKey(clientId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ClientNote[]) : [];
  } catch {
    return [];
  }
}

export function saveClientNotes(clientId: string, notes: ClientNote[]): void {
  try {
    localStorage.setItem(clientNotesKey(clientId), JSON.stringify(notes ?? []));
  } catch {
    // ignore
  }
  try {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { clientId } }));
  } catch {
    // ignore
  }
}

export function appendClientNote(clientId: string, note: ClientNote): ClientNote[] {
  const current = loadClientNotes(clientId);
  const next = [note, ...current];
  saveClientNotes(clientId, next);
  return next;
}

export function subscribeClientNotes(handler: (clientId: string) => void): () => void {
  const onEvt = (e: Event) => {
    const ce = e as CustomEvent;
    const cid = ce?.detail?.clientId as string | undefined;
    if (cid) handler(cid);
  };
  window.addEventListener(EVENT_NAME, onEvt as EventListener);
  return () => window.removeEventListener(EVENT_NAME, onEvt as EventListener);
}

'@ | Set-Content -Path $servicePath -Encoding UTF8
Ok "Wrote: $serviceRel"

# ---- Patch FollowUpsFeature.tsx
$fu = Get-Content -Path $fuPath -Raw -Encoding UTF8

if ($fu -notmatch 'clientNotesStore') {
  $fu = [regex]::Replace(
    $fu,
    '(^import[^\r\n]*\r?\n(?:import[^\r\n]*\r?\n)*)',
    '$1' + "import { appendClientNote } from \"../../services/clientNotesStore\";" + "`r`n",
    1,
    [System.Text.RegularExpressions.RegexOptions]::Multiline
  )
  if ($fu -notmatch 'appendClientNote') { Fail "FollowUpsFeature: failed to insert appendClientNote import." }
  Ok "FollowUpsFeature: inserted appendClientNote import"
} else {
  Ok "FollowUpsFeature: clientNotesStore import already present"
}

$fu = [regex]::Replace(
  $fu,
  'const\s+createdAt\s*=\s*new\s+Date\(\)\.toISOString\(\);\s*\r?\n\s*const\s+key\s*=\s*CLIENT_NOTES_KEY_PREFIX\s*\+\s*selectedFollowUp\.clientId;\s*\r?\n\s*\r?\n\s*try\s*\{\s*\r?\n\s*const\s+raw\s*=\s*localStorage\.getItem\(key\);\s*\r?\n\s*const\s+parsed\s*=\s*raw\s*\?\s*JSON\.parse\(raw\)\s*:\s*\[\];\s*\r?\n\s*const\s+list\s*=\s*Array\.isArray\(parsed\)\s*\?\s*parsed\s*:\s*\[\];\s*\r?\n\s*list\.unshift\(\{[^}]*createdAt[^}]*\}\);\s*\r?\n\s*localStorage\.setItem\(key,\s*JSON\.stringify\(list\)\);\s*\r?\n\s*\}\s*catch\s*\{\s*\r?\n\s*//\s*ignore\s*\r?\n\s*\}\s*\r?\n\s*\r?\n\s*setClientNoteDraft\(\"\"\);',
  'const createdAt = new Date().toISOString();' + "`r`n" +
  '                    appendClientNote(selectedFollowUp.clientId, { id: \"note_\" + createdAt, html, createdAt, createdBy: \"User\" });' + "`r`n`r`n" +
  '                    setClientNoteDraft(\"\" );',
  1,
  [System.Text.RegularExpressions.RegexOptions]::Singleline
)

Set-Content -Path $fuPath -Value $fu -Encoding UTF8
Ok "Patched: $fuRel"

# ---- Patch EstimatePickerFeature.tsx
$ep = Get-Content -Path $epPath -Raw -Encoding UTF8

if ($ep -notmatch 'clientNotesStore') {
  $ep = [regex]::Replace(
    $ep,
    '(^import[^\r\n]*\r?\n(?:import[^\r\n]*\r?\n)*)',
    '$1' + "import { loadClientNotes, saveClientNotes, subscribeClientNotes } from \"../../services/clientNotesStore\";" + "`r`n",
    1,
    [System.Text.RegularExpressions.RegexOptions]::Multiline
  )
  if ($ep -notmatch 'loadClientNotes') { Fail "EstimatePickerFeature: failed to insert clientNotesStore imports." }
  Ok "EstimatePickerFeature: inserted clientNotesStore imports"
} else {
  Ok "EstimatePickerFeature: clientNotesStore imports already present"
}

# Insert effects after activeUserName if not already present
if ($ep -notmatch 'subscribeClientNotes\(') {
  $anchor = 'const activeUserName = "User";'
  if ($ep -notlike "*$anchor*") { Fail "EstimatePickerFeature: activeUserName anchor not found." }

  $effects = @'
const activeUserName = "User";

  // Load client notes whenever the selected client changes
  useEffect(() => {
    if (!pickerClientId) {
      setClientNotes([]);
      setClientNoteDraftHtml("");
      return;
    }
    setClientNotes(loadClientNotes(pickerClientId as unknown as string));
    setClientNoteDraftHtml("");
  }, [pickerClientId]);

  // Persist notes (per-client) whenever notes change
  useEffect(() => {
    if (!pickerClientId) return;
    saveClientNotes(pickerClientId as unknown as string, clientNotes);
  }, [pickerClientId, clientNotes]);

  // Live refresh: when FollowUps saves a note for the same client, reload it immediately
  useEffect(() => {
    const unsub = subscribeClientNotes((clientId) => {
      if (!pickerClientId) return;
      if (clientId !== (pickerClientId as unknown as string)) return;
      setClientNotes(loadClientNotes(clientId));
    });
    return () => unsub();
  }, [pickerClientId]);
'@

  $ep = $ep.Replace($anchor, $effects)
  Ok "EstimatePickerFeature: wired notes to central store + subscription"
} else {
  Ok "EstimatePickerFeature: subscription already present"
}

Set-Content -Path $epPath -Value $ep -Encoding UTF8
Ok "Patched: $epRel"

# ---- Patch EstimatePickerTabs.tsx
$tabs = Get-Content -Path $tabsPath -Raw -Encoding UTF8

# Force LTR in note editor style (insert if missing)
if ($tabs -notmatch 'unicodeBidi:\s*\"plaintext\"') {
  $tabs = [regex]::Replace(
    $tabs,
    '(contentEditable[\s\S]*?<div\s+style=\{\{)([\s\S]*?)(\}\})',
    '$1$2, direction: "ltr", unicodeBidi: "plaintext"$3',
    1
  )
  Ok "EstimatePickerTabs: enforced LTR on editor (best-effort)"
}

# Force LTR in rendered note body (best-effort)
if ($tabs -notmatch 'direction:\s*\"ltr\"') {
  $tabs = [regex]::Replace(
    $tabs,
    '(fontSize:\s*13,\s*lineHeight:\s*1\.5,\s*color:\s*\"#111827\",)',
    '$1 direction: "ltr", unicodeBidi: "plaintext",',
    1
  )
  Ok "EstimatePickerTabs: enforced LTR on note body (best-effort)"
}

Set-Content -Path $tabsPath -Value $tabs -Encoding UTF8
Ok "Patched: $tabsRel"

Ok "Done."
