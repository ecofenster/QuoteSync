# =====================================================================
# QuoteSync — Phase 4A: Extract Estimate Defaults (data + builders) from App.tsx
# Script: 20260220_16_phase4a_extract_estimate_defaults_data.ps1
# Run from: PS C:\Github\QuoteSync\web\ps1_patches>
#
# Moves ONLY estimate-default data/builders out of src\App.tsx into:
#   src\features\estimateDefaults\defaultEstimateDefaults.ts
#
# Includes:
# - HINGE_TYPES, UG_DOUBLE, UG_TRIPLE, HANDLE_TYPES, SUN_PROTECTION
# - buildCillDepthOptions(), CILL_DEPTHS, FRAME_EXTS
# - makeDefaultEstimateDefaults()
#
# Notes:
# - Does NOT move DefaultsEditor component (UI) in this step.
# - Does NOT move makeDefaultClients() in this step (depends on nextClientRef/uid).
# - No UI/layout/logic changes; only relocation + imports.
#
# Safety:
# - Auto-backup touched files to _backups\<timestamp>\
# - Fail fast if anchors ambiguous or if target file exists
# =====================================================================

$ErrorActionPreference = "Stop"

function Ok($m){ Write-Host "OK: $m" -ForegroundColor Green }
function Info($m){ Write-Host "INFO: $m" -ForegroundColor Cyan }
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
function Ensure-Once([string]$name, [string]$text, [string]$pattern){
  $rx = [regex]::new($pattern, [System.Text.RegularExpressions.RegexOptions]::Multiline)
  $m = $rx.Matches($text)
  if ($m.Count -ne 1) { Fail "Ambiguous (expected 1 match, got $($m.Count)): $name" }
}
function Replace-Once([string]$name, [ref]$textRef, [string]$pattern, [string]$replacement){
  $rx = [regex]::new($pattern, [System.Text.RegularExpressions.RegexOptions]::Multiline)
  $m = $rx.Matches($textRef.Value)
  if ($m.Count -ne 1) { Fail "Ambiguous (expected 1 match, got $($m.Count)): $name" }
  $textRef.Value = $rx.Replace($textRef.Value, $replacement, 1)
}
function Ensure-NotPresent([string]$name, [string]$text, [string]$needle){
  if ($text -match [regex]::Escape($needle)) { Fail "Refusing to re-apply (already present): $name contains '$needle'" }
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
$targetPath = Join-Path $root "src\features\estimateDefaults\defaultEstimateDefaults.ts"

Backup-File $root $appPath $backupRoot
if (Test-Path $targetPath) { Fail "Refusing to overwrite existing file: src\features\estimateDefaults\defaultEstimateDefaults.ts" }

$appTxt = Get-Text $appPath

# Guard: do not re-apply if App already imports this module
Ensure-NotPresent "App.tsx" $appTxt "./features/estimateDefaults/defaultEstimateDefaults"

# Extract exactly one contiguous block from HINGE_TYPES through end of makeDefaultEstimateDefaults(),
# stopping right before DEFAULT_CUSTOMER_ADDRESS.
$blockPattern = '(?s)\r?\nconst HINGE_TYPES:[\s\S]*?\r?\nfunction makeDefaultEstimateDefaults\(\): EstimateDefaults \{[\s\S]*?\r?\n\}\r?\n\r?\nconst DEFAULT_CUSTOMER_ADDRESS'
Ensure-Once "App.tsx estimate defaults block (HINGE_TYPES..makeDefaultEstimateDefaults)" $appTxt $blockPattern

$rx = [regex]::new($blockPattern, [System.Text.RegularExpressions.RegexOptions]::Multiline)
$m = $rx.Match($appTxt)
$full = $m.Value

# Split: keep trailing anchor (DEFAULT_CUSTOMER_ADDRESS) in App.tsx
# We'll remove everything up to just before 'const DEFAULT_CUSTOMER_ADDRESS'
$idx = $full.LastIndexOf("const DEFAULT_CUSTOMER_ADDRESS")
if ($idx -lt 0) { Fail "Internal: could not locate DEFAULT_CUSTOMER_ADDRESS anchor within extracted block." }

$toMove = $full.Substring(0, $idx).TrimStart("`r","`n")
# Ensure it contains expected items
if ($toMove -notmatch 'const HINGE_TYPES:' ) { Fail "Internal: extracted block missing HINGE_TYPES." }
if ($toMove -notmatch 'const FRAME_EXTS' ) { Fail "Internal: extracted block missing FRAME_EXTS." }
if ($toMove -notmatch 'function makeDefaultEstimateDefaults' ) { Fail "Internal: extracted block missing makeDefaultEstimateDefaults." }

# Build defaultEstimateDefaults.ts content
$header = @"
// Auto-generated by QuoteSync Phase 4A extraction patch.
// Source of truth for estimate-level defaults (data + builders).
import * as Models from "../../models/types";
import type { EstimateDefaults } from "../../models/types";
import { SUPPLIERS, WOOD_TYPES, firstProductForSupplier } from "../catalog/defaultCatalog";

"@

$body = $toMove

# Convert to exports (only those used outside file)
$body = $body -replace '(^|\r?\n)const HINGE_TYPES:', '$1export const HINGE_TYPES:'
$body = $body -replace '(^|\r?\n)const UG_DOUBLE =', '$1export const UG_DOUBLE ='
$body = $body -replace '(^|\r?\n)const UG_TRIPLE =', '$1export const UG_TRIPLE ='
$body = $body -replace '(^|\r?\n)const HANDLE_TYPES:', '$1export const HANDLE_TYPES:'
$body = $body -replace '(^|\r?\n)const SUN_PROTECTION:', '$1export const SUN_PROTECTION:'
$body = $body -replace '(^|\r?\n)function buildCillDepthOptions\(', '$1function buildCillDepthOptions('
$body = $body -replace '(^|\r?\n)const CILL_DEPTHS =', '$1export const CILL_DEPTHS ='
$body = $body -replace '(^|\r?\n)const FRAME_EXTS =', '$1export const FRAME_EXTS ='
$body = $body -replace '(^|\r?\n)function makeDefaultEstimateDefaults\(', '$1export function makeDefaultEstimateDefaults('

# Ensure productType is explicitly Models.ProductType (keeps current behaviour)
$body = $body -replace 'const productType:\s*Models\.ProductType\s*=\s*"uPVC";', '  const productType: Models.ProductType = "uPVC";'

# Write file
Set-Text $targetPath ($header + $body.TrimStart("`r","`n") + "`r`n")
Ok "Created: src\features\estimateDefaults\defaultEstimateDefaults.ts"

# Remove the moved block from App.tsx while preserving DEFAULT_CUSTOMER_ADDRESS line onward.
# Replace the entire matched region with a newline + DEFAULT_CUSTOMER_ADDRESS anchor.
Replace-Once "App.tsx remove moved estimate defaults block" ([ref]$appTxt) $blockPattern "`r`nconst DEFAULT_CUSTOMER_ADDRESS"

# Insert import into App.tsx after catalog import (must exist once)
Ensure-Once "App.tsx defaultCatalog import anchor" $appTxt 'from "\./features/catalog/defaultCatalog";'
$importInsert = @'
import {
  HINGE_TYPES,
  UG_DOUBLE,
  UG_TRIPLE,
  HANDLE_TYPES,
  SUN_PROTECTION,
  CILL_DEPTHS,
  FRAME_EXTS,
  makeDefaultEstimateDefaults,
} from "./features/estimateDefaults/defaultEstimateDefaults";

'@
Replace-Once "App.tsx insert estimate defaults import" ([ref]$appTxt) '(?m)^(import \{[\s\S]*?\}\s+from "\./features/catalog/defaultCatalog";\r?\n)' "`$1$importInsert"

Set-Text $appPath $appTxt
Ok "Patched: src\App.tsx"

Ok "Phase 4A complete: estimate defaults data/builders moved out of App.tsx."
Info "Next: npm run dev"
