$ErrorActionPreference = "Stop"

function Ok($m){ Write-Host "OK: $m" -ForegroundColor Green }
function Fail($m){ Write-Host "ERROR: $m" -ForegroundColor Red; throw $m }

$webRoot = "C:\Github\QuoteSync\web"
Set-Location $webRoot
Write-Host "Run directory:" (Get-Location).Path

if (!(Test-Path ".\package.json")) { Fail "package.json not found in $webRoot" }
if (!(Test-Path ".\src\App.tsx")) { Fail "src\App.tsx not found in $webRoot" }

# Backup
$ts = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = Join-Path $webRoot "_backups\$ts"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
Copy-Item -Force ".\src\App.tsx" (Join-Path $backupDir "App.tsx")
Ok "Backed up src\App.tsx -> $backupDir\App.tsx"

$path = Join-Path $webRoot "src\App.tsx"
$txt  = Get-Content -Raw -LiteralPath $path

function Replace-Once([string]$h, [string]$f, [string]$r, [string]$label) {
  $i = $h.IndexOf($f)
  if ($i -lt 0) { Fail "Not found: $label" }
  $j = $h.IndexOf($f, $i + $f.Length)
  if ($j -ge 0) { Fail "Ambiguous (multiple matches): $label" }
  return $h.Substring(0, $i) + $r + $h.Substring($i + $f.Length)
}

function Insert-AfterOnce([string]$h, [string]$anchor, [string]$insert, [string]$label) {
  $i = $h.IndexOf($anchor)
  if ($i -lt 0) { Fail "Not found: $label" }
  $j = $h.IndexOf($anchor, $i + $anchor.Length)
  if ($j -ge 0) { Fail "Ambiguous (multiple matches): $label" }
  return $h.Substring(0, $i + $anchor.Length) + $insert + $h.Substring($i + $anchor.Length)
}

# ------------------------------------------------------------
# 1) Ensure edit-mode state + helpers exist
# ------------------------------------------------------------
if ($txt -notmatch "const\s+\[editingClientId,\s*setEditingClientId\]") {
  $stateAnchor = 'const [showAddClient, setShowAddClient] = useState(false);'
  $helpers = @"

  // client edit mode
  const [editingClientId, setEditingClientId] = useState<string | null>(null);

  function splitAddress7(addr: string): [string, string, string, string, string, string, string] {
    const parts = (addr || "")
      .split(/\r?\n/)
      .map((s) => (s || "").trim())
      .filter(Boolean);
    while (parts.length < 7) parts.push("");
    return [parts[0] || "", parts[1] || "", parts[2] || "", parts[3] || "", parts[4] || "", parts[5] || "", parts[6] || ""];
  }

  function openEditClientPanel(c: Client) {
    setEditingClientId(c.id);

    setDraftClientType(c.type === "Business" ? "Business" : "Individual");

    setDraftClientName(c.clientName || "");
    setDraftBusinessName(c.businessName || "");
    setDraftContactName(c.contactPerson || "");

    setDraftEmail(c.email || "");
    setDraftMobile(c.mobile || "");
    setDraftHome(c.home || "");

    const [pa1, pa2, pa3, pt, pc, pco, pp] = splitAddress7(c.projectAddress || "");
    setDraftProjAddress1(pa1);
    setDraftProjAddress2(pa2);
    setDraftProjAddress3(pa3);
    setDraftProjTown(pt);
    setDraftProjCity(pc);
    setDraftProjCounty(pco);
    setDraftProjPostcode(pp);

    const invoiceDifferentNow = ((c.invoiceAddress || "").trim() !== (c.projectAddress || "").trim());
    setInvoiceDifferent(invoiceDifferentNow);

    const [ia1, ia2, ia3, it, ic, ico, ip] = splitAddress7(c.invoiceAddress || "");
    setDraftInvAddress1(ia1);
    setDraftInvAddress2(ia2);
    setDraftInvAddress3(ia3);
    setDraftInvTown(it);
    setDraftInvCity(ic);
    setDraftInvCounty(ico);
    setDraftInvPostcode(ip);

    setShowAddClient(true);
  }

  function updateClient(type: ClientType) {
    if (!editingClientId) return;

    const projectAddress =
      [
        draftProjAddress1,
        draftProjAddress2,
        draftProjAddress3,
        draftProjTown,
        draftProjCity,
        draftProjCounty,
        draftProjPostcode,
      ]
        .map((s) => (s || "").trim())
        .filter(Boolean)
        .join("\n") || DEFAULT_CUSTOMER_ADDRESS;

    const invoiceAddress = invoiceDifferent
      ? ([
          draftInvAddress1,
          draftInvAddress2,
          draftInvAddress3,
          draftInvTown,
          draftInvCity,
          draftInvCounty,
          draftInvPostcode,
        ]
          .map((s) => (s || "").trim())
          .filter(Boolean)
          .join("\n") || projectAddress)
      : projectAddress;

    const businessName = (draftBusinessName || "").trim();
    const contactPerson = (draftContactName || "").trim();
    const clientName = type === "Business" ? (businessName || "Business") : ((draftClientName || "").trim() || "Client");

    setClients((prev) =>
      prev.map((c) =>
        c.id !== editingClientId
          ? c
          : {
              ...c,
              type,
              clientName,
              businessName: type === "Business" ? businessName : undefined,
              contactPerson: type === "Business" ? contactPerson : undefined,
              email: (draftEmail || "").trim(),
              mobile: (draftMobile || "").trim(),
              home: (draftHome || "").trim(),
              projectAddress,
              invoiceAddress,
            }
      )
    );

    setShowAddClient(false);
    setEditingClientId(null);
  }

"@

  $txt = Insert-AfterOnce $txt $stateAnchor $helpers "Insert edit-mode helpers"
  Ok "Inserted edit-mode helpers"
} else {
  Ok "Edit-mode helpers already present"
}

