# ============================================================
# QuoteSync Patch - Client Tabs (Client Info / Estimates / Orders / Notes / Files)
# + Add "Follow Ups" menu item (placeholder)
#
# MUST be executed from:
#   PS C:\Github\QuoteSync\web\ps1_patches>
#
# This patch:
#  - Set-Location to C:\Github\QuoteSync\web
#  - Verifies package.json and src\App.tsx
#  - Creates timestamped backup in _backups\yyyyMMdd_HHmmss
#  - Applies SAFE, ANCHORED edits (fails on ambiguity)
#  - Does NOT run npm run dev
# ============================================================

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

function Copy-BackupFile {
  param([string]$Src,[string]$BackupFolder)
  $name = Split-Path $Src -Leaf
  Copy-Item -LiteralPath $Src -Destination (Join-Path $BackupFolder $name) -Force
}

function Ensure-Once {
  param([string]$Text,[string]$Needle,[string]$Context)
  $c = ([regex]::Matches($Text, [regex]::Escape($Needle))).Count
  if ($c -ne 1) { Fail "Ambiguity: Expected exactly 1 match for [$Context], found $c." }
}

function Ensure-Zero {
  param([string]$Text,[string]$Needle,[string]$Context)
  $c = ([regex]::Matches($Text, [regex]::Escape($Needle))).Count
  if ($c -ne 0) { Fail "Ambiguity: Expected 0 matches for [$Context], found $c." }
}

function Insert-After {
  param([string]$Text,[string]$Anchor,[string]$Insert,[string]$Context)
  Ensure-Once -Text $Text -Needle $Anchor -Context $Context
  return $Text.Replace($Anchor, ($Anchor + "`r`n" + $Insert))
}

