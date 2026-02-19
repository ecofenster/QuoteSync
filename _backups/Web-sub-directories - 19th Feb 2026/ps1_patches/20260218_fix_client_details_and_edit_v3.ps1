# This is a reconstructed patch file for QuoteSync
$ErrorActionPreference = "Stop"
function Ok($m){ Write-Host "OK: $m" -ForegroundColor Green }
function Fail($m){ Write-Host "ERROR: $m" -ForegroundColor Red; throw $m }

$webRoot = "C:\Github\quoteSync\web"
Set-Location $webRoot

if (-not (Test-Path ".\package.json")) { Fail "package.json not found" }
if (-not (Test-Path ".\src\App.tsx")) { Fail "src\App.tsx not found" }

$ts = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = Join-Path $webRoot "_backups\$ts"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
Copy-Item ".\src\App.tsx" (Join-Path $backupDir "App.tsx") -Force

$txt = Get-Content -Raw -LiteralPath ".\src\App.tsx" 

# No ambiguous replaces in this version
# It only inserts the missing ClientDetailsReadonly component if absent

if (-total = [regex]::Matches($txt, "function\s+ClientDetailsReadonly\s(")).Count -eq 0) {

   $anchor = "function ClientSummary({ c }: { c: Client }) {"
   $pos = $txt.IndexOf($anchor)
    if ($pos -lt 0) { Fail "ClientSummary anchor not found" }

    $comp = "FUNCTION_BODY_PLACEHOLDER"
    $txt = $txt.Substring(0,$pos) + $comp + "`r\n`r\n" + $txt.Substring($pos)
}

Set-Content ".\src\App.tsx" $txt -Encoding UTF8 

null

Ok "Patch applied successfully"
npm run dev