# ------------------------------------------------------------
# 2) Fix createClient(): persist typed addresses (was incorrectly saving DEFAULT_CUSTOMER_ADDRESS)
# ------------------------------------------------------------
if ($txt -match "projectAddress:\s*DEFAULT_CUSTOMER_ADDRESS" -or $txt -match "invoiceAddress:\s*DEFAULT_CUSTOMER_ADDRESS") {
  $txt = Replace-Once $txt "      projectAddress: DEFAULT_CUSTOMER_ADDRESS," "      projectAddress," "createClient projectAddress"
  $txt = Replace-Once $txt "      invoiceAddress: DEFAULT_CUSTOMER_ADDRESS," "      invoiceAddress," "createClient invoiceAddress"
  Ok "Fixed createClient address persistence"
} else {
  Ok "createClient address persistence already fixed"
}

# ------------------------------------------------------------
# 3) Ensure openAddClientPanel clears edit mode
# ------------------------------------------------------------
$openAddAnchor = "function openAddClientPanel() {"
if ($txt -match [regex]::Escape($openAddAnchor) -and $txt -notmatch "openAddClientPanel\(\)\s*{\s*setEditingClientId\(null\)") {
  $txt = Replace-Once $txt $openAddAnchor "function openAddClientPanel() {`r`n    setEditingClientId(null);" "openAddClientPanel clear edit"
  Ok "openAddClientPanel now clears edit mode"
} else {
  Ok "openAddClientPanel clear edit already present (or function not found)"
}

# ------------------------------------------------------------
# 4) Add Client panel buttons: Cancel clears edit mode; Primary does Create vs Save
# ------------------------------------------------------------
if ($txt -match '<Button variant="secondary" onClick=\{\(\) => setShowAddClient\(false\)\}\>') {
  $txt = Replace-Once $txt '<Button variant="secondary" onClick={() => setShowAddClient(false)}>' '<Button variant="secondary" onClick={() => { setShowAddClient(false); setEditingClientId(null); }}>' "Cancel button edit clear"
  Ok "Cancel button updated"
} else {
  Ok "Cancel button already updated (or anchor not found)"
}

