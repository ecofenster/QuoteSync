# =========================
# QuoteSync Phase 4G - Fix EstimatePickerFeature compile crash
# Run from: PS C:\Github\QuoteSync\web\ps1_patches>
# =========================

$ErrorActionPreference = "Stop"
function Ok($m){ Write-Host "OK: $m" -ForegroundColor Green }
function Fail($m){ Write-Host "ERROR: $m" -ForegroundColor Red; throw $m }

$runDir = (Get-Location).Path
Write-Host "Run directory: $runDir"

# Detect web root robustly
# Expected structure: ...\web\ps1_patches (runDir) and ...\web\src exists
$webRoot = $null

if (Test-Path (Join-Path $runDir "..\src\App.tsx")) {
  $webRoot = (Resolve-Path (Join-Path $runDir "..")).Path
} elseif (Test-Path (Join-Path $runDir "src\App.tsx")) {
  $webRoot = (Resolve-Path $runDir).Path
} elseif (Test-Path (Join-Path $runDir "web\src\App.tsx")) {
  $webRoot = (Resolve-Path (Join-Path $runDir "web")).Path
} else {
  Fail "Could not detect web root. Expected src\App.tsx under .. or current or .\web"
}

Ok "Detected web root: $webRoot"

$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backup = Join-Path $webRoot ("_backups\" + $stamp)
New-Item -ItemType Directory -Path $backup | Out-Null
Ok "Backup folder: $backup"

function Backup-File($rel){
  $src = Join-Path $webRoot $rel
  if (!(Test-Path $src)) { Fail "Missing file: $rel (looked in $webRoot)" }
  $dstName = ($rel -replace '[\\\/:]', '_')
  $dst = Join-Path $backup $dstName
  Copy-Item $src $dst -Force
  Ok "Backed up $rel -> $dst"
}

function Replace-One([string]$text,[string]$pattern,[string]$replacement,[string]$label){
  $m = [regex]::Matches($text,$pattern)
  if ($m.Count -ne 1) { Fail ("{0}: expected 1 match, found {1}. Pattern: {2}" -f $label,$m.Count,$pattern) }
  return [regex]::Replace($text,$pattern,$replacement,1)
}

$featureRel = "src\features\estimatePicker\EstimatePickerFeature.tsx"
Backup-File $featureRel

$featurePath = Join-Path $webRoot $featureRel
$feature = Get-Content $featurePath -Raw -Encoding UTF8

# 1) Fix duplicate destructuring: "const { clientId, clients, clientId, ..."
# Replace with a single clientId
$feature = [regex]::Replace(
  $feature,
  'const\s*\{\s*clientId\s*,\s*clients\s*,\s*clientId\s*,',
  'const { clientId, clients,',
  1
)

# Validate we no longer have "clientId, clients, clientId"
if ($feature -match 'clientId\s*,\s*clients\s*,\s*clientId') {
  Fail "Duplicate clientId destructure still present after fix."
}

Ok "Fixed duplicate clientId destructuring."

# 2) Make forwardRef call safe (avoid missing import issues):
# If it uses `forwardRef<...>(` without React., swap to React.forwardRef
$feature = [regex]::Replace(
  $feature,
  'const\s+EstimatePickerFeature\s*=\s*forwardRef<',
  'const EstimatePickerFeature = React.forwardRef<',
  1
)

Ok "Ensured React.forwardRef is used (import-safe)."

Set-Content -Path $featurePath -Value $feature -Encoding UTF8
Ok "Updated $featureRel"

Ok "DONE. If Vite is running, it should hot-reload. Otherwise run npm run dev from C:\Github\QuoteSync\web"