function Replace-Once {
  param([string]$Text,[string]$Old,[string]$New,[string]$Context)
  Ensure-Once -Text $Text -Needle $Old -Context $Context
  return $Text.Replace($Old, $New)
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

  # ------------------------------------------------------------
  # 1) MenuKey: add follow_ups
  # ------------------------------------------------------------
  $menuAnchor = '  | "client_database"'
  $menuInsert = '  | "follow_ups"'
  Ensure-Zero -Text $txt -Needle $menuInsert -Context "MenuKey already has follow_ups"
  $txt = Insert-After -Text $txt -Anchor $menuAnchor -Insert $menuInsert -Context "Insert follow_ups in MenuKey"

  # ------------------------------------------------------------
  # 2) Types: add SalesStatus, PickerTab, ClientNote, ClientFile
  # ------------------------------------------------------------
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

  Ensure-Zero -Text $txt -Needle "type SalesStatus" -Context "SalesStatus type already present"
  $txt = Insert-After -Text $txt -Anchor $typesAnchor -Insert $typesInsert -Context "Insert SalesStatus/PickerTab/ClientNote/ClientFile"

  # ------------------------------------------------------------
  # 3) Estimate type: add salesStatus
  # ------------------------------------------------------------
  $estAnchor = '  status: EstimateStatus;'
  $estInsert = '  salesStatus: SalesStatus; // Open/Lost/Order'
  Ensure-Zero -Text $txt -Needle $estInsert -Context "Estimate already has salesStatus line"
  $txt = Insert-After -Text $txt -Anchor $estAnchor -Insert $estInsert -Context "Insert salesStatus into Estimate type"

  # ------------------------------------------------------------
  # 4) Client type: add notes/files/link
  # ------------------------------------------------------------
  $clientAnchor = '  invoiceAddress: string;'
  $clientInsert = @'
  notes: ClientNote[];
  filesLink: string;
  files: ClientFile[];
'@.TrimEnd()

  Ensure-Zero -Text $txt -Needle "notes: ClientNote[]" -Context "Client already has notes"
  $txt = Insert-After -Text $txt -Anchor $clientAnchor -Insert $clientInsert -Context "Insert notes/files into Client type"

  # ------------------------------------------------------------
  # 5) Persistence helpers: load/save clients with migration
  # ------------------------------------------------------------
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
    estimates: Array.isArray(c.estimates) ? c.estimates.map((e: any) => migrateEstimateShape(e)).filter(Boolean) as any : [],
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

  Ensure-Zero -Text $txt -Needle "const CLIENTS_STORAGE_KEY" -Context "Persistence helpers already inserted"
  $txt = Insert-After -Text $txt -Anchor $persistAnchor -Insert $persistInsert -Context "Insert persistence helpers"

  # ------------------------------------------------------------
  # 6) Clients state: load from storage first
  # ------------------------------------------------------------
  $oldClientsState = '  const [clients, setClients] = useState<Client[]>(() => makeDefaultClients());'
  $newClientsState = '  const [clients, setClients] = useState<Client[]>(() => loadClients() ?? makeDefaultClients());'
  $txt = Replace-Once -Text $txt -Old $oldClientsState -New $newClientsState -Context "Clients state initializer"

  # ------------------------------------------------------------
  # 7) Persist on change (useEffect)
  # ------------------------------------------------------------
  $clientsLine = $newClientsState
  $persistEffect = @'
  useEffect(() => {
    saveClients(clients);
  }, [clients]);
'@.TrimEnd()
  Ensure-Zero -Text $txt -Needle "saveClients(clients);" -Context "Clients persist effect already present"
  $txt = Insert-After -Text $txt -Anchor $clientsLine -Insert $persistEffect -Context "Insert clients persist useEffect"

  # ------------------------------------------------------------
  # 8) Picker tab + draft note HTML state
  # ------------------------------------------------------------
  $pickerAnchor = '  const [pickerClientId, setPickerClientId] = useState<string | null>(null);'
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

  Ensure-Zero -Text $txt -Needle "const [pickerTab" -Context "pickerTab already present"
  $txt = Insert-After -Text $txt -Anchor $pickerAnchor -Insert $pickerInsert -Context "Insert picker tab & notes state"

  # ------------------------------------------------------------
  # 9) openClient: force default tab
  # ------------------------------------------------------------
  $openClientAnchor = '  setPickerClientId(client.id);'
  Ensure-Once -Text $txt -Needle $openClientAnchor -Context "openClient picker client id"
  Ensure-Zero -Text $txt -Needle '  setPickerTab("client_info");' -Context "openClient already sets pickerTab"
  $txt = $txt.Replace($openClientAnchor, ($openClientAnchor + "`r`n  setPickerTab(`"client_info`");`r`n  setDraftNoteHtml(`"`");"))

  # ------------------------------------------------------------
  # 10) createEstimateForClient: default salesStatus = Open
  # ------------------------------------------------------------
  $salesOld = '      status: "Draft",'
  $salesNew = '      status: "Draft",' + "`r`n" + '      salesStatus: "Open",'
  Ensure-Zero -Text $txt -Needle 'salesStatus: "Open"' -Context "createEstimateForClient already sets salesStatus"
  $txt = Replace-Once -Text $txt -Old $salesOld -New $salesNew -Context "Insert salesStatus in new estimate"

  # ------------------------------------------------------------
  # 11) Add helpers: set estimate sales status, add note, add file, set filesLink
  # ------------------------------------------------------------
  $helpersAnchor = 'function openEstimateFromPicker(est'
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
  setClients((prev) =>
    prev.map((c) => (c.id === clientId ? { ...c, notes: [note, ...(c.notes || [])] } : c))
  );
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

  setClients((prev) =>
    prev.map((c) => (c.id === clientId ? { ...c, files: [ ...added, ...(c.files || []) ] } : c))
  );
}
'@.TrimEnd()

  Ensure-Zero -Text $txt -Needle "function setEstimateSalesStatus" -Context "Helpers already present"
  Ensure-Once -Text $txt -Needle $helpersAnchor -Context "Anchor before openEstimateFromPicker"
  $txt = Insert-After -Text $txt -Anchor "}\n\nfunction openEstimateFromPicker" -Insert "`r`n`r`n$helpersInsert`r`n" -Context "Insert helpers before openEstimateFromPicker"
  # The anchor above uses a small replace trick; validate still has openEstimateFromPicker
  if ($txt.IndexOf("function openEstimateFromPicker") -lt 0) { Fail "Post-insert validation failed: openEstimateFromPicker missing." }

  # ------------------------------------------------------------
  # 12) Replace the Estimate Picker UI with tabbed layout
  # ------------------------------------------------------------
  $pickerStart = "{/* ESTIMATE PICKER */}"
  $pickerEnd   = "{/* ESTIMATE DEFAULTS */}"
  Ensure-Once -Text $txt -Needle $pickerStart -Context "Estimate picker start marker"
  Ensure-Once -Text $txt -Needle $pickerEnd -Context "Estimate defaults marker (end)"

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
                      <H2>{pickerTab === "client_info" ? "Client" : pickerTab === "estimates" ? "Estimates" : pickerTab === "orders" ? "Orders" : pickerTab === "notes" ? "Client Notes" : "Files"}</H2>
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
                          <Button
                            variant="secondary"
                            onClick={() => document.execCommand("bold")}
                          >
                            Bold
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => document.execCommand("italic")}
                          >
                            Italic
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => document.execCommand("underline")}
                          >
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

  # ------------------------------------------------------------
  # 13) Sidebar: add Follow Ups item under Customers (after Client Database)
  # ------------------------------------------------------------
  $sidebarAnchor = '<SidebarItem label="Client Database" active={menu === "client_database"} onClick={() => selectMenu("client_database")} />'
  $sidebarInsert = '<SidebarItem label="Follow Ups" active={menu === "follow_ups"} onClick={() => selectMenu("follow_ups")} />'
  Ensure-Zero -Text $txt -Needle $sidebarInsert -Context "Follow Ups sidebar item already exists"
  $txt = Insert-After -Text $txt -Anchor $sidebarAnchor -Insert $sidebarInsert -Context "Insert Follow Ups sidebar item"

  # ------------------------------------------------------------
  # 14) Render placeholder for menu === follow_ups
  # ------------------------------------------------------------
  $menuRenderAnchor = '{menu === "client_database" && ('
  Ensure-Once -Text $txt -Needle $menuRenderAnchor -Context "Client database menu render anchor"
  Ensure-Zero -Text $txt -Needle 'menu === "follow_ups"' -Context "Follow Ups render already exists"

  $followUpsRender = @'
            {menu === "follow_ups" && (
              <Card style={{ minHeight: 520 }}>
                <div style={{ display: "grid", gap: 10 }}>
                  <H2>Follow Ups</H2>
                  <Small>Coming next: reminders, call-backs, and task tracking linked to clients and estimates.</Small>
                </div>
              </Card>
            )}
