<# 
QuoteSync Hotfix (v9) — Fix broken JSX in EstimatePickerTabs Client Notes block

Problem:
- EstimatePickerTabs.tsx currently contains literal `r`n sequences inside JSX (e.g. <div`r`n ...),
  which breaks parsing (Vite "Unexpected token").
- The Client Notes editor block and/or Add Note handler got malformed during prior patches.

What this patch does (minimal, targeted):
1) Backs up:
   - src\features\estimatePicker\EstimatePickerTabs.tsx
2) Replaces ONLY the Client Notes editor JSX block with a known-good version (no `r`n artifacts).
3) Replaces ONLY the Add Note onClick handler body with a known-good version.

No layout changes outside Client Notes.
Dev server:
- Does NOT run/restart npm run dev.

Run from:
PS C:\Github\QuoteSync\web\ps1_patches>
#>

$ErrorActionPreference="Stop"
function Fail($m){ Write-Host "ERROR: $m" -ForegroundColor Red; throw $m }
function Ok($m){ Write-Host "OK: $m" -ForegroundColor Green }

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

$tabsRel="src\features\estimatePicker\EstimatePickerTabs.tsx"
$tabsPath=Join-Path $webRoot $tabsRel
if(-not (Test-Path $tabsPath)){ Fail "Missing file: $tabsRel" }

Copy-Item $tabsPath (Join-Path $backupDir "EstimatePickerTabs.tsx") -Force
Ok "Backed up: $tabsRel"

$txt = Get-Content $tabsPath -Raw -Encoding UTF8

# ---------- Fix 1: Replace the malformed editor block ----------
$sectionNeedle = "{/* CLIENT NOTES (WYSIWYG comment area, timestamp + user) */}"
$afterEditorNeedle = '<div style={{ display: "flex", justifyContent: "flex-end" }}>'

$posSection = $txt.IndexOf($sectionNeedle)
if($posSection -lt 0){ Fail "Could not locate Client Notes section header." }

# Find the button row anchor and replace everything between the first <div ...contentEditable...> and that anchor.
$posAfter = $txt.IndexOf($afterEditorNeedle, $posSection)
if($posAfter -lt 0){ Fail "Could not locate Client Notes button row anchor." }

# Locate editor open tag by searching for 'contentEditable' then backing up to '<div'
$posCE = $txt.IndexOf("contentEditable", $posSection)
if($posCE -lt 0 -or $posCE -gt $posAfter){ Fail "Could not locate contentEditable in Client Notes section." }

$scanFrom = [Math]::Max(0, $posCE - 500)
$chunk = $txt.Substring($scanFrom, $posCE - $scanFrom)
$rel = $chunk.LastIndexOf("<div")
if($rel -lt 0){ Fail "Could not locate opening <div for client notes editor." }
$posEditorOpen = $scanFrom + $rel

$goodEditor = @'
    <div
      ref={clientNotesEditorRef}
      dir="ltr"
      contentEditable
      suppressContentEditableWarning
      onInput={(e) => setClientNoteDraftHtml(stripBidiControls((e.currentTarget as HTMLDivElement).innerHTML))}
      style={{
        minHeight: 120,
        borderRadius: 14,
        border: "1px solid #e4e4e7",
        padding: 12,
        background: "#fff",
        outline: "none",
        direction: "ltr",
        unicodeBidi: "plaintext",
      }}
    ></div>
'@

$txt = $txt.Substring(0, $posEditorOpen) + $goodEditor + "`r`n`r`n" + $txt.Substring($posAfter)
Ok "Replaced Client Notes editor JSX block"

# ---------- Fix 2: Replace Add Note onClick handler body ----------
# We target the first Add Note button onClick within the Client Notes section only.
$posButton = $txt.IndexOf("Add Note", $posSection)
if($posButton -lt 0){ Fail "Could not locate Add Note button text." }

# Walk backwards to the nearest 'onClick={() => {' before the Add Note text
$posOnClick = $txt.LastIndexOf('onClick={() => {', $posButton)
if($posOnClick -lt 0){ Fail "Could not locate Add Note onClick handler." }

# Find the end of the handler by finding the next '}}' followed by a newline and spaces then '>'
$posHandlerEnd = $txt.IndexOf("        }}", $posOnClick)
if($posHandlerEnd -lt 0){ Fail "Could not locate end of Add Note onClick handler (indent anchor)." }
$posHandlerEnd = $posHandlerEnd + ("        }}".Length)

$goodOnClick = @'
onClick={() => {
          const htmlRaw = (clientNoteDraftHtml ?? "").trim();
          const html = stripBidiControls(htmlRaw);
          if (!html) return;

          const createdAt = new Date().toISOString();
          const safeHtml = `<div dir="ltr" style="direction:ltr;unicode-bidi:plaintext">${html}</div>`;

          setClientNotes((prev) => [
            { id: "note_" + createdAt, html: safeHtml, createdAt, createdBy: activeUserName },
            ...prev,
          ]);
          setClientNoteDraftHtml("");
        }}
'@

$txt = $txt.Substring(0, $posOnClick) + $goodOnClick + $txt.Substring($posHandlerEnd)
Ok "Replaced Add Note onClick handler"

Set-Content -Path $tabsPath -Value $txt -Encoding UTF8
Ok "Patched: $tabsRel"
Ok "Done. (Dev server not restarted.)"
