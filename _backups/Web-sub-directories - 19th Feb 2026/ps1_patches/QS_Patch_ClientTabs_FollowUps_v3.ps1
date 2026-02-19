# ============================================================
# QuoteSync Patch v3 - Client Tabs + Notes/Files + Sales Status (idempotent Follow Ups)
#
# Fixes v2 failure by treating Follow Ups render as idempotent:
# - If Follow Ups render block already exists, it will NOT fail; it will skip inserting it.
# - Same for Follow Ups sidebar item and MenuKey union: inserted only if missing.
#
# MUST be executed from:
#   PS C:\Github\QuoteSync\web\ps1_patches>
#
# This patch:
#  - Set-Location to C:\Github\QuoteSync\web
#  - Verifies package.json and src\App.tsx
#  - Creates timestamped backup in _backups\yyyyMMdd_HHmmss
#  - Block-scoped edits / anchored inserts; fails on ambiguity where required
#  - Does NOT run npm run dev
# ============================================================

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Ok($m){ Write-Host "OK: $m" -ForegroundColor Green }
function Info($m){ Write-Host "INFO: $m" -ForegroundColor Cyan }
function Warn($m){ Write-Host "WARN: $m" -ForegroundColor Yellow }
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

function Copy-BackupFile {
  param([string]$Src,[string]$BackupFolder)
  $name = Split-Path $Src -Leaf
  Copy-Item -LiteralPath $Src -Destination (Join-Path $BackupFolder $name) -Force
}

function Count-Matches {
  param([string]$Text,[string]$Needle)
  return ([regex]::Matches($Text, [regex]::Escape($Needle))).Count
}

function Ensure-Once {
  param([string]$Text,[string]$Needle,[string]$Context)
  $c = Count-Matches -Text $Text -Needle $Needle
  if ($c -ne 1) { Fail "Ambiguity: Expected exactly 1 match for [$Context], found $c." }
}

function Ensure-AtLeastOnce {
  param([string]$Text,[string]$Needle,[string]$Context)
  $c = Count-Matches -Text $Text -Needle $Needle
  if ($c -lt 1) { Fail "Missing: Expected at least 1 match for [$Context], found $c." }
}

function Insert-After-Once {
  param([string]$Text,[string]$Anchor,[string]$Insert,[string]$Context)
  Ensure-Once -Text $Text -Needle $Anchor -Context $Context
  return $Text.Replace($Anchor, ($Anchor + "`r`n" + $Insert))
}

function Replace-Once {
  param([string]$Text,[string]$Old,[string]$New,[string]$Context)
  Ensure-Once -Text $Text -Needle $Old -Context $Context
  return $Text.Replace($Old, $New)
}

function Get-BraceMatchedBlock {
  param([string]$Text,[int]$StartIndex)
  $open = $Text.IndexOf("{", $StartIndex)
  if ($open -lt 0) { return $null }
  $depth = 0
  for ($i = $open; $i -lt $Text.Length; $i++) {
    $ch = $Text[$i]
    if ($ch -eq "{") { $depth++ }
    elseif ($ch -eq "}") {
      $depth--
      if ($depth -eq 0) {
        return @{
          OpenIndex = $open
          CloseIndex = $i
          BlockText = $Text.Substring($StartIndex, ($i - $StartIndex + 1))
        }
      }
    }
  }
  return $null
}

