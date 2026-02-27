# =====================================================================
# QuoteSync — Phase 4C (v2): Extract Default Clients seed data from App.tsx
# Script: 20260227_05_phase4c_extract_default_clients_v2.ps1
# Run from: PS C:\Github\QuoteSync\web\ps1_patches>
#
# Robust match: does NOT assume DEFAULT_CUSTOMER_ADDRESS uses .join("\n")
# Captures:
#   const DEFAULT_CUSTOMER_ADDRESS = ...;
#   function makeDefaultClients(...): ... { ... }
# up to the closing brace of makeDefaultClients.
#
# Creates:
#   src\features\clients\defaultClients.ts
#
# Updates:
#   src\App.tsx (remove block, add import, update first makeDefaultClients() call)
# =====================================================================

$ErrorActionPreference = "Stop"

function Ok($m){ Write-Host "OK: $m" -ForegroundColor Green }
function Info($m){ Write-Host "INFO: $m" -ForegroundColor Cyan }
function Warn($m){ Write-Host "WARN: $m" -ForegroundColor Yellow }
function Fail($m){ Write-Host "ERROR: $m" -ForegroundColor Red; throw $m }

function Get-Text([string]$path){
  if (!(Test-Path $path)) { Fail "Missing file: $path" }
  return [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
}
function Set-Text([string]$path, [string]$text){
  $dir = Split-Path -Parent $path
  if (!(Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  [System.IO.File]::WriteAllText($path, $text, [System.Text.Encoding]::UTF8)
}
function Backup-File([string]$root, [string]$absPath, [string]$backupRoot){
  if (!(Test-Path $absPath)) { Fail "Cannot backup missing file: $absPath" }
  $rel = (Resolve-Path $absPath).Path.Substring((Resolve-Path $root).Path.Length).TrimStart('\')
  $dest = Join-Path $backupRoot $rel
  $destDir = Split-Path -Parent $dest
  if (!(Test-Path $destDir)) { New-Item -ItemType Directory -Force -Path $destDir | Out-Null }
  Copy-Item -Force $absPath $dest
  Ok "Backed up $rel -> $dest"
}
function Ensure-NotPresent([string]$name, [string]$text, [string]$needle){
  if ($text -match [regex]::Escape($needle)) { Fail "Refusing to re-apply (already present): $name contains '$needle'" }
}
function Find-Context([string]$text, [string]$needle, [int]$lines=18){
  $arr = $text -split "`r?`n"
  $idx = -1
  for ($i=0; $i -lt $arr.Length; $i++){
    if ($arr[$i] -like "*$needle*") { $idx = $i; break }
  }
  if ($idx -lt 0) { return @() }
  $start = [Math]::Max(0, $idx - $lines)
  $end = [Math]::Min($arr.Length-1, $idx + $lines)
  $out = @()
  for ($j=$start; $j -le $end; $j++){
    $out += ("{0,5}: {1}" -f ($j+1), $arr[$j])
  }
  return $out
}

# --- Resolve project root (web) from ps1_patches ---
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Resolve-Path (Join-Path $scriptDir "..")  # ...\web
Set-Location $root
Info "Run directory: $root"

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupRoot = Join-Path $root "_backups\$timestamp"
New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null
Ok "Backup folder: $backupRoot"

$appPath = Join-Path $root "src\App.tsx"
$targetPath = Join-Path $root "src\features\clients\defaultClients.ts"

Backup-File $root $appPath $backupRoot
if (Test-Path $targetPath) { Fail "Refusing to overwrite existing file: src\features\clients\defaultClients.ts" }

$appTxt = Get-Text $appPath
Ensure-NotPresent "App.tsx" $appTxt "./features/clients/defaultClients"

# Robust block:
# - DEFAULT_CUSTOMER_ADDRESS: any single statement ending with semicolon
# - then function makeDefaultClients ... until its matching closing brace
$blockPattern = '(?s)const\s+DEFAULT_CUSTOMER_ADDRESS\s*=\s*[\s\S]*?;\s*\r?\n\s*\r?\nfunction\s+makeDefaultClients\s*\(\)\s*:\s*[\s\S]*?\r?\n\}\s*\r?\n'
$rx = [regex]::new($blockPattern, [System.Text.RegularExpressions.RegexOptions]::Multiline)
$matches = $rx.Matches($appTxt)

if ($matches.Count -ne 1) {
  Warn "Could not match default clients block uniquely (expected 1, got $($matches.Count))."
  Warn "Diagnostics: context for 'DEFAULT_CUSTOMER_ADDRESS' and 'function makeDefaultClients'."
  $c1 = Find-Context $appTxt "DEFAULT_CUSTOMER_ADDRESS" 30
  if ($c1.Count -gt 0) { $c1 | ForEach-Object { Write-Host $_ } } else { Warn "No DEFAULT_CUSTOMER_ADDRESS found." }
  Write-Host ""
  $c2 = Find-Context $appTxt "function makeDefaultClients" 30
  if ($c2.Count -gt 0) { $c2 | ForEach-Object { Write-Host $_ } } else { Warn "No function makeDefaultClients found." }
  Fail "Ambiguous (expected 1 match, got $($matches.Count)): App.tsx default clients block"
}

$block = $matches[0].Value

# Transform: export const DEFAULT_CUSTOMER_ADDRESS
$blockOut = $block -replace '(?m)^const\s+DEFAULT_CUSTOMER_ADDRESS\s*=', 'export const DEFAULT_CUSTOMER_ADDRESS ='

# Transform: makeDefaultClients signature to accept helpers (no logic change)
# Capture return type from App.tsx (Client[] or Array<Client> etc) and keep it.
$blockOut = [regex]::Replace(
  $blockOut,
  '(?m)^function\s+makeDefaultClients\s*\(\)\s*:\s*([^\r\n]+)\s*\{',
  'export function makeDefaultClients(opts: { uid: () => string; nextClientRef: (n: number) => string }): $1 {' ,
  1
)

# Replace uid()/nextClientRef() calls
$blockOut = $blockOut -replace '\bnextClientRef\(', 'opts.nextClientRef('
$blockOut = $blockOut -replace '\buid\(\)', 'opts.uid()'

$header = @"
// Auto-generated by QuoteSync Phase 4C extraction patch.
// Seed/demo clients moved out of src/App.tsx (no logic changes).
import * as Models from "../../models/types";
import type { Client } from "../../models/types";

"@

Set-Text $targetPath ($header + $blockOut.TrimStart("`r","`n") + "`r`n")
Ok "Created: src\features\clients\defaultClients.ts"

# Remove block from App.tsx
$appTxt2 = $rx.Replace($appTxt, "`r`n", 1)

# Insert import (after DefaultsEditor import if present, else after EstimatePickerTabs)
$inserted = $false
$impAfterDefaultsEditor = [regex]::new('(?m)^import DefaultsEditor from "\./features/estimateDefaults/DefaultsEditor";\r?\n')
$m1 = $impAfterDefaultsEditor.Matches($appTxt2)
if ($m1.Count -eq 1) {
  $appTxt2 = $impAfterDefaultsEditor.Replace($appTxt2, $m1[0].Value + 'import { DEFAULT_CUSTOMER_ADDRESS, makeDefaultClients } from "./features/clients/defaultClients";' + "`r`n", 1)
  $inserted = $true
}

if (-not $inserted) {
  $impAfterPicker = [regex]::new('(?m)^import EstimatePickerTabs from "\./features/estimatePicker/EstimatePickerTabs";\r?\n')
  $m2 = $impAfterPicker.Matches($appTxt2)
  if ($m2.Count -ne 1) { Fail "Ambiguous: could not find single EstimatePickerTabs import to insert defaultClients import." }
  $appTxt2 = $impAfterPicker.Replace($appTxt2, $m2[0].Value + 'import { DEFAULT_CUSTOMER_ADDRESS, makeDefaultClients } from "./features/clients/defaultClients";' + "`r`n", 1)
}

# Update first call site: makeDefaultClients()
$callRx = [regex]::new('(?m)\bmakeDefaultClients\(\)')
$callMatches = $callRx.Matches($appTxt2)
if ($callMatches.Count -lt 1) { Fail "Expected at least 1 makeDefaultClients() call in App.tsx after extraction." }
$appTxt2 = $callRx.Replace($appTxt2, 'makeDefaultClients({ uid, nextClientRef })', 1)
Ok "Updated App.tsx call: makeDefaultClients({ uid, nextClientRef })"

Set-Text $appPath $appTxt2
Ok "Patched: src\App.tsx"

Ok "Phase 4C complete: default clients seed extracted."
Info "Next: npm run dev"
