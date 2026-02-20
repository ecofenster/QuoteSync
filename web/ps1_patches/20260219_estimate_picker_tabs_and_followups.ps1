# QuoteSync - Estimate Picker Tabs + Follow Ups (scoped patch)
# File: 20260219_estimate_picker_tabs_and_followups.ps1
# Run from: PS C:\Github\QuoteSync\web\ps1_patches>

$ErrorActionPreference = "Stop"

function Ok($m){ Write-Host "OK: $m" -ForegroundColor Green }
function Fail($m){ Write-Host "ERROR: $m" -ForegroundColor Red; throw $m }

$psDir = $PSScriptRoot
$webRoot = Resolve-Path (Join-Path $psDir "..")
Write-Host ("Run directory: " + $psDir) -ForegroundColor Cyan
Write-Host ("Web root:      " + $webRoot.Path) -ForegroundColor Cyan
Set-Location $webRoot.Path

$src = Join-Path $webRoot.Path "src\App.tsx"
if (!(Test-Path $src)) { Fail "Missing: $src" }

# Backup
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$bkDir = Join-Path $webRoot.Path ("_backups\" + $stamp)
New-Item -ItemType Directory -Force -Path $bkDir | Out-Null
Copy-Item -Force $src (Join-Path $bkDir "App.tsx")
Ok "Backed up src\App.tsx -> $bkDir\App.tsx"

$txt = Get-Content $src -Raw -Encoding UTF8

# -----------------------------
# 1) Insert picker tab/outcome/notes/files state after pickerClient memo (idempotent)
# -----------------------------
if ($txt -notmatch "const \[pickerTab, setPickerTab\]") {
  $rx = [regex] '(?s)(//\s*estimate picker\s*\r?\n\s*const \[pickerClientId, setPickerClientId\] = useState<string \| null>\(null\);\s*\r?\n\s*const pickerClient = useMemo\(\(\) => clients\.find\(\(c\) => c\.id === pickerClientId\) \?\? null, \[clients, pickerClientId\]\);\s*\r?\n)'
  $m = $rx.Matches($txt)
  if ($m.Count -ne 1) { Fail "Ambiguous or missing estimate picker state anchor (matches=$($m.Count))." }

  $insert = @"
  // Estimate Picker tabs (isolated)
  const [pickerTab, setPickerTab] = useState<""client"" | ""estimates"" | ""orders"" | ""notes"" | ""files"">(""client"");
  useEffect(() => {
    // When switching client in picker, always land on Client Info
    setPickerTab(""client"");
  }, [pickerClientId]);

  // Per-estimate outcome (Open/Lost/Order) without touching Estimate type
  const [pickerOutcomeByEstimateId, setPickerOutcomeByEstimateId] = useState<Record<string, ""Open"" | ""Lost"" | ""Order"">>({});

  // Notes (per client) — lightweight WYSIWYG via contentEditable HTML
  const [pickerNotesUser, setPickerNotesUser] = useState<string>(() => localStorage.getItem(""qs_notes_user"") || ""User"");
  useEffect(() => {
    localStorage.setItem(""qs_notes_user"", pickerNotesUser || ""User"");
  }, [pickerNotesUser]);

  const [pickerNotesByClientId, setPickerNotesByClientId] = useState<
    Record<string, { id: string; ts: number; user: string; html: string }[]>
  >({});
  const [pickerNoteDraftHtml, setPickerNoteDraftHtml] = useState<string>("""");
  const [pickerNoteEditorKey, setPickerNoteEditorKey] = useState<number>(0);

  // Files (per client): links + uploaded filenames (metadata only)
  const [pickerFileLinksByClientId, setPickerFileLinksByClientId] = useState<
    Record<string, { id: string; ts: number; user: string; url: string; label: string }[]>
  >({});
  const [pickerUploadsByClientId, setPickerUploadsByClientId] = useState<
    Record<string, { id: string; ts: number; user: string; name: string; size: number }[]>
  >({});
  const [pickerFileUrl, setPickerFileUrl] = useState<string>("""");
  const [pickerFileLabel, setPickerFileLabel] = useState<string>("""");
"@

  $txt = $rx.Replace($txt, ('$1' + "`r`n" + $insert + "`r`n"), 1)
  Ok "Inserted Estimate Picker tab/outcome/notes/files state."
} else {
  Ok "Picker state already present (skipped)."
}

# -----------------------------
# 2) Replace ONLY Estimate Picker JSX between markers (scoped)
# -----------------------------
$rxPicker = [regex] '(?s)(\{/\*\s*ESTIMATE PICKER\s*\*/\}\s*\r?\n)(.*?)(\{/\*\s*ESTIMATE DEFAULTS\s*\*/\})'
$m2 = $rxPicker.Matches($txt)
if ($m2.Count -ne 1) { Fail "Ambiguous or missing ESTIMATE PICKER block (matches=$($m2.Count))." }

if ($m2[0].Groups[2].Value -match "Tabs \(Estimate Picker only\)" ) {
  Ok "Estimate Picker tabs already present (skipped)."
} else {
  $replacement = @"
{/* ESTIMATE PICKER */}
            {view === ""estimate_picker"" && pickerClient && (
              <Card style={{ minHeight: 520 }}>
                <div style={{ display: ""grid"", gap: 12 }}>
                  <div style={{ display: ""flex"", alignItems: ""flex-start"", justifyContent: ""space-between"", gap: 12 }}>
                    <div>
                      <H2>Choose an estimate</H2>
                      <Small>
                        {pickerClient.clientName} • {pickerClient.clientRef}
                      </Small>
                    </div>

                    <div style={{ display: ""flex"", gap: 10 }}>
                      <Button variant=""secondary"" onClick={() => setView(""customers"")}>
                        Back
                      </Button>
                      <Button variant=""primary"" onClick={() => createEstimateForClient(pickerClient)}>
                        New Estimate
                      </Button>
                    </div>
                  </div>

                  {/* Tabs (Estimate Picker only) */}
                  <div
                    style={{
                      display: ""flex"",
                      gap: 8,
                      borderBottom: ""1px solid #e4e4e7"",
                      paddingBottom: 8,
                      flexWrap: ""wrap"",
                    }}
                  >
                    <Button variant={pickerTab === ""client"" ? ""primary"" : ""secondary""} onClick={() => setPickerTab(""client"")}>
                      Client Info
                    </Button>
                    <Button
                      variant={pickerTab === ""estimates"" ? ""primary"" : ""secondary""}
                      onClick={() => setPickerTab(""estimates"")}
                    >
                      Estimates
                    </Button>
                    <Button variant={pickerTab === ""orders"" ? ""primary"" : ""secondary""} onClick={() => setPickerTab(""orders"")}>
                      Orders
                    </Button>
                    <Button variant={pickerTab === ""notes"" ? ""primary"" : ""secondary""} onClick={() => setPickerTab(""notes"")}>
                      Client Notes
                    </Button>
                    <Button variant={pickerTab === ""files"" ? ""primary"" : ""secondary""} onClick={() => setPickerTab(""files"")}>
                      Files
                    </Button>
                  </div>

                  {/* Tab panels */}
                  {pickerTab === ""client"" && <ClientDetailsReadonly c={pickerClient} onEdit={() => openEditClientPanel(pickerClient)} />}

                  {pickerTab === ""estimates"" && (
                    <div style={{ marginTop: 2, display: ""grid"", gap: 10 }}>
                      {pickerClient.estimates.map((e) => {
                        const outcome = pickerOutcomeByEstimateId[e.id] || ""Open"";
                        return (
                          <div
                            key={e.id}
                            style={{
                              borderRadius: 14,
                              border: ""1px solid #e4e4e7"",
                              padding: 10,
                              background: ""#fff"",
                              display: ""flex"",
                              justifyContent: ""space-between"",
                              alignItems: ""center"",
                              gap: 10,
                            }}
                          >
                            <div style={{ display: ""flex"", alignItems: ""center"", gap: 8, flexWrap: ""wrap"" }}>
                              <Pill>{e.estimateRef}</Pill>
                              <Small>{e.status}</Small>
                              <Small>{e.positions.length} positions</Small>
                            </div>

                            <div style={{ display: ""flex"", alignItems: ""center"", gap: 10 }}>
                              <select
                                value={outcome}
                                onChange={(ev) => {
                                  const v = ev.target.value as ""Open"" | ""Lost"" | ""Order"";
                                  setPickerOutcomeByEstimateId((prev) => ({ ...prev, [e.id]: v }));
                                }}
                                style={{
                                  height: 36,
                                  borderRadius: 10,
                                  border: ""1px solid #e4e4e7"",
                                  padding: ""0 10px"",
                                  fontSize: 14,
                                  background: ""#fff"",
                                }}
                              >
                                <option value=""Open"">Open</option>
                                <option value=""Lost"">Lost</option>
                                <option value=""Order"">Order</option>
                              </select>

                              <Button variant=""primary"" onClick={() => openEstimateFromPicker(e.id)}>
                                Open
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {pickerTab === ""orders"" && (
                    <div style={{ marginTop: 2, display: ""grid"", gap: 10 }}>
                      {pickerClient.estimates
                        .filter((e) => (pickerOutcomeByEstimateId[e.id] || ""Open"") === ""Order"")
                        .map((e) => (
                          <div
                            key={e.id}
                            style={{
                              borderRadius: 14,
                              border: ""1px solid #e4e4e7"",
                              padding: 10,
                              background: ""#fff"",
                              display: ""flex"",
                              justifyContent: ""space-between"",
                              alignItems: ""center"",
                              gap: 10,
                            }}
                          >
                            <div style={{ display: ""flex"", alignItems: ""center"", gap: 8, flexWrap: ""wrap"" }}>
                              <Pill>{e.estimateRef}</Pill>
                              <Small>{e.status}</Small>
                              <Small>{e.positions.length} positions</Small>
                            </div>

                            <Button variant=""primary"" onClick={() => openEstimateFromPicker(e.id)}>
                              Open
                            </Button>
                          </div>
                        ))}

                      {pickerClient.estimates.filter((e) => (pickerOutcomeByEstimateId[e.id] || ""Open"") === ""Order"").length === 0 && (
                        <Small>No estimates marked “Order”.</Small>
                      )}
                    </div>
                  )}

                  {pickerTab === ""notes"" && (
                    <div style={{ display: ""grid"", gap: 10 }}>
                      <div style={{ display: ""flex"", gap: 10, alignItems: ""center"", flexWrap: ""wrap"" }}>
                        <Small style={{ minWidth: 80 }}>User</Small>
                        <input
                          value={pickerNotesUser}
                          onChange={(e) => setPickerNotesUser(e.target.value)}
                          style={{
                            height: 36,
                            borderRadius: 10,
                            border: ""1px solid #e4e4e7"",
                            padding: ""0 10px"",
                            fontSize: 14,
                            width: 240,
                          }}
                        />
                      </div>

                      <div
                        key={pickerNoteEditorKey}
                        contentEditable
                        suppressContentEditableWarning
                        onInput={(e) => setPickerNoteDraftHtml((e.target as HTMLDivElement).innerHTML)}
                        style={{
                          minHeight: 120,
                          borderRadius: 12,
                          border: ""1px solid #e4e4e7"",
                          padding: 10,
                          background: ""#fff"",
                          fontSize: 14,
                        }}
                      />

                      <div style={{ display: ""flex"", gap: 10 }}>
                        <Button
                          variant=""primary""
                          onClick={() => {
                            const html = (pickerNoteDraftHtml || """").trim();
                            if (!html) return;
                            const note = { id: uid(), ts: Date.now(), user: pickerNotesUser || ""User"", html };
                            setPickerNotesByClientId((prev) => ({
                              ...prev,
                              [pickerClient.id]: [note, ...(prev[pickerClient.id] || [])],
                            }));
                            setPickerNoteDraftHtml("""");
                            setPickerNoteEditorKey((n) => n + 1);
                          }}
                        >
                          Add note
                        </Button>
                        <Button
                          variant=""secondary""
                          onClick={() => {
                            setPickerNoteDraftHtml("""");
                            setPickerNoteEditorKey((n) => n + 1);
                          }}
                        >
                          Clear
                        </Button>
                      </div>

                      <div style={{ display: ""grid"", gap: 8 }}>
                        {(pickerNotesByClientId[pickerClient.id] || []).map((n) => (
                          <div
                            key={n.id}
                            style={{
                              borderRadius: 12,
                              border: ""1px solid #e4e4e7"",
                              padding: 10,
                              background: ""#fff"",
                            }}
                          >
                            <div style={{ display: ""flex"", justifyContent: ""space-between"", gap: 10, flexWrap: ""wrap"" }}>
                              <Small>
                                {new Date(n.ts).toLocaleString()} • {n.user}
                              </Small>
                            </div>
                            <div style={{ marginTop: 6 }} dangerouslySetInnerHTML={{ __html: n.html }} />
                          </div>
                        ))}
                        {(pickerNotesByClientId[pickerClient.id] || []).length === 0 && <Small>No notes yet.</Small>}
                      </div>
                    </div>
                  )}

                  {pickerTab === ""files"" && (
                    <div style={{ display: ""grid"", gap: 12 }}>
                      <div style={{ display: ""grid"", gap: 8 }}>
                        <Small>Link (SharePoint / Drive / OneDrive / local path)</Small>
                        <div style={{ display: ""flex"", gap: 10, flexWrap: ""wrap"" }}>
                          <input
                            value={pickerFileLabel}
                            onChange={(e) => setPickerFileLabel(e.target.value)}
                            placeholder=""Label (optional)""
                            style={{
                              height: 36,
                              borderRadius: 10,
                              border: ""1px solid #e4e4e7"",
                              padding: ""0 10px"",
                              fontSize: 14,
                              width: 240,
                            }}
                          />
                          <input
                            value={pickerFileUrl}
                            onChange={(e) => setPickerFileUrl(e.target.value)}
                            placeholder=""URL or path""
                            style={{
                              height: 36,
                              borderRadius: 10,
                              border: ""1px solid #e4e4e7"",
                              padding: ""0 10px"",
                              fontSize: 14,
                              flex: 1,
                              minWidth: 260,
                            }}
                          />
                          <Button
                            variant=""primary""
                            onClick={() => {
                              const url = (pickerFileUrl || """").trim();
                              if (!url) return;
                              const link = { id: uid(), ts: Date.now(), user: pickerNotesUser || ""User"", url, label: (pickerFileLabel || """").trim() };
                              setPickerFileLinksByClientId((prev) => ({
                                ...prev,
                                [pickerClient.id]: [link, ...(prev[pickerClient.id] || [])],
                              }));
                              setPickerFileUrl("""");
                              setPickerFileLabel("""");
                            }}
                          >
                            Add
                          </Button>
                        </div>
                      </div>

                      <div style={{ display: ""grid"", gap: 8 }}>
                        {(pickerFileLinksByClientId[pickerClient.id] || []).map((l) => (
                          <div
                            key={l.id}
                            style={{
                              borderRadius: 12,
                              border: ""1px solid #e4e4e7"",
                              padding: 10,
                              background: ""#fff"",
                              display: ""flex"",
                              justifyContent: ""space-between"",
                              alignItems: ""center"",
                              gap: 10,
                              flexWrap: ""wrap"",
                            }}
                          >
                            <div style={{ display: ""grid"" }}>
                              <Small>
                                {l.label ? `${l.label} • ` : """"}
                                {new Date(l.ts).toLocaleString()} • {l.user}
                              </Small>
                              <Small style={{ opacity: 0.9 }}>{l.url}</Small>
                            </div>
                            <Button variant=""secondary"" onClick={() => window.open(l.url, ""_blank"")}>
                              Open link
                            </Button>
                          </div>
                        ))}
                        {(pickerFileLinksByClientId[pickerClient.id] || []).length === 0 && <Small>No links yet.</Small>}
                      </div>

                      <div style={{ display: ""grid"", gap: 8 }}>
                        <Small>Uploads (dwg, excel, word, pdf, sketchup, etc.)</Small>
                        <input
                          type=""file""
                          multiple
                          accept="".dwg,.dxf,.pdf,.doc,.docx,.xls,.xlsx,.csv,.skp,.png,.jpg,.jpeg,.webp""
                          onChange={(e) => {
                            const files = Array.from(e.target.files || []);
                            if (!files.length) return;
                            const entries = files.map((f) => ({
                              id: uid(),
                              ts: Date.now(),
                              user: pickerNotesUser || ""User"",
                              name: f.name,
                              size: f.size,
                            }));
                            setPickerUploadsByClientId((prev) => ({
                              ...prev,
                              [pickerClient.id]: [...entries, ...(prev[pickerClient.id] || [])],
                            }));
                            e.currentTarget.value = """";
                          }}
                        />
                        <div style={{ display: ""grid"", gap: 6 }}>
                          {(pickerUploadsByClientId[pickerClient.id] || []).map((u) => (
                            <div
                              key={u.id}
                              style={{
                                borderRadius: 12,
                                border: ""1px solid #e4e4e7"",
                                padding: 10,
                                background: ""#fff"",
                                display: ""flex"",
                                justifyContent: ""space-between"",
                                gap: 10,
                                flexWrap: ""wrap"",
                              }}
                            >
                              <Small>
                                {u.name} • {(u.size / 1024).toFixed(1)} KB
                              </Small>
                              <Small>
                                {new Date(u.ts).toLocaleString()} • {u.user}
                              </Small>
                            </div>
                          ))}
                          {(pickerUploadsByClientId[pickerClient.id] || []).length === 0 && <Small>No uploads recorded yet.</Small>}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            )}
"@

  $txt = $rxPicker.Replace($txt, ($replacement + "`r`n            " + '$3'), 1)
  Ok "Replaced Estimate Picker block with tabbed UI."
}

# -----------------------------
# 3) Add Follow Ups menu item under Customers after Client Database
#    (minimal MenuKey extension + SidebarItem insert + minimal panel to avoid blank)
# -----------------------------
# 3a) Ensure MenuKey includes follow_ups
if ($txt -notmatch '"follow_ups"') {
  $rxMenu = [regex] '(?s)type MenuKey =\s*\r?\n((?:\s*\|\s*"[^"]+"\s*\r?\n)+)\s*;'
  $mm = $rxMenu.Matches($txt)
  if ($mm.Count -ne 1) { Fail "Ambiguous or missing MenuKey union (matches=$($mm.Count))." }
  $body = $mm[0].Groups[1].Value
  $new = "type MenuKey =`r`n" + $body + "  | `"follow_ups`"`r`n;"
  $txt = $rxMenu.Replace($txt, [System.Text.RegularExpressions.MatchEvaluator]{ param($m) $new }, 1)
  Ok "Added MenuKey: follow_ups"
} else {
  Ok "MenuKey already includes follow_ups (skipped)."
}

# 3b) Insert Sidebar item after Client Database
if ($txt -notmatch 'label="Follow Ups"') {
  $rxSide = [regex] '(?s)(<H3>Customers</H3>[\s\S]*?<SidebarItem label="Client Database"[^>]*?/>\s*)'
  $ms = $rxSide.Matches($txt)
  if ($ms.Count -ne 1) { Fail "Ambiguous Customers sidebar anchor (matches=$($ms.Count))." }
  $ins = '                <SidebarItem label="Follow Ups" active={menu === "follow_ups"} onClick={() => selectMenu("follow_ups")} />' + "`r`n"
  $txt = $rxSide.Replace($txt, ('$1' + $ins), 1)
  Ok "Inserted Customers sidebar item: Follow Ups"
} else {
  Ok "Follow Ups sidebar item already present (skipped)."
}

# 3c) Add minimal panel for follow_ups to avoid blank customers view
if ($txt -notmatch 'menu === "follow_ups"') {
  $rxPanels = [regex] '(?s)(\{menu === "client_database"[\s\S]*?\}\s*\r?\n)'
  $mp = $rxPanels.Matches($txt)
  if ($mp.Count -lt 1) { Fail "Could not find Customers panels anchor near menu === \"client_database\"." }
  # Insert after first client_database panel block (conservative)
  $panelInsert = @"
                  {menu === ""follow_ups"" && (
                    <div style={{ padding: 10 }}>
                      <H2>Follow Ups</H2>
                      <Small>Coming soon.</Small>
                    </div>
                  )}
"@
  $txt = $rxPanels.Replace($txt, ('$1' + "`r`n" + $panelInsert + "`r`n"), 1)
  Ok "Inserted minimal Follow Ups panel."
} else {
  Ok "Follow Ups panel already present (skipped)."
}

# Write back
Set-Content -Path $src -Value $txt -Encoding UTF8
Ok "Wrote src\App.tsx"

Ok "Patch complete."
