# QuoteSync patch v4 (NO REGEX): Add micro-labels above estimate action controls
# Fixes previous regex timeout by using IndexOf/SubString only.
#
# Target file:
#   src\features\estimatePicker\EstimatePickerTabs.tsx
#
# Adds micro-labels (small uppercase) above:
#   Email -> Send
#   Follow up -> Add Follow Up
#   Estimate status -> existing status control (custom dropdown)
#   Open estimate -> Open
#
# IMPORTANT:
# - Creates timestamped backup under web\_backups\...
# - Does NOT run npm run dev.
#
# Run from: PS C:\Github\QuoteSync\web\ps1_patches>
#   Unblock-File .\20260304_estimate_actions_micro_labels_v4_NO_REGEX_20260304_164413.ps1
#   pwsh -ExecutionPolicy Bypass -File .\20260304_estimate_actions_micro_labels_v4_NO_REGEX_20260304_164413.ps1

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
$orig = $txt

# --- Locate the action row region using robust anchors ---
$rowStartNeedle = '<div style={{ display: "flex", alignItems: "center", gap: 10 }}>'
$rowStart = $txt.IndexOf($rowStartNeedle)
if ($rowStart -lt 0) { Fail "Could not find action row start: $rowStartNeedle" }

# Find Send button label AFTER rowStart
$sendNeedle = '>Send</Button>'
$sendPos = $txt.IndexOf($sendNeedle, $rowStart)
if ($sendPos -lt 0) { Fail "Could not find Send button in action row." }

# Find Add Follow Up AFTER send
$followNeedle = '>Add Follow Up</Button>'
$followPos = $txt.IndexOf($followNeedle, $sendPos)
if ($followPos -lt 0) { Fail "Could not find Add Follow Up button in action row." }

# Find Open estimate button AFTER follow up
$openBtnNeedle = '<Button variant="primary" onClick={() => openEstimateFromPicker(e.id)}>'
$openBtnPos = $txt.IndexOf($openBtnNeedle, $followPos)
if ($openBtnPos -lt 0) { Fail "Could not find Open button in action row." }

# Find end of open button
$openEndNeedle = '</Button>'
$openEnd = $txt.IndexOf($openEndNeedle, $openBtnPos)
if ($openEnd -lt 0) { Fail "Could not find end of Open button." }
$openEnd = $openEnd + $openEndNeedle.Length

# Find row end </div> corresponding to the row: we expect a closing </div> right after open button (with whitespace)
# We'll take the first occurrence of '</div>' after openEnd as row end.
$rowEndNeedle = '</div>'
$rowEnd = $txt.IndexOf($rowEndNeedle, $openEnd)
if ($rowEnd -lt 0) { Fail "Could not find action row closing </div>." }
$rowEnd = $rowEnd + $rowEndNeedle.Length

$seg = $txt.Substring($rowStart, $rowEnd - $rowStart)

# Extract existing Status control block: between end of Add Follow Up button and start of Open button.
# Find the Add Follow Up button end within seg
$segFollowEnd = $seg.IndexOf($followNeedle)
if ($segFollowEnd -lt 0) { Fail "Internal: could not locate Add Follow Up within segment." }
$segFollowEnd = $segFollowEnd + $followNeedle.Length

$segOpenStart = $seg.IndexOf($openBtnNeedle)
if ($segOpenStart -lt 0) { Fail "Internal: could not locate Open button within segment." }

$statusBlock = $seg.Substring($segFollowEnd, $segOpenStart - $segFollowEnd).Trim()

# Remove any inner "Status" label line if present (exact match)
$statusLabelExact = '<div style={{ fontSize: 12, fontWeight: 900, color: "#111827", paddingLeft: 2 }}>Status</div>'
if ($statusBlock.Contains($statusLabelExact)) {
  $statusBlock = $statusBlock.Replace($statusLabelExact, '')
  $statusBlock = $statusBlock.Trim()
}

$labelStyle = '{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "#6b7280", marginBottom: 4 }'
$colStyle   = '{ display: "flex", flexDirection: "column", alignItems: "flex-start" }'

# Build new grouped row. We keep the exact button code for Send/Add Follow Up by extracting those from seg.
# Extract Send button block: from first '<Button' after rowStart to end of Send </Button>
$sendBtnStart = $seg.IndexOf('<Button', 0)
if ($sendBtnStart -lt 0) { Fail "Internal: could not locate Send <Button> start." }
$sendBtnEnd = $seg.IndexOf($sendNeedle, $sendBtnStart)
if ($sendBtnEnd -lt 0) { Fail "Internal: could not locate Send </Button> end." }
$sendBtnEnd = $sendBtnEnd + $sendNeedle.Length
$sendBtnBlock = $seg.Substring($sendBtnStart, $sendBtnEnd - $sendBtnStart)

# Extract Add Follow Up button block: from first '<Button' after Send block end to end of Add Follow Up </Button>
$followBtnStart = $seg.IndexOf('<Button', $sendBtnEnd)
if ($followBtnStart -lt 0) { Fail "Internal: could not locate Add Follow Up <Button> start." }
$followBtnEnd = $seg.IndexOf($followNeedle, $followBtnStart)
if ($followBtnEnd -lt 0) { Fail "Internal: could not locate Add Follow Up </Button> end." }
$followBtnEnd = $followBtnEnd + $followNeedle.Length
$followBtnBlock = $seg.Substring($followBtnStart, $followBtnEnd - $followBtnStart)

# Extract Open button block: from openBtnNeedle to openEnd within seg
$openBtnSegStart = $seg.IndexOf($openBtnNeedle)
if ($openBtnSegStart -lt 0) { Fail "Internal: could not locate Open button block start." }
$openBtnSegEnd = $seg.IndexOf($openEndNeedle, $openBtnSegStart)
if ($openBtnSegEnd -lt 0) { Fail "Internal: could not locate Open button block end." }
$openBtnSegEnd = $openBtnSegEnd + $openEndNeedle.Length
$openBtnBlock = $seg.Substring($openBtnSegStart, $openBtnSegEnd - $openBtnSegStart)

$newSeg = @"
<div style={{ display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap" }}>
  <div style=$colStyle>
    <div style=$labelStyle>Email</div>
    $sendBtnBlock
  </div>

  <div style=$colStyle>
    <div style=$labelStyle>Follow up</div>
    $followBtnBlock
  </div>

  <div style=$colStyle>
    <div style=$labelStyle>Estimate status</div>
    $statusBlock
  </div>

  <div style=$colStyle>
    <div style=$labelStyle>Open estimate</div>
    $openBtnBlock
  </div>
</div>
"@

# Replace the original segment in the full file
$txt = $txt.Substring(0, $rowStart) + $newSeg + $txt.Substring($rowEnd)

if ($txt -eq $orig) { Fail "No changes applied." }

Set-Content -Path $path -Value $txt -Encoding UTF8
Ok ("Wrote " + $rel)

Write-Host ""
Write-Host "DONE. Refresh the browser." -ForegroundColor Cyan
Write-Host ("Backup: " + $backupDir) -ForegroundColor Cyan
