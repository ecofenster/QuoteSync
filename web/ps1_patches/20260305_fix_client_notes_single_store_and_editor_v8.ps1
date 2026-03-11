# QuoteSync patch
# Fix: client notes not saving/visible + "backwards typing"
# - Remove duplicate/localStorage "Safe" note store logic from EstimatePickerFeature (single source of truth: services/clientNotesStore)
# - Make Client Notes editor less fragile (avoid controlled contentEditable re-render issues) in EstimatePickerTabs
# Run from: PS C:\Github\QuoteSync\web\ps1_patches>

$ErrorActionPreference = "Stop"

function Fail($m){ Write-Host "ERROR: $m" -ForegroundColor Red; throw $m }
function Info($m){ Write-Host $m -ForegroundColor Cyan }
function Ok($m){ Write-Host "OK: $m" -ForegroundColor Green }

# --- Run dir guard ---
$runDir = (Get-Location).Path
Write-Host "Run directory: $runDir"
if ($runDir -notmatch "\\ps1_patches$") {
  Fail "Please run this from: PS C:\Github\QuoteSync\web\ps1_patches>"
}

# --- Detect web root ---
$webRoot = Resolve-Path (Join-Path $runDir "..") | Select-Object -ExpandProperty Path
if (!(Test-Path (Join-Path $webRoot "src"))) { Fail "Detected web root doesn't contain src/: $webRoot" }
Ok "Detected web root: $webRoot"

# --- Backup dir ---
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = Join-Path $webRoot "_backups\$stamp"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
Ok "Backup dir: $backupDir"

function Backup-File($rel){
  $src = Join-Path $webRoot $rel
  if (!(Test-Path $src)) { Fail "File not found: $rel" }
  $dst = Join-Path $backupDir ($rel -replace "[\\/]", "_")
  Copy-Item -Force $src $dst
  Ok "Backed up: $rel"
}

function Read-Text($rel){
  $p = Join-Path $webRoot $rel
  return Get-Content -Raw -LiteralPath $p
}

function Write-Text($rel, $txt){
  $p = Join-Path $webRoot $rel
  Set-Content -LiteralPath $p -Value $txt -Encoding UTF8
}

# =========================
# 1) EstimatePickerFeature.tsx - remove duplicate Safe store logic
# =========================
$epRel = "src\features\estimatePicker\EstimatePickerFeature.tsx"
Backup-File $epRel
$ep = Read-Text $epRel

# Replace refresh-on-tab-open to use service function instead of removed safe function
$needleRefresh = 'setClientNotes(loadClientNotesSafe(pickerClientId as unknown as string));'
if ($ep -notlike "*$needleRefresh*") {
  # Some variants may already differ; do a softer match
  if ($ep -match "setClientNotes\(loadClientNotesSafe\(") {
    $ep = $ep -replace "setClientNotes\(loadClientNotesSafe\([^\)]*\)\);", "setClientNotes(loadClientNotes(pickerClientId));"
    Ok "EstimatePickerFeature: patched tab-open refresh to loadClientNotes(service)."
  } else {
    Info "EstimatePickerFeature: tab-open refresh already not using loadClientNotesSafe (skipped)."
  }
} else {
  $ep = $ep.Replace($needleRefresh, 'setClientNotes(loadClientNotes(pickerClientId));')
  Ok "EstimatePickerFeature: patched tab-open refresh to loadClientNotes(service)."
}

# Remove the duplicated localStorage prefix + safe functions block (if present)
# We remove from 'const CLIENT_NOTES_KEY_PREFIX' through end of 'saveClientNotesSafe' function.
$start = $ep.IndexOf('const CLIENT_NOTES_KEY_PREFIX = "qs_client_notes_v1_";')
if ($start -ge 0) {
  $endMarker = "  function saveClientNotesSafe"
  $end = $ep.IndexOf($endMarker, $start)
  if ($end -lt 0) { Fail "EstimatePickerFeature: couldn't find saveClientNotesSafe block after CLIENT_NOTES_KEY_PREFIX." }
  # find end of saveClientNotesSafe function by locating the next closing brace line after it
  $after = $ep.IndexOf("}", $end)
  if ($after -lt 0) { Fail "EstimatePickerFeature: couldn't find end brace for saveClientNotesSafe." }
  # move to the line end after that brace
  $afterLine = $ep.IndexOf("`n", $after)
  if ($afterLine -lt 0) { $afterLine = $after + 1 }

  $ep = $ep.Remove($start, $afterLine - $start)
  Ok "EstimatePickerFeature: removed CLIENT_NOTES_KEY_PREFIX + load/saveClientNotesSafe block."
} else {
  Info "EstimatePickerFeature: safe store block not found (skipped)."
}

