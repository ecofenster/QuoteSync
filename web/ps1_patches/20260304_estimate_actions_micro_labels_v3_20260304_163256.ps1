# QuoteSync patch v3: Add micro-labels above estimate action controls (Email / Follow up / Estimate status / Open estimate)
# Robust patch: supports either
#  A) Full action row with Send + Add Follow Up + (custom status) + Open
#  B) Minimal action row with (native <select> status) + Open
#
# IMPORTANT:
# - Creates timestamped backup under web\_backups\...
# - Does NOT run npm run dev.

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

$labelStyle = '{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "#6b7280", marginBottom: 4 }'
$colStyle   = '{ display: "flex", flexDirection: "column", alignItems: "flex-start" }'

function Replace-Once($pattern, $replacement, $label){
  $rx = New-Object System.Text.RegularExpressions.Regex($pattern, [System.Text.RegularExpressions.RegexOptions]::Singleline)
  $m = $rx.Match($script:txt)
  if (-not $m.Success) { return $false }
  $script:txt = $rx.Replace($script:txt, $replacement, 1)
  Ok ("Patched: " + $label)
  return $true
}

# --- Pattern A: row containing Send + Add Follow Up + Open (custom dropdown already present) ---
$patA = '<div\s+style=\{\{\s*display:\s*"flex",\s*alignItems:\s*"center",\s*gap:\s*10[\s\S]*?</Button>\s*</div>\s*</div>'
# Narrow by requiring Send and Add Follow Up and openEstimateFromPicker
$patA = '<div\s+style=\{\{\s*display:\s*"flex",\s*alignItems:\s*"center",\s*gap:\s*10[\s\S]*?>[\s\S]*?>\s*Send\s*</Button>[\s\S]*?>\s*Add Follow Up\s*</Button>[\s\S]*?openEstimateFromPicker\(e\.id\)[\s\S]*?</Button>\s*</div>'

$replA = @"
<div style={{ display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap" }}>
  <div style=$colStyle>
    <div style=$labelStyle>Email</div>
    <Button
      variant="outline"
      onClick={() => {
        setSendModalEstimateId(e.id);
        setSendModalOpen(true);
        setSendModalAddFollowUp(true);
        setSendModalFollowUpDays(3);
        setSendModalPhoneCall(true);
      }}
    >
      Send
    </Button>
  </div>

  <div style=$colStyle>
    <div style=$labelStyle>Follow up</div>
    <Button variant="outline" onClick={() => addFollowUpForEstimate(e.id, { days: 3, sendEmail: true, needsCall: true })}>
      Add Follow Up
    </Button>
  </div>

  <div style=$colStyle>
    <div style=$labelStyle>Estimate status</div>
    __STATUS_BLOCK__
  </div>

  <div style=$colStyle>
    <div style=$labelStyle>Open estimate</div>
    <Button variant="primary" onClick={() => openEstimateFromPicker(e.id)}>
      Open
    </Button>
  </div>
</div>
"@

# If pattern A matches, we still need to preserve the existing status control block.
if ((New-Object System.Text.RegularExpressions.Regex($patA, [System.Text.RegularExpressions.RegexOptions]::Singleline)).IsMatch($txt)) {
  # Extract the existing status block between the Add Follow Up button and the Open button within that matched region.
  $m = (New-Object System.Text.RegularExpressions.Regex($patA, [System.Text.RegularExpressions.RegexOptions]::Singleline)).Match($txt)
  $seg = $m.Value

  # Find status chunk: after "Add Follow Up</Button>" and before '<Button variant="primary" onClick={() => openEstimateFromPicker'
  $rxStatus = New-Object System.Text.RegularExpressions.Regex('</Button>\s*[\s\S]*?Add Follow Up\s*</Button>\s*([\s\S]*?)<Button\s+variant="primary"\s+onClick=\{\(\)\s*=>\s*openEstimateFromPicker', [System.Text.RegularExpressions.RegexOptions]::Singleline)
  $ms = $rxStatus.Match($seg)
  if (-not $ms.Success) { Fail "Matched action row but could not isolate the Status control block." }

  $statusBlock = $ms.Groups[1].Value.Trim()

  # Remove any inner 'Status' label inside the status block to avoid duplicate wording.
  $statusBlock = [regex]::Replace($statusBlock, '<div\s+style=\{\{\s*fontSize:\s*12[\s\S]*?>\s*Status\s*</div>\s*', '', 1, [System.Text.RegularExpressions.RegexOptions]::Singleline)

  $final = $replA.Replace("__STATUS_BLOCK__", $statusBlock)

  # Replace the whole matched segment with our new grouped layout
  $txt = $txt.Substring(0, $m.Index) + $final + $txt.Substring($m.Index + $m.Length)
  Ok "Patched: micro-label grouping (Send / Follow Up / Status / Open)"
}
else {
  # --- Pattern B: minimal row with <select> + Open ---
  $patB = '<div\s+style=\{\{\s*display:\s*"flex",\s*alignItems:\s*"center",\s*gap:\s*10\s*\}\}>\s*<select[\s\S]*?</select>\s*<Button\s+variant="primary"\s+onClick=\{\(\)\s*=>\s*openEstimateFromPicker\(e\.id\)\}>\s*Open\s*</Button>\s*</div>'

  $replB = @"
<div style={{ display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap" }}>
  <div style=$colStyle>
    <div style=$labelStyle>Estimate status</div>
    <select
      value={outcome}
      onChange={(ev) => {
        const v = ev.currentTarget.value as EstimateOutcome;
        setEstimateOutcomeById((prev) => ({ ...prev, [e.id]: v }));
      }}
      style={{
        height: 36,
        borderRadius: 10,
        border: "1px solid #e4e4e7",
        padding: "0 10px",
        background: "#fff",
        fontSize: 14,
      }}
    >
      <option value="Open">Open</option>
      <option value="Lost">Lost</option>
      <option value="Order">Order</option>
    </select>
  </div>

  <div style=$colStyle>
    <div style=$labelStyle>Open estimate</div>
    <Button variant="primary" onClick={() => openEstimateFromPicker(e.id)}>
      Open
    </Button>
  </div>
</div>
"@

  $okB = Replace-Once $patB $replB "micro-label grouping (Status / Open)"
  if (-not $okB) {
    Fail "Could not find the estimate action row to label. I tried both (A) Send/Add Follow Up/Status/Open and (B) select+Open. Upload your current EstimatePickerTabs.tsx again and I will retarget."
  }
}

if ($txt -eq $orig) { Fail "No changes were made (unexpected)." }

Set-Content -Path $path -Value $txt -Encoding UTF8
Ok ("Wrote " + $rel)

Write-Host ""
Write-Host "DONE. Refresh the browser." -ForegroundColor Cyan
Write-Host ("Backup: " + $backupDir) -ForegroundColor Cyan
