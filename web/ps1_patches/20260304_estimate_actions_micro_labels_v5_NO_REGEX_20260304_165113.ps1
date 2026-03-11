# QuoteSync patch v5 (NO REGEX): Add micro-labels above estimate action controls
# More tolerant matching: does NOT rely on exact ">Send</Button>" formatting.
#
# Adds micro-labels above:
#   Email -> (Send button)
#   Follow up -> (Add Follow Up button)
#   Estimate status -> (existing status control block)
#   Open estimate -> (Open button)
#
# IMPORTANT:
# - Creates timestamped backup under web\_backups\...
# - Does NOT run npm run dev.
#
# Run from: PS C:\Github\QuoteSync\web\ps1_patches>
#   Unblock-File .\20260304_estimate_actions_micro_labels_v5_NO_REGEX_20260304_165113.ps1
#   pwsh -ExecutionPolicy Bypass -File .\20260304_estimate_actions_micro_labels_v5_NO_REGEX_20260304_165113.ps1

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

# Locate action row start
$rowStartNeedle = '<div style={{ display: "flex", alignItems: "center", gap: 10 }}>'
$rowStart = $txt.IndexOf($rowStartNeedle)
if ($rowStart -lt 0) { Fail "Could not find action row start: $rowStartNeedle" }

# Find Open button anchor AFTER rowStart
$openAnchor = 'openEstimateFromPicker(e.id)'
$openAnchorPos = $txt.IndexOf($openAnchor, $rowStart)
if ($openAnchorPos -lt 0) { Fail "Could not find Open button anchor: $openAnchor" }

# Find the Button tag start for the Open button by searching backwards for '<Button'
$openBtnStart = $txt.LastIndexOf('<Button', $openAnchorPos)
if ($openBtnStart -lt 0) { Fail "Could not locate Open <Button> start." }

# Find end of that Open button
$openBtnEnd = $txt.IndexOf('</Button>', $openBtnStart)
if ($openBtnEnd -lt 0) { Fail "Could not locate Open </Button> end." }
$openBtnEnd = $openBtnEnd + '</Button>'.Length

# Find row end: first </div> after Open button end
$rowEnd = $txt.IndexOf('</div>', $openBtnEnd)
if ($rowEnd -lt 0) { Fail "Could not find action row closing </div> after Open button." }
$rowEnd = $rowEnd + '</div>'.Length

$seg = $txt.Substring($rowStart, $rowEnd - $rowStart)

# Helper to extract a <Button ...>...</Button> block containing a label within $seg
function Extract-ButtonByLabel($segment, $label) {
  $labelPos = $segment.IndexOf($label)
  if ($labelPos -lt 0) { return $null }

  $btnStart = $segment.LastIndexOf('<Button', $labelPos)
  if ($btnStart -lt 0) { return $null }

  $btnEnd = $segment.IndexOf('</Button>', $labelPos)
  if ($btnEnd -lt 0) { return $null }
  $btnEnd = $btnEnd + '</Button>'.Length

  return @{ Start=$btnStart; End=$btnEnd; Block=$segment.Substring($btnStart, $btnEnd - $btnStart) }
}

$sendBtn = Extract-ButtonByLabel $seg 'Send'
if ($null -eq $sendBtn) { Fail "Could not find Send button in action row (searched within the action row segment)." }

$followBtn = Extract-ButtonByLabel $seg 'Add Follow Up'
if ($null -eq $followBtn) { Fail "Could not find Add Follow Up button in action row." }

# Extract Open button block from seg using anchor
$segOpenAnchorPos = $seg.IndexOf($openAnchor)
if ($segOpenAnchorPos -lt 0) { Fail "Internal: Open anchor not found within segment." }
$openBtn2Start = $seg.LastIndexOf('<Button', $segOpenAnchorPos)
if ($openBtn2Start -lt 0) { Fail "Internal: could not locate Open <Button> within segment." }
$openBtn2End = $seg.IndexOf('</Button>', $openBtn2Start)
if ($openBtn2End -lt 0) { Fail "Internal: could not locate Open </Button> within segment." }
$openBtn2End = $openBtn2End + '</Button>'.Length
$openBtnBlock = $seg.Substring($openBtn2Start, $openBtn2End - $openBtn2Start)

# Status block is whatever sits between end of Add Follow Up button and start of Open button.
$followEnd = $followBtn.End
$statusBlock = $seg.Substring($followEnd, $openBtn2Start - $followEnd).Trim()

# Remove the inner "Status" label line if present (exact string)
$statusLabelExact = '<div style={{ fontSize: 12, fontWeight: 900, color: "#111827", paddingLeft: 2 }}>Status</div>'
if ($statusBlock.Contains($statusLabelExact)) {
  $statusBlock = $statusBlock.Replace($statusLabelExact, '').Trim()
}

$labelStyle = '{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "#6b7280", marginBottom: 4 }'
$colStyle   = '{ display: "flex", flexDirection: "column", alignItems: "flex-start" }'

$newSeg = @"
<div style={ display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap" }>
  <div style=$colStyle>
    <div style=$labelStyle>Email</div>
    $($sendBtn.Block)
  </div>

  <div style=$colStyle>
    <div style=$labelStyle>Follow up</div>
    $($followBtn.Block)
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

# Replace in full file
$txt = $txt.Substring(0, $rowStart) + $newSeg + $txt.Substring($rowEnd)

if ($txt -eq $orig) { Fail "No changes applied." }

Set-Content -Path $path -Value $txt -Encoding UTF8
Ok ("Wrote " + $rel)

Write-Host ""
Write-Host "DONE. Refresh the browser." -ForegroundColor Cyan
Write-Host ("Backup: " + $backupDir) -ForegroundColor Cyan
