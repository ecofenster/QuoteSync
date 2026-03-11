<# 
QuoteSync Patch — Fix Client Notes visibility + prevent backwards notes
User intent:
- Notes are CLIENT specific (not project specific)
- No need for live auto-refresh while on FollowUps; refresh when Client Notes tab is opened is correct.

What this patch does (minimal, no layout changes):
1) EstimatePickerFeature.tsx
   - When switching to the "client_notes" tab, reload notes for the current client from localStorage.
     (So notes saved from FollowUps appear as soon as you open Client Notes.)

2) EstimatePickerTabs.tsx
   - Sanitises bidi control chars on input + on save to prevent reversed/backwards notes being stored.
   - Adds explicit dir="ltr" attribute on the contentEditable editor + note body container.

3) FollowUpsFeature.tsx
   - Wraps saved HTML with a dir="ltr" container so it can't flip direction when rendered elsewhere.

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

$fuRel="src\features\followUps\FollowUpsFeature.tsx"
$epRel="src\features\estimatePicker\EstimatePickerFeature.tsx"
$tabsRel="src\features\estimatePicker\EstimatePickerTabs.tsx"
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

function Replace-OneRegex([string]$txt,[string]$pattern,[string]$replacement,[string]$err){
  $new=[regex]::Replace($txt,$pattern,$replacement,1,[System.Text.RegularExpressions.RegexOptions]::Singleline)
  if($new -eq $txt){ Fail $err }
  return $new
}

# -------------------------
# 1) EstimatePickerFeature: reload notes when opening Client Notes tab
# -------------------------
$ep = Get-Content $epPath -Raw -Encoding UTF8

if($ep -notmatch '\[estimatePickerTab\]'){
  # Insert the reload effect right after the estimatePickerTab state line (stable anchor).
  $pattern = 'const\s+\[\s*estimatePickerTab\s*,\s*setEstimatePickerTab\s*\]\s*=\s*useState<EstimatePickerTab>\("client_info"\);\s*'
  $inject = @'
const [estimatePickerTab, setEstimatePickerTab] = useState<EstimatePickerTab>("client_info");

  // When user opens the Client Notes tab, refresh notes from storage for the current client.
  // (This is the intended behaviour: refresh on access, not live while on FollowUps.)
  useEffect(() => {
    if (estimatePickerTab !== "client_notes") return;
    if (!pickerClientId) return;
    setClientNotes(loadClientNotes(pickerClientId));
  }, [estimatePickerTab, pickerClientId]);
'@
  $ep2=[regex]::Replace($ep,$pattern,$inject,1,[System.Text.RegularExpressions.RegexOptions]::Singleline)
  if($ep2 -eq $ep){ Fail "EstimatePickerFeature: could not insert refresh-on-tab effect (anchor not found)." }
  $ep=$ep2
  Ok "EstimatePickerFeature: added refresh-on-tab-open (client_notes)"
} else {
  Ok "EstimatePickerFeature: refresh-on-tab already present (skipped)"
}

Set-Content $epPath $ep -Encoding UTF8

# -------------------------
# 2) EstimatePickerTabs: sanitize bidi controls + add dir="ltr"
# -------------------------
$tabs = Get-Content $tabsPath -Raw -Encoding UTF8

# Add a tiny sanitizer helper near the top (after imports). Idempotent.
if($tabs -notmatch 'function\s+stripBidiControls'){
  $tabs = [regex]::Replace(
    $tabs,
    '(^import[^\r\n]*\r?\n(?:import[^\r\n]*\r?\n)*)',
    '$1' + "`r`n" + 'function stripBidiControls(html: string): string {' + "`r`n" +
    '  // Remove Unicode bidi control characters that can cause "backwards" text.' + "`r`n" +
    '  return (html ?? "").replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, "");' + "`r`n" +
    '}' + "`r`n",
    1,
    [System.Text.RegularExpressions.RegexOptions]::Multiline
  )
  Ok "EstimatePickerTabs: added stripBidiControls()"
} else {
  Ok "EstimatePickerTabs: stripBidiControls() already present"
}

# Update onInput to sanitize
$tabs = $tabs.Replace(
  'onInput={(e) => setClientNoteDraftHtml((e.currentTarget as HTMLDivElement).innerHTML)}',
  'onInput={(e) => setClientNoteDraftHtml(stripBidiControls((e.currentTarget as HTMLDivElement).innerHTML))}'
)

# Add dir="ltr" attribute to the contentEditable div if missing
if($tabs -notmatch '<div\s*\r?\n\s*contentEditable[\s\S]*?\sdir="ltr"'){
  $tabs = $tabs.Replace(
    '<div' + "`r`n" + '      contentEditable',
    '<div' + "`r`n" + '      dir="ltr"' + "`r`n" + '      contentEditable'
  )
  Ok "EstimatePickerTabs: set dir=\"ltr\" on editor"
} else {
  Ok "EstimatePickerTabs: editor already has dir=\"ltr\""
}

# Ensure Add Note button sanitises before saving (find first trim call and wrap it)
$tabs = [regex]::Replace(
  $tabs,
  'const\s+html\s*=\s*\(clientNoteDraftHtml\s*\?\?\s*""\)\.trim\(\);\s*',
  'const html = stripBidiControls((clientNoteDraftHtml ?? "")).trim();' + "`r`n",
  1
)

# Rendered note body: add dir="ltr" attribute to the note body div (best-effort)
$tabs = $tabs.Replace(
  '<div style={{ marginTop: 8, direction: "ltr", unicodeBidi: "plaintext" }} dangerouslySetInnerHTML={{ __html: n.html }} />',
  '<div dir="ltr" style={{ marginTop: 8, direction: "ltr", unicodeBidi: "plaintext" }} dangerouslySetInnerHTML={{ __html: n.html }} />'
)

Set-Content $tabsPath $tabs -Encoding UTF8
Ok "EstimatePickerTabs: sanitised bidi + enforced LTR attributes"

# -------------------------
# 3) FollowUpsFeature: wrap saved html with an LTR container
# -------------------------
$fu = Get-Content $fuPath -Raw -Encoding UTF8

# Replace: const html = (clientNoteDraft ?? "").trim();
$fu = [regex]::Replace(
  $fu,
  'const\s+html\s*=\s*\(clientNoteDraft\s*\?\?\s*""\)\.trim\(\);\s*',
  'const html = (clientNoteDraft ?? "").trim();' + "`r`n" +
  '                    const safeHtml = `<div dir="ltr" style="direction:ltr;unicode-bidi:plaintext">${html}</div>`;' + "`r`n",
  1
)

# Replace uses of html in note object with safeHtml (best-effort, first occurrence in list.unshift)
$fu = [regex]::Replace(
  $fu,
  'list\.unshift\(\{\s*id:\s*"note_"\s*\+\s*createdAt,\s*html,\s*createdAt,\s*createdBy:\s*"User"\s*\}\);',
  'list.unshift({ id: "note_" + createdAt, html: safeHtml, createdAt, createdBy: "User" });',
  1
)

Set-Content $fuPath $fu -Encoding UTF8
Ok "FollowUpsFeature: wrapped saved HTML in LTR container"

Ok "Done. (Dev server not restarted.)"
