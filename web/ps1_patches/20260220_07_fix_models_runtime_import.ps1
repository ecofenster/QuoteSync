# =====================================================================
# QuoteSync — Hotfix: Models runtime import (fix "Models is not defined")
# Script: 20260220_07_fix_models_runtime_import.ps1
# Run from: PS C:\Github\QuoteSync\web\ps1_patches>
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

$appTxt = Get-Text $appPath

# Fix: runtime namespace import (not type-only)
Ensure-Once "App.tsx has type-only Models import" $appTxt 'import type \* as Models from "\.\/models\/types";'
Replace-Once "App.tsx Models import -> runtime" ([ref]$appTxt) 'import type \* as Models from "\.\/models\/types";' 'import * as Models from "./models/types";'

Set-Text $appPath $appTxt
Ok "Patched: src\App.tsx"
Ok "Done. Re-run: npm run dev"
