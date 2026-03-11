<# 
QuoteSync Patch (v6) — Notes: refresh on Client Notes tab open + stop backwards + use clientNotesStore on FollowUps
Fixes prior failure: uses flexible line-based anchors (no exact-string match, no heavy regex).

Run from:
PS C:\Github\QuoteSync\web\ps1_patches>

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
# 1) EstimatePickerFeature — refresh notes when opening Client Notes tab
# -------------------------
$ep = Get-Content $epPath -Raw -Encoding UTF8
if($ep -match 'refresh notes from storage for the current client'){
  Ok "EstimatePickerFeature: refresh-on-open already present (skipped)"
} else {
  $lines = $ep -split "`r?`n"
  $idx = -1
  for($i=0;$i -lt $lines.Length;$i++){
    if($lines[$i] -match 'const\s+\[\s*estimatePickerTab\s*,\s*setEstimatePickerTab\s*\]\s*=\s*useState<EstimatePickerTab>\('){
      $idx = $i
      break
    }
  }
  if($idx -lt 0){ Fail "EstimatePickerFeature: could not find estimatePickerTab state declaration line." }

  $insert = @(
    '',
    '  // When user opens the Client Notes tab, refresh notes from storage for the current client.',
    '  // (Refresh-on-access is intended; no live updates needed while on Follow Ups.)',
    '  useEffect(() => {',
    '    if (estimatePickerTab !== "client_notes") return;',
    '    if (!pickerClientId) return;',
    '    setClientNotes(loadClientNotesSafe(pickerClientId as unknown as string));',
    '  }, [estimatePickerTab, pickerClientId]);',
    ''
  )

  $out = @()
  for($i=0;$i -lt $lines.Length;$i++){
    $out += $lines[$i]
    if($i -eq $idx){
      $out += $insert
    }
  }
  Set-Content -Path $epPath -Value ($out -join "`r`n") -Encoding UTF8
  Ok "EstimatePickerFeature: inserted refresh-on-open for Client Notes tab"
}

# -------------------------
# 2) EstimatePickerTabs — bidi sanitizer + LTR attributes + wrap stored html
# -------------------------
$tabs = Get-Content $tabsPath -Raw -Encoding UTF8
$lines = $tabs -split "`r?`n"

# Insert stripBidiControls after last import line
if($tabs -notmatch 'function\s+stripBidiControls'){
  $lastImport = -1
  for($i=0;$i -lt $lines.Length;$i++){
    if($lines[$i] -match '^\s*import\s+'){
      $lastImport = $i
    }
  }
  if($lastImport -lt 0){ Fail "EstimatePickerTabs: could not find import section." }

  $helper = @(
    '',
    'function stripBidiControls(html: string): string {',
    '  // Remove Unicode bidi control characters that can cause "backwards" text.',
    '  return (html ?? "").replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, "");',
    '}',
    ''
  )

  $out=@()
  for($i=0;$i -lt $lines.Length;$i++){
    $out += $lines[$i]
    if($i -eq $lastImport){
      $out += $helper
    }
  }
  $tabs = $out -join "`r`n"
  $lines = $tabs -split "`r?`n"
  Ok "EstimatePickerTabs: added stripBidiControls()"
} else {
  Ok "EstimatePickerTabs: stripBidiControls() already present"
}

# Sanitize onInput (line replace if present)
$tabs = $tabs.Replace(
  'onInput={(e) => setClientNoteDraftHtml((e.currentTarget as HTMLDivElement).innerHTML)}',
  'onInput={(e) => setClientNoteDraftHtml(stripBidiControls((e.currentTarget as HTMLDivElement).innerHTML))}'
)

