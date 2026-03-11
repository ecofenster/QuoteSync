<# 
QuoteSync Patch (v2) — Follow Ups: 2x2 grid of 4 + Add Note in bottom-right
Fixes prior patch failure by using regex anchors (whitespace/CRLF tolerant) and by working with the CURRENT FollowUpsFeature layout.

Changes:
1) FollowUpsFeature.tsx
   - Converts overall layout to a true 2x2 grid:
       TL Calendar | TR Follow Ups list
       BL Follow Up Details | BR Add Note
   - Removes the previously-inserted "Client note quick add" block inside the Details panel (so it's not duplicated).
   - Adds bottom-right Add Note panel (tied to per-client notes key):
       qs_client_notes_v1_<clientId>

2) EstimatePickerFeature.tsx
   - Persists Client Notes per-client using the same key:
       qs_client_notes_v1_<clientId>
   - Loads notes when switching picker client.

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
  [string]$Note = "Follow Ups: 4-panel grid + Add Note bottom-right (linked to Client Notes) [v2]"
)

$ErrorActionPreference = "Stop"
function Fail($m){ Write-Host "ERROR: $m" -ForegroundColor Red; throw $m }
function Ok($m){ Write-Host "OK: $m" -ForegroundColor Green }
function Warn($m){ Write-Host "WARN: $m" -ForegroundColor Yellow }

$runDir = (Get-Location).Path
Write-Host "Run directory: $runDir"

# Detect web root (walk up to package.json)
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
$epRel  = "src\features\estimatePicker\EstimatePickerFeature.tsx"
$fuPath = Join-Path $webRoot $fuRel
$epPath = Join-Path $webRoot $epRel

if (-not (Test-Path $fuPath)) { Fail "Missing file: $fuRel" }
if (-not (Test-Path $epPath)) { Fail "Missing file: $epRel" }

Copy-Item -Path $fuPath -Destination (Join-Path $backupDir "FollowUpsFeature.tsx") -Force
Copy-Item -Path $epPath -Destination (Join-Path $backupDir "EstimatePickerFeature.tsx") -Force
Ok "Backed up: $fuRel"
Ok "Backed up: $epRel"

# =========================
# Patch FollowUpsFeature.tsx
# =========================
$fu = Get-Content -Path $fuPath -Raw -Encoding UTF8

# Ensure CLIENT_NOTES_KEY_PREFIX exists (idempotent)
if ($fu -notmatch 'CLIENT_NOTES_KEY_PREFIX') {
  $fu = $fu -replace 'const STORAGE_KEY = "qs_followups_v1";', ('const STORAGE_KEY = "qs_followups_v1";' + "`r`n" + 'const CLIENT_NOTES_KEY_PREFIX = "qs_client_notes_v1_";')
  Ok "FollowUpsFeature: inserted CLIENT_NOTES_KEY_PREFIX"
} else {
  Ok "FollowUpsFeature: CLIENT_NOTES_KEY_PREFIX already present"
}

# Ensure clientNoteDraft state exists (idempotent). Insert immediately after selectedId state line.
if ($fu -notmatch 'clientNoteDraft') {
  $fu = [regex]::Replace(
    $fu,
    '(\r?\n\s*const\s*\[\s*selectedId\s*,\s*setSelectedId\s*\]\s*=\s*useState<[^>]+>\(\s*null\s*\);\s*)',
    '$1' + "`r`n" + '  const [clientNoteDraft, setClientNoteDraft] = useState<string>("");',
    1
  )
  if ($fu -notmatch 'clientNoteDraft') { Fail "FollowUpsFeature: could not insert clientNoteDraft state (selectedId line not found)." }
  Ok "FollowUpsFeature: added clientNoteDraft state"
} else {
  Ok "FollowUpsFeature: clientNoteDraft already present"
}

# Remove the previous in-details quick add block if present
$fu = [regex]::Replace(
  $fu,
  '\r?\n\s*\{\s*/\*\s*Client note quick add\s*\*/\s*\}\s*\r?\n.*?\r?\n\s*</div>\s*\r?\n\s*</div>\s*\r?\n',
  "`r`n",
  [System.Text.RegularExpressions.RegexOptions]::Singleline
)
Ok "FollowUpsFeature: removed embedded quick add block (if present)"

