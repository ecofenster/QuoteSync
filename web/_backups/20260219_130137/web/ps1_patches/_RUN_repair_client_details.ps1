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

$txt=Get-Content -Raw -LiteralPath ".\src\App.tsx"

function Replace-Once([string]$h,[string]$f,[string]$r,[string]$label){
  $i=$h.IndexOf($f); if($i -lt 0){Fail "Not found: $label"}
  $j=$h.IndexOf($f,$i+$f.Length); if($j -ge 0){Fail "Ambiguous: $label"}
  return $h.Substring(0,$i)+$r+$h.Substring($i+$f.Length)
}

# --- DEDUPE: keep first ClientDetailsReadonly, remove any additional ones (up to ClientSummary)
$clientSummaryAnchor="function ClientSummary({ c }: { c: Client }) {"
$csPos=$txt.IndexOf($clientSummaryAnchor)
if($csPos -lt 0){Fail "Anchor not found: ClientSummary()"}

$m=[regex]::Matches($txt,"function\s+ClientDetailsReadonly\s*\(")
if($m.Count -eq 0){Fail "ClientDetailsReadonly not found (we need it present before dedupe)"}
if($m.Count -ge 2){
  $secondStart=$m[1].Index
  if($secondStart -ge $csPos){Fail "Unexpected order: duplicate starts after ClientSummary"}
  $txt = $txt.Substring(0,$secondStart) + $txt.Substring($csPos)
  Ok "Removed duplicate ClientDetailsReadonly (kept first)"
}else{
  Ok "No duplicate ClientDetailsReadonly detected"
}

# --- Ensure picker uses ClientDetailsReadonly
$pickerFind="                  <ClientSummary c={pickerClient} />"
$pickerReplace="                  <ClientDetailsReadonly c={pickerClient} onEdit={() => openEditClientPanel(pickerClient)} />"
if($txt.IndexOf($pickerFind) -ge 0){
  $txt=Replace-Once $txt $pickerFind $pickerReplace "Picker swap ClientSummary -> ClientDetailsReadonly"
  Ok "Picker now uses ClientDetailsReadonly"
}elseif($txt -match "<ClientDetailsReadonly\s+c=\{pickerClient\}"){
  Ok "Picker already uses ClientDetailsReadonly"
}else{
  Fail "Picker render line not found (neither ClientSummary nor ClientDetailsReadonly present)"
}

# --- Sanity
$cnt=[regex]::Matches($txt,"function\s+ClientDetailsReadonly\s*\(").Count
if($cnt -ne 1){Fail "Sanity failed: expected 1 ClientDetailsReadonly, found $cnt"}

Set-Content -LiteralPath ".\src\App.tsx" -Value $txt -Encoding UTF8
Ok "Wrote src\App.tsx"

Ok "Starting dev server..."
npm run dev