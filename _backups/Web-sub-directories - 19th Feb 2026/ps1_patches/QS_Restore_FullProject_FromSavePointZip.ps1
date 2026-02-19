# ============================================================
# QuoteSync - FULL PROJECT RESTORE from save-point ZIP
#
# Save-point ZIP (as provided by user):
#   C:\Github\QuoteSync\web\_backups\20260219_130137_full_project.zip
#
# MUST run from:
#   PS C:\Github\QuoteSync\web\ps1_patches>
#
# What this does:
#  1) Set-Location -> C:\Github\QuoteSync\web
#  2) Creates timestamped safety backup ZIP of CURRENT project (excluding node_modules/dist/.git/_backups)
#  3) Extracts save-point ZIP to a temp folder under _backups
#  4) Restores project files into C:\Github\QuoteSync\web
#     - Preserves existing: _backups\ and ps1_patches\
#  5) Verifies package.json + src\App.tsx after restore
#  6) DOES NOT run npm run dev
#
# ============================================================

param(
  [Parameter(Mandatory=$false)]
  [string]$SaveZip = "C:\Github\QuoteSync\web\_backups\20260219_130137_full_project.zip"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Ok($m){ Write-Host "OK: $m" -ForegroundColor Green }
function Info($m){ Write-Host "INFO: $m" -ForegroundColor Cyan }
function Warn($m){ Write-Host "WARN: $m" -ForegroundColor Yellow }
function Fail($m){ Write-Host "ERROR: $m" -ForegroundColor Red; throw $m }

function New-Stamp { return (Get-Date -Format "yyyyMMdd_HHmmss") }

function Ensure-Dir([string]$p){
  if (-not (Test-Path $p)) { New-Item -ItemType Directory -Path $p | Out-Null }
}

function Safe-RemoveItem([string]$path){
  if (Test-Path $path) {
    Remove-Item -LiteralPath $path -Recurse -Force
  }
}

try {
  $runDir = (Get-Location).Path
  Write-Host ("RUN DIR: " + $runDir) -ForegroundColor Yellow

  $repoRoot = "C:\Github\QuoteSync\web"
  if (-not (Test-Path $repoRoot)) { Fail "Repo root not found: $repoRoot" }
  Set-Location $repoRoot
  Ok "Set-Location -> $repoRoot"

  if (-not (Test-Path $SaveZip)) { Fail "Save-point ZIP not found: $SaveZip" }
  Ok "Found save-point ZIP: $SaveZip"

  $backupsDir = Join-Path $repoRoot "_backups"
  Ensure-Dir $backupsDir

  # ------------------------------------------------------------
  # 1) Safety backup of CURRENT project (zip)
  # ------------------------------------------------------------
  $stamp = New-Stamp
  $safetyZip = Join-Path $backupsDir ($stamp + "_pre_restore_current_web.zip")

  Info "Creating safety backup ZIP (excluding node_modules/dist/.git/_backups)..."
  $exclude = @("node_modules", "dist", ".git", "_backups")
  $items = Get-ChildItem -LiteralPath $repoRoot -Force | Where-Object {
    $exclude -notcontains $_.Name
  } | Select-Object -ExpandProperty FullName

  if (-not $items -or $items.Count -eq 0) { Fail "Nothing to back up (unexpected)."}
  if (Test-Path $safetyZip) { Safe-RemoveItem $safetyZip }

  Compress-Archive -Path $items -DestinationPath $safetyZip -Force
  $zipSizeMB = [math]::Round(((Get-Item $safetyZip).Length / 1MB), 2)
  Ok "Safety backup created: $safetyZip ($zipSizeMB MB)"

  # ------------------------------------------------------------
  # 2) Extract save-point ZIP to temp
  # ------------------------------------------------------------
  $extractDir = Join-Path $backupsDir ($stamp + "_extract_full_project")
  Ensure-Dir $extractDir
  Info "Extracting save-point ZIP -> $extractDir"
  Expand-Archive -LiteralPath $SaveZip -DestinationPath $extractDir -Force
  Ok "Extracted save-point ZIP"

  # Some zips contain a top-level folder; detect it.
  $rootItems = Get-ChildItem -LiteralPath $extractDir -Force
  $srcRoot = $extractDir
  if ($rootItems.Count -eq 1 -and $rootItems[0].PSIsContainer) {
    $srcRoot = $rootItems[0].FullName
    Info "Detected single top-level folder in ZIP; using: $srcRoot"
  }

  # ------------------------------------------------------------
  # 3) Restore files into repoRoot, preserving _backups and ps1_patches
  # ------------------------------------------------------------
  Info "Restoring project files into $repoRoot (preserving _backups and ps1_patches)..."

  # a) Remove existing files/folders except preserved
  $preserve = @("_backups", "ps1_patches")
  Get-ChildItem -LiteralPath $repoRoot -Force | ForEach-Object {
    if ($preserve -contains $_.Name) { return }
    # Avoid deleting junctions/symlinks weirdness by removing carefully
    try {
      Remove-Item -LiteralPath $_.FullName -Recurse -Force
    } catch {
      Fail "Failed to remove: $($_.FullName) :: $($_.Exception.Message)"
    }
  }
  Ok "Cleared repo root (except _backups and ps1_patches)"

  # b) Copy from extracted srcRoot into repoRoot
  # Use robocopy for robust copy including hidden files, preserving structure
  $rcLog = Join-Path $backupsDir ($stamp + "_restore_robocopy.log")

  # Copy everything from srcRoot to repoRoot
  $cmd = @(
    "robocopy",
    "`"$srcRoot`"",
    "`"$repoRoot`"",
    "/E",
    "/COPY:DAT",
    "/R:2",
    "/W:1",
    "/NFL",
    "/NDL",
    "/NP",
    "/LOG:`"$rcLog`""
  )

  # robocopy returns codes >= 8 for failure; 0-7 are OK/with differences
  $p = Start-Process -FilePath "cmd.exe" -ArgumentList ("/c " + ($cmd -join " ")) -Wait -PassThru
  $code = $p.ExitCode
  if ($code -ge 8) {
    Fail "Robocopy failed with exit code $code. See log: $rcLog"
  }
  Ok "Files copied from save-point (robocopy exit code $code). Log: $rcLog"

  # Re-create preserve dirs if ZIP overwrote them (shouldn't, because we deleted others, but safe)
  Ensure-Dir (Join-Path $repoRoot "_backups")
  Ensure-Dir (Join-Path $repoRoot "ps1_patches")

  # ------------------------------------------------------------
  # 4) Verify key files
  # ------------------------------------------------------------
  $pkg = Join-Path $repoRoot "package.json"
  $app = Join-Path $repoRoot "src\App.tsx"
  if (-not (Test-Path $pkg)) { Fail "Restore incomplete: missing package.json" }
  if (-not (Test-Path $app)) { Fail "Restore incomplete: missing src\App.tsx" }
  Ok "Verified package.json and src\App.tsx after restore"

  Info "RESTORE COMPLETE."
  Info "NOTE: npm run dev was NOT executed."
  Ok "DONE"
}
catch {
  Fail $_.Exception.Message
}