# Convert to 2x2 grid: change outer grid and remove inner wrapper grid
$fu = $fu.Replace(
  '<div style={{ display: "grid", gridTemplateRows: "auto auto", gap: 12, minHeight: 520 }}>',
  '<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "auto auto", gap: 12, minHeight: 520 }}>'
)

$fu = $fu.Replace(
  '      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>',
  '      '
)

# Remove the wrapper closing </div> right before the Bottom details comment (tolerate LF/CRLF)
$fu = [regex]::Replace(
  $fu,
  '\r?\n\s*</div>\s*\r?\n\s*\r?\n\s*\{\s*/\*\s*Bottom:\s*details\s*\(only when a follow-up is selected\)\s*\*/\s*\}',
  "`r`n`r`n      {/* Bottom: details (only when a follow-up is selected) */}",
  1
)

# Position the three existing panels (calendar, list, details) by updating the first 3 occurrences of the common panel wrapper
$panel = '<div style={{ border: "1px solid #e4e4e7", borderRadius: 16, overflow: "hidden", background: "#fff" }}>'
$idx1 = $fu.IndexOf($panel)
if ($idx1 -lt 0) { Fail "FollowUpsFeature: panel wrapper (1) not found." }
$idx2 = $fu.IndexOf($panel, $idx1 + 1)
if ($idx2 -lt 0) { Fail "FollowUpsFeature: panel wrapper (2) not found." }
$idx3 = $fu.IndexOf($panel, $idx2 + 1)
if ($idx3 -lt 0) { Fail "FollowUpsFeature: panel wrapper (3) not found." }

$p1 = '<div style={{ gridColumn: "1", gridRow: "1", border: "1px solid #e4e4e7", borderRadius: 16, overflow: "hidden", background: "#fff" }}>'
$p2 = '<div style={{ gridColumn: "2", gridRow: "1", border: "1px solid #e4e4e7", borderRadius: 16, overflow: "hidden", background: "#fff" }}>'
$p3 = '<div style={{ gridColumn: "1", gridRow: "2", border: "1px solid #e4e4e7", borderRadius: 16, overflow: "hidden", background: "#fff" }}>'

$fu = $fu.Substring(0, $idx1) + $p1 + $fu.Substring($idx1 + $panel.Length)
$idx2 = $fu.IndexOf($panel, $idx1 + $p1.Length)
$idx3 = $fu.IndexOf($panel, $idx2 + 1)
$fu = $fu.Substring(0, $idx2) + $p2 + $fu.Substring($idx2 + $panel.Length)
$idx3 = $fu.IndexOf($panel, $idx2 + $p2.Length)
$fu = $fu.Substring(0, $idx3) + $p3 + $fu.Substring($idx3 + $panel.Length)
Ok "FollowUpsFeature: positioned 3 panels into grid"

# Insert bottom-right Add Note panel just before the final outer closing </div> (the one that closes the outer grid)
$insertAnchor = "`r`n`r`n    </div>`r`n  );"
if ($fu -notlike "*$insertAnchor*") {
  $insertAnchor = "`n`n    </div>`n  );"
}
if ($fu -notlike "*$insertAnchor*") { Fail "FollowUpsFeature: could not locate return tail anchor for inserting Add Note panel." }

