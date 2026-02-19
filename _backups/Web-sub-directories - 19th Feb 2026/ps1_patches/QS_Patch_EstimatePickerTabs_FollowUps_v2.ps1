# ============================================================
# QuoteSync Patch v2 - Estimate Picker Tabs + Follow Ups (robust sidebar anchor)
#
# Implements ONLY:
# - Estimate Picker tabs (Client Info / Estimates / Orders / Client Notes / Files)
# - Sales status dropdown Open/Lost/Order + Orders tab
# - Notes WYSIWYG (basic) with timestamp + user
# - Files link field + upload metadata list
# - Add Customers menu item: Follow Ups + placeholder view
#
# Robust fixes vs v1:
# - Sidebar insertion finds the Client Database SidebarItem via regex (not exact string)
# - All inserts are idempotent (safe to re-run). If already present, it skips.
#
# MUST run from:
#   PS C:\Github\QuoteSync\web\ps1_patches>
#
# This patch:
#  - Set-Location to C:\Github\QuoteSync\web
#  - Verifies package.json and src\App.tsx
#  - Creates timestamped backup in _backups\yyyyMMdd_HHmmss
#  - Scoped edits only; fails on ambiguity
#  - DOES NOT run npm run dev
# ============================================================

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Ok($m){ Write-Host "OK: $m" -ForegroundColor Green }
function Info($m){ Write-Host "INFO: $m" -ForegroundColor Cyan }
function Warn($m){ Write-Host "WARN: $m" -ForegroundColor Yellow }
function Fail($m){ Write-Host "ERROR: $m" -ForegroundColor Red; throw $m }

function New-BackupFolder([string]$RepoRoot){
  $stamp = Get-Date -Format "yyyyMMdd_HHmmss"
  $bdir = Join-Path $RepoRoot "_backups"
  if (-not (Test-Path $bdir)) { New-Item -ItemType Directory -Path $bdir | Out-Null }
  $dest = Join-Path $bdir $stamp
  New-Item -ItemType Directory -Path $dest | Out-Null
  return $dest
}

function Copy-BackupFile([string]$Src,[string]$BackupFolder){
  $name = Split-Path $Src -Leaf
  Copy-Item -LiteralPath $Src -Destination (Join-Path $BackupFolder $name) -Force
}

function Count-Literal([string]$Text,[string]$Needle){
  return ([regex]::Matches($Text, [regex]::Escape($Needle))).Count
}

function Ensure-LiteralOnce([string]$Text,[string]$Needle,[string]$Context){
  $c = Count-Literal $Text $Needle
  if ($c -ne 1) { Fail "Ambiguity: Expected exactly 1 match for [$Context], found $c." }
}

function Count-Regex([string]$Text,[string]$Pattern){
  return ([regex]::Matches($Text, $Pattern, [System.Text.RegularExpressions.RegexOptions]::Singleline)).Count
}

function Ensure-RegexOnce([string]$Text,[string]$Pattern,[string]$Context){
  $c = Count-Regex $Text $Pattern
  if ($c -ne 1) { Fail "Ambiguity: Expected exactly 1 regex match for [$Context], found $c." }
}

