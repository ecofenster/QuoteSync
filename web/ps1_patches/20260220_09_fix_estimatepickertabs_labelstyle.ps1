# =====================================================================
# QuoteSync — Hotfix: Define labelStyle in EstimatePickerTabs (fix runtime error)
# Script: 20260220_09_fix_estimatepickertabs_labelstyle.ps1
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
function Ensure-NotPresent([string]$name, [string]$text, [string]$pattern){
  $rx = [regex]::new($pattern, [System.Text.RegularExpressions.RegexOptions]::Multiline)
  if ($rx.IsMatch($text)) { Fail "Refusing to re-apply (already present): $name" }
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

$tabsPath  = Join-Path $root "src\features\estimatePicker\EstimatePickerTabs.tsx"
Backup-File $root $tabsPath $backupRoot

$txt = Get-Text $tabsPath

# Ensure we haven't already added it
Ensure-NotPresent "EstimatePickerTabs.tsx labelStyle const exists" $txt "const\s+labelStyle\s*="

# Anchor: insert just before ClientDetailsReadonly()
Ensure-Once "EstimatePickerTabs.tsx anchor ClientDetailsReadonly" $txt "function ClientDetailsReadonly\("

$insert = @"
const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#3f3f46",
  marginBottom: 6,
};

function ClientDetailsReadonly(
"@

Replace-Once "EstimatePickerTabs.tsx insert labelStyle" ([ref]$txt) "function ClientDetailsReadonly\(" $insert

Set-Text $tabsPath $txt
Ok "Patched: src\features\estimatePicker\EstimatePickerTabs.tsx"
Ok "Done. Re-run: npm run dev"