$addPanel = @'
      {/* Bottom-right: Add Note (client notes) */}
      <div style={{ gridColumn: "2", gridRow: "2", border: "1px solid #e4e4e7", borderRadius: 16, overflow: "hidden", background: "#fff" }}>
        <div style={{ padding: 12, borderBottom: "1px solid #f1f5f9" }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: "#111827" }}>Add Note:</div>
        </div>

        <div style={{ padding: 12, display: "grid", gap: 10 }}>
          {!selectedFollowUp && (
            <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.4 }}>
              Select a follow-up (green) to add a note for that client.
            </div>
          )}

          {selectedFollowUp && (
            <>
              <textarea
                value={clientNoteDraft}
                onChange={(e) => setClientNoteDraft(e.currentTarget.value)}
                placeholder="Add a note for this client..."
                style={{
                  width: "100%",
                  minHeight: 140,
                  border: "1px solid #e4e4e7",
                  borderRadius: 14,
                  padding: 12,
                  fontSize: 13,
                  outline: "none",
                }}
              />

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  onClick={() => {
                    const html = (clientNoteDraft ?? "").trim();
                    if (!selectedFollowUp) return;
                    if (!html) return;

                    const createdAt = new Date().toISOString();
                    const key = CLIENT_NOTES_KEY_PREFIX + selectedFollowUp.clientId;

                    try {
                      const raw = localStorage.getItem(key);
                      const parsed = raw ? JSON.parse(raw) : [];
                      const list = Array.isArray(parsed) ? parsed : [];
                      list.unshift({ id: "note_" + createdAt, html, createdAt, createdBy: "User" });
                      localStorage.setItem(key, JSON.stringify(list));
                    } catch {
                      // ignore
                    }

                    setClientNoteDraft("");
                  }}
                  style={{
                    height: 32,
                    padding: "0 10px",
                    borderRadius: 12,
                    border: "1px solid #e4e4e7",
                    background: "#fff",
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  Save note
                </button>
              </div>

              <div style={{ fontSize: 12, color: "#6b7280" }}>
                This saves into the client’s <b>Client Notes</b>.
              </div>
            </>
          )}
        </div>
      </div>
'@

$fu = $fu.Replace($insertAnchor, "`r`n`r`n" + $addPanel + $insertAnchor)
Ok "FollowUpsFeature: inserted Add Note panel (2,2)"

Set-Content -Path $fuPath -Value $fu -Encoding UTF8
Ok "Patched: $fuRel"

# =========================
# Patch EstimatePickerFeature.tsx (persist client notes per-client)
# =========================
$ep = Get-Content -Path $epPath -Raw -Encoding UTF8

if ($ep -notmatch 'qs_client_notes_v1_') {
  $anchor = 'const activeUserName = "User";'
  if ($ep -notlike "*$anchor*") { Fail "EstimatePickerFeature: activeUserName anchor not found." }

  $inject = @'
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

  // Load notes when switching client in the picker
  useEffect(() => {
    if (!pickerClientId) {
      setClientNotes([]);
      setClientNoteDraftHtml("");
      return;
    }
    setClientNotes(loadClientNotesSafe(pickerClientId as unknown as string));
    setClientNoteDraftHtml("");
  }, [pickerClientId]);

  // Persist notes per-client
  useEffect(() => {
    if (!pickerClientId) return;
    saveClientNotesSafe(pickerClientId as unknown as string, clientNotes);
  }, [pickerClientId, clientNotes]);
'@

  $ep = $ep.Replace($anchor, $inject)
  Ok "EstimatePickerFeature: added per-client Client Notes persistence"
} else {
  Ok "EstimatePickerFeature: per-client notes already present"
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

  # Hot files
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

  # src tree
  $srcPath = Join-Path $webRoot "src"
  $treeLines = @()
  if (Test-Path $srcPath) {
    $items = Get-ChildItem -Path $srcPath -Recurse -File | Sort-Object FullName
    foreach ($it in $items) {
      $rel = $it.FullName.Substring($webRoot.Length).TrimStart('\')
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
  Ok "Updated: _handover\SNAPSHOT.txt"

  if (-not [string]::IsNullOrWhiteSpace($Note)) {
    if (-not (Test-Path $patchLogPath)) {
      Warn "PATCHLOG.md missing; skipping log append."
    } else {
      $entry = @()
      $entry += ""
      $entry += "## $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
      $entry += $Note
      $entry += ""
      $entry += "- Patch: 20260305_followups_grid4_add_note_v2.ps1"
      $entry += "- Files: $fuRel, $epRel"
      Add-Content -Path $patchLogPath -Value ($entry -join "`r`n") -Encoding UTF8
      Ok "Appended note to: _handover\PATCHLOG.md"
    }
  }
} else {
  Warn "_handover not found; skipping snapshot/log update."
}

Ok "Done."