function Get-RegexMatch([string]$Text,[string]$Pattern,[string]$Context){
  $m = [regex]::Match($Text, $Pattern, [System.Text.RegularExpressions.RegexOptions]::Singleline)
  if (-not $m.Success) { Fail "Missing: $Context" }
  return $m
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
  $occ = Count-Literal $Text $orig
  if ($occ -ne 1) { Fail "Ambiguity: Expected unique function block for [$Context], found $occ." }

  $new = & $Transform $orig
  if ($new -eq $orig) { return $Text } # idempotent: no change needed

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

  $backupFolder = New-BackupFolder $repoRoot
  Copy-BackupFile $app $backupFolder
  Ok "Backed up App.tsx -> $backupFolder\App.tsx"

  $txt = Get-Content -LiteralPath $app -Raw -Encoding UTF8

  # ------------------------------------------------------------
  # 1) Ensure follow_ups in MenuKey union (robust, within block only)
  # ------------------------------------------------------------
  $menuBlockPattern = 'type\s+MenuKey\s*=\s*(?:\r?\n\s*\|\s*"[^"]+"\s*)+;'
  Ensure-RegexOnce $txt $menuBlockPattern "type MenuKey union block"
  $mMenu = Get-RegexMatch $txt $menuBlockPattern "type MenuKey union block"
  $menuBlock = $mMenu.Value
  if ($menuBlock -match '\|\s*"follow_ups"') {
    Ok 'MenuKey already contains "follow_ups" (skip)'
  } else {
    $indent = ([regex]::Match($menuBlock, '(\r?\n)(\s*)\|\s*"')).Groups[2].Value
    if (-not $indent) { $indent = "  " }
    if ($menuBlock -match '\|\s*"client_database"') {
      $menuBlock2 = [regex]::Replace($menuBlock,'(\r?\n\s*\|\s*"client_database"\s*)',('$1' + "`r`n" + $indent + '| "follow_ups"'),1)
      $txt = $txt.Replace($menuBlock, $menuBlock2)
      Ok 'Inserted "follow_ups" after "client_database" in MenuKey'
    } else {
      $menuBlock2 = [regex]::Replace($menuBlock,';$',("`r`n" + $indent + '| "follow_ups";'))
      $txt = $txt.Replace($menuBlock, $menuBlock2)
      Ok 'Inserted "follow_ups" at end of MenuKey'
    }
  }

  # ------------------------------------------------------------
  # 2) Insert types if missing
  # ------------------------------------------------------------
  if ((Count-Literal $txt "type SalesStatus") -eq 0) {
    $anchor = 'type EstimateStatus = "Draft" | "Completed";'
    Ensure-LiteralOnce $txt $anchor "EstimateStatus anchor"
    $insert = @'

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
    $txt = $txt.Replace($anchor, ($anchor + $insert))
    Ok "Inserted SalesStatus/PickerTab/ClientNote/ClientFile types"
  } else { Ok "Types already present (skip)" }

  # ------------------------------------------------------------
  # 3) Extend Estimate/Client type definitions (idempotent)
  # ------------------------------------------------------------
  if ((Count-Literal $txt "salesStatus: SalesStatus") -eq 0) {
    $estAnchor = "  status: EstimateStatus;"
    Ensure-LiteralOnce $txt $estAnchor "Estimate.status anchor"
    $txt = $txt.Replace($estAnchor, ($estAnchor + "`r`n  salesStatus: SalesStatus; // Open/Lost/Order"))
    Ok "Extended Estimate type with salesStatus"
  } else { Ok "Estimate.salesStatus already present (skip)" }

  if ((Count-Literal $txt "notes: ClientNote[]") -eq 0) {
    $cliAnchor = "  invoiceAddress: string;"
    Ensure-LiteralOnce $txt $cliAnchor "Client.invoiceAddress anchor"
    $txt = $txt.Replace($cliAnchor, ($cliAnchor + "`r`n`r`n  notes: ClientNote[];`r`n  filesLink: string;`r`n  files: ClientFile[];"))
    Ok "Extended Client type with notes/files"
  } else { Ok "Client notes/files already present (skip)" }

  # ------------------------------------------------------------
  # 4) Defaults + creators (idempotent)
  # ------------------------------------------------------------
  $txt = Replace-FunctionBlock -Text $txt -Signature "function makeDefaultClients(): Client[]" -Context "makeDefaultClients" -Transform {
    param($blk)
    if ($blk -match "notes:\s*\[\]") { return $blk }
    return $blk -replace "estimates:\s*\[\],", "estimates: [],`r`n      notes: [],`r`n      filesLink: `"`",`r`n      files: [],"
  }
  Ok "Ensured makeDefaultClients has notes/files defaults"

  $txt = Replace-FunctionBlock -Text $txt -Signature "function createClient(type: ClientType)" -Context "createClient" -Transform {
    param($blk)
    if ($blk -match "notes:\s*\[\]") { return $blk }
    # insert within newClient object by replacing the single estimates: [] occurrence
    $cnt = (Count-Regex $blk "estimates:\s*\[\],")
    if ($cnt -ne 1) { Fail "Ambiguity inside createClient: expected 1 estimates: [], found $cnt." }
    return [regex]::Replace($blk, "estimates:\s*\[\],", "estimates: [],`r`n      notes: [],`r`n      filesLink: `"`",`r`n      files: [],", 1)
  }
  Ok "Ensured createClient includes notes/files"

  $txt = Replace-FunctionBlock -Text $txt -Signature "function createEstimateForClient(client: Client)" -Context "createEstimateForClient" -Transform {
    param($blk)
    if ($blk -match "salesStatus:\s*`"Open`"") { return $blk }
    $cnt = (Count-Literal $blk 'status: "Draft",')
    if ($cnt -ne 1) { Fail "Ambiguity inside createEstimateForClient: expected 1 status Draft anchor, found $cnt." }
    return $blk.Replace('status: "Draft",', 'status: "Draft",`r`n      salesStatus: "Open",')
  }
  Ok "Ensured createEstimateForClient sets salesStatus Open"

  # ------------------------------------------------------------
  # 5) Picker state + openClient default tab (idempotent)
  # ------------------------------------------------------------
  if ((Count-Literal $txt "const [pickerTab, setPickerTab]") -eq 0) {
    $pickerAnchor = 'const [pickerClientId, setPickerClientId] = useState<string | null>(null);'
    Ensure-LiteralOnce $txt $pickerAnchor "pickerClientId state anchor"
    $insert = @'
  const [pickerTab, setPickerTab] = useState<PickerTab>("client_info");
  const [draftNoteHtml, setDraftNoteHtml] = useState<string>("");
  const [currentUser, setCurrentUser] = useState<string>(() => {
    try {
      const v = localStorage.getItem("quotesync.currentUser.v1");
      return v && v.trim() ? v : "User";
    } catch {
      return "User";
    }
  });

  useEffect(() => {
    try { localStorage.setItem("quotesync.currentUser.v1", currentUser); } catch {}
  }, [currentUser]);

'@.TrimEnd()
    $txt = $txt.Replace($pickerAnchor, ($pickerAnchor + "`r`n" + $insert))
    Ok "Inserted picker tab/current user state"
  } else { Ok "Picker tab state already present (skip)" }

  if ((Count-Literal $txt 'setPickerTab("client_info")') -eq 0) {
    $anchor = "setPickerClientId(client.id);"
    Ensure-LiteralOnce $txt $anchor "openClient setPickerClientId anchor"
    $txt = $txt.Replace($anchor, ($anchor + "`r`n    setPickerTab(`"client_info`");`r`n    setDraftNoteHtml(`"`");"))
    Ok "Updated openClient default tab"
  } else { Ok "openClient already sets pickerTab (skip)" }

  # ------------------------------------------------------------
  # 6) Helpers above openEstimateFromPicker (idempotent)
  # ------------------------------------------------------------
  if ((Count-Literal $txt "function setEstimateSalesStatus") -eq 0) {
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
  } else { Ok "Helpers already present (skip)" }

  # ------------------------------------------------------------
  # 7) Sidebar: insert Follow Ups after Client Database (regex based)
  # ------------------------------------------------------------
  $followSidebarNeedle = 'label="Follow Ups"'
  if ((Count-Literal $txt $followSidebarNeedle) -eq 0) {
    $clientDbPattern = '<SidebarItem\b[^>]*\blabel\s*=\s*"Client Database"[^>]*/>'
    Ensure-RegexOnce $txt $clientDbPattern "Client Database SidebarItem"
    $mSid = Get-RegexMatch $txt $clientDbPattern "Client Database SidebarItem"
    $clientDbItem = $mSid.Value

    # infer indentation from match line start
    $lineStart = $txt.LastIndexOf("`n", $mSid.Index)
    if ($lineStart -lt 0) { $lineStart = 0 } else { $lineStart = $lineStart + 1 }
    $indent = ""
    for ($i = $lineStart; $i -lt $txt.Length; $i++) {
      $ch = $txt[$i]
      if ($ch -eq " " -or $ch -eq "`t") { $indent += $ch } else { break }
    }

    $followItem = $indent + '<SidebarItem label="Follow Ups" active={menu === "follow_ups"} onClick={() => selectMenu("follow_ups")} />'
    $txt = $txt.Replace($clientDbItem, ($clientDbItem + "`r`n" + $followItem))
    Ok "Inserted Follow Ups sidebar item"
  } else { Ok "Follow Ups sidebar already present (skip)" }

  # ------------------------------------------------------------
  # 8) Customers render: Follow Ups placeholder before ESTIMATE PICKER marker
  # ------------------------------------------------------------
  if ((Count-Literal $txt '{menu === "follow_ups" && view === "customers"') -eq 0) {
    $marker = "{/* ESTIMATE PICKER */}"
    Ensure-LiteralOnce $txt $marker "ESTIMATE PICKER marker"
    $render = @'
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
    $txt = $txt.Replace($marker, ($render + "`r`n            " + $marker))
    Ok "Inserted Follow Ups render block"
  } else { Ok "Follow Ups render already present (skip)" }

  # ------------------------------------------------------------
  # 9) Replace Estimate Picker section between markers
  # ------------------------------------------------------------
  $startMarker = "{/* ESTIMATE PICKER */}"
  $endMarker   = "{/* ESTIMATE DEFAULTS */}"
  Ensure-LiteralOnce $txt $startMarker "Estimate Picker start marker"
  Ensure-LiteralOnce $txt $endMarker "Estimate Picker end marker"

  $startIdx = $txt.IndexOf($startMarker)
  $endIdx   = $txt.IndexOf($endMarker)
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
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <Pill>{e.estimateRef}</Pill>
                            <Small>{e.status}</Small>
                            <Small>{e.positions.length} positions</Small>

                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 10 }}>
                              <Small style={{ color: "#52525b" }}>Sales</Small>
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
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              <Pill>{e.estimateRef}</Pill>
                              <Small>{e.status}</Small>
                              <Small>{e.positions.length} positions</Small>
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
  Ok "Replaced Estimate Picker block with tabbed UI"

  Set-Content -LiteralPath $app -Value $txt -Encoding UTF8
  Ok "Wrote src\App.tsx"

  Info "NOTE: Per requirement, npm run dev was NOT executed."
  Ok "DONE"
}
catch {
  Fail $_.Exception.Message
}
