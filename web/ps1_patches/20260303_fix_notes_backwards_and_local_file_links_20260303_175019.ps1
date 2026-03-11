# QuoteSync patch: Fix Client Notes typing/saving backwards + Handle local file paths for "Open link"
# - Notes: remove dangerouslySetInnerHTML control loop; use ref + effect sync only when editor not focused.
# - Files: local paths (Google Drive Desktop / NAS / SharePoint sync) can't be opened by browser; copy to clipboard + instruct user.
#   Web URLs still open in a new tab. Missing scheme gets https:// added.
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

function Replace-ExactOnce([string]$label, [string]$from, [string]$to) {
  $count = ([regex]::Matches($txt, [regex]::Escape($from))).Count
  if ($count -ne 1) { Fail ("${label}: expected 1 match, found " + $count) }
  $script:txt = $txt.Replace($from, $to)
  Ok $label
}

function Replace-ExactAny([string]$label, [string]$from, [string]$to) {
  $count = ([regex]::Matches($txt, [regex]::Escape($from))).Count
  if ($count -lt 1) { Fail ("${label}: expected >=1 match, found 0") }
  $script:txt = $txt.Replace($from, $to)
  Ok ("${label}: replaced " + $count)
}

# 1) Insert helper block after the destructure " } = props;" inside EstimatePickerTabs
$helperMarker = "const clientNotesEditorRef = React.useRef"
if ($txt -notmatch [regex]::Escape($helperMarker)) {
  $needle = "} = props;"
  $idx = $txt.IndexOf($needle)
  if ($idx -lt 0) { Fail 'Could not find "} = props;" to insert helper block.' }

  # Insert after end-of-line
  $insertAt = $txt.IndexOf("`n", $idx + $needle.Length)
  if ($insertAt -lt 0) { $insertAt = $idx + $needle.Length } else { $insertAt = $insertAt + 1 }

  $helper = @"

// --- Client Notes editor (contentEditable) ---
// Avoid "backwards typing" by NOT controlling innerHTML while the editor is focused.
const clientNotesEditorRef = React.useRef<HTMLDivElement | null>(null);

React.useEffect(() => {
  if (estimatePickerTab !== "client_notes") return;
  const el = clientNotesEditorRef.current;
  if (!el) return;

  // If user is actively typing, do NOT overwrite DOM.
  if (typeof document !== "undefined" && document.activeElement === el) return;

  const desired = clientNoteDraftHtml ?? "";
  if (el.innerHTML !== desired) el.innerHTML = desired;
}, [estimatePickerTab, clientNoteDraftHtml, pickerClient?.id]);

const openClientFileLink = (raw: string) => {
  const v = (raw ?? "").trim();
  if (!v) return;

  const isFileUrl = /^file:\/\//i.test(v);
  const isWinPath =
    /^[A-Za-z]:\\/.test(v) || /^[A-Za-z]:\//.test(v) || /^\\\\/.test(v);

  if (isFileUrl || isWinPath) {
    // Normalize into a Windows-style path for copy/paste
    let path = v;
    if (isFileUrl) path = path.replace(/^file:\/\//i, "");
    path = decodeURI(path);
    path = path.replace(/\//g, "\\");

    // Copy to clipboard if possible (safe no-op if blocked)
    try {
      // @ts-ignore
      if (navigator?.clipboard?.writeText) {
        // @ts-ignore
        navigator.clipboard.writeText(path).catch(() => {});
      }
    } catch {}

    alert(
      "This is a local file path (e.g. Google Drive Desktop / NAS). Browsers can't open local paths directly.\n\n" +
        "Path copied to clipboard (if permitted):\n" +
        path +
        "\n\nPaste it into File Explorer address bar."
    );
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

  $txt = $txt.Insert($insertAt, $helper)
  Ok "Inserted helper block (clientNotesEditorRef + openClientFileLink)"
} else {
  Ok "Helper block already present (skipped)"
}

# 2) Notes editor: replace dangerouslySetInnerHTML line with ref=
$danger = 'dangerouslySetInnerHTML={{ __html: clientNoteDraftHtml }}'
if ($txt.Contains($danger)) {
  Replace-ExactOnce "Notes editor: replaced dangerouslySetInnerHTML with ref" $danger 'ref={clientNotesEditorRef}'
} else {
  Ok "Notes editor dangerouslySetInnerHTML not found (already fixed?)"
}

# 3) Files: route Open link buttons through openClientFileLink(...)
Replace-ExactAny 'Files: route "Open link" for input URL' 'window.open(clientFileUrl, "_blank");' 'openClientFileLink(clientFileUrl);'
Replace-ExactAny 'Files: route "Open link" for saved file URL' 'window.open(f.url, "_blank")' 'openClientFileLink(f.url)'

# 4) Remove the guard line that returns early (helper handles empty)
$guard = 'if (!clientFileUrl.trim()) return;'
$gCount = ([regex]::Matches($txt, [regex]::Escape($guard))).Count
if ($gCount -ge 1) {
  $txt = $txt.Replace($guard, '')
  Ok ("Removed clientFileUrl empty guard: " + $gCount)
} else {
  Ok "clientFileUrl empty guard not found (skipped)"
}

# Write file
Set-Content -Path $p -Value $txt -Encoding UTF8
Ok ("Wrote " + $rel)

Write-Host ""
Write-Host "Starting dev server..." -ForegroundColor Cyan
Push-Location $webRoot
try { npm run dev } finally { Pop-Location }
