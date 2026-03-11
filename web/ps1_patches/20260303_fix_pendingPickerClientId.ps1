# QuoteSync - Hotfix: pendingPickerClientId is not defined (fix Open blank screen crash)
# Run from: PS C:\Github\QuoteSync\web\ps1_patches>
# Then:
#   Unblock-File .\20260303_fix_pendingPickerClientId.ps1
#   pwsh -ExecutionPolicy Bypass -File .\20260303_fix_pendingPickerClientId.ps1

$ErrorActionPreference = "Stop"

function Ok($m){ Write-Host "OK: $m" -ForegroundColor Green }
function Warn($m){ Write-Host "WARN: $m" -ForegroundColor Yellow }
function Fail($m){ Write-Host "ERROR: $m" -ForegroundColor Red; throw $m }

$runDir = (Get-Location).Path
Write-Host "Run directory: $runDir"

# Detect web root (works whether you run from ...\web\ps1_patches or ...\web)
$webRoot = $null
if (Test-Path (Join-Path $runDir "src\App.tsx")) {
  $webRoot = $runDir
} elseif (Test-Path (Join-Path $runDir "..\src\App.tsx")) {
  $webRoot = (Resolve-Path (Join-Path $runDir "..")).Path
} else {
  Fail "Could not detect web root. Expected src\App.tsx in current folder OR parent folder."
}
Ok "Detected web root: $webRoot"

$appRel = "src\App.tsx"
$appPath = Join-Path $webRoot $appRel
if (!(Test-Path $appPath)) { Fail "Missing file: $appRel (looked for $appPath)" }

# Backup
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backup = Join-Path $webRoot ("_backups\" + $stamp + "_fix_pendingPickerClientId")
New-Item -ItemType Directory -Path $backup | Out-Null
Copy-Item $appPath (Join-Path $backup "src_App.tsx") -Force
Ok "Backed up $appRel -> $(Join-Path $backup "src_App.tsx")"

$app = Get-Content $appPath -Raw -Encoding UTF8

$hasPending = ($app -match '\bpendingPickerClientId\b') -or ($app -match '\bsetPendingPickerClientId\b')
if (-not $hasPending) {
  Warn "No pendingPickerClientId tokens found in App.tsx. Nothing to patch here."
  Warn "If you're still seeing the error, double-check you are running the right project folder and that Vite is using this App.tsx."
  Ok "DONE (no-op)."
  exit 0
}

# Prefer mapping pendingPickerClientId -> estimatePickerClientId (the intended state name in App)
$hasEstimate = ($app -match '\[estimatePickerClientId,\s*setEstimatePickerClientId\]') -or ($app -match '\bestimatePickerClientId\b')
if (-not $hasEstimate) {
  # Fallback mapping pendingPickerClientId -> pickerClientId if that exists
  $hasPicker = ($app -match '\[pickerClientId,\s*setPickerClientId\]') -or ($app -match '\bpickerClientId\b')
  if ($hasPicker) {
    Warn "No estimatePickerClientId found; falling back to pickerClientId mapping."
    $app2 = $app -replace '\bsetPendingPickerClientId\b','setPickerClientId'
    $app2 = $app2 -replace '\bpendingPickerClientId\b','pickerClientId'
  } else {
    Fail "App.tsx references pendingPickerClientId but has neither estimatePickerClientId nor pickerClientId state to map to. Please upload the current src\App.tsx if this happens."
  }
} else {
  $app2 = $app -replace '\bsetPendingPickerClientId\b','setEstimatePickerClientId'
  $app2 = $app2 -replace '\bpendingPickerClientId\b','estimatePickerClientId'
}

if ($app2 -eq $app) {
  Fail "Patch made no changes even though pendingPickerClientId tokens were detected. Aborting."
}

Set-Content -Path $appPath -Value $app2 -Encoding UTF8
Ok "Patched src\App.tsx (pendingPickerClientId -> correct state variable)."

Ok "DONE. Refresh the browser. If you still get a blank screen, open DevTools Console and paste the first red error line."
