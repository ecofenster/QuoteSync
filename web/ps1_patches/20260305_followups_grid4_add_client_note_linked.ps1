<# 
QuoteSync Patch — Follow Ups: 2x2 grid (4 panels) + Add Client Note (linked to Client Notes)
Changes:
1) FollowUpsFeature.tsx
   - Layout becomes 2 columns x 2 rows:
     (1,1) Calendar | (2,1) Follow Ups list
     (1,2) Follow Up Details | (2,2) Add Note
   - Bottom-right "Add Note" saves a ClientNote for the selected client to localStorage key:
       qs_client_notes_v1_<clientId>

2) EstimatePickerFeature.tsx
   - Client Notes tab now loads/saves notes per-client using the SAME localStorage key:
       qs_client_notes_v1_<clientId>
   - This ties Follow Ups notes and Client Notes together.

Run from:
PS C:\Github\QuoteSync\web\ps1_patches>

Backups:
C:\Github\QuoteSync\web\_backups\<timestamp>\

Dev server:
Does NOT run/restart npm run dev (per rule)

Also:
Updates _handover\PATCHLOG.md + _handover\SNAPSHOT.txt on success.
#>

param(
  [string]$Note = "Follow Ups: 4-panel grid + Add Note linked to Client Notes (per-client storage)"
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

# Add per-client notes key prefix near storage key
$fuKeyAnchor = 'const STORAGE_KEY = "qs_followups_v1";'
$fuKeyInsert = @'
const STORAGE_KEY = "qs_followups_v1";
const CLIENT_NOTES_KEY_PREFIX = "qs_client_notes_v1_";
'@
if ($fu -notlike "*$fuKeyAnchor*") { Fail "FollowUpsFeature: STORAGE_KEY anchor not found." }
$fu = $fu.Replace($fuKeyAnchor, $fuKeyInsert)
Ok "FollowUpsFeature: added CLIENT_NOTES_KEY_PREFIX"

# Add client note draft state after selectedId state
$fuStateAnchor = 'const [selectedId, setSelectedId] = useState<string | null>(null);'
$fuStateInsert = @'
const [selectedId, setSelectedId] = useState<string | null>(null);
  const [clientNoteDraft, setClientNoteDraft] = useState<string>("");
'@
if ($fu -notlike "*$fuStateAnchor*") { Fail "FollowUpsFeature: selectedId state anchor not found." }
$fu = $fu.Replace($fuStateAnchor, $fuStateInsert)
Ok "FollowUpsFeature: added clientNoteDraft state"

# Change outer grid to 2x2
$outerOld = '<div style={{ display: "grid", gridTemplateRows: "auto auto", gap: 12, minHeight: 520 }}>'
$outerNew = '<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "auto auto", gap: 12, minHeight: 520 }}>'
if ($fu -notlike "*$outerOld*") { Fail "FollowUpsFeature: outer grid anchor not found." }
$fu = $fu.Replace($outerOld, $outerNew)
Ok "FollowUpsFeature: outer grid changed"

# Remove inner top wrapper grid opening
$wrapperOpen = '      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>'
if ($fu -notlike "*$wrapperOpen*") { Fail "FollowUpsFeature: wrapper open anchor not found." }
$fu = $fu.Replace($wrapperOpen, "      ")
Ok "FollowUpsFeature: removed wrapper open"

# Remove wrapper closing right before bottom details block
$wrapperCloseA = "      </div>`r`n`r`n      {/* Bottom: details (only when a follow-up is selected) */}"
$wrapperCloseB = "      </div>`n`n      {/* Bottom: details (only when a follow-up is selected) */}"
if ($fu -like "*$wrapperCloseA*") {
  $fu = $fu.Replace($wrapperCloseA, "      `r`n`r`n      {/* Bottom: details (only when a follow-up is selected) */}")
} elseif ($fu -like "*$wrapperCloseB*") {
  $fu = $fu.Replace($wrapperCloseB, "      `n`n      {/* Bottom: details (only when a follow-up is selected) */}")
} else {
  Fail "FollowUpsFeature: wrapper close anchor not found."
}
Ok "FollowUpsFeature: removed wrapper close"

# Position panels by editing the first 3 occurrences of the shared panel style
$panelStyle = '<div style={{ border: "1px solid #e4e4e7", borderRadius: 16, overflow: "hidden", background: "#fff" }}>'
$fuIdx1 = $fu.IndexOf($panelStyle)
if ($fuIdx1 -lt 0) { Fail "FollowUpsFeature: panel style (1) not found." }
$fuIdx2 = $fu.IndexOf($panelStyle, $fuIdx1 + 1)
if ($fuIdx2 -lt 0) { Fail "FollowUpsFeature: panel style (2) not found." }
$fuIdx3 = $fu.IndexOf($panelStyle, $fuIdx2 + 1)
if ($fuIdx3 -lt 0) { Fail "FollowUpsFeature: panel style (3) not found." }

$panel1 = '<div style={{ gridColumn: "1", gridRow: "1", border: "1px solid #e4e4e7", borderRadius: 16, overflow: "hidden", background: "#fff" }}>'
$panel2 = '<div style={{ gridColumn: "2", gridRow: "1", border: "1px solid #e4e4e7", borderRadius: 16, overflow: "hidden", background: "#fff" }}>'
$panel3 = '<div style={{ gridColumn: "1", gridRow: "2", border: "1px solid #e4e4e7", borderRadius: 16, overflow: "hidden", background: "#fff" }}>'

$fu = $fu.Substring(0, $fuIdx1) + $panel1 + $fu.Substring($fuIdx1 + $panelStyle.Length)
# recompute indices after replacement
$fuIdx2 = $fu.IndexOf($panelStyle, $fuIdx1 + $panel1.Length)
$fuIdx3 = $fu.IndexOf($panelStyle, $fuIdx2 + 1)
$fu = $fu.Substring(0, $fuIdx2) + $panel2 + $fu.Substring($fuIdx2 + $panelStyle.Length)
$fuIdx3 = $fu.IndexOf($panelStyle, $fuIdx2 + $panel2.Length)
$fu = $fu.Substring(0, $fuIdx3) + $panel3 + $fu.Substring($fuIdx3 + $panelStyle.Length)
Ok "FollowUpsFeature: positioned 3 existing panels into grid"

# Insert the new bottom-right Add Note panel
$tailAnchor = "      </div>`r`n`r`n    </div>`r`n  );`r`n}"
$tailAnchorLF = "      </div>`n`n    </div>`n  );`n}"

$addNotePanel = @'
      {/* Bottom-right: Add client note (tied to Client Notes) */}
      <div style={{ gridColumn: "2", gridRow: "2", border: "1px solid #e4e4e7", borderRadius: 16, overflow: "hidden", background: "#fff" }}>
        <div style={{ padding: 12, borderBottom: "1px solid #f1f5f9" }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: "#111827" }}>Add Note</div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>
            {selectedFollowUp ? `Client: ${selectedFollowUp.clientName}` : "Select a follow-up to add a client note."}
          </div>
        </div>

        <div style={{ padding: 12, display: "grid", gap: 10 }}>
          {!selectedFollowUp && (
            <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.4 }}>
              No follow-up selected.
              <br />
              Click an item in the list (green highlight) to enable adding a note for that client.
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
                  minHeight: 130,
                  borderRadius: 14,
                  border: "1px solid #e4e4e7",
                  padding: 12,
                  background: "#fff",
                  outline: "none",
                  fontSize: 13,
                }}
              />

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  onClick={() => {
                    const html = (clientNoteDraft ?? "").trim();
                    if (!html) return;

                    const key = CLIENT_NOTES_KEY_PREFIX + selectedFollowUp.clientId;
                    const createdAt = new Date().toISOString();

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
                Saved notes appear in the client’s <b>Client Notes</b> tab (per-client).
              </div>
            </>
          )}
        </div>
      </div>
