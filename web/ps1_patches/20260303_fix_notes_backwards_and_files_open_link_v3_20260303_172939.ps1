# QuoteSync patch v3: Fix Client Notes typing backwards + Fix Files "Open link"
# This version tolerates multiple "} = props;" occurrences and inserts helper after the FIRST match only.
#
# Run from: PS C:\Github\QuoteSync\web\ps1_patches>
#   Unblock-File .\THIS_SCRIPT.ps1
#   pwsh -ExecutionPolicy Bypass -File .\THIS_SCRIPT.ps1

$ErrorActionPreference = "Stop"

function Fail($m){ Write-Host "ERROR: $m" -ForegroundColor Red; throw $m }
function Ok($m){ Write-Host "OK: $m" -ForegroundColor Green }

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

function Replace-First([string]$label, [string]$pattern, [string]$replacement, [switch]$AllowZero) {
  $rx = [regex]::new($pattern, [System.Text.RegularExpressions.RegexOptions]::Singleline)
  $m = $rx.Matches($txt)
  if ($m.Count -eq 0) {
    if ($AllowZero) { Ok ("Skipped (not found): " + $label); return }
    Fail ("${label}: expected at least 1 match, found 0")
  }
  $script:txt = $rx.Replace($txt, $replacement, 1)
  Ok $label
}

# 0) Ensure react imports include useEffect/useRef (add only if missing)
$hasUseEffect = ($txt -match '\buseEffect\b')
$hasUseRef    = ($txt -match '\buseRef\b')

if (-not $hasUseEffect -or -not $hasUseRef) {
  if ($txt -match 'import\s+React\s*,\s*\{([^}]*)\}\s+from\s+["'']react["''];') {
    $txt = [regex]::Replace(
      $txt,
      'import\s+React\s*,\s*\{([^}]*)\}\s+from\s+["'']react["''];',
      {
        param($m)
        $inner = $m.Groups[1].Value
        $parts = $inner.Split(",") | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" }
        if (-not ($parts -contains "useEffect") ) { $parts += "useEffect" }
        if (-not ($parts -contains "useRef") )    { $parts += "useRef" }
        "import React, { " + ($parts -join ", ") + " } from ""react"";"
      },
      1,
      [System.Text.RegularExpressions.RegexOptions]::Singleline
    )
    Ok "Updated react import (React, { ... }) to include useEffect/useRef"
  }
  elseif ($txt -match 'import\s*\{([^}]*)\}\s+from\s+["'']react["''];') {
    $txt = [regex]::Replace(
      $txt,
      'import\s*\{([^}]*)\}\s+from\s+["'']react["''];',
      {
        param($m)
        $inner = $m.Groups[1].Value
        $parts = $inner.Split(",") | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" }
        if (-not ($parts -contains "useEffect") ) { $parts += "useEffect" }
        if (-not ($parts -contains "useRef") )    { $parts += "useRef" }
        "import { " + ($parts -join ", ") + " } from ""react"";"
      },
      1,
      [System.Text.RegularExpressions.RegexOptions]::Singleline
    )
    Ok "Updated react import ({ ... }) to include useEffect/useRef"
  }
  elseif ($txt -match 'import\s+React\s+from\s+["'']react["''];') {
    if ($txt -notmatch 'import\s*\{\s*useEffect\s*,\s*useRef\s*\}\s+from\s+["'']react["''];') {
      $txt = [regex]::Replace(
        $txt,
        'import\s+React\s+from\s+["'']react["''];',
        'import React from "react";' + "`r`n" + 'import { useEffect, useRef } from "react";',
        1
      )
      Ok 'Inserted import { useEffect, useRef } from "react";'
    }
  }
}

# 1) Insert helper block after FIRST "} = props;" (only if not already present)
if ($txt -notmatch 'const\s+clientNotesEditorRef\s*=\s*useRef<') {
  Replace-First "Inserted Client Notes ref/effect + openClientFileLink helper" '\}\s*=\s*props;\s*\r?\n' @'
} = props;

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

'@
} else {
  Ok "Helper block already present (skipped)"
}

# 2) Fix Client Notes editor: remove dangerouslySetInnerHTML and add ref=
Replace-First "Removed dangerouslySetInnerHTML (fix backwards typing)" '(\s*)dangerouslySetInnerHTML=\{\{\s*__html:\s*clientNoteDraftHtml\s*\}\}\s*\r?\n' '${1}ref={clientNotesEditorRef}' + "`r`n" -AllowZero

# 3) Fix Files Open link: use openClientFileLink(clientFileUrl)
if ($txt -match 'window\.open\(\s*clientFileUrl\s*,\s*"_blank"\s*\)') {
  $txt = [regex]::Replace(
    $txt,
    'window\.open\(\s*clientFileUrl\s*,\s*"_blank"\s*\)\s*;',
    'openClientFileLink(clientFileUrl);',
    1,
    [System.Text.RegularExpressions.RegexOptions]::Singleline
  )
  Ok 'Updated Files "Open link" to call openClientFileLink'
} else {
  Ok 'Files "Open link" window.open(clientFileUrl) not found (skipped)'
}

# Remove "if (!clientFileUrl.trim()) return;" if present (helper handles empty)
$txt = [regex]::Replace(
  $txt,
  '\s*if\s*\(\s*!\s*clientFileUrl\.trim\(\)\s*\)\s*return\s*;\s*\r?\n',
  "`r`n",
  1,
  [System.Text.RegularExpressions.RegexOptions]::Singleline
)

Set-Content -Path $p -Value $txt -Encoding UTF8
Ok ("Wrote " + $rel)

Write-Host ""
Write-Host "Starting dev server..." -ForegroundColor Cyan
Push-Location $webRoot
try { npm run dev } finally { Pop-Location }
