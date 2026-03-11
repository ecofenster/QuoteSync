# QuoteSync patch: Fix Client Notes typing backwards + Fix Files "Open link"
# - Client Notes: contentEditable was controlled via dangerouslySetInnerHTML, causing caret to jump and text to appear backwards.
#   Fix: make editor "semi-uncontrolled" using a ref; only sync innerHTML when NOT focused (tab switch / load / after Add Note).
# - Files Open link: normalize URL (add https:// if missing), encode, and open safely.

# Run from: PS C:\Github\QuoteSync\web\ps1_patches>
#   Unblock-File .\THIS_SCRIPT.ps1
#   pwsh -ExecutionPolicy Bypass -File .\THIS_SCRIPT.ps1

$ErrorActionPreference = "Stop"

function Fail($m){ Write-Host "ERROR: $m" -ForegroundColor Red; throw $m }
function Ok($m){ Write-Host "OK: $m" -ForegroundColor Green }

$runDir = (Get-Location).Path
Write-Host ("Run directory: " + $runDir)

# Detect web root (parent of ps1_patches)
$webRoot = Resolve-Path (Join-Path $runDir "..") | Select-Object -ExpandProperty Path
if (-not (Test-Path (Join-Path $webRoot "package.json"))) { Fail "Could not detect web root (package.json not found) at: $webRoot" }
Ok ("Detected web root: " + $webRoot)

# Backup folder
$backupsRoot = Join-Path $webRoot "_backups"
New-Item -ItemType Directory -Force -Path $backupsRoot | Out-Null
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = Join-Path $backupsRoot $stamp
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
Ok ("Backup folder: " + $backupDir)

$targetRel = "src\features\estimatePicker\EstimatePickerTabs.tsx"
$targetPath = Join-Path $webRoot $targetRel
if (-not (Test-Path $targetPath)) { Fail "Missing file: $targetPath" }

Copy-Item -Force $targetPath (Join-Path $backupDir "EstimatePickerTabs.tsx")
Ok ("Backed up " + $targetRel)

$txt = Get-Content -Raw -Path $targetPath -Encoding UTF8

function Ensure-Once($label, $needle) {
  $count = ([regex]::Matches($txt, [regex]::Escape($needle))).Count
  if ($count -ne 1) { Fail "$label: expected exactly 1 match, found $count" }
}

# ---- 1) Insert ref + effect + helper openClientFileLink (after props destructure) ----
$anchor = @"
  } = props;

  return (
"@

Ensure-Once "Anchor props destructure" $anchor

$insertion = @"
  } = props;

  // --- Client Notes editor (contentEditable) ---
  // Keep innerHTML in sync only when the editor is NOT focused, to avoid caret jumps / reversed typing.
  const clientNotesEditorRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
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

    // If it's a local Windows path, browsers generally cannot open it for security reasons.
    // In that case, we just alert the user to copy/paste into Explorer.
    const looksLikeWindowsPath = /^[A-Za-z]:\\/.test(v) || /^\\\\/.test(v);
    if (looksLikeWindowsPath) {
      alert("This looks like a local file path. Browsers usually can't open local paths. Copy/paste it into Windows Explorer:\n\n" + v);
      return;
    }

    let url = v;

    // If missing a scheme, assume https://
    const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(url);
    if (!hasScheme) {
      // common case: www.example.com or sharepoint/drive links pasted without scheme
      url = "https://" + url;
    }

    // Encode spaces etc. but keep URL readable
    const safeUrl = encodeURI(url);

    try {
      // Validate URL
      // eslint-disable-next-line no-new
      new URL(safeUrl);
      window.open(safeUrl, "_blank", "noopener,noreferrer");
    } catch {
      alert("That link doesn't look like a valid URL:\n\n" + v);
    }
  };

  return (
"@

$txt = $txt.Replace($anchor, $insertion)
Ok "Inserted clientNotesEditorRef + sync effect + openClientFileLink"

# ---- 2) Fix Client Notes editor: remove dangerouslySetInnerHTML and add ref ----
$oldNotes = @"
<div
      contentEditable
      suppressContentEditableWarning
      onInput={(e) => setClientNoteDraftHtml((e.currentTarget as HTMLDivElement).innerHTML)}
      dangerouslySetInnerHTML={{ __html: clientNoteDraftHtml }}
      style={{
        minHeight: 120,
        borderRadius: 14,
        border: "1px solid #e4e4e7",
        padding: 12,
        background: "#fff",
        outline: "none",
      }}
    />
"@

Ensure-Once "Client Notes editor block" $oldNotes

$newNotes = @"
<div
      ref={clientNotesEditorRef}
      contentEditable
      suppressContentEditableWarning
      onInput={(e) => setClientNoteDraftHtml((e.currentTarget as HTMLDivElement).innerHTML)}
      style={{
        minHeight: 120,
        borderRadius: 14,
        border: "1px solid #e4e4e7",
        padding: 12,
        background: "#fff",
        outline: "none",
      }}
    />
"@

$txt = $txt.Replace($oldNotes, $newNotes)
Ok "Updated Client Notes editor to avoid backwards typing"

# ---- 3) Fix Files: Open link button uses openClientFileLink ----
$oldOpen = @"
onClick={() => {
            if (!clientFileUrl.trim()) return;
            window.open(clientFileUrl, "_blank");
          }}
"@

Ensure-Once "Files Open link handler" $oldOpen

$newOpen = @"
onClick={() => openClientFileLink(clientFileUrl)}
"@

$txt = $txt.Replace($oldOpen, $newOpen)
Ok "Updated Files 'Open link' to normalize/validate URLs"

# Write file
Set-Content -Path $targetPath -Value $txt -Encoding UTF8
Ok ("Wrote " + $targetRel)

# Run dev server (per standing rule)
Write-Host ""
Write-Host "Starting dev server..." -ForegroundColor Cyan
Push-Location $webRoot
try {
  npm run dev
} finally {
  Pop-Location
}
