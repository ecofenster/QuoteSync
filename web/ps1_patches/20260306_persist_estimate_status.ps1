
<# 
QuoteSync Patch — Persist estimate status to localStorage

Purpose
-------
When estimate status is changed in Estimate Selection (EstimatePickerTabs),
it currently updates only React state. Client Database filters read from
localStorage, so the status disappears when leaving the screen.

This patch updates the status handler so it also writes to:

qs_estimate_outcomes_v1_<clientId>

Files touched
-------------
src\features\estimatePicker\EstimatePickerTabs.tsx

Safety
------
Creates a backup before modifying the file.

Run from
--------
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

if(-not (Test-Path $filePath)){ Fail "Missing file: $filePath" }

# Backup
$ts=Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir=Join-Path (Join-Path $webRoot "_backups") $ts
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
Copy-Item $filePath (Join-Path $backupDir "EstimatePickerTabs.tsx") -Force
Ok "Backed up: $fileRel"

$txt=Get-Content $filePath -Raw -Encoding UTF8

$old='setEstimateOutcomeById((prev) => ({ ...prev, [e.id]: opt }));'

$new=@'
setEstimateOutcomeById((prev) => {
  const next = { ...prev, [e.id]: opt };

  try {
    const key = `qs_estimate_outcomes_v1_${pickerClient?.id}`;
    localStorage.setItem(key, JSON.stringify(next));
  } catch {}

  return next;
});
'@

if($txt -notlike "*$old*"){ Fail "Anchor not found for status update." }

$txt=$txt.Replace($old,$new)

Set-Content -Path $filePath -Value $txt -Encoding UTF8

Ok "Estimate status persistence added."
Ok "Done. (Dev server not restarted.)"
