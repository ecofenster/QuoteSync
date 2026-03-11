<# 
QuoteSync Hotfix (v12) — Fix EstimatePickerFeature.tsx syntax error near useImperativeHandle

Current Vite error:
  EstimatePickerFeature.tsx: Unexpected token, expected "," around useImperativeHandle(ref,...)

Cause:
There is an orphaned block in the component:
      // ignore
    }
  }
directly before useImperativeHandle, breaking parsing.

What this patch does:
- Backs up src\features\estimatePicker\EstimatePickerFeature.tsx
- Removes the orphaned "// ignore" + closing braces block (only that block)
- Does NOT restart dev server.

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

# Remove ONLY the orphaned ignore block. Keep it conservative.
$pattern = [regex]::Escape("      // ignore") + "\s*\r?\n\s*\}\s*\r?\n\s*\}\s*\r?\n"
$txt2 = [regex]::Replace($txt, $pattern, "", 1, [System.Text.RegularExpressions.RegexOptions]::Singleline)

if($txt2 -eq $txt){
  Fail "Orphaned // ignore block not found — no changes made."
}

Set-Content -Path $path -Value $txt2 -Encoding UTF8
Ok "Removed orphaned // ignore block."
Ok "Done. (Dev server not restarted.)"
