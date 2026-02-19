# ============================================================
# QuoteSync - RESTORE src\App.tsx to a chosen backup stamp
#
# Use this when patches have left App.tsx in a messy partial state.
#
# MUST run from:
#   PS C:\Github\QuoteSync\web\ps1_patches>
#
# What it does:
#  - Set-Location -> C:\Github\QuoteSync\web
#  - Verifies package.json and src\App.tsx
#  - Creates a NEW timestamped backup of current App.tsx first
#  - Restores src\App.tsx from _backups\<BackupStamp>\App.tsx
#  - Shows the most recent backup stamps that contain App.tsx
#  - DOES NOT run npm run dev
#
# Usage:
#   pwsh -NoProfile -ExecutionPolicy Bypass -File .\QS_Restore_AppTsx_ToSavePoint.ps1
#   pwsh -NoProfile -ExecutionPolicy Bypass -File .\QS_Restore_AppTsx_ToSavePoint.ps1 -BackupStamp 20260219_141921
# ============================================================

param(
  [Parameter(Mandatory=$false)]
  [string]$BackupStamp = "20260219_141921"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Ok($m){ Write-Host "OK: $m" -ForegroundColor Green }
function Info($m){ Write-Host "INFO: $m" -ForegroundColor Cyan }
function Warn($m){ Write-Host "WARN: $m" -ForegroundColor Yellow }
function Fail($m){ Write-Host "ERROR: $m" -ForegroundColor Red; throw $m }

function New-BackupFolder([string]$RepoRoot){
  $stamp = Get-Date -Format "yyyyMMdd_HHmmss"
  $bdir = Join-Path $RepoRoot "_backups"
  if (-not (Test-Path $bdir)) { New-Item -ItemType Directory -Path $bdir | Out-Null }
  $dest = Join-Path $bdir $stamp
  New-Item -ItemType Directory -Path $dest | Out-Null
  return $dest
}

try {
  $runDir = (Get-Location).Path
  Write-Host ("RUN DIR: " + $runDir) -ForegroundColor Yellow

  $repoRoot = "C:\Github\QuoteSync\web"
  if (-not (Test-Path $repoRoot)) { Fail "Repo root not found: $repoRoot" }
  Set-Location $repoRoot
  Ok "Set-Location -> $repoRoot"

  $pkg = Join-Path $repoRoot "package.json"
  $app = Join-Path $repoRoot "src\App.tsx"
  if (-not (Test-Path $pkg)) { Fail "Missing package.json at $pkg" }
  if (-not (Test-Path $app)) { Fail "Missing src\App.tsx at $app" }
  Ok "Verified package.json and src\App.tsx exist"

  $backupsDir = Join-Path $repoRoot "_backups"
  if (-not (Test-Path $backupsDir)) { Fail "Missing _backups folder at $backupsDir" }

  # Show recent stamps containing App.tsx
  Info "Recent backup stamps containing App.tsx:"
  $recent = Get-ChildItem -LiteralPath $backupsDir -Directory |
    Sort-Object Name -Descending |
    ForEach-Object {
      $f = Join-Path $_.FullName "App.tsx"
      if (Test-Path $f) { $_.Name }
    } | Select-Object -First 12

  if (-not $recent -or $recent.Count -eq 0) {
    Fail "No backups with App.tsx found under $backupsDir"
  }

  $recent | ForEach-Object { Write-Host ("  - " + $_) -ForegroundColor DarkGray }

  $sourceFolder = Join-Path $backupsDir $BackupStamp
  $sourceFile = Join-Path $sourceFolder "App.tsx"
  if (-not (Test-Path $sourceFile)) {
    Fail "Requested backup not found: $sourceFile"
  }

  # Backup current App.tsx before restore
  $pre = New-BackupFolder $repoRoot
  Copy-Item -LiteralPath $app -Destination (Join-Path $pre "App.tsx") -Force
  Ok "Backed up CURRENT App.tsx -> $pre\App.tsx"

  Copy-Item -LiteralPath $sourceFile -Destination $app -Force
  Ok "Restored src\App.tsx from -> $sourceFile"

  Info "NOTE: npm run dev was NOT executed."
  Ok "DONE"
}
catch {
  Fail $_.Exception.Message
}
