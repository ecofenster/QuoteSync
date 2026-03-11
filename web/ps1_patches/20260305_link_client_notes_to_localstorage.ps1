<# 
QuoteSync Patch — Persist Client Notes per-client (shared with Follow Ups "Add Note")
What this fixes:
- Follow Ups "Add Note" already saves to localStorage key:
    qs_client_notes_v1_<clientId>
- Client Notes tab (Estimate Picker) currently keeps notes in-memory only,
  so saved notes don't appear when you switch views/refresh.

This patch:
- Loads client notes from localStorage whenever pickerClientId changes
- Saves client notes to localStorage whenever clientNotes changes
- Uses the SAME key as FollowUpsFeature:
    qs_client_notes_v1_<clientId>

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
  [string]$Note = "Persist Client Notes per-client via localStorage (qs_client_notes_v1_<clientId>)"
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

$epRel  = "src\features\estimatePicker\EstimatePickerFeature.tsx"
$epPath = Join-Path $webRoot $epRel
if (-not (Test-Path $epPath)) { Fail "Missing file: $epRel" }

Copy-Item -Path $epPath -Destination (Join-Path $backupDir "EstimatePickerFeature.tsx") -Force
Ok "Backed up: $epRel"

$ep = Get-Content -Path $epPath -Raw -Encoding UTF8

# Idempotent: skip if already present
if ($ep -match 'qs_client_notes_v1_') {
  Ok "Already linked to qs_client_notes_v1_ (no changes)."
} else {
  $anchor = 'const activeUserName = "User";'
  if ($ep -notlike "*$anchor*") { Fail "Anchor not found: activeUserName" }

  $insert = @'
const activeUserName = "User";

  const CLIENT_NOTES_KEY_PREFIX = "qs_client_notes_v1_";

  function loadClientNotesSafe(clientId: string) {
    try {
      const raw = localStorage.getItem(CLIENT_NOTES_KEY_PREFIX + clientId);
      if (!raw) return [] as ClientNote[];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as ClientNote[]) : ([] as ClientNote[]);
    } catch {
      return [] as ClientNote[];
    }
  }

  function saveClientNotesSafe(clientId: string, notes: ClientNote[]) {
    try {
      localStorage.setItem(CLIENT_NOTES_KEY_PREFIX + clientId, JSON.stringify(notes ?? []));
    } catch {
      // ignore
    }
  }

  // Load client notes whenever the selected client changes
  useEffect(() => {
    if (!pickerClientId) {
      setClientNotes([]);
      setClientNoteDraftHtml("");
      return;
    }
    setClientNotes(loadClientNotesSafe(pickerClientId as unknown as string));
    setClientNoteDraftHtml("");
  }, [pickerClientId]);

  // Persist notes (per-client) whenever notes change
  useEffect(() => {
    if (!pickerClientId) return;
    saveClientNotesSafe(pickerClientId as unknown as string, clientNotes);
  }, [pickerClientId, clientNotes]);
'@

  $ep = $ep.Replace($anchor, $insert)
  Ok "Inserted per-client Client Notes load/save"
}

Set-Content -Path $epPath -Value $ep -Encoding UTF8
Ok "Patched: $epRel"

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
    $entry += "- Patch: 20260305_link_client_notes_to_localstorage.ps1"
    $entry += "- Files: $epRel"
    Add-Content -Path $patchLogPath -Value ($entry -join "`r`n") -Encoding UTF8
    Ok "Appended note to: _handover\PATCHLOG.md"
  }
}

Ok "Done."
