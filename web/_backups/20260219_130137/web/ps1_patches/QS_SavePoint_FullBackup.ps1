# ============================================================
# QuoteSync - FULL SAVE-POINT (copy + zip) - NO DEV RUN
# MUST be executed from: PS C:\Github\QuoteSync\web\ps1_patches>
# Output ZIP: C:\Github\QuoteSync\web\_backups\yyyyMMdd_HHmmss_full_project.zip
# Also creates: C:\Github\QuoteSync\web\_backups\yyyyMMdd_HHmmss\ (staging copy)
# ============================================================

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Ok($m){ Write-Host "OK: $m" -ForegroundColor Green }
function Info($m){ Write-Host "INFO: $m" -ForegroundColor Cyan }
function Fail($m){ Write-Host "ERROR: $m" -ForegroundColor Red; throw $m }

try {
  $runDir = (Get-Location).Path
  Write-Host ("RUN DIR: " + $runDir) -ForegroundColor Yellow

  # Enforce correct repo root
  $repoRoot = "C:\Github\QuoteSync\web"
  if (-not (Test-Path $repoRoot)) { Fail "Repo root not found: $repoRoot" }
  Set-Location $repoRoot
  Ok "Set-Location -> $repoRoot"

  # Fail-safe sanity checks
  $pkg = Join-Path $repoRoot "package.json"
  $app = Join-Path $repoRoot "src\App.tsx"
  if (-not (Test-Path $pkg)) { Fail "Missing package.json at $pkg" }
  if (-not (Test-Path $app)) { Fail "Missing src\App.tsx at $app" }
  Ok "Verified package.json and src\App.tsx exist"

  # Backup paths
  $stamp = Get-Date -Format "yyyyMMdd_HHmmss"
  $backupsDir = Join-Path $repoRoot "_backups"
  if (-not (Test-Path $backupsDir)) { New-Item -ItemType Directory -Path $backupsDir | Out-Null }

  $backupFolder = Join-Path $backupsDir $stamp
  $stagingRoot  = Join-Path $backupFolder "web"
  New-Item -ItemType Directory -Path $backupFolder | Out-Null
  New-Item -ItemType Directory -Path $stagingRoot  | Out-Null

  $zipPath = Join-Path $backupsDir ("{0}_full_project.zip" -f $stamp)

  Info "Backup folder: $backupFolder"
  Info "Staging copy:  $stagingRoot"
  Info "ZIP target:    $zipPath"

  # Copy full project into staging (exclude _backups to prevent recursion)
  $excludeDir = "_backups"

  Info "Copying project (excluding '$excludeDir')..."
  $robocopyLog = Join-Path $backupFolder "robocopy.log"

  $src = $repoRoot
  $dst = $stagingRoot

  $rcArgs = @(
    "`"$src`"",
    "`"$dst`"",
    "/MIR",
    "/XD", "`"$excludeDir`"",
    "/R:2",
    "/W:1",
    "/NFL","/NDL","/NP",
    "/LOG:`"$robocopyLog`""
  )

  $p = Start-Process -FilePath "robocopy.exe" -ArgumentList $rcArgs -NoNewWindow -PassThru -Wait
  $code = $p.ExitCode

  # Robocopy exit codes: 0-7 are success; 8+ indicates failure.
  if ($code -ge 8) { Fail "Robocopy failed with exit code $code. Log: $robocopyLog" }
  Ok "Robocopy completed (exit code $code). Log: $robocopyLog"

  # Refuse to overwrite an existing ZIP
  if (Test-Path $zipPath) { Fail "ZIP already exists (refusing to overwrite): $zipPath" }

  # Create ZIP of staged contents (no nested zip confusion)
  Info "Creating ZIP..."
  Compress-Archive -Path (Join-Path $stagingRoot "*") -DestinationPath $zipPath -CompressionLevel Optimal
  if (-not (Test-Path $zipPath)) { Fail "ZIP was not created: $zipPath" }

  # Report size
  $zipInfo = Get-Item $zipPath
  $zipMB = [Math]::Round(($zipInfo.Length / 1MB), 2)

  Ok "SAVE-POINT COMPLETE"
  Write-Host ("ZIP:  " + $zipInfo.FullName) -ForegroundColor Green
  Write-Host ("Size: " + $zipMB + " MB") -ForegroundColor Green
  Write-Host ("Copy: " + $backupFolder) -ForegroundColor Green

  Info "NOTE: Per requirement, npm run dev was NOT executed."
}
catch {
  Fail $_.Exception.Message
}
