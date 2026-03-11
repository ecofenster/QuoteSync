# QuoteSync - Phase 4E - Fix compile errors after EstimatePicker extraction
# Run from: PS C:\Github\QuoteSync\web\ps1_patches>

$ErrorActionPreference = "Stop"

function Ok($m){ Write-Host "OK: $m" -ForegroundColor Green }
function Warn($m){ Write-Host "WARN: $m" -ForegroundColor Yellow }
function Fail($m){ Write-Host "ERROR: $m" -ForegroundColor Red; throw $m }

# --- run dir / root detect ---
$runDir = (Get-Location).Path
Write-Host "Run directory: $runDir"

# Expect ...\web\ps1_patches ; web root is parent
$webRoot = Split-Path -Parent $runDir
if (-not (Test-Path (Join-Path $webRoot "package.json"))) {
  Fail "Detected web root invalid (package.json not found). Are you running from C:\Github\QuoteSync\web\ps1_patches ?"
}
Ok "Detected web root: $webRoot"

# --- backup folder ---
$stamp = (Get-Date).ToString("yyyyMMdd_HHmmss")
$backupDir = Join-Path $webRoot "_backups\$stamp"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
Ok "Backup folder: $backupDir"

function Backup-File($absPath, $label){
  if (-not (Test-Path $absPath)) { Fail "Missing file: $absPath" }
  $safe = ($label -replace "[^A-Za-z0-9_.-]","_")
  $dest = Join-Path $backupDir $safe
  Copy-Item -Force $absPath $dest
  Ok "Backed up $label -> $dest"
}

function Read-Text($absPath){
  return [System.IO.File]::ReadAllText($absPath, [System.Text.Encoding]::UTF8)
}
function Write-Text($absPath, $txt){
  [System.IO.File]::WriteAllText($absPath, $txt, [System.Text.Encoding]::UTF8)
}

function Ensure-Contains($txt, $needle, $label){
  if ($txt -notmatch [regex]::Escape($needle)) {
    Fail "${label} missing expected text: $needle"
  }
}

function Replace-OnceLiteral($txt, $find, $replace, $label){
  $m = [regex]::Matches($txt, [regex]::Escape($find))
  if ($m.Count -ne 1) {
    Fail "${label}: expected 1 match, found $($m.Count). Needle: $find"
  }
  return $txt.Replace($find, $replace)
}

# ------------------------------------------------------------
# 1) Fix TS compile errors in EstimatePickerTabs.tsx
#    - H3 and Small are used with `style={...}` but their signatures don't accept props.
#    - Make them accept optional style prop (no layout changes).
# ------------------------------------------------------------
$tabsPath = Join-Path $webRoot "src\features\estimatePicker\EstimatePickerTabs.tsx"
Backup-File $tabsPath "src_features_estimatePicker_EstimatePickerTabs.tsx"
$tabs = Read-Text $tabsPath

Ensure-Contains $tabs "function Small(" "EstimatePickerTabs.tsx"
Ensure-Contains $tabs "function H3(" "EstimatePickerTabs.tsx"

$tabs = Replace-OnceLiteral $tabs `
'function Small({ children }: { children: React.ReactNode }) {' `
'function Small({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {' `
"EstimatePickerTabs.tsx Small signature"

$tabs = Replace-OnceLiteral $tabs `
'  return <div style={{ fontSize: 12, color: "#71717a" }}>{children}</div>;' `
'  return <div style={{ fontSize: 12, color: "#71717a", ...(style ?? {}) }}>{children}</div>;' `
"EstimatePickerTabs.tsx Small style merge"

$tabs = Replace-OnceLiteral $tabs `
'function H3({ children }: { children: React.ReactNode }) {' `
'function H3({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {' `
"EstimatePickerTabs.tsx H3 signature"

$tabs = Replace-OnceLiteral $tabs `
'  return <h3 style={{ fontSize: 14, margin: 0, fontWeight: 800, color: "#18181b" }}>{children}</h3>;' `
'  return <h3 style={{ fontSize: 14, margin: 0, fontWeight: 800, color: "#18181b", ...(style ?? {}) }}>{children}</h3>;' `
"EstimatePickerTabs.tsx H3 style merge"

Write-Text $tabsPath $tabs
Ok "Patched: src\\features\\estimatePicker\\EstimatePickerTabs.tsx (H3/Small accept style)"

# ------------------------------------------------------------
# 2) Fix missing type imports in App.tsx if present
#    - App.tsx uses Client/Estimate/Position/EstimateDefaults/ClientType without importing them.
#    - Add a type-only import next to Models import (safe).
# ------------------------------------------------------------
$appPath = Join-Path $webRoot "src\App.tsx"
Backup-File $appPath "src_App.tsx"
$app = Read-Text $appPath

# If it already has the type import, do nothing
if ($app -match 'import\s+type\s+\{[^}]*\bClient\b') {
  Ok "App.tsx already has type imports for Client/etc. Skipping import patch."
} else {
  # Find the Models import line to insert after
  $modelsImport = 'import * as Models from "./models/types";'
  $m = [regex]::Matches($app, [regex]::Escape($modelsImport))
  if ($m.Count -ne 1) {
    Warn "App.tsx: Could not uniquely find Models import. Skipping type import insert."
  } else {
    $insert = $modelsImport + "`r`n" + 'import type { Client, Estimate, Position, EstimateDefaults, ClientType } from "./models/types";'
    $app = Replace-OnceLiteral $app $modelsImport $insert "App.tsx insert type imports"
    Write-Text $appPath $app
    Ok "Patched: src\\App.tsx (added type-only imports for Client/Estimate/Position/EstimateDefaults/ClientType)"
  }
}

Ok "DONE: Phase 4E compile-error fixes applied."
Ok "Next: run npm run dev from: PS C:\Github\QuoteSync\web"
Write-Host "Backup location: $backupDir"