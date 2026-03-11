# QuoteSync hotfix: Define statusMenuForEstimateId state (was causing ReferenceError)
# Symptom:
#   EstimatePickerTabs.tsx: Uncaught ReferenceError: statusMenuForEstimateId is not defined
# Cause:
#   Custom Status dropdown menu references statusMenuForEstimateId but state wasn't inserted into the component scope.
#
# Fix:
#   - Insert:
#       const [statusMenuForEstimateId, setStatusMenuForEstimateId] = React.useState<string | null>(null);
#       React.useEffect(() => { document click closes menu }, [])
#     immediately after the component signature.
#
# IMPORTANT:
# - Creates timestamped backup under web\_backups\...
# - Does NOT run npm run dev.
#
# Run from: PS C:\Github\QuoteSync\web\ps1_patches>
#   Unblock-File .\20260304_fix_statusMenu_state_missing_20260304_144219.ps1
#   pwsh -ExecutionPolicy Bypass -File .\20260304_fix_statusMenu_state_missing_20260304_144219.ps1

$ErrorActionPreference = "Stop"
function Fail($m){ Write-Host "ERROR: $m" -ForegroundColor Red; throw $m }
function Ok($m)  { Write-Host "OK: $m" -ForegroundColor Green }
function Warn($m){ Write-Host "WARN: $m" -ForegroundColor Yellow }

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

if ($txt -match 'statusMenuForEstimateId') {
  # It's referenced; ensure it's declared in component scope.
  if ($txt -match 'const\s*\[\s*statusMenuForEstimateId\s*,\s*setStatusMenuForEstimateId\s*\]') {
    Warn "statusMenuForEstimateId state already declared — no change needed."
    Write-Host ("Backup: " + $backupDir) -ForegroundColor Cyan
    exit 0
  }
} else {
  Fail "This file does not reference statusMenuForEstimateId — are you on the custom status dropdown version?"
}

# Insert right after: export default function EstimatePickerTabs(props: Props) {
$marker = 'export default function EstimatePickerTabs(props: Props) {'
$pos = $txt.IndexOf($marker)
if ($pos -lt 0) { Fail "Could not find component signature: $marker" }

$insertAt = $pos + $marker.Length

$snippet = @'
  const [statusMenuForEstimateId, setStatusMenuForEstimateId] = React.useState<string | null>(null);

  React.useEffect(() => {
    function onDocClick() {
      setStatusMenuForEstimateId(null);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

'@

$txt2 = $txt.Substring(0, $insertAt) + "`r`n" + $snippet + $txt.Substring($insertAt)

Set-Content -Path $path -Value $txt2 -Encoding UTF8
Ok ("Inserted statusMenuForEstimateId state + click-away effect")
Ok ("Wrote " + $rel)

Write-Host ""
Write-Host "DONE. Refresh the browser." -ForegroundColor Cyan
Write-Host ("Backup: " + $backupDir) -ForegroundColor Cyan
