# QuoteSync Patch — Stage A2: Fixed = frame-only (no sash) + extend insertion list
# Run from: PS C:\Github\QuoteSync\web\ps1_patches>
# This script will auto-locate the web root relative to this folder.
$ErrorActionPreference = "Stop"

function Ok($m){ Write-Host "OK: $m" -ForegroundColor Green }
function Info($m){ Write-Host "INFO: $m" -ForegroundColor Cyan }
function Fail($m){ Write-Host "ERROR: $m" -ForegroundColor Red; throw $m }

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $here) { Fail "Unable to determine script directory." }

# Expect: ...\web\ps1_patches\ (this script lives here)
$webRoot = Resolve-Path (Join-Path $here "..")
Set-Location $webRoot
Write-Host "Run directory: $(Get-Location)" -ForegroundColor Yellow

if (-not (Test-Path ".\src\App.tsx")) { Fail "Expected .\src\App.tsx under $webRoot" }
if (-not (Test-Path ".\src\components\GridEditor.tsx")) { Fail "Expected .\src\components\GridEditor.tsx under $webRoot" }

# Backups
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$bakDir = Join-Path $webRoot "_backups"
if (-not (Test-Path $bakDir)) { New-Item -ItemType Directory -Path $bakDir | Out-Null }
Copy-Item ".\src\App.tsx" (Join-Path $bakDir "App.tsx.$stamp.bak") -Force
Copy-Item ".\src\components\GridEditor.tsx" (Join-Path $bakDir "GridEditor.tsx.$stamp.bak") -Force
Ok "Backups written to $bakDir"

# --- 1) Extend insertion dropdown options in App.tsx ---
$appPath = ".\src\App.tsx"
$app = Get-Content $appPath -Raw

$old = @'
                                  <option>Fixed</option>
                                  <option>Turn</option>
                                  <option>Tilt</option>
                                  <option>Tilt & Turn</option>
'@

$new = @'
                                  <option>Fixed</option>
                                  <option>Turn</option>
                                  <option>Tilt</option>
                                  <option>Tilt & Turn</option>
                                  <option>Top Hung</option>
                                  <option>Side Hung</option>
                                  <option>Reversible</option>
'@

if ($app -notlike "*<option>Fixed</option>*<option>Tilt & Turn</option>*") {
  Fail "App.tsx: insertion <option> block not found in expected form."
}

$app2 = $app.Replace($old, $new)
if ($app2 -eq $app) { Info "App.tsx: insertion list already updated (no change)." } else { Ok "App.tsx: insertion list updated." }
Set-Content -Path $appPath -Value $app2 -Encoding UTF8

# --- 2) GridEditor preview: Fixed = frame + glass (no sash), others show sash + glass ---
$gridPath = ".\src\components\GridEditor.tsx"
$grid = Get-Content $gridPath -Raw

$geomOld = "  const frameTh = 18;`r`n  const sashInset = 24;"
$geomNew = "  const frameTh = 18;`r`n  const isFixed = (pos.insertion || `"`").toLowerCase().includes(`"fixed`");`r`n  const sashInset = isFixed ? frameTh : 24;"

if ($grid -notlike "*const frameTh = 18;*const sashInset = 24;*") {
  Fail "GridEditor.tsx: geometry block not found in expected form."
}

$grid2 = $grid.Replace($geomOld, $geomNew)
if ($grid2 -eq $grid) { Info "GridEditor.tsx: isFixed geometry already present (no change)." } else { Ok "GridEditor.tsx: added isFixed + conditional inset." }

$sashOld = @'
            {/* Sash boundary */}
            <rect x={sashX} y={sashY} width={sashW} height={sashH} fill="none" stroke="#111" strokeWidth={1.2} />
'@

$sashNew = @'
            {/* Sash / Glass */}
            {/* Fixed: using frame opening only (no sash). Operable: show sash + glass. */}
            {!isFixed && (
              <rect x={sashX} y={sashY} width={sashW} height={sashH} fill="none" stroke="#111" strokeWidth={1.2} />
            )}
            <rect
              x={sashX + (isFixed ? 0 : 14)}
              y={sashY + (isFixed ? 0 : 14)}
              width={sashW - (isFixed ? 0 : 28)}
              height={sashH - (isFixed ? 0 : 28)}
              fill="#bcd7f5"
              opacity={0.8}
              stroke="none"
            />
'@

if ($grid2 -notlike "*{/* Sash boundary */}*") {
  Info "GridEditor.tsx: Sash boundary marker not found (maybe already patched). Attempting to patch by rect signature."
  # Fallback: replace the exact rect line if present
  $rectLine = '<rect x={sashX} y={sashY} width={sashW} height={sashH} fill="none" stroke="#111" strokeWidth={1.2} />'
  if ($grid2 -like "*$rectLine*") {
    $grid2 = $grid2.Replace($rectLine, ($sashNew -replace "^\s*{\s*/\* Sash / Glass \*/\s*}\s*\r?\n", ""))
    Ok "GridEditor.tsx: replaced sash rect line via fallback."
  } else {
    Fail "GridEditor.tsx: could not locate sash boundary rect to patch."
  }
} else {
  $grid3 = $grid2.Replace($sashOld, $sashNew)
  if ($grid3 -eq $grid2) { Info "GridEditor.tsx: sash/glass block already updated (no change)." } else { Ok "GridEditor.tsx: fixed vs operable sash/glass applied." }
  $grid2 = $grid3
}

Set-Content -Path $gridPath -Value $grid2 -Encoding UTF8

Ok "Patch complete. Your dev server should hot-reload; otherwise refresh the browser."
