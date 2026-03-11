<# 
QuoteSync Patch — Persist Estimate Status to localStorage (robust fix)

Why this failed before
----------------------
The previous script looked for an exact line:
  setEstimateOutcomeById((prev) => ({ ...prev, [e.id]: opt }));
but your current file content is not identical in all copies, and some versions
were already malformed (`{ .prev, ... }`), so the exact anchor was not found.

What this patch does
--------------------
In:
  src\features\estimatePicker\EstimatePickerTabs.tsx

it replaces the ENTIRE status-option onClick block with a known-good version that:
1) updates React state
2) writes the same status map to:
     qs_estimate_outcomes_v1_<clientId>
3) closes the status menu

Run from
--------
PS C:\Github\QuoteSync\web\ps1_patches>

Dev server
----------
Does NOT run/restart npm run dev.
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

# Find the status option onClick block by stable surrounding anchors
$startNeedle = 'onClick={() => {'
$contextNeedle = 'aria-selected={opt === outcome}'
$persistNeedle = 'qs_estimate_outcomes_v1_'

$contextPos = $txt.IndexOf($contextNeedle)
if($contextPos -lt 0){ Fail "Could not find estimate status option block (aria-selected anchor missing)." }

$start = $txt.LastIndexOf($startNeedle, $contextPos)
if($start -lt 0){ Fail "Could not find start of status option onClick block." }

$endNeedle = 'setStatusMenuForEstimateId(null);'
$end = $txt.IndexOf($endNeedle, $start)
if($end -lt 0){ Fail "Could not find end of status option onClick block." }

$lineEnd = $txt.IndexOf("`n", $end)
if($lineEnd -lt 0){ $lineEnd = $txt.Length - 1 }

$replacement = @'
onClick={() => {
                                  setEstimateOutcomeById((prev) => {
                                    const next = { ...prev, [e.id]: opt };

                                    try {
                                      const key = `qs_estimate_outcomes_v1_${pickerClient?.id}`;
                                      localStorage.setItem(key, JSON.stringify(next));
                                    } catch {}

                                    return next;
                                  });
                                  setStatusMenuForEstimateId(null);
                                }}
'@

$txt = $txt.Substring(0, $start) + $replacement + $txt.Substring($lineEnd + 1)

# Sanity check
if($txt -notmatch 'qs_estimate_outcomes_v1_'){ Fail "Persistence write was not inserted." }

Set-Content -Path $filePath -Value $txt -Encoding UTF8

Ok "Estimate status handler now persists to localStorage."
Ok "Done. (Dev server not restarted.)"