# Add dir="ltr" attribute above contentEditable (best-effort: find a line containing contentEditable and insert prior line)
$lines = $tabs -split "`r?`n"
for($i=0;$i -lt $lines.Length;$i++){
  if($lines[$i] -match '^\s*contentEditable\b' -and ($i -gt 0) -and ($lines[$i-1] -notmatch 'dir="ltr"')){
    $indent = ($lines[$i] -replace '^(?:(\s*).*)$','$1')
    $lines = $lines[0..($i-1)] + @("$indent" + 'dir="ltr"') + $lines[$i..($lines.Length-1)]
    break
  }
}
$tabs = $lines -join "`r`n"

# Sanitize before saving: replace first occurrence of const html = ...trim();
$tabs = [System.Text.RegularExpressions.Regex]::Replace(
  $tabs,
  'const\s+html\s*=\s*\(clientNoteDraftHtml\s*\?\?\s*""\)\.trim\(\);\s*',
  'const htmlRaw = (clientNoteDraftHtml ?? "").trim();' + "`r`n" + '          const html = stripBidiControls(htmlRaw);' + "`r`n",
  1
)

# Wrap stored note html in LTR container (replace known line)
$tabs = $tabs.Replace(
  'setClientNotes((prev) => [{ id: "note_" + createdAt, html, createdAt, createdBy: activeUserName }, ...prev]);',
  'const safeHtml = `<div dir="ltr" style="direction:ltr;unicode-bidi:plaintext">${html}</div>`;' + "`r`n" +
  '          setClientNotes((prev) => [{ id: "note_" + createdAt, html: safeHtml, createdAt, createdBy: activeUserName }, ...prev]);'
)

# Ensure rendered body has dir="ltr" (best-effort exact replace)
$tabs = $tabs.Replace(
  '<div style={{ marginTop: 8, direction: "ltr", unicodeBidi: "plaintext" }} dangerouslySetInnerHTML={{ __html: n.html }} />',
  '<div dir="ltr" style={{ marginTop: 8, direction: "ltr", unicodeBidi: "plaintext" }} dangerouslySetInnerHTML={{ __html: n.html }} />'
)

Set-Content -Path $tabsPath -Value $tabs -Encoding UTF8
Ok "EstimatePickerTabs: sanitised bidi + enforced LTR attributes"

# -------------------------
# 3) FollowUpsFeature — use appendClientNote so subscription can work when you later choose to use it
#    (Also ensures consistent v1 key storage via the store).
# -------------------------
$fu = Get-Content $fuPath -Raw -Encoding UTF8

if($fu -match 'appendClientNote\('){
  Ok "FollowUpsFeature: already uses appendClientNote() (skipped)"
} else {
  # Replace manual localStorage write region by searching for the key line and the subsequent setClientNoteDraft(""); line.
  $start = $fu.IndexOf('const key = CLIENT_NOTES_KEY_PREFIX + selectedFollowUp.clientId;')
  if($start -lt 0){ Warn "FollowUpsFeature: key anchor not found; skipping FollowUps change." }
  else {
    $end = $fu.IndexOf('setClientNoteDraft("");', $start)
    if($end -lt 0){ Fail "FollowUpsFeature: could not find end anchor setClientNoteDraft after key line." }
    # include the end line
    $endLineEnd = $fu.IndexOf("`n", $end)
    if($endLineEnd -lt 0){ $endLineEnd = $fu.Length }

    $replacement = @'
const createdAt = new Date().toISOString();
                    const safeHtml = `<div dir="ltr" style="direction:ltr;unicode-bidi:plaintext">${html}</div>`;
                    appendClientNote(selectedFollowUp.clientId, { id: "note_" + createdAt, html: safeHtml, createdAt, createdBy: "User" });
                    setClientNoteDraft("");
'@

    $fu = $fu.Substring(0,$start) + $replacement + $fu.Substring($endLineEnd)
    Set-Content -Path $fuPath -Value $fu -Encoding UTF8
    Ok "FollowUpsFeature: switched Save note to appendClientNote()"
  }
}

Ok "Done. (Dev server not restarted.)"