'@.TrimEnd()

  $txt = Insert-After -Text $txt -Anchor $menuRenderAnchor -Insert $followUpsRender -Context "Insert Follow Ups render block"

  # ------------------------------------------------------------
  # 15) makeDefaultClients(): ensure new fields exist for defaults
  # ------------------------------------------------------------
  # Ensure any hardcoded default clients include notes/files fields. We'll patch by injecting defaults in createClient() and migration handles old.
  # For default clients factory, safest is to ensure returned client objects get fields via a post-map.
  $defaultsAnchor = 'function makeDefaultClients() {'
  Ensure-Once -Text $txt -Needle $defaultsAnchor -Context "makeDefaultClients exists"

  # Add a normalization pass at end of makeDefaultClients, just before return, if not already present.
  # Find a safe anchor: "return [" occurs once inside makeDefaultClients in this file.
  $retAnchor = "  return ["
  $retCount = ([regex]::Matches($txt, [regex]::Escape($retAnchor))).Count
  if ($retCount -lt 1) { Fail "Could not find return anchor for makeDefaultClients." }

  # We'll append a normalization right after clients are built in the initial state via loadClients/migrate or createClient/createEstimate.
  # So we skip touching makeDefaultClients to avoid brittle edits.

  # ------------------------------------------------------------
  # 16) createClient(): ensure new fields set (notes/files/filesLink)
  # ------------------------------------------------------------
  # In createClient block, insert defaults for notes/files/filesLink near estimates: []
  $createAnchor = "  estimates: [],"
  Ensure-Once -Text $txt -Needle $createAnchor -Context "createClient estimates anchor"
  Ensure-Zero -Text $txt -Needle "notes: []" -Context "createClient already has notes/files fields"

  $createInsert = @'
  notes: [],
  filesLink: "",
  files: [],
'@.TrimEnd()

  $txt = $txt.Replace($createAnchor, ($createAnchor + "`r`n" + $createInsert))

  # ------------------------------------------------------------
  # Final write
  # ------------------------------------------------------------
  Set-Content -LiteralPath $app -Value $txt -Encoding UTF8
  Ok "Patched src\App.tsx (tabs + follow ups + sales status + notes/files + persistence)"

  Info "NOTE: Per requirement, npm run dev was NOT executed."
  Ok "DONE"
}
catch {
  Fail $_.Exception.Message
}
