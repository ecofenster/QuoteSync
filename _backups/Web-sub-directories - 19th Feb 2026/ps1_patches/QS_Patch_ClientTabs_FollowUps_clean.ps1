# ============================================================
# QuoteSync Patch - Add Client Tabs in Estimate Picker + Follow Ups menu
# (Client Info / Estimates / Orders / Client Notes / Files)
#
# IMPORTANT:
# - This patch uses the uploaded/known-good App.tsx baseline (no partial-state assumptions)
# - No manual edits required
#
# MUST be executed from:
#   PS C:\Github\QuoteSync\web\ps1_patches>
#
# This patch:
#  - Set-Location to C:\Github\QuoteSync\web
#  - Verifies package.json and src\App.tsx
#  - Creates timestamped backup in _backups\yyyyMMdd_HHmmss
#  - Applies block-scoped edits (brace-matched) + marker-based JSX replacement
#  - Fails on ambiguity
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

function Count-Matches([string]$Text,[string]$Needle){
  return ([regex]::Matches($Text, [regex]::Escape($Needle))).Count
}

function Ensure-Once([string]$Text,[string]$Needle,[string]$Context){
  $c = Count-Matches $Text $Needle
  if ($c -ne 1) { Fail "Ambiguity: Expected exactly 1 match for [$Context], found $c." }
}

function Ensure-Zero([string]$Text,[string]$Needle,[string]$Context){
  $c = Count-Matches $Text $Needle
  if ($c -ne 0) { Fail "Ambiguity: Expected 0 matches for [$Context], found $c." }
}

