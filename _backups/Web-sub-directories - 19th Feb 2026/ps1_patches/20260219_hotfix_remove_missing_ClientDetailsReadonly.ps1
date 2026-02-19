$ErrorActionPreference="Stop"
function Ok($m){Write-Host "OK: $m" -ForegroundColor Green}
function Fail($m){Write-Host "ERROR: $m" -ForegroundColor Red; throw $m}

$web="C:\Github\QuoteSync\web"
Set-Location $web
Write-Host "Run directory:" (Get-Location).Path

if(!(Test-Path ".\package.json")){Fail "package.json not found in $web"}
if(!(Test-Path ".\src\App.tsx")){Fail "src\App.tsx not found in $web"}

$ts=Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir=Join-Path $web "_backups\$ts"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
Copy-Item -Force ".\src\App.tsx" (Join-Path $backupDir "App.tsx")
Ok "Backed up src\App.tsx -> $backupDir\App.tsx"

$path=".\src\App.tsx"
$txt=Get-Content -Raw -LiteralPath $path

# If ClientDetailsReadonly is referenced but not defined, revert picker render to ClientSummary to stop white-screen crash
$hasRef = $txt -match "<ClientDetailsReadonly\b"
$hasDef = $txt -match "function\s+ClientDetailsReadonly\s*\("
if($hasRef -and -not $hasDef){
  $txt = $txt.Replace(
    "                  <ClientDetailsReadonly c={pickerClient} onEdit={() => openEditClientPanel(pickerClient)} />",
    "                  <ClientSummary c={pickerClient} />"
  )
  # also handle any variant without onEdit (just in case)
  $txt = $txt -replace "(\s*)<ClientDetailsReadonly\s+c=\{pickerClient\}[^>]*/>", '$1<ClientSummary c={pickerClient} />'
  Ok "Reverted picker to ClientSummary (ClientDetailsReadonly missing caused crash)"
}else{
  Ok "No action needed (either no reference, or component definition exists)"
}

Set-Content -LiteralPath $path -Value $txt -Encoding UTF8
Ok "Patched src\App.tsx"

Ok "Starting dev server..."
npm run dev
