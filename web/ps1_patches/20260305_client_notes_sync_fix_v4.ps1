<# 
QuoteSync Patch (v4) — Fix FollowUps note -> Client Notes (client-specific) + stop "backwards" display
What this fixes (ONLY):
1) FollowUpsFeature was saving to key: qs_client_notes_<clientId>  (wrong key)
   while Client Notes expects client-specific notes (we standardize to):
   qs_client_notes_v1_<clientId>

2) EstimatePickerFeature had no persistence or refresh for clientNotes state, so it wouldn't
   show notes saved elsewhere until the client was reopened.

3) Client Notes editor / rendered note body can flip RTL and display reversed text.
   We force LTR + unicodeBidi plaintext for the editor and note body (style only).

Changes:
- Adds src\services\clientNotesStore.ts (single source of truth + event)
- FollowUpsFeature: Save note uses appendClientNote() (no more wrong key)
- EstimatePickerFeature: loads/saves/subscribes via store
- EstimatePickerTabs: adds direction:"ltr" and unicodeBidi:"plaintext" to note editor + body

Run from:
PS C:\Github\QuoteSync\web\ps1_patches>

Backups:
C:\Github\QuoteSync\web\_backups\<timestamp>\

Dev server:
Does NOT run/restart npm run dev.
#>

$ErrorActionPreference="Stop"
function Fail($m){ Write-Host "ERROR: $m" -ForegroundColor Red; throw $m }
function Ok($m){ Write-Host "OK: $m" -ForegroundColor Green }
function Warn($m){ Write-Host "WARN: $m" -ForegroundColor Yellow }

$runDir=(Get-Location).Path
Write-Host "Run directory: $runDir"

# detect web root
$here=$runDir
$webRoot=$null
for($i=0;$i -lt 10;$i++){
  if(Test-Path (Join-Path $here "package.json")){ $webRoot=$here; break }
  $p=Split-Path $here -Parent
  if($p -eq $here){ break }
  $here=$p
}
if(-not $webRoot){ Fail "Could not detect web root (package.json not found). Run from ...\web\ps1_patches." }
Ok "Detected web root: $webRoot"

$ts=Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir=Join-Path (Join-Path $webRoot "_backups") $ts
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
Ok "Backup dir: $backupDir"

$serviceRel="src\services\clientNotesStore.ts"
$fuRel="src\features\followUps\FollowUpsFeature.tsx"
$epRel="src\features\estimatePicker\EstimatePickerFeature.tsx"
$tabsRel="src\features\estimatePicker\EstimatePickerTabs.tsx"

$servicePath=Join-Path $webRoot $serviceRel
$fuPath=Join-Path $webRoot $fuRel
$epPath=Join-Path $webRoot $epRel
$tabsPath=Join-Path $webRoot $tabsRel

foreach($p in @($fuPath,$epPath,$tabsPath)){
  if(-not (Test-Path $p)){ Fail "Missing file: $p" }
}

Copy-Item $fuPath (Join-Path $backupDir "FollowUpsFeature.tsx") -Force
Copy-Item $epPath (Join-Path $backupDir "EstimatePickerFeature.tsx") -Force
Copy-Item $tabsPath (Join-Path $backupDir "EstimatePickerTabs.tsx") -Force
Ok "Backed up: $fuRel"
Ok "Backed up: $epRel"
Ok "Backed up: $tabsRel"

# ----- helpers
function Insert-ImportAfterReact([string]$txt,[string]$importLine){
  if($txt -match [regex]::Escape($importLine)){ return $txt }
  $lines = $txt -split "`r?`n"
  for($i=0;$i -lt $lines.Length;$i++){
    if($lines[$i] -match '^import\s+React'){
      $before = $lines[0..$i]
      $after  = @()
      if($i -lt $lines.Length-1){ $after = $lines[($i+1)..($lines.Length-1)] }
      $new = @()
      $new += $before
      $new += $importLine
      $new += $after
      return ($new -join "`r`n")
    }
  }
  # fallback: prepend
  return ($importLine + "`r`n" + $txt)
}

# ----- write service file
$servicesDir=Split-Path $servicePath -Parent
if(-not (Test-Path $servicesDir)){ New-Item -ItemType Directory -Path $servicesDir -Force | Out-Null; Ok "Created: $servicesDir" }

$store=@'
import type { ClientNote } from "../models/types";

const PREFIX = "qs_client_notes_v1_";
const EVT = "qs_client_notes_changed";

export function loadClientNotes(clientId: string): ClientNote[] {
  try {
    const raw = localStorage.getItem(PREFIX + clientId);
    if (!raw) return [];
    const p = JSON.parse(raw);
    return Array.isArray(p) ? (p as ClientNote[]) : [];
  } catch {
    return [];
  }
}

export function saveClientNotes(clientId: string, notes: ClientNote[]) {
  try {
    localStorage.setItem(PREFIX + clientId, JSON.stringify(notes ?? []));
  } catch {
    // ignore
  }
  try {
    window.dispatchEvent(new CustomEvent(EVT, { detail: { clientId } }));
  } catch {
    // ignore
  }
}

export function appendClientNote(clientId: string, note: ClientNote) {
  const list = loadClientNotes(clientId);
  const next = [note, ...list];
  saveClientNotes(clientId, next);
  return next;
}