'@

if ($fu -like "*$tailAnchor*") {
  $fu = $fu.Replace($tailAnchor, $addNotePanel + "`r`n`r`n" + $tailAnchor)
} elseif ($fu -like "*$tailAnchorLF*") {
  $fu = $fu.Replace($tailAnchorLF, $addNotePanel + "`n`n" + $tailAnchorLF)
} else {
  Fail "FollowUpsFeature: tail anchor not found for inserting Add Note panel."
}
Ok "FollowUpsFeature: inserted Add Note panel (2,2)"

Set-Content -Path $fuPath -Value $fu -Encoding UTF8
Ok "Patched: $fuRel"

# =========================
# Patch EstimatePickerFeature.tsx
# =========================
$ep = Get-Content -Path $epPath -Raw -Encoding UTF8

# Insert per-client notes helpers + effects right after: const activeUserName = "User";
$epAnchor = 'const activeUserName = "User";'
$epInsert = @'
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

if ($ep -notlike "*$epAnchor*") { Fail "EstimatePickerFeature: activeUserName anchor not found." }
$ep = $ep.Replace($epAnchor, $epInsert)
Ok "EstimatePickerFeature: added per-client Client Notes load/save"

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
      $entry += "- Patch: 20260305_followups_grid4_add_client_note_linked.ps1"
      $entry += "- Files: $fuRel, $epRel"
      Add-Content -Path $patchLogPath -Value ($entry -join "`r`n") -Encoding UTF8
      Ok "Appended note to: _handover\PATCHLOG.md"
    }
  }
} else {
  Warn "_handover not found; skipping snapshot/log update."
}

Ok "Done."