if ($txt -match '<Button variant="primary" onClick=\{\(\) => createClient\(draftClientType\)\}\>') {
  $txt = Replace-Once $txt '<Button variant="primary" onClick={() => createClient(draftClientType)}>' '<Button variant="primary" onClick={() => (editingClientId ? updateClient(draftClientType) : createClient(draftClientType))}>' "Primary button create vs save"
  Ok "Primary button updated"
} else {
  Ok "Primary button already updated (or anchor not found)"
}

if ($txt -match "Create Client") {
  # only replace the specific inline label line if present exactly as before
  $txt = $txt -replace "(\s+)Create Client(\s*)", '$1{editingClientId ? "Save Changes" : "Create Client"}$2'
  Ok "Primary label updated (Create/Save)"
}

# ------------------------------------------------------------
# 5) Ensure ClientDetailsReadonly component exists (it is currently USED but missing)
# ------------------------------------------------------------
if ($txt -notmatch "function\s+ClientDetailsReadonly\s*\(") {
  $clientSummaryAnchor = "function ClientSummary({ c }: { c: Client }) {"
  $csPos = $txt.IndexOf($clientSummaryAnchor)
  if ($csPos -lt 0) { Fail "Anchor not found: ClientSummary()" }

  $component = @'
function ClientDetailsReadonly({ c, onEdit }: { c: Client; onEdit: () => void }) {
  const partsP = (c.projectAddress || "").split(/\r?\n/).map((s) => (s || "").trim()).filter(Boolean);
  while (partsP.length < 7) partsP.push("");
  const [p1, p2, p3, pt, pc, pco, pp] = [partsP[0] || "", partsP[1] || "", partsP[2] || "", partsP[3] || "", partsP[4] || "", partsP[5] || "", partsP[6] || ""];

  const invDifferent = ((c.invoiceAddress || "").trim() !== (c.projectAddress || "").trim());
  const partsI = (c.invoiceAddress || "").split(/\r?\n/).map((s) => (s || "").trim()).filter(Boolean);
  while (partsI.length < 7) partsI.push("");
  const [i1, i2, i3, it, ic, ico, ip] = [partsI[0] || "", partsI[1] || "", partsI[2] || "", partsI[3] || "", partsI[4] || "", partsI[5] || "", partsI[6] || ""];

  return (
    <div style={{ borderRadius: 16, border: "1px solid #e4e4e7", padding: 12, background: "#fff" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <H3>Client contact information</H3>
        <Button variant="secondary" onClick={onEdit}>Edit</Button>
      </div>

      <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={c.type === "Business"} disabled />
            <span style={{ fontSize: 12, fontWeight: 800, color: "#3f3f46" }}>Business customer</span>
          </label>
          <Small>Type: {c.type}</Small>
        </div>

        {c.type === "Business" ? (
          <>
            <div>
              <div style={labelStyle}>Business name</div>
              <Input value={c.businessName || c.clientName || ""} onChange={() => {}} disabled />
            </div>
            <div>
              <div style={labelStyle}>Contact name</div>
              <Input value={c.contactPerson || ""} onChange={() => {}} disabled />
            </div>
          </>
        ) : (
          <div>
            <div style={labelStyle}>Client name</div>
            <Input value={c.clientName || ""} onChange={() => {}} disabled />
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <div style={labelStyle}>Email</div>
            <Input value={c.email || ""} onChange={() => {}} disabled />
          </div>
          <div>
            <div style={labelStyle}>Mobile</div>
            <Input value={c.mobile || ""} onChange={() => {}} disabled />
          </div>
        </div>

        <div>
          <div style={labelStyle}>Home</div>
          <Input value={c.home || ""} onChange={() => {}} disabled />
        </div>

        <div style={{ marginTop: 10, borderTop: "1px solid #e4e4e7", paddingTop: 10 }}>
          <H3>Project site address</H3>

          <div style={{ marginTop: 10, display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <div style={labelStyle}>Address line 1</div>
                <Input value={p1} onChange={() => {}} disabled />
              </div>
              <div>
                <div style={labelStyle}>Address line 2</div>
                <Input value={p2} onChange={() => {}} disabled />
              </div>
            </div>

            <div>
              <div style={labelStyle}>Address line 3</div>
              <Input value={p3} onChange={() => {}} disabled />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <div style={labelStyle}>Town</div>
                <Input value={pt} onChange={() => {}} disabled />
              </div>
              <div>
                <div style={labelStyle}>City</div>
                <Input value={pc} onChange={() => {}} disabled />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <div style={labelStyle}>County</div>
                <Input value={pco} onChange={() => {}} disabled />
              </div>
              <div>
                <div style={labelStyle}>Postcode</div>
                <Input value={pp} onChange={() => {}} disabled />
              </div>
            </div>

            <div style={{ marginTop: 6 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 800 }}>
                <input type="checkbox" checked={invDifferent} disabled />
                Invoice address if different
              </label>
            </div>

            {invDifferent && (
              <div style={{ marginTop: 10, borderRadius: 12, border: "1px solid #e4e4e7", padding: 12, background: "#fafafa" }}>
                <H3>Invoice address</H3>

                <div style={{ marginTop: 10, display: "grid", gap: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <div style={labelStyle}>Address line 1</div>
                      <Input value={i1} onChange={() => {}} disabled />
                    </div>
                    <div>
                      <div style={labelStyle}>Address line 2</div>
                      <Input value={i2} onChange={() => {}} disabled />
                    </div>
                  </div>

                  <div>
                    <div style={labelStyle}>Address line 3</div>
                    <Input value={i3} onChange={() => {}} disabled />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <div style={labelStyle}>Town</div>
                      <Input value={it} onChange={() => {}} disabled />
                    </div>
                    <div>
                      <div style={labelStyle}>City</div>
                      <Input value={ic} onChange={() => {}} disabled />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <div style={labelStyle}>County</div>
                      <Input value={ico} onChange={() => {}} disabled />
                    </div>
                    <div>
                      <div style={labelStyle}>Postcode</div>
                      <Input value={ip} onChange={() => {}} disabled />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
'@

  $txt = $txt.Substring(0, $csPos) + $component + "`r`n`r`n" + $txt.Substring($csPos)
  Ok "Inserted ClientDetailsReadonly() component"
} else {
  Ok "ClientDetailsReadonly() already exists"
}

# ------------------------------------------------------------
# 6) Ensure picker uses ClientDetailsReadonly (no-op if already set)
# ------------------------------------------------------------
$pickerFind = "                  <ClientSummary c={pickerClient} />"
$pickerReplace = "                  <ClientDetailsReadonly c={pickerClient} onEdit={() => openEditClientPanel(pickerClient)} />"
if ($txt.IndexOf($pickerFind) -ge 0) {
  $txt = Replace-Once $txt $pickerFind $pickerReplace "Picker swap ClientSummary -> ClientDetailsReadonly"
  Ok "Picker now uses ClientDetailsReadonly"
} else {
  Ok "Picker already uses ClientDetailsReadonly (or ClientSummary line not present)"
}

# Sanity: exactly one component definition
$cnt = [regex]::Matches($txt, "function\s+ClientDetailsReadonly\s*\(").Count
if ($cnt -ne 1) { Fail "Sanity failed: expected 1 ClientDetailsReadonly(), found $cnt" }

Set-Content -LiteralPath $path -Value $txt -Encoding UTF8
Ok "Patched src\App.tsx"

Ok "Starting dev server..."
npm run dev
