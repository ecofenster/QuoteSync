# ============================================================
# QuoteSync - Restore src\App.tsx from latest _backups\<stamp>\App.tsx
#
# PURPOSE:
#   Get you back to a compiling state immediately (no manual edits)
#
# MUST be executed from:
#   PS C:\Github\QuoteSync\web\ps1_patches>
#
# WHAT IT DOES:
#  - Set-Location to C:\Github\QuoteSync\web
#  - Verifies package.json
#  - Creates a NEW timestamped backup in _backups\yyyyMMdd_HHmmss (before restore)
#  - Restores src\App.tsx from the chosen backup folder (default: latest that contains App.tsx)
#  - Does NOT run npm run dev
#
# OPTIONAL:
#   pwsh ... -File .\QS_Restore_AppTsx_FromBackup.ps1 -BackupStamp 20260219_132839
# ============================================================

param(
  [Parameter(Mandatory=$false)]
  [string]$BackupStamp
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Ok($m){ Write-Host "OK: $m" -ForegroundColor Green }
function Info($m){ Write-Host "INFO: $m" -ForegroundColor Cyan }
function Fail($m){ Write-Host "ERROR: $m" -ForegroundColor Red; throw $m }

function New-BackupFolder {
  param([string]$RepoRoot)
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
  if (-not (Test-Path $pkg)) { Fail "Missing package.json at $pkg" }
  Ok "Verified package.json"

  $app = Join-Path $repoRoot "src\App.tsx"
  if (-not (Test-Path $app)) { Fail "Missing src\App.tsx at $app" }

  $backupsDir = Join-Path $repoRoot "_backups"
  if (-not (Test-Path $backupsDir)) { Fail "Missing _backups folder at $backupsDir" }

  # Backup current App.tsx before restore
  $preRestoreBackup = New-BackupFolder -RepoRoot $repoRoot
  Copy-Item -LiteralPath $app -Destination (Join-Path $preRestoreBackup "App.tsx") -Force
  Ok "Backed up current App.tsx -> $preRestoreBackup\App.tsx"

  # Choose backup source
  $sourceFolder = $null
  if ($BackupStamp -and $BackupStamp.Trim()) {
    $candidate = Join-Path $backupsDir $BackupStamp.Trim()
    if (-not (Test-Path $candidate)) { Fail "Backup stamp folder not found: $candidate" }
    $candidateFile = Join-Path $candidate "App.tsx"
    if (-not (Test-Path $candidateFile)) { Fail "Backup App.tsx not found at: $candidateFile" }
    $sourceFolder = $candidate
  } else {
    $folders = Get-ChildItem -LiteralPath $backupsDir -Directory |
      Sort-Object Name -Descending
    foreach ($f in $folders) {
      $candidateFile = Join-Path $f.FullName "App.tsx"
      if (Test-Path $candidateFile) { $sourceFolder = $f.FullName; break }
    }
    if (-not $sourceFolder) { Fail "No backup folder containing App.tsx was found under $backupsDir" }
  }

  $sourceFile = Join-Path $sourceFolder "App.tsx"
  Info "Restoring from: $sourceFile"

  Copy-Item -LiteralPath $sourceFile -Destination $app -Force
  Ok "Restored src\App.tsx"

  Info "NOTE: Per requirement, npm run dev was NOT executed."
  Ok "DONE"
}
catch {
  Fail $_.Exception.Message
}
