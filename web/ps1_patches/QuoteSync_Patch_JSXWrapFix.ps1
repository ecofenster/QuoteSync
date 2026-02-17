# QuoteSync - JSX wrap fix for App.tsx (StageA3 patch follow-up)
# Run from: PS C:\Github\QuoteSync\web\ps1_patches>
# Fixes: [plugin:vite:react-babel] Adjacent JSX elements must be wrapped (src\App.tsx around Preview/Summary + Nav buttons)

$ErrorActionPreference = "Stop"

function Ok($m){ Write-Host "OK: $m" -ForegroundColor Green }
function Fail($m){ Write-Host "ERROR: $m" -ForegroundColor Red; throw $m }

$runFrom = (Get-Location).Path
Write-Host "Run directory: $runFrom"

# If launched from ps1_patches, hop to web root
if ($runFrom -like "*\ps1_patches") { Set-Location (Resolve-Path "..").Path }
$webRoot = (Get-Location).Path

if (-not (Test-Path (Join-Path $webRoot "src\App.tsx"))) {
  Fail "Expected src\App.tsx under $webRoot. Run from: PS C:\Github\QuoteSync\web\ps1_patches>"
}

$backupDir = Join-Path $webRoot "_backups"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

$ts = Get-Date -Format "yyyyMMdd_HHmmss"
$appPath = Join-Path $webRoot "src\App.tsx"
$bak = Join-Path $backupDir ("App.tsx.$ts.bak")
Copy-Item $appPath $bak -Force
Ok "Backup written: $bak"

$txt = Get-Content $appPath -Raw

# Insert wrapper <div> before the Preview card
$needle1 = '                          <div style={{ borderRadius: 14, border: "1px solid #e4e4e7", padding: 12 }}>'
if ($txt -notmatch [regex]::Escape($needle1)) { Fail "App.tsx: expected Preview card block not found (anchor missing)." }

$already1 = '                          <div>' + "`r`n`r`n" + $needle1
if ($txt -match [regex]::Escape($already1)) {
  Ok "App.tsx: wrapper before Preview already present; skipping."
} else {
  $txt = $txt -replace [regex]::Escape($needle1), ("                          <div>`r`n`r`n" + $needle1)
  Ok "App.tsx: inserted wrapper <div> before Preview card."
}

# Close wrapper after nav button row
$pattern2 = [regex]::Escape("                    </div>") + "\r?\n" + [regex]::Escape("                  </div>") + "\r?\n" + [regex]::Escape("                )}")
if ($txt -notmatch $pattern2) { Fail "App.tsx: could not find expected end-of-section anchor to close wrapper." }

$pattern2Already = [regex]::Escape("                    </div>") + "\r?\n" + [regex]::Escape("                          </div>") + "\r?\n" + [regex]::Escape("                  </div>") + "\r?\n" + [regex]::Escape("                )}")
if ($txt -match $pattern2Already) {
  Ok "App.tsx: wrapper closing already present; skipping."
} else {
  $replacement2 = "                    </div>`r`n                          </div>`r`n                  </div>`r`n                )}"
  $txt = [regex]::Replace($txt, $pattern2, $replacement2, 1)
  Ok "App.tsx: inserted wrapper closing </div> after nav buttons."
}

Set-Content -Path $appPath -Value $txt -Encoding UTF8
Ok "App.tsx updated."

Ok "Done."
