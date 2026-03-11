# QuoteSync patch: Clarify Estimate action buttons with small labels (Email / Follow up / Estimate status / Open estimate)
# - No layout redesign: same row, just wraps each control with a tiny label above it.
# - Keeps existing buttons/handlers exactly as-is.
# - Adds clarity so users can see at a glance what each control is for.
#
# IMPORTANT:
# - Creates timestamped backup under web\_backups\...
# - Does NOT run npm run dev.
#
# Run from: PS C:\Github\QuoteSync\web\ps1_patches>
#   Unblock-File .\20260304_estimate_actions_micro_labels_20260304_162135.ps1
#   pwsh -ExecutionPolicy Bypass -File .\20260304_estimate_actions_micro_labels_20260304_162135.ps1

$ErrorActionPreference = "Stop"
function Fail($m){ Write-Host "ERROR: $m" -ForegroundColor Red; throw $m }
function Ok($m)  { Write-Host "OK: $m" -ForegroundColor Green }

$runDir = (Get-Location).Path
Write-Host ("Run directory: " + $runDir)

$webRoot = Resolve-Path (Join-Path $runDir "..") | Select-Object -ExpandProperty Path
if (-not (Test-Path (Join-Path $webRoot "package.json"))) { Fail "Could not detect web root (package.json not found) at: $webRoot" }
Ok ("Detected web root: " + $webRoot)

$rel = "src\features\estimatePicker\EstimatePickerTabs.tsx"
$path = Join-Path $webRoot $rel
if (-not (Test-Path $path)) { Fail "Missing file: $path" }

# Backup
$backupsRoot = Join-Path $webRoot "_backups"
New-Item -ItemType Directory -Force -Path $backupsRoot | Out-Null
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = Join-Path $backupsRoot $stamp
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
Ok ("Backup folder: " + $backupDir)

Copy-Item -Force $path (Join-Path $backupDir "EstimatePickerTabs.tsx")
Ok ("Backed up " + $rel)

$txt = Get-Content -Raw -Encoding UTF8 $path

# Find the estimate action row (Send / Add Follow Up / Status / Open) and wrap each control with a micro-label.
# This is intentionally conservative: it only patches the first matching action row.
$pattern = @'
(?s)
<div\s+style=\{{\{{\s*display:\s*"flex",\s*alignItems:\s*"center",\s*gap:\s*10\s*\}}\}}\s*>\s*
(?<send><Button[\s\S]*?>\s*Send\s*</Button>)\s*
(?<follow><Button[\s\S]*?>\s*Add\s+Follow\s+Up\s*</Button>)\s*
(?<status><div[\s\S]*?>[\s\S]*?>\s*Status\s*</div>[\s\S]*?</div>)\s*
(?<open><Button[\s\S]*?>\s*Open(?:\s+Estimate)?\s*</Button>)\s*
</div>
'@

$repl = @'
<div style={{ display: "flex", alignItems: "flex-end", gap: 14 }}>
  <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#6b7280", paddingLeft: 2 }}>Email</div>
    ${send}
  </div>

  <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#6b7280", paddingLeft: 2 }}>Follow up</div>
    ${follow}
  </div>

  <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#6b7280", paddingLeft: 2 }}>Estimate status</div>
    <!-- status control -->
    ${status}
  </div>

  <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#6b7280", paddingLeft: 2 }}>Open estimate</div>
    ${open}
  </div>
</div>
'@

try {
  $rx = [regex]::new($pattern, [System.Text.RegularExpressions.RegexOptions]::Singleline)
  $m = $rx.Match($txt)
  if (-not $m.Success) {
    Fail "Could not find the estimate action row (Send/Add Follow Up/Status/Open) in EstimatePickerTabs.tsx. If the wording changed, tell me what the buttons are labelled now and I will retarget."
  }

  # Replace only the first match
  $txt2 = $rx.Replace($txt, $repl, 1)

  # Within the inserted status block, remove the old 'Status' label line if present to avoid duplicate label.
  # This targets the common pattern: <div ...>Status</div> directly above the control.
  $txt2 = [regex]::Replace(
    $txt2,
    '(?s)<!-- status control -->\s*<div[^>]*>\s*<div[^>]*>\s*Status\s*</div>',
    '<!-- status control -->\n<div>',
    1,
    [System.Text.RegularExpressions.RegexOptions]::Singleline,
    [TimeSpan]::FromSeconds(2)
  )

  Set-Content -Path $path -Value $txt2 -Encoding UTF8
  Ok ("Wrote " + $rel)
} catch {
  Fail $_.Exception.Message
}

Write-Host ""
Write-Host "DONE. Refresh the browser." -ForegroundColor Cyan
Write-Host ("Backup: " + $backupDir) -ForegroundColor Cyan