function Replace-FunctionBlock {
  param(
    [string]$Text,
    [string]$Signature,
    [scriptblock]$Transform,
    [string]$Context
  )

  $sigIndex = $Text.IndexOf($Signature)
  if ($sigIndex -lt 0) { Fail "Could not find function signature for [$Context]: $Signature" }

  $blk = Get-BraceMatchedBlock -Text $Text -StartIndex $sigIndex
  if ($null -eq $blk) { Fail "Failed to brace-match function block for [$Context]." }

  $orig = $blk.BlockText
  $occ = Count-Matches -Text $Text -Needle $orig
  if ($occ -ne 1) { Fail "Ambiguity: Expected unique function block for [$Context], found $occ." }

  $new = & $Transform $orig
  if ($new -eq $orig) { Fail "No changes produced for [$Context] (unexpected)." }

  return $Text.Replace($orig, $new)
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

  $backupFolder = New-BackupFolder -RepoRoot $repoRoot
  Copy-BackupFile -Src $app -BackupFolder $backupFolder
  Ok "Backed up App.tsx -> $backupFolder"

  $txt = Get-Content -LiteralPath $app -Raw -Encoding UTF8

  # ---------------------------
  # A) Follow Ups menu key (idempotent)
  # ---------------------------
  $menuInsert = '  | "follow_ups"'
  if ((Count-Matches -Text $txt -Needle $menuInsert) -eq 0) {
    $menuAnchor = '  | "client_database"'
    $txt = Insert-After-Once -Text $txt -Anchor $menuAnchor -Insert $menuInsert -Context "Insert follow_ups in MenuKey"
    Ok "Inserted MenuKey follow_ups"
  } else {
    Ok "MenuKey follow_ups already present (skip)"
  }

  # ---------------------------
  # B) Types (must not already exist)
  # ---------------------------
  if ((Count-Matches -Text $txt -Needle "type SalesStatus") -gt 0) {
    Warn "Types already inserted earlier (SalesStatus present). This patch expects a clean state for tabs/types."
    Fail "SalesStatus already present. Refusing to re-apply types. Restore from backup or tell me and I will craft a continuation patch."
  }

  $typesAnchor = 'type EstimateStatus = "Draft" | "Completed";'
  $typesInsert = @'
type SalesStatus = "Open" | "Lost" | "Order";

type PickerTab = "client_info" | "estimates" | "orders" | "notes" | "files";

type ClientNote = {
  id: string;
  tsIso: string;
  user: string;
  html: string; // WYSIWYG stored as HTML
};

type ClientFile = {
  id: string;
  tsIso: string;
  user: string;
  name: string;
  mime: string;
  size: number;
  lastModified: number;
};
'@.TrimEnd()
  $txt = Insert-After-Once -Text $txt -Anchor $typesAnchor -Insert $typesInsert -Context "Insert SalesStatus/PickerTab/ClientNote/ClientFile"
  Ok "Inserted tab-related types"

  # ---------------------------
  # C) Extend Estimate + Client types
  # ---------------------------
  $estInsert = '  salesStatus: SalesStatus; // Open/Lost/Order'
  if ((Count-Matches -Text $txt -Needle $estInsert) -eq 0) {
    $estAnchor = '  status: EstimateStatus;'
    $txt = Insert-After-Once -Text $txt -Anchor $estAnchor -Insert $estInsert -Context "Insert salesStatus into Estimate type"
    Ok "Inserted Estimate.salesStatus"
  } else { Ok "Estimate.salesStatus already present (skip)" }

  $clientNeedle = "notes: ClientNote[];"
  if ((Count-Matches -Text $txt -Needle $clientNeedle) -eq 0) {
    $clientAnchor = '  invoiceAddress: string;'
    $clientInsert = @'
  notes: ClientNote[];
  filesLink: string;
  files: ClientFile[];
'@.TrimEnd()
    $txt = Insert-After-Once -Text $txt -Anchor $clientAnchor -Insert $clientInsert -Context "Insert notes/files into Client type"
    Ok "Inserted Client notes/files fields"
  } else { Ok "Client notes/files already present (skip)" }

  # ---------------------------
  # D) Persistence helpers + state init + effect
  # ---------------------------
  if ((Count-Matches -Text $txt -Needle "const CLIENTS_STORAGE_KEY") -gt 0) {
    Warn "Persistence helpers already present."
    Fail "CLIENTS_STORAGE_KEY already present. Refusing to re-apply. Restore from backup or ask for a continuation patch."
  }

  $persistAnchor = 'const DEFAULT_ESTIMATE_REF_PREFIX = "EF-EST";'
  $persistInsert = @'
const CLIENTS_STORAGE_KEY = "quotesync.clients.v1";
const CURRENT_USER_STORAGE_KEY = "quotesync.currentUser.v1";

function safeJsonParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function migrateEstimateShape(e: any): Estimate | null {
  if (!e || typeof e !== "object") return null;
  if (typeof e.id !== "string") return null;

  const salesStatus: SalesStatus = e.salesStatus === "Lost" || e.salesStatus === "Order" ? e.salesStatus : "Open";

  return {
    id: e.id,
    estimateRef: String(e.estimateRef || ""),
    baseEstimateRef: String(e.baseEstimateRef || ""),
    revisionNo: typeof e.revisionNo === "number" ? e.revisionNo : 0,
    status: e.status === "Completed" ? "Completed" : "Draft",
    salesStatus,
    defaults: e.defaults || makeDefaultEstimateDefaults(),
    positions: Array.isArray(e.positions) ? e.positions : [],
  };
}

function migrateClientShape(c: any): Client | null {
  if (!c || typeof c !== "object") return null;
  if (typeof c.id !== "string") return null;
  if (c.type !== "Business" && c.type !== "Individual") return null;

  const notes = Array.isArray(c.notes) ? c.notes : [];
  const files = Array.isArray(c.files) ? c.files : [];

  const migrated: Client = {
    id: c.id,
    type: c.type,
    clientRef: String(c.clientRef || ""),
    clientName: String(c.clientName || ""),
    email: String(c.email || ""),
    mobile: String(c.mobile || ""),
    home: String(c.home || ""),
    projectName: String(c.projectName || ""),
    projectAddress: String(c.projectAddress || ""),
    invoiceAddress: String(c.invoiceAddress || ""),
    businessName: c.businessName ? String(c.businessName) : undefined,
    contactPerson: c.contactPerson ? String(c.contactPerson) : undefined,
    estimates: Array.isArray(c.estimates) ? c.estimates.map(migrateEstimateShape).filter(Boolean) as any : [],
    notes: notes.map((n: any) => ({
      id: typeof n?.id === "string" ? n.id : uid(),
      tsIso: typeof n?.tsIso === "string" ? n.tsIso : new Date().toISOString(),
      user: typeof n?.user === "string" ? n.user : "User",
      html: typeof n?.html === "string" ? n.html : "",
    })),
    filesLink: typeof c.filesLink === "string" ? c.filesLink : "",
    files: files.map((f: any) => ({
      id: typeof f?.id === "string" ? f.id : uid(),
      tsIso: typeof f?.tsIso === "string" ? f.tsIso : new Date().toISOString(),
      user: typeof f?.user === "string" ? f.user : "User",
      name: typeof f?.name === "string" ? f.name : "file",
      mime: typeof f?.mime === "string" ? f.mime : "application/octet-stream",
      size: typeof f?.size === "number" ? f.size : 0,
      lastModified: typeof f?.lastModified === "number" ? f.lastModified : 0,
    })),
  };

  return migrated;
}

function loadClients(): Client[] | null {
  try {
    const raw = localStorage.getItem(CLIENTS_STORAGE_KEY);
    const parsed = safeJsonParse<any[]>(raw);
    if (!Array.isArray(parsed)) return null;
    const migrated = parsed.map(migrateClientShape).filter(Boolean) as Client[];
    return migrated.length ? migrated : null;
  } catch {
    return null;
  }
}

function saveClients(clients: Client[]) {
  try {
    localStorage.setItem(CLIENTS_STORAGE_KEY, JSON.stringify(clients));
  } catch {
    // ignore
  }
}
'@.TrimEnd()
  $txt = Insert-After-Once -Text $txt -Anchor $persistAnchor -Insert $persistInsert -Context "Insert persistence helpers"
  Ok "Inserted persistence helpers"

  $oldClientsState = '  const [clients, setClients] = useState<Client[]>(() => makeDefaultClients());'
  $newClientsState = '  const [clients, setClients] = useState<Client[]>(() => loadClients() ?? makeDefaultClients());'
  $txt = Replace-Once -Text $txt -Old $oldClientsState -New $newClientsState -Context "Clients state initializer"
  Ok "Updated clients state init to loadClients()"

  $persistEffectNeedle = "saveClients(clients);"
  if ((Count-Matches -Text $txt -Needle $persistEffectNeedle) -eq 0) {
    $persistEffect = @'
  useEffect(() => {
    saveClients(clients);
  }, [clients]);
'@.TrimEnd()
    $txt = Insert-After-Once -Text $txt -Anchor $newClientsState -Insert $persistEffect -Context "Insert clients persist useEffect"
    Ok "Inserted clients persist effect"
  } else {
    Ok "Clients persist effect already present (skip)"
  }

  # ---------------------------
  # E) Picker state
  # ---------------------------
  $pickerAnchor = '  const [pickerClientId, setPickerClientId] = useState<string | null>(null);'
  $pickerNeedle = "const [pickerTab"
  if ((Count-Matches -Text $txt -Needle $pickerNeedle) -gt 0) {
    Warn "pickerTab already present."
    Fail "pickerTab already present. Refusing to re-apply."
  }

  $pickerInsert = @'
  const [pickerTab, setPickerTab] = useState<PickerTab>("client_info");
  const [draftNoteHtml, setDraftNoteHtml] = useState<string>("");
  const [currentUser, setCurrentUser] = useState<string>(() => {
    try {
      const v = localStorage.getItem(CURRENT_USER_STORAGE_KEY);
      return v && v.trim() ? v : "User";
    } catch {
      return "User";
    }
  });

  useEffect(() => {
    try { localStorage.setItem(CURRENT_USER_STORAGE_KEY, currentUser); } catch {}
  }, [currentUser]);
'@.TrimEnd()

  $txt = Insert-After-Once -Text $txt -Anchor $pickerAnchor -Insert $pickerInsert -Context "Insert picker tab & notes state"
  Ok "Inserted picker tab/current user state"

  if ((Count-Matches -Text $txt -Needle 'setPickerTab("client_info")') -eq 0) {
    $openClientAnchor = '  setPickerClientId(client.id);'
    Ensure-Once -Text $txt -Needle $openClientAnchor -Context "openClient setPickerClientId anchor"
    $txt = $txt.Replace($openClientAnchor, ($openClientAnchor + "`r`n  setPickerTab(`"client_info`");`r`n  setDraftNoteHtml(`"`");"))
    Ok "Updated openClient to default to Client Info tab"
  } else {
    Ok "openClient already sets pickerTab (skip)"
  }

  # ---------------------------
  # F) Ensure createEstimateForClient adds salesStatus Open
  # ---------------------------
  $txt = Replace-FunctionBlock -Text $txt -Signature "function createEstimateForClient" -Context "createEstimateForClient" -Transform {
    param($blk)
    if ($blk -match "salesStatus:\s*`"Open`"") { Fail "createEstimateForClient already has salesStatus Open (unexpected for this patch)." }
    $needle = 'status: "Draft",'
    $cnt = (Count-Matches -Text $blk -Needle $needle)
    if ($cnt -ne 1) { Fail "Ambiguity inside createEstimateForClient: expected 1 '$needle', found $cnt." }
    return $blk.Replace($needle, ($needle + "`r`n      salesStatus: `"`Open`",")) 
  }
  Ok "Patched createEstimateForClient salesStatus default"

  # ---------------------------
  # G) Insert helpers above openEstimateFromPicker
  # ---------------------------
  $helpersNeedle = "function setEstimateSalesStatus"
  if ((Count-Matches -Text $txt -Needle $helpersNeedle) -gt 0) {
    Warn "Helpers already present."
    Fail "Helpers already present. Refusing to re-apply."
  }

  $helpersInsert = @'
function setEstimateSalesStatus(clientId: string, estimateId: string, salesStatus: SalesStatus) {
  setClients((prev) =>
    prev.map((c) =>
      c.id !== clientId
        ? c
        : {
            ...c,
            estimates: c.estimates.map((e) => (e.id === estimateId ? { ...e, salesStatus } : e)),
          }
    )
  );
}

function addClientNote(clientId: string, html: string, user: string) {
  const trimmed = (html || "").trim();
  if (!trimmed) return;
  const note: ClientNote = { id: uid(), tsIso: new Date().toISOString(), user: user || "User", html: trimmed };
  setClients((prev) => prev.map((c) => (c.id === clientId ? { ...c, notes: [note, ...(c.notes || [])] } : c)));
}

function setClientFilesLink(clientId: string, link: string) {
  setClients((prev) => prev.map((c) => (c.id === clientId ? { ...c, filesLink: link } : c)));
}

function addClientFiles(clientId: string, files: FileList | null, user: string) {
  if (!files || files.length === 0) return;
  const added: ClientFile[] = Array.from(files).map((f) => ({
    id: uid(),
    tsIso: new Date().toISOString(),
    user: user || "User",
    name: f.name,
    mime: f.type || "application/octet-stream",
    size: f.size,
    lastModified: f.lastModified,
  }));

  setClients((prev) => prev.map((c) => (c.id === clientId ? { ...c, files: [...added, ...(c.files || [])] } : c)));
}
'@.TrimEnd()

  $sig = "function openEstimateFromPicker"
  $idx = $txt.IndexOf($sig)
  if ($idx -lt 0) { Fail "Could not find openEstimateFromPicker signature." }
  $txt = $txt.Insert($idx, ($helpersInsert + "`r`n`r`n"))
  Ok "Inserted helpers above openEstimateFromPicker"

  # ---------------------------
  # H) Replace estimate picker UI with tabbed layout (markers required)
  # ---------------------------
  $pickerStart = "{/* ESTIMATE PICKER */}"
  $pickerEnd   = "{/* ESTIMATE DEFAULTS */}"
  Ensure-Once -Text $txt -Needle $pickerStart -Context "Estimate picker start marker"
  Ensure-Once -Text $txt -Needle $pickerEnd -Context "Estimate defaults marker"

  $startIdx = $txt.IndexOf($pickerStart)
  $endIdx = $txt.IndexOf($pickerEnd)
  if ($endIdx -le $startIdx) { Fail "Markers out of order for picker replacement." }

  $before = $txt.Substring(0, $startIdx)
  $after  = $txt.Substring($endIdx)

  $newPicker = @'
            {/* ESTIMATE PICKER */}
            {view === "estimate_picker" && pickerClient && (
              <Card style={{ minHeight: 520 }}>
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <H2>
                        {pickerTab === "client_info"
                          ? "Client"
                          : pickerTab === "estimates"
                            ? "Estimates"
                            : pickerTab === "orders"
                              ? "Orders"
                              : pickerTab === "notes"
                                ? "Client Notes"
                                : "Files"}
                      </H2>
                      <Small>
                        {pickerClient.clientName} • {pickerClient.clientRef}
                      </Small>
                    </div>

                    <div style={{ display: "flex", gap: 10 }}>
                      <Button variant="secondary" onClick={() => setView("customers")}>
                        Back
                      </Button>
                      <Button variant="primary" onClick={() => createEstimateForClient(pickerClient)}>
                        New Estimate
                      </Button>
                    </div>
                  </div>

                  {/* Tabs */}
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      flexWrap: "wrap",
                      borderBottom: "1px solid #e4e4e7",
                      paddingBottom: 8,
                    }}
                  >
                    {[
                      ["client_info", "Client Info"],
                      ["estimates", "Estimates"],
                      ["orders", "Orders"],
                      ["notes", "Client Notes"],
                      ["files", "Files"],
                    ].map(([k, label]) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setPickerTab(k as PickerTab)}
                        style={{
                          border: "1px solid #e4e4e7",
                          borderBottom: pickerTab === k ? "2px solid #16a34a" : "1px solid #e4e4e7",
                          background: pickerTab === k ? "#f0fdf4" : "#fff",
                          borderRadius: 10,
                          padding: "8px 10px",
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {/* Tab: Client Info */}
                  {pickerTab === "client_info" && (
                    <div style={{ display: "grid", gap: 12 }}>
                      <ClientDetailsReadonly c={pickerClient} onEdit={() => openEditClientPanel(pickerClient)} />
                    </div>
                  )}

                  {/* Tab: Estimates */}
                  {pickerTab === "estimates" && (
                    <div style={{ display: "grid", gap: 10 }}>
                      {pickerClient.estimates.length === 0 && (
                        <div style={{ padding: 12, border: "1px dashed #d4d4d8", borderRadius: 12, color: "#52525b" }}>
                          No estimates yet.
                        </div>
                      )}

                      {pickerClient.estimates.map((e) => (
                        <div
                          key={e.id}
                          style={{
                            borderRadius: 14,
                            border: "1px solid #e4e4e7",
                            padding: 10,
                            background: "#fff",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 10,
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                            <div style={{ display: "grid" }}>
                              <strong style={{ fontSize: 14 }}>{e.estimateRef}</strong>
                              <Small>
                                {e.status} • Sales: {e.salesStatus || "Open"}
                              </Small>
                            </div>

                            <div style={{ display: "grid", gap: 4 }}>
                              <Small style={{ color: "#52525b" }}>Sales status</Small>
                              <select
                                value={(e.salesStatus || "Open") as any}
                                onChange={(ev) => setEstimateSalesStatus(pickerClient.id, e.id, ev.target.value as SalesStatus)}
                                style={{
                                  border: "1px solid #e4e4e7",
                                  borderRadius: 10,
                                  padding: "8px 10px",
                                  fontSize: 13,
                                  background: "#fff",
                                }}
                              >
                                <option value="Open">Open</option>
                                <option value="Lost">Lost</option>
                                <option value="Order">Order</option>
                              </select>
                            </div>
                          </div>

                          <div style={{ display: "flex", gap: 10 }}>
                            <Button variant="primary" onClick={() => openEstimateFromPicker(e.id)}>
                              Open
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Tab: Orders */}
                  {pickerTab === "orders" && (
                    <div style={{ display: "grid", gap: 10 }}>
                      {pickerClient.estimates.filter((e) => (e.salesStatus || "Open") === "Order").length === 0 && (
                        <div style={{ padding: 12, border: "1px dashed #d4d4d8", borderRadius: 12, color: "#52525b" }}>
                          No orders yet. Mark an estimate as <strong>Order</strong> in the Estimates tab.
                        </div>
                      )}

                      {pickerClient.estimates
                        .filter((e) => (e.salesStatus || "Open") === "Order")
                        .map((e) => (
                          <div
                            key={e.id}
                            style={{
                              borderRadius: 14,
                              border: "1px solid #e4e4e7",
                              padding: 10,
                              background: "#fff",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              gap: 10,
                            }}
                          >
                            <div style={{ display: "grid" }}>
                              <strong style={{ fontSize: 14 }}>{e.estimateRef}</strong>
                              <Small>{e.status} • Sales: Order</Small>
                            </div>

                            <div style={{ display: "flex", gap: 10 }}>
                              <Button variant="primary" onClick={() => openEstimateFromPicker(e.id)}>
                                Open
                              </Button>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}

                  {/* Tab: Client Notes */}
                  {pickerTab === "notes" && (
                    <div style={{ display: "grid", gap: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          <Small style={{ color: "#52525b" }}>User</Small>
                          <input
                            value={currentUser}
                            onChange={(e) => setCurrentUser(e.target.value)}
                            style={{
                              border: "1px solid #e4e4e7",
                              borderRadius: 10,
                              padding: "8px 10px",
                              fontSize: 13,
                              width: 220,
                            }}
                          />
                        </div>

                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <Button variant="secondary" onClick={() => document.execCommand("bold")}>
                            Bold
                          </Button>
                          <Button variant="secondary" onClick={() => document.execCommand("italic")}>
                            Italic
                          </Button>
                          <Button variant="secondary" onClick={() => document.execCommand("underline")}>
                            Underline
                          </Button>
                        </div>
                      </div>

                      <div
                        contentEditable
                        suppressContentEditableWarning
                        onInput={(e) => setDraftNoteHtml((e.currentTarget as HTMLDivElement).innerHTML)}
                        style={{
                          border: "1px solid #e4e4e7",
                          borderRadius: 14,
                          padding: 12,
                          minHeight: 120,
                          background: "#fff",
                          outline: "none",
                        }}
                      />

                      <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <Button
                          variant="primary"
                          onClick={() => {
                            addClientNote(pickerClient.id, draftNoteHtml, currentUser);
                            setDraftNoteHtml("");
                          }}
                        >
                          Add Note
                        </Button>
                      </div>

                      <div style={{ display: "grid", gap: 10 }}>
                        {(pickerClient.notes || []).length === 0 && (
                          <div style={{ padding: 12, border: "1px dashed #d4d4d8", borderRadius: 12, color: "#52525b" }}>
                            No notes yet.
                          </div>
                        )}

                        {(pickerClient.notes || []).map((n) => (
                          <div
                            key={n.id}
                            style={{
                              borderRadius: 14,
                              border: "1px solid #e4e4e7",
                              padding: 10,
                              background: "#fff",
                              display: "grid",
                              gap: 8,
                            }}
                          >
                            <Small>
                              {new Date(n.tsIso).toLocaleString()} • {n.user}
                            </Small>
                            <div dangerouslySetInnerHTML={{ __html: n.html }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tab: Files */}
                  {pickerTab === "files" && (
                    <div style={{ display: "grid", gap: 12 }}>
                      <div style={{ display: "grid", gap: 6 }}>
                        <Small style={{ color: "#52525b" }}>Client files URL (SharePoint / OneDrive / Google Drive / local path)</Small>
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                          <input
                            value={pickerClient.filesLink || ""}
                            onChange={(e) => setClientFilesLink(pickerClient.id, e.target.value)}
                            placeholder="Paste folder URL or file path…"
                            style={{
                              flex: "1 1 420px",
                              border: "1px solid #e4e4e7",
                              borderRadius: 10,
                              padding: "10px 12px",
                              fontSize: 13,
                              background: "#fff",
                            }}
                          />
                          <Button
                            variant="secondary"
                            onClick={() => {
                              const link = (pickerClient.filesLink || "").trim();
                              if (link) window.open(link, "_blank");
                            }}
                          >
                            Open Link
                          </Button>
                        </div>
                      </div>

                      <div style={{ display: "grid", gap: 6 }}>
                        <Small style={{ color: "#52525b" }}>Upload file (records metadata only in this prototype)</Small>
                        <input
                          type="file"
                          multiple
                          accept=".dwg,.dxf,.xlsx,.xls,.doc,.docx,.pdf,.skp,.png,.jpg,.jpeg"
                          onChange={(e) => addClientFiles(pickerClient.id, e.target.files, currentUser)}
                        />
                      </div>

                      <div style={{ display: "grid", gap: 10 }}>
                        {(pickerClient.files || []).length === 0 && (
                          <div style={{ padding: 12, border: "1px dashed #d4d4d8", borderRadius: 12, color: "#52525b" }}>
                            No files logged yet.
                          </div>
                        )}

                        {(pickerClient.files || []).map((f) => (
                          <div
                            key={f.id}
                            style={{
                              borderRadius: 14,
                              border: "1px solid #e4e4e7",
                              padding: 10,
                              background: "#fff",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              gap: 10,
                              flexWrap: "wrap",
                            }}
                          >
                            <div style={{ display: "grid" }}>
                              <strong style={{ fontSize: 14 }}>{f.name}</strong>
                              <Small>
                                {new Date(f.tsIso).toLocaleString()} • {f.user} • {(f.size / 1024).toFixed(1)} KB
                              </Small>
                            </div>
                            <Small style={{ color: "#52525b" }}>{f.mime}</Small>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            )}
'@.TrimEnd()

  $txt = $before + $newPicker + "`r`n`r`n            " + $after
  Ok "Replaced estimate picker UI with tabbed layout"

  # ---------------------------
  # I) Sidebar Follow Ups item (idempotent)
  # ---------------------------
  $sidebarInsert = '<SidebarItem label="Follow Ups" active={menu === "follow_ups"} onClick={() => selectMenu("follow_ups")} />'
  if ((Count-Matches -Text $txt -Needle $sidebarInsert) -eq 0) {
    $sidebarAnchor = '<SidebarItem label="Client Database" active={menu === "client_database"} onClick={() => selectMenu("client_database")} />'
    $txt = Insert-After-Once -Text $txt -Anchor $sidebarAnchor -Insert $sidebarInsert -Context "Insert Follow Ups sidebar item"
    Ok "Inserted Follow Ups sidebar item"
  } else {
    Ok "Follow Ups sidebar item already present (skip)"
  }

  # ---------------------------
  # J) Follow Ups render block (idempotent)
  # ---------------------------
  $followUpsNeedle = '{menu === "follow_ups" && view === "customers" && ('
  if ((Count-Matches -Text $txt -Needle $followUpsNeedle) -eq 0) {
    $clientDbRenderAnchor = '{menu === "client_database" && view === "customers" && ('
    Ensure-Once -Text $txt -Needle $clientDbRenderAnchor -Context "Client Database render anchor"
    $followUpsRender = @'
            {menu === "follow_ups" && view === "customers" && (
              <Card style={{ minHeight: 520 }}>
                <div style={{ display: "grid", gap: 10 }}>
                  <H2>Follow Ups</H2>
                  <Small>Coming next: reminders, call-backs, and task tracking linked to clients and estimates.</Small>
                </div>
              </Card>
            )}
'@.TrimEnd()
    $txt = Insert-After-Once -Text $txt -Anchor $clientDbRenderAnchor -Insert $followUpsRender -Context "Insert Follow Ups render block"
    Ok "Inserted Follow Ups render block"
  } else {
    Ok "Follow Ups render block already present (skip)"
  }

  # ---------------------------
  # K) createClient adds notes/files/filesLink (block-scoped)
  # ---------------------------
  $txt = Replace-FunctionBlock -Text $txt -Signature "function createClient(type: ClientType)" -Context "createClient" -Transform {
    param($blk)
    if ($blk -match "notes:\s*\[\]") { Fail "createClient already has notes/files fields (unexpected for this patch)." }
    $needle = "estimates: [],"
    $cnt = (Count-Matches -Text $blk -Needle $needle)
    if ($cnt -ne 1) { Fail "Ambiguity inside createClient: expected 1 '$needle', found $cnt." }
    $insert = $needle + "`r`n    notes: [],`r`n    filesLink: `"`",`r`n    files: [],"
    return $blk.Replace($needle, $insert)
  }
  Ok "Patched createClient to include notes/files"

  Set-Content -LiteralPath $app -Value $txt -Encoding UTF8
  Ok "Wrote src\App.tsx"

  Info "NOTE: Per requirement, npm run dev was NOT executed."
  Ok "DONE"
}
catch {
  Fail $_.Exception.Message
}
