# =====================================================================
# QuoteSync — Save Point: Phase 3 Model Lock (Stable)
# Script: 20260220_12_savepoint_phase3_model_lock_stable.ps1
# Run from: PS C:\Github\QuoteSync\web\ps1_patches>
#
# Creates:
#   C:\Github\QuoteSync\web\_backups\<timestamp>_PHASE3_MODEL_LOCK_STABLE\
#   ...plus a ZIP of the web folder and SHA256 hash file.
# =====================================================================

$ErrorActionPreference = "Stop"

function Ok($m){ Write-Host "OK: $m" -ForegroundColor Green }
function Info($m){ Write-Host "INFO: $m" -ForegroundColor Cyan }
function Fail($m){ Write-Host "ERROR: $m" -ForegroundColor Red; throw $m }

# --- Resolve project root (web) from ps1_patches ---
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Resolve-Path (Join-Path $scriptDir "..")  # ...\web
Set-Location $root
Info "Run directory: $root"

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$label = "${timestamp}_PHASE3_MODEL_LOCK_STABLE"
$backupBase = Join-Path $root "_backups"
$saveDir = Join-Path $backupBase $label

if (!(Test-Path $backupBase)) { New-Item -ItemType Directory -Force -Path $backupBase | Out-Null }

# Create savepoint dir
New-Item -ItemType Directory -Force -Path $saveDir | Out-Null
Ok "Savepoint folder: $saveDir"

# Copy key folders/files (conservative, no exclusions beyond node_modules/dist/_backups)
$copyItems = @(
  "src",
  "public",
  "index.html",
  "package.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "tsconfig.json",
  "tsconfig.*.json",
  "vite.config.*",
  "postcss.config.*",
  "tailwind.config.*",
  ".env",
  ".env.*"
)

foreach ($item in $copyItems) {
  $matches = Get-ChildItem -LiteralPath $root -Filter $item -Force -ErrorAction SilentlyContinue
  if ($matches) {
    foreach ($m in $matches) {
      $srcPath = $m.FullName
      $destPath = Join-Path $saveDir $m.Name
      Copy-Item -Recurse -Force $srcPath $destPath
      Ok "Copied: $($m.Name)"
    }
  } else {
    # If it's a direct path (src/public/index.html/package.json etc.) check explicitly
    $p = Join-Path $root $item
    if (Test-Path $p) {
      $destPath = Join-Path $saveDir (Split-Path -Leaf $p)
      Copy-Item -Recurse -Force $p $destPath
      Ok "Copied: $item"
    }
  }
}

# Create a full web zip (excluding node_modules, dist, _backups)
$zipPath = Join-Path $saveDir "QuoteSync_web_${label}.zip"
$staging = Join-Path $saveDir "_zip_staging"
New-Item -ItemType Directory -Force -Path $staging | Out-Null

# Robocopy for exclusions and speed
$excludes = @("node_modules","dist","_backups")
$xd = @()
foreach ($e in $excludes) { $xd += @("/XD", (Join-Path $root $e)) }

$rcLog = Join-Path $saveDir "robocopy.log"
$null = & robocopy $root $staging /MIR /R:1 /W:1 /NFL /NDL /NP /NJH /NJS /MT:8 @xd /LOG:$rcLog
# Robocopy returns codes; treat 0-7 as success
if ($LASTEXITCODE -gt 7) { Fail "Robocopy failed with exit code $LASTEXITCODE. See $rcLog" }
Ok "Staged web folder for zip (excluded: node_modules, dist, _backups)"

# Zip it
if (Test-Path $zipPath) { Remove-Item -Force $zipPath }
Compress-Archive -Path (Join-Path $staging "*") -DestinationPath $zipPath -CompressionLevel Optimal
Ok "Created ZIP: $zipPath"

# Hash it
$hash = Get-FileHash -Path $zipPath -Algorithm SHA256
$hashFile = Join-Path $saveDir "SHA256.txt"
$hashLine = "$($hash.Hash)  $([IO.Path]::GetFileName($zipPath))"
Set-Content -Path $hashFile -Value $hashLine -Encoding UTF8
Ok "SHA256: $($hash.Hash)"
Ok "Wrote: $hashFile"

# Cleanup staging
Remove-Item -Recurse -Force $staging
Ok "Cleaned staging folder"

Ok "SAVEPOINT COMPLETE: $label"
Info "Next: proceed to Phase 4 (Validation foundation) when ready."
