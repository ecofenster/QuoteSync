$ErrorActionPreference="Stop"
function Fail($m){ Write-Host "ERROR: $m" -ForegroundColor Red; throw $m }
function Ok($m){ Write-Host "OK: $m" -ForegroundColor Green }

$runDir=(Get-Location).Path
Write-Host "Run directory: $runDir"

# Detect web root
$here=$runDir
$webRoot=$null
for($i=0;$i -lt 10;$i++){
  if(Test-Path (Join-Path $here "package.json")){ $webRoot=$here; break }
  $p=Split-Path $here -Parent
  if($p -eq $here){ break }
  $here=$p
}
if(-not $webRoot){ Fail "Could not detect web root (package.json not found). Run from ...\web\ps1_patches." }
Ok "Detected web root: $webRoot"

$ts=Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir=Join-Path (Join-Path $webRoot "_backups") $ts
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
Ok "Backup dir: $backupDir"

$rel="src\features\estimatePicker\EstimatePickerFeature.tsx"
$path=Join-Path $webRoot $rel
if(-not (Test-Path $path)){ Fail "Missing file: $rel" }

Copy-Item $path (Join-Path $backupDir "EstimatePickerFeature.tsx") -Force
Ok "Backed up: $rel"

$txt = Get-Content $path -Raw -Encoding UTF8

$old = 'const EstimatePickerFeature = React.forwardRef<EstimatePickerFeatureHandle, Props>(function EstimatePickerFeature(props, ref) {'
if($txt -notlike "*$old*"){ Fail "Anchor not found (forwardRef generic line). File may differ from expected." }

$new = @"
const EstimatePickerFeature = React.forwardRef(function EstimatePickerFeature(
  props: Props,
  ref: React.ForwardedRef<EstimatePickerFeatureHandle>
) {
"@

$txt = $txt.Replace($old, $new)

Set-Content -Path $path -Value $txt -Encoding UTF8
Ok "Patched forwardRef declaration to TSX-safe form."
Ok "Done. (Dev server not restarted.)"
