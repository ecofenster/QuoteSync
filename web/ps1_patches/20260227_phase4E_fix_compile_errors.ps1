# QuoteSync Phase 4E — Fix compile errors after Phase 4D extraction
# - App.tsx: ensure type imports exist (Client/Estimate/etc) so TS compiles
# - EstimatePickerTabs.tsx: allow style props on H3/Small and make pickerClient non-nullable
#
# Run from: PS C:\Github\QuoteSync\web\ps1_patches
# (script will auto-detect web root and create backups)

$ErrorActionPreference = "Stop"

function Ok($m){ Write-Host "OK: $m" -ForegroundColor Green }
function Warn($m){ Write-Host "WARN: $m" -ForegroundColor Yellow }
function Fail($m){ Write-Host "ERROR: $m" -ForegroundColor Red; throw $m }

Write-Host "Run directory: $(Get-Location)" -ForegroundColor Cyan

# --- detect web root (folder that contains package.json and src/) ---
$here = (Get-Location).Path
$webRoot = $null
$probe = $here
for ($i=0; $i -lt 8; $i++){
  if (Test-Path (Join-Path $probe "package.json") -and Test-Path (Join-Path $probe "src")) { $webRoot = $probe; break }
  $parent = Split-Path $probe -Parent
  if ($parent -eq $probe) { break }
  $probe = $parent
}
if (-not $webRoot) { Fail "Could not detect web root. Expected to find package.json + src/. Current: $here" }
Ok "Detected web root: $webRoot"

# --- backup folder ---
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = Join-Path $webRoot ("_backups\" + $stamp)
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
Ok "Backup folder: $backupDir"

function Backup-File([string]$absPath){
  if (-not (Test-Path $absPath)) { Fail "Missing file: $absPath" }
  $rel = $absPath.Substring($webRoot.Length).TrimStart("\","/")
  $safe = ($rel -replace "[\\/:\*\?""<>\|]", "_")
  $dest = Join-Path $backupDir $safe
  Copy-Item -Force $absPath $dest
  Ok "Backed up $rel -> $dest"
}

function Read-Text([string]$absPath){
  return [IO.File]::ReadAllText($absPath, [Text.Encoding]::UTF8)
}
function Write-Text([string]$absPath, [string]$content){
  [IO.File]::WriteAllText($absPath, $content, [Text.Encoding]::UTF8)
}

function Ensure-Inserted-AfterUniqueAnchor([string]$label, [string]$absPath, [string]$anchorLiteral, [string]$insertText){
  $txt = Read-Text $absPath
  $idx = $txt.IndexOf($anchorLiteral)
  if ($idx -lt 0) { Fail "$label: anchor not found: $anchorLiteral" }
  # ensure unique
  $count = ([regex]::Matches($txt, [regex]::Escape($anchorLiteral))).Count
  if ($count -ne 1) { Fail "$label: expected 1 match, found $count. Anchor: $anchorLiteral" }

  if ($txt.Contains($insertText.Trim())) {
    Warn "$label: insert already present, skipping."
    return $txt
  }

  $insertPos = $idx + $anchorLiteral.Length
  $next = $txt.Substring(0, $insertPos) + "`r`n" + $insertText + $txt.Substring($insertPos)
  Write-Text $absPath $next
  Ok "$label: inserted."
  return $next
}

function Replace-Unique([string]$label, [string]$absPath, [string]$pattern, [string]$replacement){
  $txt = Read-Text $absPath
  $m = [regex]::Matches($txt, $pattern)
  if ($m.Count -ne 1) { Fail "$label: expected 1 match, found $($m.Count). Pattern: $pattern" }
  $next = [regex]::Replace($txt, $pattern, $replacement, 1)
  Write-Text $absPath $next
  Ok "$label: replaced."
  return $next
}

# =========================
# 1) App.tsx — add missing type imports from models/types
# =========================
$app = Join-Path $webRoot "src\App.tsx"
Backup-File $app

$anchor = 'import * as Models from "./models/types";'
$insert = 'import type { Client, ClientType, Estimate, Position, EstimateDefaults } from "./models/types";'
Ensure-Inserted-AfterUniqueAnchor "App.tsx type imports" $app $anchor $insert | Out-Null

# =========================
# 2) EstimatePickerTabs.tsx — allow style props + make pickerClient non-null
# =========================
$tabs = Join-Path $webRoot "src\features\estimatePicker\EstimatePickerTabs.tsx"
Backup-File $tabs

# pickerClient: Client | null  -> Client
Replace-Unique "EstimatePickerTabs.tsx pickerClient non-null" $tabs 'pickerClient:\s*Client\s*\|\s*null;' 'pickerClient: Client;' | Out-Null

# Small({ children }) -> Small({ children, style })
# Works even if already updated (guarded by unique match count)
try {
  Replace-Unique "EstimatePickerTabs.tsx Small supports style" $tabs `
'function\s+Small\(\{\s*children\s*\}\s*:\s*\{\s*children:\s*React\.ReactNode\s*\}\s*\)\s*\{\s*return\s*<div\s+style=\{\{\s*fontSize:\s*12,\s*color:\s*"#71717a"\s*\}\}>\{children\}<\/div>;\s*\}' `
'function Small({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {\n  return <div style={{ fontSize: 12, color: "#71717a", ...(style || {}) }}>{children}</div>;\n}' | Out-Null
} catch {
  Warn "EstimatePickerTabs.tsx Small supports style: could not apply (maybe already updated)."
}

# H3({ children }) -> H3({ children, style })
try {
  Replace-Unique "EstimatePickerTabs.tsx H3 supports style" $tabs `
'function\s+H3\(\{\s*children\s*\}\s*:\s*\{\s*children:\s*React\.ReactNode\s*\}\s*\)\s*\{\s*return\s*<h3\s+style=\{\{\s*fontSize:\s*14,\s*margin:\s*0,\s*fontWeight:\s*800,\s*color:\s*"#18181b"\s*\}\}>\{children\}<\/h3>;\s*\}' `
'function H3({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {\n  return <h3 style={{ fontSize: 14, margin: 0, fontWeight: 800, color: "#18181b", ...(style || {}) }}>{children}</h3>;\n}' | Out-Null
} catch {
  Warn "EstimatePickerTabs.tsx H3 supports style: could not apply (maybe already updated)."
}

Ok "Phase 4E complete."

Write-Host ""
Write-Host "Next:" -ForegroundColor Cyan
Write-Host "  1) From: PS C:\Github\QuoteSync\web" -ForegroundColor Cyan
Write-Host "  2) Run: npm run dev" -ForegroundColor Cyan
Write-Host ""
Write-Host "Backup location: $backupDir" -ForegroundColor Yellow
