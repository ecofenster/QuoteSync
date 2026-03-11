# QuoteSync patch v5: Fix Client Notes typing backwards + Fix Files "Open link"
# v5: NO regex replacements on large TSX file (avoids regex timeouts). Uses safe string operations.
#
# Run from: PS C:\Github\QuoteSync\web\ps1_patches>
#   Unblock-File .\THIS_SCRIPT.ps1
#   pwsh -ExecutionPolicy Bypass -File .\THIS_SCRIPT.ps1

$ErrorActionPreference = "Stop"

function Fail($m){ Write-Host "ERROR: $m" -ForegroundColor Red; throw $m }
function Ok($m){ Write-Host "OK: $m" -ForegroundColor Green }
function Warn($m){ Write-Host "WARN: $m" -ForegroundColor Yellow }

$runDir = (Get-Location).Path
Write-Host ("Run directory: " + $runDir)

$webRoot = Resolve-Path (Join-Path $runDir "..") | Select-Object -ExpandProperty Path
if (-not (Test-Path (Join-Path $webRoot "package.json"))) { Fail "Could not detect web root (package.json not found) at: $webRoot" }
Ok ("Detected web root: " + $webRoot)

$backupsRoot = Join-Path $webRoot "_backups"
New-Item -ItemType Directory -Force -Path $backupsRoot | Out-Null
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = Join-Path $backupsRoot $stamp
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
Ok ("Backup folder: " + $backupDir)

$rel = "src\features\estimatePicker\EstimatePickerTabs.tsx"
$p = Join-Path $webRoot $rel
if (-not (Test-Path $p)) { Fail "Missing file: $p" }

Copy-Item -Force $p (Join-Path $backupDir "EstimatePickerTabs.tsx")
Ok ("Backed up " + $rel)

$txt = Get-Content -Raw -Encoding UTF8 $p

# 1) Ensure imports for useEffect/useRef exist (simple insertion after: import React from "react";)
if ($txt -notmatch '\buseEffect\b' -or $txt -notmatch '\buseRef\b') {
  $reactImport = 'import React from "react";'
  $namedImport = 'import { useEffect, useRef } from "react";'

  if ($txt.Contains($namedImport)) {
    Ok "React named import for useEffect/useRef already present"
  }
  elseif ($txt.Contains($reactImport)) {
    $txt = $txt.Replace($reactImport, $reactImport + "`r`n" + $namedImport)
    Ok 'Inserted import { useEffect, useRef } from "react";'
  } else {
    Warn 'Could not find exact: import React from "react"; (imports may already include hooks).'
  }
}

# 2) Insert helper block after the first occurrence of "} = props;"
if (-not $txt.Contains("const clientNotesEditorRef = useRef")) {
  $needle = "} = props;"
  $idx = $txt.IndexOf($needle)
  if ($idx -lt 0) { Fail 'Could not find "} = props;" to insert helper block.' }

  $insertAt = $idx + $needle.Length
  # insert after the end of that line
  $lineEnd = $txt.IndexOf("`n", $insertAt)
  if ($lineEnd -lt 0) { $lineEnd = $insertAt }

  $helper = @"


// --- Client Notes editor (contentEditable) ---
// Keep innerHTML in sync only when the editor is NOT focused, to avoid caret jumps / reversed typing.
const clientNotesEditorRef = useRef<HTMLDivElement | null>(null);

useEffect(() => {
  if (estimatePickerTab !== "client_notes") return;
  const el = clientNotesEditorRef.current;
  if (!el) return;

  // If user is actively typing, do NOT overwrite DOM.
  if (typeof document !== "undefined" && document.activeElement === el) return;

  const desired = clientNoteDraftHtml ?? "";
  if (el.innerHTML !== desired) {
    el.innerHTML = desired;
  }
}, [estimatePickerTab, clientNoteDraftHtml, pickerClient?.id]);

const openClientFileLink = (raw: string) => {
  const v = (raw ?? "").trim();
  if (!v) return;

  const looksLikeWindowsPath = /^[A-Za-z]:\\/.test(v) || /^\\\\/.test(v);
  if (looksLikeWindowsPath) {
    alert("This looks like a local file path. Browsers usually can't open local paths. Copy/paste it into Windows Explorer:\n\n" + v);
    return;
  }

  let url = v;
  const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(url);
  if (!hasScheme) url = "https://" + url;

  const safeUrl = encodeURI(url);

  try {
    // eslint-disable-next-line no-new
    new URL(safeUrl);
    window.open(safeUrl, "_blank", "noopener,noreferrer");
  } catch {
    alert("That link doesn't look like a valid URL:\n\n" + v);
  }
};

"@

  $txt = $txt.Insert($lineEnd + 1, $helper)
  Ok "Inserted Client Notes ref/effect + openClientFileLink helper"
} else {
  Ok "Helper already present (skipped)"
}

# 3) Replace dangerouslySetInnerHTML with ref={clientNotesEditorRef}
$danger = 'dangerouslySetInnerHTML={{ __html: clientNoteDraftHtml }}'
if ($txt.Contains($danger)) {
  # Preserve indentation by replacing the whole token only
  $txt = $txt.Replace($danger, 'ref={clientNotesEditorRef}')
  Ok "Removed dangerouslySetInnerHTML (fix backwards typing)"
} else {
  Warn "dangerouslySetInnerHTML for clientNoteDraftHtml not found (maybe already fixed)."
}

# 4) Files "Open link": replace window.open(clientFileUrl, "_blank"); with openClientFileLink(clientFileUrl);
$openOld = 'window.open(clientFileUrl, "_blank");'
if ($txt.Contains($openOld)) {
  $txt = $txt.Replace($openOld, 'openClientFileLink(clientFileUrl);')
  Ok 'Updated Files "Open link" to call openClientFileLink'
} else {
  Warn 'window.open(clientFileUrl, "_blank") not found (maybe already updated).'
}

# 5) Remove empty-link guard line if present
$guard = 'if (!clientFileUrl.trim()) return;'
$gidx = $txt.IndexOf($guard)
if ($gidx -ge 0) {
  $lineStart = $txt.LastIndexOf("`n", $gidx)
  if ($lineStart -lt 0) { $lineStart = 0 } else { $lineStart = $lineStart + 1 }
  $lineEnd = $txt.IndexOf("`n", $gidx)
  if ($lineEnd -lt 0) { $lineEnd = $gidx + $guard.Length }
  $txt = $txt.Remove($lineStart, ($lineEnd - $lineStart) + 1)
  Ok 'Removed Files empty-link guard (openClientFileLink handles empty)'
} else {
  Ok 'Files empty-link guard not found (skipped)'
}

# Write file
Set-Content -Path $p -Value $txt -Encoding UTF8
Ok ("Wrote " + $rel)

Write-Host ""
Write-Host "Starting dev server..." -ForegroundColor Cyan
Push-Location $webRoot
try { npm run dev } finally { Pop-Location }
