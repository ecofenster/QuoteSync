<# 
QuoteSync Handover System — Update Snapshot (v2)
Updates:
  - web\_handover\SNAPSHOT.txt
Optionally appends a note to:
  - web\_handover\PATCHLOG.md  (if -Note is provided)

Rules:
  - Run from: PS C:\Github\QuoteSync\web\ps1_patches>
  - Auto-detect web root
  - Backup SNAPSHOT.txt (and PATCHLOG.md if touched) to web\_backups\<timestamp>\_handover\
  - Does NOT start/stop dev server
#>

param(
  [string]$Note = ""
)

$ErrorActionPreference = "Stop"

function Fail($m) { Write-Host "ERROR: $m" -ForegroundColor Red; throw $m }
function Ok($m)   { Write-Host "OK: $m" -ForegroundColor Green }
function Warn($m) { Write-Host "WARN: $m" -ForegroundColor Yellow }

$runDir = (Get-Location).Path
Write-Host "Run directory: $runDir"

# Detect web root
$here = $runDir
$webRoot = $null
for ($i=0; $i -lt 10; $i++) {
  if (Test-Path (Join-Path $here "package.json")) { $webRoot = $here; break }
  $parent = Split-Path $here -Parent
  if ($parent -eq $here -or [string]::IsNullOrWhiteSpace($parent)) { break }
  $here = $parent
}
if (-not $webRoot) { Fail "Could not detect web root (package.json not found). Run from ...\web\ps1_patches." }
Ok "Detected web root: $webRoot"

$handoverDir = Join-Path $webRoot "_handover"
if (-not (Test-Path $handoverDir)) { Fail "_handover not found. Run the setup script first." }

$backupDirRoot = Join-Path $webRoot "_backups"
$ts = Get-Date -Format "yyyyMMdd_HHmmss"
$handoverBackupDir = Join-Path (Join-Path $backupDirRoot $ts) "_handover"
New-Item -ItemType Directory -Path $handoverBackupDir -Force | Out-Null

# Backup files we're going to touch
$snapshotPath = Join-Path $handoverDir "SNAPSHOT.txt"
if (Test-Path $snapshotPath) { Copy-Item $snapshotPath (Join-Path $handoverBackupDir "SNAPSHOT.txt") -Force }
$patchLogPath = Join-Path $handoverDir "PATCHLOG.md"
if ($Note -and (Test-Path $patchLogPath)) { Copy-Item $patchLogPath (Join-Path $handoverBackupDir "PATCHLOG.md") -Force }

Ok "Backup created: $handoverBackupDir"

function Sha256File($p) {
  if (-not (Test-Path $p)) { return $null }
  return (Get-FileHash -Path $p -Algorithm SHA256).Hash
}

# Git
$gitBranch = $null; $gitSha = $null; $gitDirty = $null
if (Test-Path (Join-Path $webRoot ".git")) {
  try {
    $gitBranch = (& git -C $webRoot rev-parse --abbrev-ref HEAD) 2>$null
    $gitSha    = (& git -C $webRoot rev-parse --short HEAD) 2>$null
    $gitDirty  = (& git -C $webRoot status --porcelain) 2>$null
  } catch { }
}

# Node/npm
$nodev = $null; $npmv = $null
try { $nodev = (& node -v) 2>$null } catch { $nodev = "<node not found>" }
try { $npmv  = (& npm -v) 2>$null } catch { $npmv  = "<npm not found>" }

$srcPath = Join-Path $webRoot "src"
if (-not (Test-Path $srcPath)) { Fail "src folder not found at $srcPath" }

$hotFiles = @(
  "src\models\types.ts",
  "src\App.tsx",
  "src\features\estimatePicker\EstimatePickerTabs.tsx",
  "src\features\estimatePicker\EstimatePickerFeature.tsx",
  "src\features\followUps\FollowUpsFeature.tsx"
)

$hotReport = @()
foreach ($rel in $hotFiles) {
  $abs = Join-Path $webRoot $rel
  $hash = Sha256File $abs
  $exists = Test-Path $abs
  $hotReport += [pscustomobject]@{ Path=$rel; Exists=$exists; SHA256=($hash ?? "") }
}

$treeLines = @()
$items = Get-ChildItem -Path $srcPath -Recurse -File | Sort-Object FullName
foreach ($it in $items) {
  $rel = $it.FullName.Substring($webRoot.Length).TrimStart('\')
  $treeLines += ("{0}  {1}" -f $it.Length, $rel)
}

$snap = @()
$snap += "QuoteSync SNAPSHOT"
$snap += "Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
$snap += "WebRoot: $webRoot"
$snap += "RunDir: $runDir"
$snap += ""
$snap += "Environment:"
$snap += "  Node: $nodev"
$snap += "  npm : $npmv"
if ($gitBranch) {
  $snap += "  GitBranch: $gitBranch"
  $snap += "  GitSHA   : $gitSha"
  $snap += ("  GitDirty : " + ( [string]::IsNullOrWhiteSpace($gitDirty) ? "clean" : "CHANGES" ))
} else {
  $snap += "  Git: <not detected>"
}
$snap += ""
$snap += "Hot files (SHA256):"
foreach ($h in $hotReport) {
  $snap += ("  - {0} | exists={1} | {2}" -f $h.Path, $h.Exists, ($h.SHA256))
}
$snap += ""
$snap += "src tree (bytes  relativePath):"
$snap += $treeLines

Set-Content -Path $snapshotPath -Value ($snap -join "`r`n") -Encoding UTF8
Ok "Updated: _handover\SNAPSHOT.txt"

if (-not [string]::IsNullOrWhiteSpace($Note)) {
  if (-not (Test-Path $patchLogPath)) { Fail "PATCHLOG.md not found at $patchLogPath" }
  $entry = @()
  $entry += ""
  $entry += "## $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
  $entry += $Note
  Add-Content -Path $patchLogPath -Value ($entry -join "`r`n") -Encoding UTF8
  Ok "Appended note to: _handover\PATCHLOG.md"
}

Write-Host ""
Write-Host "Done. For new chats upload: _handover\HANDOVER.md + _handover\SNAPSHOT.txt + _handover\CONTEXT.json" -ForegroundColor Cyan
Write-Host ""
