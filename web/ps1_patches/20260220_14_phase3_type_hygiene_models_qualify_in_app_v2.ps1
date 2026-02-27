# =====================================================================
# QuoteSync — Phase 3.5 (v2): Type Hygiene (qualify central unions/enums via Models.*)
# Script: 20260220_14_phase3_type_hygiene_models_qualify_in_app_v2.ps1
# Run from: PS C:\Github\QuoteSync\web\ps1_patches>
#
# Fixes v1 "Expected at least 1 match" by making some patterns optional.
# No UI/layout/logic changes (type-only).
# Auto-backup touched files and fail fast on critical anchors only.
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
  [System.IO.File]::WriteAllText($path, $text, [System.Text.Encoding]::UTF8)
}
function Ensure-Once([string]$name, [string]$text, [string]$pattern){
  $rx = [regex]::new($pattern, [System.Text.RegularExpressions.RegexOptions]::Multiline)
  $m = $rx.Matches($text)
  if ($m.Count -ne 1) { Fail "Ambiguous (expected 1 match, got $($m.Count)): $name" }
}
function Ensure-Present([string]$name, [string]$text, [string]$pattern){
  $rx = [regex]::new($pattern, [System.Text.RegularExpressions.RegexOptions]::Multiline)
  if (-not $rx.IsMatch($text)) { Fail "Precondition failed: $name" }
}
function Replace-IfAny([string]$name, [ref]$textRef, [string]$pattern, [string]$replacement){
  $rx = [regex]::new($pattern, [System.Text.RegularExpressions.RegexOptions]::Multiline)
  $m = $rx.Matches($textRef.Value)
  if ($m.Count -eq 0) { Info "$name (skipped; 0 matches)"; return }
  $textRef.Value = $rx.Replace($textRef.Value, $replacement)
  Ok "$name (replaced $($m.Count))"
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
Backup-File $root $appPath $backupRoot

$txt = Get-Text $appPath

# Critical anchor: runtime Models namespace import must exist exactly once
Ensure-Once "App.tsx Models runtime import" $txt 'import \* as Models from "\.\/models\/types";'

# ProductType (type positions only)
Replace-IfAny "App.tsx qualify ': ProductType'"   ([ref]$txt) ':\s*ProductType\b' ': Models.ProductType'
Replace-IfAny "App.tsx qualify ': ProductType[]'" ([ref]$txt) ':\s*ProductType\[\]' ': Models.ProductType[]'
Replace-IfAny "App.tsx qualify '<ProductType>'"   ([ref]$txt) '<\s*ProductType\s*>' '<Models.ProductType>'
Replace-IfAny "App.tsx qualify '<ProductType,'"   ([ref]$txt) '<\s*ProductType\s*,' '<Models.ProductType,'
Replace-IfAny "App.tsx qualify 'as ProductType'"  ([ref]$txt) '\bas\s+ProductType\b' 'as Models.ProductType'
Replace-IfAny "App.tsx qualify 'Record<ProductType,'" ([ref]$txt) 'Record<\s*ProductType\s*,' 'Record<Models.ProductType,'

# View
Replace-IfAny "App.tsx qualify '<View>'"  ([ref]$txt) '<\s*View\s*>' '<Models.View>'
Replace-IfAny "App.tsx qualify ': View'"  ([ref]$txt) ':\s*View\b' ': Models.View'
Replace-IfAny "App.tsx qualify 'as View'" ([ref]$txt) '\bas\s+View\b' 'as Models.View'
Replace-IfAny "App.tsx qualify 'Record<View,'" ([ref]$txt) 'Record<\s*View\s*,' 'Record<Models.View,'

# MenuKey
Replace-IfAny "App.tsx qualify '<MenuKey>'"  ([ref]$txt) '<\s*MenuKey\s*>' '<Models.MenuKey>'
Replace-IfAny "App.tsx qualify ': MenuKey'"  ([ref]$txt) ':\s*MenuKey\b' ': Models.MenuKey'
Replace-IfAny "App.tsx qualify 'as MenuKey'" ([ref]$txt) '\bas\s+MenuKey\b' 'as Models.MenuKey'
Replace-IfAny "App.tsx qualify 'Record<MenuKey,'" ([ref]$txt) 'Record<\s*MenuKey\s*,' 'Record<Models.MenuKey,'

Set-Text $appPath $txt
Ok "Patched: src\App.tsx"
Ok "Phase 3.5 type hygiene complete (no UI/logic changes)."
Info "Next: npm run dev"
