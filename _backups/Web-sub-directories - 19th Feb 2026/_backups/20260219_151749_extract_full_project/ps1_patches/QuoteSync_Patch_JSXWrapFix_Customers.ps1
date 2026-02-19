# QuoteSync - JSX fix (Customers/Add Client block) for App.tsx
# Run from: PS C:\Github\QuoteSync\web\ps1_patches>
# Fixes: Adjacent JSX elements must be wrapped (error around App.tsx ~1288)
# Cause: an extra stray </div> was inserted inside the "Add client" conditional block.

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

# Target the exact stray closing div sequence observed in your snippet:
#   </div>
#         </div>   <-- stray extra closing div (over-indented)
#   </div>
# )}
$needleCRLF = "                    </div>`r`n                          </div>`r`n                  </div>`r`n                )}"
$needleLF   = "                    </div>`n                          </div>`n                  </div>`n                )}"

if ($txt -like "*$needleCRLF*") {
  $txt = $txt.Replace($needleCRLF, "                    </div>`r`n                  </div>`r`n                )}")
  Ok "App.tsx: removed stray </div> (CRLF)."
} elseif ($txt -like "*$needleLF*") {
  $txt = $txt.Replace($needleLF, "                    </div>`n                  </div>`n                )}")
  Ok "App.tsx: removed stray </div> (LF)."
} else {
  Fail "App.tsx: expected stray closing-div sequence not found. No changes made."
}

Set-Content -Path $appPath -Value $txt -Encoding UTF8
Ok "App.tsx updated."
Ok "Done."
