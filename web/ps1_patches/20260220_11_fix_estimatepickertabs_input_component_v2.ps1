# =====================================================================
# QuoteSync — Hotfix: Add local Input primitive back into EstimatePickerTabs
# Fixes runtime error: "Input is not defined"
# Script: 20260220_11_fix_estimatepickertabs_input_component_v2.ps1
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

$tabsPath = Join-Path $root "src\features\estimatePicker\EstimatePickerTabs.tsx"
Backup-File $root $tabsPath $backupRoot

$txt = Get-Text $tabsPath

# Preconditions (do NOT require unique match; just require presence)
if ($txt -notmatch "<Input\b") { Fail "Precondition failed: No '<Input' usage found in EstimatePickerTabs.tsx" }

# Ensure we haven't already added it
Ensure-NotPresent "EstimatePickerTabs.tsx already defines Input (function)" $txt "function\s+Input\s*\("
Ensure-NotPresent "EstimatePickerTabs.tsx already defines Input (const)" $txt "const\s+Input\s*="

# Anchor: insert local Input primitive just before Pill
Ensure-Once "EstimatePickerTabs.tsx anchor function Pill" $txt "function Pill\("

$insertion = @"
function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { style, disabled, ...rest } = props;

  // Minimal local primitive; matches existing file's inline styling approach.
  const base: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid #e4e4e7",
    background: disabled ? "#f4f4f5" : "#ffffff",
    color: "#111827",
    fontSize: 14,
    outline: "none",
  };

  return <input {...rest} disabled={disabled} style={{ ...base, ...(style as any) }} />;
}

function Pill(
"@

Replace-Once "EstimatePickerTabs.tsx insert Input primitive" ([ref]$txt) "function Pill\(" $insertion

Set-Text $tabsPath $txt
Ok "Patched: src\features\estimatePicker\EstimatePickerTabs.tsx"
Ok "Done. Re-run: npm run dev"
