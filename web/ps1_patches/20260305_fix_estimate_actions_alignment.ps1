<# 
QuoteSync Patch — Fix Estimate actions header alignment
- Goal: make the action headers (Email / Follow up / Estimate status / Open estimate) sit inline.
- Cause: action row uses alignItems:flex-end while the Status pill was shorter (height 34), pulling its label down.
- Fix:
  1) Change action row alignItems to "flex-start"
  2) Make the Status pill match button height (38) + padding consistent

Run from: PS C:\Github\QuoteSync\web\ps1_patches>
Creates backups in: C:\Github\QuoteSync\web\_backups\<timestamp>\
Does NOT run npm run dev
Also updates: web\_handover\PATCHLOG.md and web\_handover\SNAPSHOT.txt (on success)
#>

param(
  [string]$Note = "UI: Align Estimate actions headers (Status label inline)"
)

$ErrorActionPreference = "Stop"

function Fail($m) { Write-Host "ERROR: $m" -ForegroundColor Red; throw $m }
function Ok($m)   { Write-Host "OK: $m" -ForegroundColor Green }
function Warn($m) { Write-Host "WARN: $m" -ForegroundColor Yellow }

$runDir = (Get-Location).Path
Write-Host "Run directory: $runDir"

# Detect web root by walking up until package.json is found
$here = $runDir
$webRoot = $null
for ($i=0; $i -lt 10; $i++) {
  if (Test-Path (Join-Path $here "package.json")) { $webRoot = $here; break }
  $parent = Split-Path $here -Parent
  if ($parent -eq $here -or [string]::IsNullOrWhiteSpace($parent)) { break }
  $here = $parent
}
if (-not $webRoot) { Fail "Could not detect web root (package.json not found). Run from ...\\web\\ps1_patches." }
Ok "Detected web root: $webRoot"

$ts = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = Join-Path (Join-Path $webRoot "_backups") $ts
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
Ok "Backup dir: $backupDir"

$targetRel = "src\\features\\estimatePicker\\EstimatePickerTabs.tsx"
$target = Join-Path $webRoot $targetRel
if (-not (Test-Path $target)) { Fail "Missing file: $targetRel" }

Copy-Item -Path $target -Destination (Join-Path $backupDir "EstimatePickerTabs.tsx") -Force
Ok "Backed up: $targetRel"

$txt = Get-Content -Path $target -Raw -Encoding UTF8

$orig1 = '<div style={{ display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap" }}>'
$repl1 = '<div style={{ display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>'
if ($txt -notlike "*$orig1*") { Fail "Anchor not found for action-row alignItems. File may have changed." }
$txt = $txt.Replace($orig1, $repl1)
Ok "Updated action row alignItems -> flex-start"

$orig2a = 'height: 34,'
$repl2a = 'height: 38,'
if ($txt -notlike "*$orig2a*") { Fail "Anchor not found for Status pill height. File may have changed." }
$txt = $txt.Replace($orig2a, $repl2a)
Ok "Updated Status pill height -> 38"

$orig2b = 'padding: "0 28px 0 10px",'
$repl2b = 'padding: "0 28px 0 14px",'
if ($txt -notlike "*$orig2b*") { Fail "Anchor not found for Status pill padding. File may have changed." }
$txt = $txt.Replace($orig2b, $repl2b)
Ok "Updated Status pill left padding -> 14px"

Set-Content -Path $target -Value $txt -Encoding UTF8
Ok "Patched: $targetRel"

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

  # Hot files
  $hotFiles = @(
    "src\\models\\types.ts",
    "src\\App.tsx",
    "src\\features\\estimatePicker\\EstimatePickerTabs.tsx",
    "src\\features\\estimatePicker\\EstimatePickerFeature.tsx",
    "src\\features\\followUps\\FollowUpsFeature.tsx"
  )

  $hotReport = @()
  foreach ($rel in $hotFiles) {
    $abs = Join-Path $webRoot $rel
    $hash = Sha256File $abs
    $exists = Test-Path $abs
    $hotReport += [pscustomobject]@{ Path=$rel; Exists=$exists; SHA256=($hash ?? "") }
  }

  # src tree
  $srcPath = Join-Path $webRoot "src"
  $treeLines = @()
  if (Test-Path $srcPath) {
    $items = Get-ChildItem -Path $srcPath -Recurse -File | Sort-Object FullName
    foreach ($it in $items) {
      $rel = $it.FullName.Substring($webRoot.Length).TrimStart('\\')
      $treeLines += ("{0}  {1}" -f $it.Length, $rel)
    }
  }

  # Write snapshot
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
  Ok "Updated: _handover\\SNAPSHOT.txt"

  if (-not [string]::IsNullOrWhiteSpace($Note)) {
    if (-not (Test-Path $patchLogPath)) {
      Warn "PATCHLOG.md missing; skipping log append."
    } else {
      $entry = @()
      $entry += ""
      $entry += "## $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
      $entry += $Note
      $entry += ""
      $entry += "- Patch: 20260305_fix_estimate_actions_alignment.ps1"
      $entry += "- Files: $targetRel"
      Add-Content -Path $patchLogPath -Value ($entry -join "`r`n") -Encoding UTF8
      Ok "Appended note to: _handover\\PATCHLOG.md"
    }
  }
} else {
  Warn "_handover not found; skipping snapshot/log update."
}

Ok "Done. (Dev server not restarted.)"
