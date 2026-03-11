<# 
QuoteSync Patch — Fix Client Notes visibility (refresh on opening tab) + stop backwards notes + use clientNotesStore from FollowUps
Fixes:
1) Regex timeout in prior patch: this version uses safe string anchors (no heavy regex).
2) Client Notes not showing notes created elsewhere:
   - When switching to the "Client Notes" tab, we reload notes from localStorage for the current client.
3) Backwards typing/saving:
   - Strip Unicode bidi control characters on input + before saving.
   - Wrap saved HTML in an LTR container.
4) FollowUps "Save note":
   - Use appendClientNote() (already imported) instead of manual localStorage write.

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

# Detect web root
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

$epRel="src\features\estimatePicker\EstimatePickerFeature.tsx"
$tabsRel="src\features\estimatePicker\EstimatePickerTabs.tsx"
$fuRel="src\features\followUps\FollowUpsFeature.tsx"

$epPath=Join-Path $webRoot $epRel
$tabsPath=Join-Path $webRoot $tabsRel
$fuPath=Join-Path $webRoot $fuRel

foreach($p in @($epPath,$tabsPath,$fuPath)){
  if(-not (Test-Path $p)){ Fail "Missing file: $p" }
}

Copy-Item $epPath (Join-Path $backupDir "EstimatePickerFeature.tsx") -Force
Copy-Item $tabsPath (Join-Path $backupDir "EstimatePickerTabs.tsx") -Force
Copy-Item $fuPath (Join-Path $backupDir "FollowUpsFeature.tsx") -Force
Ok "Backed up: $epRel"
Ok "Backed up: $tabsRel"
Ok "Backed up: $fuRel"

# -------------------------
# 1) EstimatePickerFeature — reload notes when opening Client Notes tab (no regex)
# -------------------------
$ep = Get-Content $epPath -Raw -Encoding UTF8

$anchor = 'const [estimatePickerTab, setEstimatePickerTab] = useState<EstimatePickerTab>("client_info");'
if($ep -notlike "*$anchor*"){ Fail "EstimatePickerFeature: anchor not found for estimatePickerTab state." }

if($ep -notmatch 'refresh notes from storage for the current client'){
  $inject = @"
$anchor

  // When user opens the Client Notes tab, refresh notes from storage for the current client.
  // (Refresh-on-access is intended; no live updates needed while on Follow Ups.)
  useEffect(() => {
    if (estimatePickerTab !== "client_notes") return;
    if (!pickerClientId) return;
    // use existing safe loader to match current storage key
    setClientNotes(loadClientNotesSafe(pickerClientId as unknown as string));
  }, [estimatePickerTab, pickerClientId]);

"@
  $ep = $ep.Replace($anchor, $inject)
  Ok "EstimatePickerFeature: inserted refresh-on-open for Client Notes tab"
} else {
  Ok "EstimatePickerFeature: refresh-on-open already present (skipped)"
}

Set-Content $epPath $ep -Encoding UTF8

# -------------------------
# 2) EstimatePickerTabs — strip bidi controls + wrap saved HTML
# -------------------------
$tabs = Get-Content $tabsPath -Raw -Encoding UTF8

# Add helper once (after imports block)
if($tabs -notmatch 'function\s+stripBidiControls'){
  $importIdx = $tabs.IndexOf("type Props")
  if($importIdx -lt 0){ Fail "EstimatePickerTabs: could not locate insertion point near type Props." }
  $tabs = $tabs.Insert($importIdx, @'
function stripBidiControls(html: string): string {
  // Remove Unicode bidi control characters that can cause "backwards" text.
  return (html ?? "").replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, "");
}

'@)
  Ok "EstimatePickerTabs: added stripBidiControls()"
} else {
  Ok "EstimatePickerTabs: stripBidiControls() already present"
}

# Ensure editor has dir="ltr" attribute (best-effort)
if($tabs -match "contentEditable" -and $tabs -notmatch 'dir="ltr"\s*\r?\n\s*contentEditable'){
  $tabs = $tabs.Replace(
    "<div`r`n      contentEditable",
    "<div`r`n      dir=""ltr""`r`n      contentEditable"
  )
  Ok 'EstimatePickerTabs: added dir="ltr" to editor'
} else {
  Ok 'EstimatePickerTabs: editor already has dir="ltr" (or pattern not found)'
}

# Sanitize onInput (exact match from current file)
$tabs = $tabs.Replace(
  'onInput={(e) => setClientNoteDraftHtml((e.currentTarget as HTMLDivElement).innerHTML)}',
  'onInput={(e) => setClientNoteDraftHtml(stripBidiControls((e.currentTarget as HTMLDivElement).innerHTML))}'
)

# Sanitize before saving (exact match from current file)
$tabs = $tabs.Replace(
  'const html = (clientNoteDraftHtml ?? "").trim();',
  'const htmlRaw = (clientNoteDraftHtml ?? "").trim();' + "`r`n" +
  '          const html = stripBidiControls(htmlRaw);'
)

# Wrap saved html in LTR container (only affects what we store)
$tabs = $tabs.Replace(
  'setClientNotes((prev) => [{ id: "note_" + createdAt, html, createdAt, createdBy: activeUserName }, ...prev]);',
  'const safeHtml = `<div dir="ltr" style="direction:ltr;unicode-bidi:plaintext">${html}</div>`;' + "`r`n" +
  '          setClientNotes((prev) => [{ id: "note_" + createdAt, html: safeHtml, createdAt, createdBy: activeUserName }, ...prev]);'
)

Set-Content $tabsPath $tabs -Encoding UTF8
Ok "EstimatePickerTabs: sanitised bidi + wrapped saved notes"

# -------------------------
# 3) FollowUpsFeature — use appendClientNote (already imported) instead of manual localStorage
# -------------------------
$fu = Get-Content $fuPath -Raw -Encoding UTF8

# Replace the whole try/catch block that manually writes localStorage (best-effort by anchor sequence)
$needle1 = 'const key = CLIENT_NOTES_KEY_PREFIX + selectedFollowUp.clientId;'
if($fu -like "*$needle1*"){
  # Find start at "const createdAt" within the onClick handler and replace the manual storage block.
  # We'll do a conservative replace of the specific "const key ... try { ... } catch { ... }"
  $fu = $fu -replace [regex]::Escape($needle1) + '[\s\S]*?setClientNoteDraft\(""\);', @'
const createdAt = new Date().toISOString();
                    const safeHtml = `<div dir="ltr" style="direction:ltr;unicode-bidi:plaintext">${html}</div>`;
                    appendClientNote(selectedFollowUp.clientId, { id: "note_" + createdAt, html: safeHtml, createdAt, createdBy: "User" });
                    setClientNoteDraft("");
'@
  Ok "FollowUpsFeature: Save note now uses appendClientNote()"
} else {
  Warn "FollowUpsFeature: could not find manual localStorage block anchor; no change applied there."
}

Set-Content $fuPath $fu -Encoding UTF8

Ok "Done. (Dev server not restarted.)"