function Get-BraceMatchedBlock([string]$Text,[int]$StartIndex){
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

  $blk = Get-BraceMatchedBlock $Text $sigIndex
  if ($null -eq $blk) { Fail "Failed to brace-match function block for [$Context]." }

  $orig = $blk.BlockText
  $occ = Count-Matches $Text $orig
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
  Ok "Backed up App.tsx -> $backupFolder\App.tsx"

  $txt = Get-Content -LiteralPath $app -Raw -Encoding UTF8

  # ------------------------------------------------------------
  # 1) MenuKey: add "follow_ups"
  # ------------------------------------------------------------
  $menuInsert = '  | "follow_ups"'
  Ensure-Zero $txt $menuInsert "MenuKey already has follow_ups"
  $menuAnchor = '  | "client_database"'
  Ensure-Once $txt $menuAnchor "MenuKey anchor client_database"
  $txt = $txt.Replace($menuAnchor, ($menuAnchor + "`r`n" + $menuInsert))
  Ok "Added MenuKey follow_ups"

  # ------------------------------------------------------------
  # 2) Types: SalesStatus/PickerTab/ClientNote/ClientFile
  # ------------------------------------------------------------
  Ensure-Zero $txt "type SalesStatus" "SalesStatus already present"
  $typesAnchor = 'type EstimateStatus = "Draft" | "Completed";'
  Ensure-Once $txt $typesAnchor "EstimateStatus anchor"
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
  $txt = $txt.Replace($typesAnchor, ($typesAnchor + "`r`n`r`n" + $typesInsert))
  Ok "Added SalesStatus/PickerTab/ClientNote/ClientFile types"

  # ------------------------------------------------------------
  # 3) Extend Estimate + Client types
  # ------------------------------------------------------------
  $estAnchor = "  status: EstimateStatus;"
  Ensure-Once $txt $estAnchor "Estimate.status anchor"
  Ensure-Zero $txt "salesStatus: SalesStatus" "Estimate.salesStatus already present"
  $txt = $txt.Replace($estAnchor, ($estAnchor + "`r`n  salesStatus: SalesStatus; // Open/Lost/Order"))
  Ok "Extended Estimate type"

  $clientAnchor = "  invoiceAddress: string;"
  Ensure-Once $txt $clientAnchor "Client.invoiceAddress anchor"
  Ensure-Zero $txt "notes: ClientNote[]" "Client.notes already present"
  $txt = $txt.Replace($clientAnchor, ($clientAnchor + "`r`n`r`n  notes: ClientNote[];`r`n  filesLink: string;`r`n  files: ClientFile[];"))
  Ok "Extended Client type"

  # ------------------------------------------------------------
  # 4) Persistence helpers + load/save clients
  # ------------------------------------------------------------
  Ensure-Zero $txt "const CLIENTS_STORAGE_KEY" "Persistence already present"
  $persistAnchor = 'const DEFAULT_ESTIMATE_REF_PREFIX = "EF-EST";'
  Ensure-Once $txt $persistAnchor "DEFAULT_ESTIMATE_REF_PREFIX anchor"
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

  return {
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
    estimates: Array.isArray(c.estimates) ? (c.estimates.map(migrateEstimateShape).filter(Boolean) as Estimate[]) : [],
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

  $txt = $txt.Replace($persistAnchor, ($persistAnchor + "`r`n`r`n" + $persistInsert))
  Ok "Inserted localStorage helpers"

  # ------------------------------------------------------------
  # 5) Clients state: init from storage + persist effect
  # ------------------------------------------------------------
  $oldClientsState = '  const [clients, setClients] = useState<Client[]>(() => makeDefaultClients());'
  Ensure-Once $txt $oldClientsState "clients state initializer"
  $newClientsState = '  const [clients, setClients] = useState<Client[]>(() => loadClients() ?? makeDefaultClients());'
  $txt = $txt.Replace($oldClientsState, $newClientsState)
  Ok "Updated clients init to loadClients()"

  Ensure-Zero $txt "saveClients(clients);" "clients persist effect already present"
  $txt = $txt.Replace($newClientsState, ($newClientsState + "`r`n`r`n  useEffect(() => {`r`n    saveClients(clients);`r`n  }, [clients]);"))
  Ok "Inserted clients persist effect"

  # ------------------------------------------------------------
  # 6) makeDefaultClients(): add notes/filesLink/files defaults (block-scoped)
  # ------------------------------------------------------------
  $txt = Replace-FunctionBlock -Text $txt -Signature "function makeDefaultClients(): Client[]" -Context "makeDefaultClients" -Transform {
    param($blk)
    if ($blk -match "notes:\s*\[\]") { Fail "makeDefaultClients already has notes/files (unexpected)." }
    $needle = "estimates: [],"
    $cnt = (Count-Matches $blk $needle)
    if ($cnt -ne 2) { Fail "Ambiguity inside makeDefaultClients: expected 2 occurrences of '$needle', found $cnt." }
    return $blk.Replace($needle, ($needle + "`r`n      notes: [],`r`n      filesLink: `"`",`r`n      files: [],"))
  }
  Ok "Extended makeDefaultClients defaults"

  # ------------------------------------------------------------
  # 7) createClient(): projectName + notes/files defaults (block-scoped)
  # ------------------------------------------------------------
  $txt = Replace-FunctionBlock -Text $txt -Signature "function createClient(type: ClientType)" -Context "createClient" -Transform {
    param($blk)

    # projectName
    $old = 'projectName: "",'
    $cnt = (Count-Matches $blk $old)
    if ($cnt -ne 1) { Fail "Ambiguity inside createClient: expected 1 '$old', found $cnt." }
    $blk2 = $blk.Replace($old, 'projectName: draftProjectName.trim(),')

    # notes/files
    if ($blk2 -match "notes:\s*\[\]") { Fail "createClient already has notes/files fields (unexpected)." }
    $needle = "estimates: [],"
    $cnt2 = (Count-Matches $blk2 $needle)
    if ($cnt2 -ne 1) { Fail "Ambiguity inside createClient: expected 1 '$needle', found $cnt2." }
    return $blk2.Replace($needle, ($needle + "`r`n      notes: [],`r`n      filesLink: `"`",`r`n      files: [],"))
  }
  Ok "Patched createClient (projectName + notes/files)"

  # ------------------------------------------------------------
  # 8) createEstimateForClient(): default salesStatus Open (block-scoped)
  # ------------------------------------------------------------
  $txt = Replace-FunctionBlock -Text $txt -Signature "function createEstimateForClient(client: Client)" -Context "createEstimateForClient" -Transform {
    param($blk)
    if ($blk -match "salesStatus:\s*`"") { Fail "createEstimateForClient already has salesStatus (unexpected)." }
    $needle = 'status: "Draft",'
    $cnt = (Count-Matches $blk $needle)
    if ($cnt -ne 1) { Fail "Ambiguity inside createEstimateForClient: expected 1 '$needle', found $cnt." }
    return $blk.Replace($needle, ($needle + "`r`n      salesStatus: `"`Open`",")) 
  }
  Ok "Patched createEstimateForClient salesStatus default"

  # ------------------------------------------------------------
  # 9) State: pickerTab/draftNoteHtml/currentUser (after pickerClientId)
  # ------------------------------------------------------------
  $pickerAnchor = '  const [pickerClientId, setPickerClientId] = useState<string | null>(null);'
  Ensure-Once $txt $pickerAnchor "pickerClientId state anchor"
  Ensure-Zero $txt "const [pickerTab" "pickerTab already exists"

  $pickerStateInsert = @'
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

  $txt = $txt.Replace($pickerAnchor, ($pickerAnchor + "`r`n" + $pickerStateInsert))
  Ok "Inserted picker tab + notes state"

  # Ensure openClient sets default tab and clears draft
  Ensure-Zero $txt 'setPickerTab("client_info")' "openClient already sets pickerTab"
  $openClientAnchor = '  setPickerClientId(client.id);'
  Ensure-Once $txt $openClientAnchor "openClient anchor setPickerClientId"
  $txt = $txt.Replace($openClientAnchor, ($openClientAnchor + "`r`n  setPickerTab(`"client_info`");`r`n  setDraftNoteHtml(`"`");"))
  Ok "Updated openClient to default to Client Info tab"

  # ------------------------------------------------------------
  # 10) Helpers: setEstimateSalesStatus / addClientNote / setClientFilesLink / addClientFiles
  # Inserted above openEstimateFromPicker
  # ------------------------------------------------------------
  Ensure-Zero $txt "function setEstimateSalesStatus" "helpers already exist"
  $helpers = @'
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
  $txt = $txt.Insert($idx, ($helpers + "`r`n`r`n"))
  Ok "Inserted helpers above openEstimateFromPicker"

  # ------------------------------------------------------------
  # 11) Sidebar: add Follow Ups under Customers
  # ------------------------------------------------------------
  $sidebarAnchor = '<SidebarItem label="Client Database" active={menu === "client_database"} onClick={() => selectMenu("client_database")} />'
  Ensure-Once $txt $sidebarAnchor "Sidebar Client Database item"
  Ensure-Zero $txt 'label="Follow Ups"' "Follow Ups sidebar already exists"
  $txt = $txt.Replace($sidebarAnchor, ($sidebarAnchor + "`r`n                " + '<SidebarItem label="Follow Ups" active={menu === "follow_ups"} onClick={() => selectMenu("follow_ups")} />'))
  Ok "Inserted Follow Ups sidebar item"

  # ------------------------------------------------------------
  # 12) Customers main render: Follow Ups placeholder (insert before ESTIMATE PICKER marker)
  # ------------------------------------------------------------
  $estimatePickerMarker = "{/* ESTIMATE PICKER */}"
  Ensure-Once $txt $estimatePickerMarker "ESTIMATE PICKER marker"
  Ensure-Zero $txt '{menu === "follow_ups" && view === "customers"' "Follow Ups render already exists"

  $followUpsRender = @'
            {/* FOLLOW UPS */}
            {menu === "follow_ups" && view === "customers" && (
              <Card style={{ minHeight: 520 }}>
                <div style={{ display: "grid", gap: 10 }}>
                  <H2>Follow Ups</H2>
                  <Small>Coming next: reminders, call-backs, and task tracking linked to clients and estimates.</Small>
                </div>
              </Card>
            )}
'@.TrimEnd()

  $txt = $txt.Replace($estimatePickerMarker, ($followUpsRender + "`r`n`r`n            " + $estimatePickerMarker))
  Ok "Inserted Follow Ups view render"

  # ------------------------------------------------------------
  # 13) Replace estimate picker UI with tabbed layout between markers
  # ------------------------------------------------------------
  $startMarker = "{/* ESTIMATE PICKER */}"
  $endMarker   = "{/* ESTIMATE DEFAULTS */}"
  Ensure-Once $txt $startMarker "Picker start marker"
  Ensure-Once $txt $endMarker "Picker end marker"

  $startIdx = $txt.IndexOf($startMarker)
  $endIdx = $txt.IndexOf($endMarker)
  if ($endIdx -le $startIdx) { Fail "Markers out of order for picker replacement." }

  $before = $txt.Substring(0, $startIdx)
  $after = $txt.Substring($endIdx)

  $newPicker = @'
            {/* ESTIMATE PICKER */}
            {view === "estimate_picker" && pickerClient && (
              <Card style={{ minHeight: 520 }}>
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <H2>
                        {pickerTab === "client_info"
                          ? "Client Info"
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
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", borderBottom: "1px solid #e4e4e7", paddingBottom: 8 }}>
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

                  {/* Client Info */}
                  {pickerTab === "client_info" && (
                    <div style={{ display: "grid", gap: 12 }}>
                      <ClientDetailsReadonly c={pickerClient} onEdit={() => openEditClientPanel(pickerClient)} />
                    </div>
                  )}

                  {/* Estimates */}
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
                              <Pill>{e.estimateRef}</Pill>
                              <Small>{e.status} • {e.positions.length} positions</Small>
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

                          <Button variant="primary" onClick={() => openEstimateFromPicker(e.id)}>
                            Open
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Orders */}
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
                            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                              <Pill>{e.estimateRef}</Pill>
                              <Small>{e.status}</Small>
                            </div>
                            <Button variant="primary" onClick={() => openEstimateFromPicker(e.id)}>
                              Open
                            </Button>
                          </div>
                        ))}
                    </div>
                  )}

                  {/* Client Notes */}
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
                          <Button variant="secondary" onClick={() => document.execCommand("bold")}>Bold</Button>
                          <Button variant="secondary" onClick={() => document.execCommand("italic")}>Italic</Button>
                          <Button variant="secondary" onClick={() => document.execCommand("underline")}>Underline</Button>
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
                            <Small>{new Date(n.tsIso).toLocaleString()} • {n.user}</Small>
                            <div dangerouslySetInnerHTML={{ __html: n.html }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Files */}
                  {pickerTab === "files" && (
                    <div style={{ display: "grid", gap: 12 }}>
                      <div style={{ display: "grid", gap: 6 }}>
                        <Small style={{ color: "#52525b" }}>Client files URL / folder link</Small>
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                          <input
                            value={pickerClient.filesLink || ""}
                            onChange={(e) => setClientFilesLink(pickerClient.id, e.target.value)}
                            placeholder="Paste SharePoint/OneDrive/Drive URL or folder path…"
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
                        <Small style={{ color: "#52525b" }}>Upload files (metadata only in prototype)</Small>
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

  $txt = $before + $newPicker + "`r`n            " + $after
  Ok "Replaced estimate picker with tabbed UI"

  # ------------------------------------------------------------
  # Write file
  # ------------------------------------------------------------
  Set-Content -LiteralPath $app -Value $txt -Encoding UTF8
  Ok "Patched src\App.tsx"

  Info "NOTE: Per requirement, npm run dev was NOT executed."
  Ok "DONE"
}
catch {
  Fail $_.Exception.Message
}