# Remove the duplicated "Load notes when switching client in the picker" effect that uses loadClientNotesSafe
if ($ep -match "Load notes when switching client in the picker") {
  # Remove from that comment to the end of the following useEffect block
  $m = [regex]::Match($ep, "(?s)// Load notes when switching client in the picker.*?useEffect\(\(\) => \{.*?\}\s*,\s*\[pickerClientId\]\s*\);\s*")
  if ($m.Success) {
    $ep = $ep.Remove($m.Index, $m.Length)
    Ok "EstimatePickerFeature: removed duplicated pickerClientId loadClientNotesSafe useEffect."
  } else {
    Info "EstimatePickerFeature: couldn't regex-remove duplicated load effect (skipped)."
  }
}

# Remove the duplicated "Persist notes per-client" effect that uses saveClientNotesSafe
if ($ep -match "Persist notes per-client") {
  $m2 = [regex]::Match($ep, "(?s)// Persist notes per-client.*?useEffect\(\(\) => \{.*?\}\s*,\s*\[pickerClientId,\s*clientNotes\]\s*\);\s*")
  if ($m2.Success) {
    $ep = $ep.Remove($m2.Index, $m2.Length)
    Ok "EstimatePickerFeature: removed duplicated saveClientNotesSafe useEffect."
  } else {
    Info "EstimatePickerFeature: couldn't regex-remove duplicated persist effect (skipped)."
  }
}

Write-Text $epRel $ep
Ok "EstimatePickerFeature: updated."

# =========================
# 2) EstimatePickerTabs.tsx - stabilise Client Notes editor (avoid controlled contentEditable)
# =========================
$tabsRel = "src\features\estimatePicker\EstimatePickerTabs.tsx"
Backup-File $tabsRel
$tabs = Read-Text $tabsRel

# Ensure useRef is imported
if ($tabs -match 'import React, \{ useState \} from "react";') {
  $tabs = $tabs -replace 'import React, \{ useState \} from "react";', 'import React, { useEffect, useRef, useState } from "react";'
  Ok "EstimatePickerTabs: updated React import to include useEffect/useRef."
} elseif ($tabs -match 'import React, \{ useEffect, useState \} from "react";') {
  $tabs = $tabs -replace 'import React, \{ useEffect, useState \} from "react";', 'import React, { useEffect, useRef, useState } from "react";'
  Ok "EstimatePickerTabs: updated React import to include useRef."
} elseif ($tabs -match 'import React, \{ useEffect, useRef, useState \} from "react";') {
  Info "EstimatePickerTabs: React import already includes useEffect/useRef."
} else {
  # fallback: very first import line (keep conservative)
  Fail "EstimatePickerTabs: unexpected React import line; please upload current file if this persists."
}

# Add editor ref near other local state
if ($tabs -notmatch "clientNotesEditorRef") {
  $anchor = 'const [sendModalPhoneCall, setSendModalPhoneCall] = useState(true);'
  $idx = $tabs.IndexOf($anchor)
  if ($idx -lt 0) { Fail "EstimatePickerTabs: couldn't find sendModalPhoneCall anchor." }
  $insert = $anchor + "`r`n`r`n  const clientNotesEditorRef = useRef<HTMLDivElement | null>(null);`r`n`r`n  // When Client Notes tab opens (or draft is cleared), set editor HTML once (avoid controlled contentEditable issues).`r`n  useEffect(() => {`r`n    if (estimatePickerTab !== ""client_notes"") return;`r`n    const el = clientNotesEditorRef.current;`r`n    if (!el) return;`r`n    const desired = (clientNoteDraftHtml ?? """");`r`n    if (el.innerHTML !== desired) el.innerHTML = desired;`r`n  }, [estimatePickerTab, pickerClient?.id, clientNoteDraftHtml]);"
  $tabs = $tabs.Replace($anchor, $insert)
  Ok "EstimatePickerTabs: inserted clientNotesEditorRef + one-time HTML sync useEffect."
} else {
  Info "EstimatePickerTabs: clientNotesEditorRef already present (skipped)."
}

# In Client Notes editor JSX:
# - remove dangerouslySetInnerHTML
# - add ref={clientNotesEditorRef}
# - keep dir/ltr styles
$tabs = $tabs -replace 'dangerouslySetInnerHTML=\{\{ __html: clientNoteDraftHtml \}\}', ''
$tabs = $tabs -replace '<div\s*\r?\n\s*dir="ltr"\r?\n\s*contentEditable', '<div`r`n      ref={clientNotesEditorRef}`r`n      dir="ltr"`r`n      contentEditable'
Ok "EstimatePickerTabs: made Client Notes editor use ref + removed dangerouslySetInnerHTML."

Write-Text $tabsRel $tabs
Ok "EstimatePickerTabs: updated."

Ok "Done. (No dev server command is run by this script.)"
Write-Host "Backup location: $backupDir" -ForegroundColor Yellow
