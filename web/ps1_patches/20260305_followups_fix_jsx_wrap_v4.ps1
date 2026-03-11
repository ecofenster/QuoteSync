<# 
QuoteSync Hotfix — FollowUpsFeature JSX structure fix (v4)
Fixes Vite/React error: "Adjacent JSX elements must be wrapped..."

Root causes in current FollowUpsFeature.tsx:
1) Missing newline between clientNoteDraft state and useEffect (merged tokens)
2) Missing closing </div> around the "Previous follow-ups..." helper text, causing tag imbalance.

Run from:
PS C:\Github\QuoteSync\web\ps1_patches>

Backups:
C:\Github\QuoteSync\web\_backups\<timestamp>\

Dev server:
Does NOT run/restart npm run dev.

Also:
Updates _handover\PATCHLOG.md + _handover\SNAPSHOT.txt on success.
#>

param(
  [string]$Note = "Hotfix: FollowUpsFeature JSX wrapper/tag balance (fix Vite adjacent JSX elements error)"
)

$ErrorActionPreference = "Stop"
function Fail($m){ Write-Host "ERROR: $m" -ForegroundColor Red; throw $m }
function Ok($m){ Write-Host "OK: $m" -ForegroundColor Green }
function Warn($m){ Write-Host "WARN: $m" -ForegroundColor Yellow }

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

$ts = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = Join-Path (Join-Path $webRoot "_backups") $ts
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
Ok "Backup dir: $backupDir"

$fuRel  = "src\features\followUps\FollowUpsFeature.tsx"
$fuPath = Join-Path $webRoot $fuRel
if (-not (Test-Path $fuPath)) { Fail "Missing file: $fuRel" }

Copy-Item -Path $fuPath -Destination (Join-Path $backupDir "FollowUpsFeature.tsx") -Force
Ok "Backed up: $fuRel"

$fu = Get-Content -Path $fuPath -Raw -Encoding UTF8

# 1) Fix merged state+useEffect line (tolerant)
$pattern1 = 'const\s*\[\s*clientNoteDraft\s*,\s*setClientNoteDraft\s*\]\s*=\s*useState<string>\(\s*""\s*\);\s*useEffect\s*\('
if ($fu -notmatch $pattern1) { Fail "Expected clientNoteDraft state immediately followed by useEffect was not found (file may have changed)." }

$fu = [regex]::Replace(
  $fu,
  $pattern1,
  'const [clientNoteDraft, setClientNoteDraft] = useState<string>("");' + "`r`n`r`n" + '  useEffect(',
  1
)
Ok "Fixed: clientNoteDraft/useEffect newline"

# 2) Close the helper text div before the previousForClient conditional
$pattern2 = '(<div\s+style=\{\{\s*fontSize:\s*12,\s*color:\s*"#6b7280"\s*\}\}\>\s*\r?\n\s*Previous follow-ups, last client note, estimate link, and cost overview will be expanded here next\.\s*)\r?\n\s*\{previousForClient\.length\s*>\s*0\s*&&\s*\('
if ($fu -notmatch $pattern2) { Fail "Expected helper-text block before previousForClient conditional not found." }

$fu = [regex]::Replace(
  $fu,
  $pattern2,
  '$1' + "`r`n" + '              </div>' + "`r`n`r`n" + '              {previousForClient.length > 0 && (',
  1
)
Ok "Fixed: closed helper text div before previousForClient block"

Set-Content -Path $fuPath -Value $fu -Encoding UTF8
Ok "Patched: $fuRel"

# -------------------------
# Handover: patch log + snapshot (on success)
# -------------------------
$handoverDir = Join-Path $webRoot "_handover"
if (Test-Path $handoverDir) {
  $patchLogPath = Join-Path $handoverDir "PATCHLOG.md"
  $snapshotPath = Join-Path $handoverDir "SNAPSHOT.txt"

  function Sha256File($p) {
    if (-not (Test-Path $p)) { return $null }
    return (Get-FileHash -Path $p -Algorithm SHA256).Hash
  }

  # Git info (optional)
  $gitBranch = $null; $gitSha = $null; $gitDirty = $null
  if (Test-Path (Join-Path $webRoot ".git")) {
    try {
      $gitBranch = (& git -C $webRoot rev-parse --abbrev-ref HEAD) 2>$null
      $gitSha    = (& git -C $webRoot rev-parse --short HEAD) 2>$null
      $gitDirty  = (& git -C $webRoot status --porcelain) 2>$null
    } catch { }
  }

  # Node/npm (best-effort)
  $nodev = $null; $npmv = $null
  try { $nodev = (& node -v) 2>$null } catch { $nodev = "<node not found>" }
  try { $npmv  = (& npm -v) 2>$null } catch { $npmv  = "<npm not found>" }

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

  $srcPath = Join-Path $webRoot "src"
  $treeLines = @()
  if (Test-Path $srcPath) {
    $items = Get-ChildItem -Path $srcPath -Recurse -File | Sort-Object FullName
    foreach ($it in $items) {
      $rel = $it.FullName.Substring($webRoot.Length).TrimStart('\')
      $treeLines += ("{0}  {1}" -f $it.Length, $rel)
    }
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

  # Backup handover files we touch
  $handoverBackupDir = Join-Path $backupDir "_handover"
  New-Item -ItemType Directory -Path $handoverBackupDir -Force | Out-Null
  if (Test-Path $snapshotPath) { Copy-Item $snapshotPath (Join-Path $handoverBackupDir "SNAPSHOT.txt") -Force }
  if (-not [string]::IsNullOrWhiteSpace($Note) -and (Test-Path $patchLogPath)) { Copy-Item $patchLogPath (Join-Path $handoverBackupDir "PATCHLOG.md") -Force }

  Set-Content -Path $snapshotPath -Value ($snap -join "`r`n") -Encoding UTF8
  Ok "Updated: _handover\SNAPSHOT.txt"

  if (-not [string]::IsNullOrWhiteSpace($Note) -and (Test-Path $patchLogPath)) {
    $entry = @()
    $entry += ""
    $entry += "## $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    $entry += $Note
    $entry += ""
    $entry += "- Patch: 20260305_followups_fix_jsx_wrap_v4.ps1"
    $entry += "- Files: $fuRel"
    Add-Content -Path $patchLogPath -Value ($entry -join "`r`n") -Encoding UTF8
    Ok "Appended note to: _handover\PATCHLOG.md"
  }
} else {
  Warn "_handover not found; skipping snapshot/log update."
}

Ok "Done. (Dev server not restarted.)"
