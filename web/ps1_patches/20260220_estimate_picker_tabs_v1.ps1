# QuoteSync - Add Estimate Picker tabs (scoped to Estimate Picker block only)
# File: 20260220_estimate_picker_tabs_v1.ps1
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
# 1) Insert Estimate Picker tab state after pickerClient memo (once)
# -----------------------------
if ($txt -match 'estimatePickerTab') {
  Ok "Estimate Picker tab state already present (skipped)."
} else {
  $anchor = '  const pickerClient = useMemo(() => clients.find((c) => c.id === pickerClientId) ?? null, [clients, pickerClientId]);'
  $pos = $txt.IndexOf($anchor)
  if ($pos -lt 0) { Fail "Anchor not found for pickerClient memo." }
  $insertPos = $pos + $anchor.Length

  $state = @"
  // estimate picker tabs (Estimate Picker only)
  type EstimatePickerTab = ""client_info"" | ""estimates"" | ""orders"" | ""client_notes"" | ""files"";
  type EstimateOutcome = ""Open"" | ""Lost"" | ""Order"";

  const [estimatePickerTab, setEstimatePickerTab] = useState<EstimatePickerTab>(""client_info"");
  const [estimateOutcomeById, setEstimateOutcomeById] = useState<Record<string, EstimateOutcome>>({});
  const [clientNotes, setClientNotes] = useState<Array<{ id: string; html: string; createdAt: string; createdBy: string }>>([]);
  const [clientNoteDraftHtml, setClientNoteDraftHtml] = useState<string>("""");
  const [clientFiles, setClientFiles] = useState<Array<{ id: string; label: string; url: string; addedAt: string; addedBy: string; fileNames?: string[] }>>([]);
  const [clientFileLabel, setClientFileLabel] = useState<string>("""");
  const [clientFileUrl, setClientFileUrl] = useState<string>("""");
  const [clientFileNames, setClientFileNames] = useState<string[]>([]);
  const activeUserName = ""User"";
"@

  $txt = $txt.Substring(0, $insertPos) + "`r`n`r`n" + $state + "`r`n" + $txt.Substring($insertPos)
  Ok "Inserted Estimate Picker tab/outcome/notes/files state."
}

# -----------------------------
# 2) Replace Estimate Picker block between markers (strict scope)
# -----------------------------
$startMarker = '{/* ESTIMATE PICKER */}'
$endMarker = '{/* ESTIMATE DEFAULTS */}'
$start = $txt.IndexOf($startMarker)
$end = $txt.IndexOf($endMarker)

if ($start -lt 0 -or $end -lt 0 -or $end -le $start) {
  Fail "Could not find Estimate Picker block markers."
}

$before = $txt.Substring(0, $start)
$after = $txt.Substring($end)

$replacement = @"
            {/* ESTIMATE PICKER */}
            {view === ""estimate_picker"" && pickerClient && (
              <Card style={{ minHeight: 520 }}>
                <div style={{ display: ""grid"", gap: 12 }}>
                  <div style={{ display: ""flex"", alignItems: ""flex-start"", justifyContent: ""space-between"", gap: 12 }}>
                    <div>
                      <H2>Choose an estimate</H2>
                      <Small>{pickerClient.companyName} • {pickerClient.clientRef}</Small>
                    </div>

                    <div style={{ display: ""flex"", gap: 10, alignItems: ""center"" }}>
                      <Button variant=""outline"" onClick={() => { setEstimatePickerTab(""client_info""); setView(""customers""); }}>
                        Back
                      </Button>
                      <Button variant=""primary"" onClick={() => { setEstimatePickerTab(""client_info""); openNewEstimateFromPicker(); }}>
                        New Estimate
                      </Button>
                    </div>
                  </div>

                  {/* Tabs (Estimate Picker only) */}
                  <div style={{ display: ""flex"", gap: 8, flexWrap: ""wrap"" }}>
                    <Button variant={estimatePickerTab === ""client_info"" ? ""primary"" : ""outline""} onClick={() => setEstimatePickerTab(""client_info"")}>Client Info</Button>
                    <Button variant={estimatePickerTab === ""estimates"" ? ""primary"" : ""outline""} onClick={() => setEstimatePickerTab(""estimates"")}>Estimates</Button>
                    <Button variant={estimatePickerTab === ""orders"" ? ""primary"" : ""outline""} onClick={() => setEstimatePickerTab(""orders"")}>Orders</Button>
                    <Button variant={estimatePickerTab === ""client_notes"" ? ""primary"" : ""outline""} onClick={() => setEstimatePickerTab(""client_notes"")}>Client Notes</Button>
                    <Button variant={estimatePickerTab === ""files"" ? ""primary"" : ""outline""} onClick={() => setEstimatePickerTab(""files"")}>Files</Button>
                  </div>

                  {/* CLIENT INFO (default landing tab) */}
                  {estimatePickerTab === ""client_info"" && (
                    <div style={{ display: ""grid"", gap: 10 }}>
                      <ClientInfoCard client={pickerClient} onEdit={() => openEditClientPanel(pickerClient)} />
                      <div style={{ marginTop: 2, display: ""grid"", gap: 10 }}>
                        {pickerClient.estimates.map((e) => (
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
                      </div>
                    </div>
                  )}

                  {/* ESTIMATES */}
                  {estimatePickerTab === ""estimates"" && (
                    <div style={{ display: ""grid"", gap: 10 }}>
                      <div style={{ display: ""flex"", alignItems: ""center"", justifyContent: ""space-between"", gap: 10 }}>
                        <H3 style={{ margin: 0 }}>Estimates</H3>
                        <Small>Set outcome per estimate.</Small>
                      </div>

                      <div style={{ display: ""grid"", gap: 10 }}>
                        {pickerClient.estimates.map((e) => {
                          const outcome = estimateOutcomeById[e.id] ?? ""Open"";
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
                                    const v = ev.currentTarget.value as any;
                                    setEstimateOutcomeById((prev) => ({ ...prev, [e.id]: v }));
                                  }}
                                  style={{
                                    height: 36,
                                    borderRadius: 10,
                                    border: ""1px solid #e4e4e7"",
                                    padding: ""0 10px"",
                                    background: ""#fff"",
                                    fontSize: 14,
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
                    </div>
                  )}

                  {/* ORDERS (estimates marked ""Order"") */}
                  {estimatePickerTab === ""orders"" && (
                    <div style={{ display: ""grid"", gap: 10 }}>
                      <div style={{ display: ""flex"", alignItems: ""center"", justifyContent: ""space-between"", gap: 10 }}>
                        <H3 style={{ margin: 0 }}>Orders</H3>
                        <Small>Only estimates marked “Order”.</Small>
                      </div>

                      <div style={{ display: ""grid"", gap: 10 }}>
                        {pickerClient.estimates
                          .filter((e) => (estimateOutcomeById[e.id] ?? """") === ""Order"")
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

                        {pickerClient.estimates.filter((e) => (estimateOutcomeById[e.id] ?? """") === ""Order"").length === 0 && (
                          <div style={{ borderRadius: 14, border: ""1px dashed #e4e4e7"", padding: 14 }}>
                            <Small>No orders yet. Mark an estimate as “Order” in the Estimates tab.</Small>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* CLIENT NOTES (WYSIWYG comment area, timestamp + user) */}
                  {estimatePickerTab === ""client_notes"" && (
                    <div style={{ display: ""grid"", gap: 10 }}>
                      <div style={{ display: ""flex"", alignItems: ""center"", justifyContent: ""space-between"", gap: 10 }}>
                        <H3 style={{ margin: 0 }}>Client Notes</H3>
                        <Small>Notes are stored locally for now.</Small>
                      </div>

                      <div
                        contentEditable
                        suppressContentEditableWarning
                        onInput={(e) => setClientNoteDraftHtml((e.currentTarget as HTMLDivElement).innerHTML)}
                        dangerouslySetInnerHTML={{ __html: clientNoteDraftHtml }}
                        style={{
                          minHeight: 120,
                          borderRadius: 14,
                          border: ""1px solid #e4e4e7"",
                          padding: 12,
                          background: ""#fff"",
                          outline: ""none"",
                        }}
                      />

                      <div style={{ display: ""flex"", justifyContent: ""flex-end"" }}>
                        <Button
                          variant=""primary""
                          onClick={() => {
                            const html = (clientNoteDraftHtml ?? """").trim();
                            if (!html) return;
                            const createdAt = new Date().toISOString();
                            setClientNotes((prev) => [{ id: ""note_"" + createdAt, html, createdAt, createdBy: activeUserName }, ...prev]);
                            setClientNoteDraftHtml("""");
                          }}
                        >
                          Add Note
                        </Button>
                      </div>

                      <div style={{ display: ""grid"", gap: 10 }}>
                        {clientNotes.map((n) => (
                          <div key={n.id} style={{ borderRadius: 14, border: ""1px solid #e4e4e7"", padding: 12, background: ""#fff"" }}>
                            <div style={{ display: ""flex"", justifyContent: ""space-between"", gap: 10, flexWrap: ""wrap"" }}>
                              <Small>{new Date(n.createdAt).toLocaleString()}</Small>
                              <Small>By: {n.createdBy}</Small>
                            </div>
                            <div style={{ marginTop: 8 }} dangerouslySetInnerHTML={{ __html: n.html }} />
                          </div>
                        ))}
                        {clientNotes.length === 0 && (
                          <div style={{ borderRadius: 14, border: ""1px dashed #e4e4e7"", padding: 14 }}>
                            <Small>No notes yet.</Small>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* FILES (URLs + local selection list) */}
                  {estimatePickerTab === ""files"" && (
                    <div style={{ display: ""grid"", gap: 10 }}>
                      <div style={{ display: ""flex"", alignItems: ""center"", justifyContent: ""space-between"", gap: 10 }}>
                        <H3 style={{ margin: 0 }}>Files</H3>
                        <Small>Links to SharePoint/Drive/OneDrive/local paths.</Small>
                      </div>

                      <div style={{ display: ""grid"", gap: 10, borderRadius: 14, border: ""1px solid #e4e4e7"", padding: 12, background: ""#fff"" }}>
                        <div style={{ display: ""grid"", gap: 6 }}>
                          <Small>Label</Small>
                          <input
                            value={clientFileLabel}
                            onChange={(e) => setClientFileLabel(e.currentTarget.value)}
                            placeholder=""e.g. Site photos / Survey PDF / CAD""
                            style={{ height: 38, borderRadius: 12, border: ""1px solid #e4e4e7"", padding: ""0 12px"" }}
                          />
                        </div>

                        <div style={{ display: ""grid"", gap: 6 }}>
                          <Small>URL / Path</Small>
                          <input
                            value={clientFileUrl}
                            onChange={(e) => setClientFileUrl(e.currentTarget.value)}
                            placeholder=""https://...  or  C:\path\file.pdf""
                            style={{ height: 38, borderRadius: 12, border: ""1px solid #e4e4e7"", padding: ""0 12px"" }}
                          />
                        </div>

                        <div style={{ display: ""grid"", gap: 6 }}>
                          <Small>Attach files (optional)</Small>
                          <input
                            type=""file""
                            multiple
                            accept="".dwg,.dxf,.xls,.xlsx,.doc,.docx,.pdf,.skp,.png,.jpg,.jpeg,.webp,.txt""
                            onChange={(e) => {
                              const names = Array.from(e.currentTarget.files ?? []).map((f) => f.name);
                              setClientFileNames(names);
                            }}
                          />
                        </div>

                        <div style={{ display: ""flex"", justifyContent: ""flex-end"", gap: 10, flexWrap: ""wrap"" }}>
                          <Button
                            variant=""outline""
                            onClick={() => {
                              if (!clientFileUrl.trim()) return;
                              window.open(clientFileUrl, ""_blank"");
                            }}
                          >
                            Open link
                          </Button>

                          <Button
                            variant=""primary""
                            onClick={() => {
                              const url = clientFileUrl.trim();
                              if (!url) return;
                              const addedAt = new Date().toISOString();
                              setClientFiles((prev) => [
                                { id: ""file_"" + addedAt, label: (clientFileLabel || ""File"").trim(), url, addedAt, addedBy: activeUserName, fileNames: clientFileNames },
                                ...prev,
                              ]);
                              setClientFileLabel("""");
                              setClientFileUrl("""");
                              setClientFileNames([]);
                            }}
                          >
                            Add
                          </Button>
                        </div>
                      </div>

                      <div style={{ display: ""grid"", gap: 10 }}>
                        {clientFiles.map((f) => (
                          <div key={f.id} style={{ borderRadius: 14, border: ""1px solid #e4e4e7"", padding: 12, background: ""#fff"" }}>
                            <div style={{ display: ""flex"", justifyContent: ""space-between"", gap: 10, flexWrap: ""wrap"" }}>
                              <div style={{ display: ""grid"", gap: 4 }}>
                                <div style={{ fontWeight: 800 }}>{f.label}</div>
                                <Small style={{ wordBreak: ""break-all"" }}>{f.url}</Small>
                              </div>
                              <div style={{ display: ""grid"", justifyItems: ""end"", gap: 4 }}>
                                <Small>{new Date(f.addedAt).toLocaleString()}</Small>
                                <Small>By: {f.addedBy}</Small>
                              </div>
                            </div>

                            {!!(f.fileNames && f.fileNames.length) && (
                              <div style={{ marginTop: 8, display: ""flex"", gap: 8, flexWrap: ""wrap"" }}>
                                {f.fileNames.map((n) => (
                                  <Pill key={n}>{n}</Pill>
                                ))}
                              </div>
                            )}

                            <div style={{ marginTop: 10, display: ""flex"", justifyContent: ""flex-end"" }}>
                              <Button variant=""outline"" onClick={() => window.open(f.url, ""_blank"")}>
                                Open link
                              </Button>
                            </div>
                          </div>
                        ))}
                        {clientFiles.length === 0 && (
                          <div style={{ borderRadius: 14, border: ""1px dashed #e4e4e7"", padding: 14 }}>
                            <Small>No files yet.</Small>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            )}
"@

$txt = $before + $replacement + "`r`n`r`n            " + $after

Set-Content -Path $src -Value $txt -Encoding UTF8
Ok "Replaced Estimate Picker block with tabbed UI."
Ok "Done. Run: npm run dev"
