# =========================
# QuoteSync - Phase 4H2
# Fix EstimatePickerTabs.tsx syntax error (stray duplicated lines like:
#   "}>{children}</div>;"
#   "}>{children}</h3>;"
#
# Run from: PS C:\Github\QuoteSync\web\ps1_patches>
# (This script does NOT start/stop Vite; it only edits files safely.)
# =========================

$ErrorActionPreference = "Stop"

function Ok($m){ Write-Host "OK: $m" -ForegroundColor Green }
function Warn($m){ Write-Host "WARN: $m" -ForegroundColor Yellow }
function Fail($m){ Write-Host "ERROR: $m" -ForegroundColor Red; throw $m }

$runDir = (Get-Location).Path
Write-Host "Run directory: $runDir"

# Detect web root (ps1_patches lives under ...\web\ps1_patches)
$webRoot = Resolve-Path (Join-Path $runDir "..") | Select-Object -ExpandProperty Path
if (-not (Test-Path (Join-Path $webRoot "src\App.tsx"))) {
  Fail "Could not detect web root. Expected src\App.tsx under: $webRoot. (Make sure you ran from ...\web\ps1_patches)"
}
Ok "Detected web root: $webRoot"

$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backup = Join-Path $webRoot ("_backups\" + $stamp)
New-Item -ItemType Directory -Path $backup | Out-Null
Ok "Backup folder: $backup"

function Backup-File($rel){
  $src = Join-Path $webRoot $rel
  if (!(Test-Path $src)) { Fail "Missing file: $rel" }
  $dstName = ($rel -replace '[\\\/:]', '_')
  $dst = Join-Path $backup $dstName
  Copy-Item $src $dst -Force
  Ok "Backed up $rel -> $dst"
}

$tabsRel = "src\features\estimatePicker\EstimatePickerTabs.tsx"
Backup-File $tabsRel

$tabsPath = Join-Path $webRoot $tabsRel
$txt = Get-Content $tabsPath -Raw -Encoding UTF8

$orig = $txt

# Remove stray duplicated JSX tail lines that break parsing
# Typical broken line (by itself): "}>{children}</div>;" or "}>{children}</h3>;"
$txt = [regex]::Replace($txt, '^\s*\}\>\{children\}<\/div\>;\s*$\r?\n?', '', 'Multiline')
$txt = [regex]::Replace($txt, '^\s*\}\>\{children\}<\/h3\>;\s*$\r?\n?', '', 'Multiline')

# Also remove a common variant: "}}>{children}</div>;" / "}}>{children}</h3>;"
$txt = [regex]::Replace($txt, '^\s*\}\}\>\{children\}<\/div\>;\s*$\r?\n?', '', 'Multiline')
$txt = [regex]::Replace($txt, '^\s*\}\}\>\{children\}<\/h3\>;\s*$\r?\n?', '', 'Multiline')

if ($txt -eq $orig) {
  Fail "No changes were applied. Either the file is already fixed, or the stray lines are different. Please paste lines 105-130 of EstimatePickerTabs.tsx."
}

Set-Content -Path $tabsPath -Value $txt -Encoding UTF8
Ok "Patched: $tabsRel"

Ok "DONE. Refresh the browser; Vite should recompile automatically."