export function subscribeClientNotes(cb: (clientId: string) => void) {
  const fn = (e: any) => {
    if (e?.detail?.clientId) cb(e.detail.clientId);
  };
  window.addEventListener(EVT, fn);
  return () => window.removeEventListener(EVT, fn);
}
'@
Set-Content $servicePath $store -Encoding UTF8
Ok "Wrote: $serviceRel"

# ----- patch FollowUpsFeature
$fu = Get-Content $fuPath -Raw -Encoding UTF8
$fu = Insert-ImportAfterReact $fu 'import { appendClientNote } from "../../services/clientNotesStore";'
# Replace the quick-add save block (key/list/localStorage) with appendClientNote
$fu = [regex]::Replace(
  $fu,
  'const\s+key\s*=\s*"qs_fu_client_note"[^\r\n]*?;\s*',
  'const key = "qs_fu_client_note";',
  1
)

$fu = [regex]::Replace(
  $fu,
  'const\s+key\s*=\s*\"qs_client_notes_\"\s*\+\s*selectedFollowUp\.clientId;\s*\r?\n\s*const\s+list\s*=\s*JSON\.parse\(localStorage\.getItem\(key\)\s*\|\|\s*\"\\[\\]\"\);\s*\r?\n\s*list\.unshift\(\{html:v,createdAt:new Date\(\)\.toISOString\(\),createdBy:\"user\"\}\);\s*\r?\n\s*localStorage\.setItem\(key,JSON\.stringify\(list\)\);\s*',
  'const createdAt = new Date().toISOString();' + "`r`n" +
  '                    appendClientNote(selectedFollowUp.clientId, { id: "note_" + createdAt, html: v, createdAt, createdBy: "User" });' + "`r`n",
  1
)
if($fu -match 'qs_client_notes_' -and $fu -notmatch 'qs_client_notes_v1_'){
  Warn "FollowUpsFeature: found legacy qs_client_notes_ usage still present; please verify."
} else {
  Ok "FollowUpsFeature: Save note now writes via appendClientNote (v1 key)"
}
Set-Content $fuPath $fu -Encoding UTF8
Ok "Patched: $fuRel"

# ----- patch EstimatePickerFeature: wire persistence + subscription
$ep = Get-Content $epPath -Raw -Encoding UTF8
# Insert imports after React import
$ep = Insert-ImportAfterReact $ep 'import { loadClientNotes, saveClientNotes, subscribeClientNotes } from "../../services/clientNotesStore";'

# Insert effects after the clientNotes state block (unique anchor)
$anchor = 'const [clientNoteDraftHtml, setClientNoteDraftHtml] = useState<string>("");'
if($ep -notmatch [regex]::Escape($anchor)){ Fail "EstimatePickerFeature: anchor not found for inserting effects." }

if($ep -notmatch 'subscribeClientNotes\('){
  $effects = @'
  // Client Notes (client-specific, local storage for now)
  useEffect(() => {
    if (!pickerClientId) {
      setClientNotes([]);
      setClientNoteDraftHtml("");
      return;
    }
    setClientNotes(loadClientNotes(pickerClientId));
    setClientNoteDraftHtml("");
  }, [pickerClientId]);

  useEffect(() => {
    if (!pickerClientId) return;
    saveClientNotes(pickerClientId, clientNotes);
  }, [pickerClientId, clientNotes]);

  useEffect(() => {
    const unsub = subscribeClientNotes((clientId) => {
      if (!pickerClientId) return;
      if (clientId !== pickerClientId) return;
      setClientNotes(loadClientNotes(clientId));
    });
    return () => unsub();
  }, [pickerClientId]);
'@

  $ep = $ep.Replace($anchor, $anchor + "`r`n`r`n" + $effects)
  Ok "EstimatePickerFeature: added notes load/save/subscription"
} else {
  Ok "EstimatePickerFeature: subscription already present (skipped)"
}
Set-Content $epPath $ep -Encoding UTF8
Ok "Patched: $epRel"

# ----- patch EstimatePickerTabs: force LTR on editor + note body (style only)
$tabs = Get-Content $tabsPath -Raw -Encoding UTF8
# Editor style: add direction/unicodeBidi if missing
if($tabs -notmatch 'unicodeBidi:\s*"plaintext"'){
  $tabs = $tabs.Replace(
    'outline: "none",',
    'outline: "none",' + "`r`n        direction: ""ltr""," + "`r`n        unicodeBidi: ""plaintext"","
  )
  Ok "EstimatePickerTabs: enforced LTR on editor (style)"
} else {
  Ok "EstimatePickerTabs: editor already has unicodeBidi plaintext"
}

# Note body: add direction/unicodeBidi to the note display div
if($tabs -notmatch 'dangerouslySetInnerHTML=\{\{\s*__html:\s*n\.html\s*\}\}\s*/>' ){
  Warn "EstimatePickerTabs: note body pattern not found; skipping note body LTR."
} else {
  if($tabs -notmatch 'marginTop:\s*8,\s*direction:\s*"ltr"'){
    $tabs = $tabs.Replace(
      '<div style={{ marginTop: 8 }} dangerouslySetInnerHTML={{ __html: n.html }} />',
      '<div style={{ marginTop: 8, direction: "ltr", unicodeBidi: "plaintext" }} dangerouslySetInnerHTML={{ __html: n.html }} />'
    )
    Ok "EstimatePickerTabs: enforced LTR on note body (style)"
  }
}

Set-Content $tabsPath $tabs -Encoding UTF8
Ok "Patched: $tabsRel"

Ok "Done. (Dev server not restarted.)"
