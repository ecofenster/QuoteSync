# QuoteSync - JSX fix: close missing wrapper <div> in Position wizard block
# Run from: PS C:\Github\QuoteSync\web\ps1_patches>
# Fixes: Expected corresponding JSX closing tag for <div> (App.tsx ~1748)
# Cause: wrapper <div> inserted before Preview card but its closing </div> is missing before the block ends.

$ErrorActionPreference = "Stop"
function Ok($m){ Write-Host "OK: $m" -ForegroundColor Green }
function Fail($m){ Write-Host "ERROR: $m" -ForegroundColor Red; throw $m }

$runFrom = (Get-Location).Path
Write-Host "Run directory: $runFrom"

if ($runFrom -like "*\ps1_patches") { Set-Location (Resolve-Path "..").Path }
$webRoot = (Get-Location).Path

$appPath = Join-Path $webRoot "src\App.tsx"
if (-not (Test-Path $appPath)) { Fail "Expected src\App.tsx under $webRoot. Run from: PS C:\Github\QuoteSync\web\ps1_patches>" }

$backupDir = Join-Path $webRoot "_backups"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
$ts = Get-Date -Format "yyyyMMdd_HHmmss"
$bak = Join-Path $backupDir ("App.tsx.$ts.bak")
Copy-Item $appPath $bak -Force
Ok "Backup written: $bak"

$txt = Get-Content $appPath -Raw

# Ensure wrapper opening exists (the one we inserted earlier)
$openNeedleCRLF = "                          <div>`r`n`r`n                          <div style={{ borderRadius: 14, border: ""1px solid #e4e4e7"", padding: 12 }}>"
$openNeedleLF   = "                          <div>`n`n                          <div style={{ borderRadius: 14, border: ""1px solid #e4e4e7"", padding: 12 }}>"
$hasOpen = ($txt -like "*$openNeedleCRLF*") -or ($txt -like "*$openNeedleLF*")
if (-not $hasOpen) { Fail "App.tsx: expected wrapper opening before Preview card not found. (Maybe already reverted?)" }

# Insert closing wrapper before the end of the conditional block, if missing.
$endCRLF = "                    </div>`r`n                  </div>`r`n                )}"
$endLF   = "                    </div>`n                  </div>`n                )}"

$endWithCloseCRLF = "                    </div>`r`n                          </div>`r`n                  </div>`r`n                )}"
$endWithCloseLF   = "                    </div>`n                          </div>`n                  </div>`n                )}"

if ($txt -like "*$endWithCloseCRLF*" -or $txt -like "*$endWithCloseLF*") {
  Ok "App.tsx: wrapper closing already present; nothing to do."
} elseif ($txt -like "*$endCRLF*") {
  $txt = $txt.Replace($endCRLF, $endWithCloseCRLF)
  Ok "App.tsx: inserted missing wrapper closing </div> (CRLF)."
} elseif ($txt -like "*$endLF*") {
  $txt = $txt.Replace($endLF, $endWithCloseLF)
  Ok "App.tsx: inserted missing wrapper closing </div> (LF)."
} else {
  Fail "App.tsx: could not find end-of-block anchor to insert wrapper closing."
}

Set-Content -Path $appPath -Value $txt -Encoding UTF8
Ok "App.tsx updated."
Ok "Done."
