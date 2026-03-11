<# 
QuoteSync Hotfix — Fix duplicated closing braces in EstimatePickerTabs status onClick

Problem:
The previous status-persistence patch left:
  }}                                }}
which breaks TSX parsing.

This hotfix:
- backs up EstimatePickerTabs.tsx
- replaces the duplicated closing braces with a single valid close
- does not touch layout or restart the dev server

Run from:
PS C:\Github\QuoteSync\web\ps1_patches>
#>

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
if(-not $webRoot){ Fail "Could not detect web root (package.json not found)." }
Ok "Detected web root: $webRoot"

$fileRel="src\features\estimatePicker\EstimatePickerTabs.tsx"
$filePath=Join-Path $webRoot $fileRel
if(-not (Test-Path $filePath)){ Fail "Missing file: $fileRel" }

$ts=Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir=Join-Path (Join-Path $webRoot "_backups") $ts
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
Copy-Item $filePath (Join-Path $backupDir "EstimatePickerTabs.tsx") -Force
Ok "Backed up: $fileRel"

$txt=Get-Content $filePath -Raw -Encoding UTF8

$old = '}}                                }}'
$new = '}}'

if($txt -notlike "*$old*"){ Fail "Did not find duplicated closing braces pattern." }

$txt = $txt.Replace($old, $new)

Set-Content -Path $filePath -Value $txt -Encoding UTF8
Ok "Removed duplicated closing braces in status option onClick."
Ok "Done. (Dev server not restarted.)"
