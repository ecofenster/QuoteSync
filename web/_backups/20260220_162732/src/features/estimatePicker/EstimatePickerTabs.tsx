// Auto-generated extraction (Phase 2): Estimate Picker Tabs
// Purpose: split out Estimate Picker tab UI from App.tsx without changing layout/styles.
// NOTE: This file intentionally duplicates a few small UI primitives (Button/Pill/Small/H3)
// and ClientDetailsReadonly to avoid risky refactors at this stage.

import React from "react";

type EstimateOutcome = "Open" | "Lost" | "Order";
type EstimatePickerTab = "client_info" | "estimates" | "orders" | "client_notes" | "files";

type Props = {
  estimatePickerTab: EstimatePickerTab;
  setEstimatePickerTab: (t: EstimatePickerTab) => void;

  pickerClient: any;
  openEditClientPanel: (c: any) => void;
  openEstimateFromPicker: (estimateId: string) => void;

  estimateOutcomeById: Record<string, EstimateOutcome | undefined>;
  setEstimateOutcomeById: React.Dispatch<React.SetStateAction<Record<string, EstimateOutcome>>>;

  clientNoteDraftHtml: string;
  setClientNoteDraftHtml: (html: string) => void;
  clientNotes: Array<any>;
  setClientNotes: React.Dispatch<React.SetStateAction<Array<any>>>;

  activeUserName: string;

  clientFileLabel: string;
  setClientFileLabel: (v: string) => void;
  clientFileUrl: string;
  setClientFileUrl: (v: string) => void;
  clientFileNames: string[];
  setClientFileNames: (v: string[]) => void;
  clientFiles: Array<any>;
  setClientFiles: React.Dispatch<React.SetStateAction<Array<any>>>;
};

function Button({
  children,
  onClick,
  variant = "primary",
  disabled,
  style,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary";
  disabled?: boolean;
  style?: React.CSSProperties;
}) {
  const isPrimary = variant === "primary";
  return (
    <button
      type="button"
      disabled={!!disabled}
      onClick={onClick}
      style={{
        borderRadius: 18,
        border: isPrimary ? "none" : "1px solid #e4e4e7",
        background: isPrimary ? "#18181b" : "#fff",
        color: isPrimary ? "#fff" : "#3f3f46",
        padding: "10px 14px",
        fontSize: 14,
        fontWeight: 800,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        padding: "4px 10px",
        fontSize: 12,
        fontWeight: 800,
        background: "#f4f4f5",
        color: "#18181b",
        border: "1px solid #e4e4e7",
      }}
    >
      {children}
    </span>
  );
}

function Small({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, color: "#71717a" }}>{children}</div>;
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 style={{ fontSize: 14, margin: 0, fontWeight: 800, color: "#18181b" }}>{children}</h3>;
}

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

export default function EstimatePickerTabs(props: Props) {
  const {
    estimatePickerTab,
    setEstimatePickerTab,
    pickerClient,
    openEditClientPanel,
    openEstimateFromPicker,
    estimateOutcomeById,
    setEstimateOutcomeById,
    clientNoteDraftHtml,
    setClientNoteDraftHtml,
    clientNotes,
    setClientNotes,
    activeUserName,
    clientFileLabel,
    setClientFileLabel,
    clientFileUrl,
    setClientFileUrl,
    clientFileNames,
    setClientFileNames,
    clientFiles,
    setClientFiles,
  } = props;

  return (
    <>
{/* Tabs (Estimate Picker only) */}
<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
  <Button variant={estimatePickerTab === "client_info" ? "primary" : "secondary"} onClick={() => setEstimatePickerTab("client_info")}>
    Client Info
  </Button>
  <Button variant={estimatePickerTab === "estimates" ? "primary" : "secondary"} onClick={() => setEstimatePickerTab("estimates")}>
    Estimates
  </Button>
  <Button variant={estimatePickerTab === "orders" ? "primary" : "secondary"} onClick={() => setEstimatePickerTab("orders")}>
    Orders
  </Button>
  <Button variant={estimatePickerTab === "client_notes" ? "primary" : "secondary"} onClick={() => setEstimatePickerTab("client_notes")}>
    Client Notes
  </Button>
  <Button variant={estimatePickerTab === "files" ? "primary" : "secondary"} onClick={() => setEstimatePickerTab("files")}>
    Files
  </Button>
</div>

{/* CLIENT INFO (default landing tab) */}
{estimatePickerTab === "client_info" && (
  <div style={{ display: "grid", gap: 10 }}>
    <ClientDetailsReadonly c={pickerClient} onEdit={() => openEditClientPanel(pickerClient)} />

    <div style={{ marginTop: 2, display: "grid", gap: 10 }}>
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
          </div>

          <Button variant="primary" onClick={() => openEstimateFromPicker(e.id)}>
            Open
          </Button>
        </div>
      ))}
    </div>
  </div>
)}

{/* ESTIMATES (with outcome dropdown) */}
{estimatePickerTab === "estimates" && (
  <div style={{ display: "grid", gap: 10 }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
      <H3 style={{ margin: 0 }}>Estimates</H3>
      <Small>Set outcome per estimate.</Small>
    </div>

    <div style={{ display: "grid", gap: 10 }}>
      {pickerClient.estimates.map((e) => {
        const outcome = estimateOutcomeById[e.id] ?? "Open";
        return (
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

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <select
                value={outcome}
                onChange={(ev) => {
                  const v = ev.currentTarget.value as EstimateOutcome;
                  setEstimateOutcomeById((prev) => ({ ...prev, [e.id]: v }));
                }}
                style={{
                  height: 36,
                  borderRadius: 10,
                  border: "1px solid #e4e4e7",
                  padding: "0 10px",
                  background: "#fff",
                  fontSize: 14,
                }}
              >
                <option value="Open">Open</option>
                <option value="Lost">Lost</option>
                <option value="Order">Order</option>
              </select>

              <Button variant="primary" onClick={() => openEstimateFromPicker(e.id)}>
                Open
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  </div>
)}

{/* ORDERS (estimates marked "Order") */}
{estimatePickerTab === "orders" && (
  <div style={{ display: "grid", gap: 10 }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
      <H3 style={{ margin: 0 }}>Orders</H3>
      <Small>Only estimates marked “Order”.</Small>
    </div>

    <div style={{ display: "grid", gap: 10 }}>
      {pickerClient.estimates
        .filter((e) => (estimateOutcomeById[e.id] ?? "") === "Order")
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

      {pickerClient.estimates.filter((e) => (estimateOutcomeById[e.id] ?? "") === "Order").length === 0 && (
        <div style={{ borderRadius: 14, border: "1px dashed #e4e4e7", padding: 14 }}>
          <Small>No orders yet. Mark an estimate as “Order” in the Estimates tab.</Small>
        </div>
      )}
    </div>
  </div>
)}

{/* CLIENT NOTES (WYSIWYG comment area, timestamp + user) */}
{estimatePickerTab === "client_notes" && (
  <div style={{ display: "grid", gap: 10 }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
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
        border: "1px solid #e4e4e7",
        padding: 12,
        background: "#fff",
        outline: "none",
      }}
    />

    <div style={{ display: "flex", justifyContent: "flex-end" }}>
      <Button
        variant="primary"
        onClick={() => {
          const html = (clientNoteDraftHtml ?? "").trim();
          if (!html) return;
          const createdAt = new Date().toISOString();
          setClientNotes((prev) => [{ id: "note_" + createdAt, html, createdAt, createdBy: activeUserName }, ...prev]);
          setClientNoteDraftHtml("");
        }}
      >
        Add Note
      </Button>
    </div>

    <div style={{ display: "grid", gap: 10 }}>
      {clientNotes.map((n) => (
        <div key={n.id} style={{ borderRadius: 14, border: "1px solid #e4e4e7", padding: 12, background: "#fff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <Small>{new Date(n.createdAt).toLocaleString()}</Small>
            <Small>By: {n.createdBy}</Small>
          </div>
          <div style={{ marginTop: 8 }} dangerouslySetInnerHTML={{ __html: n.html }} />
        </div>
      ))}
      {clientNotes.length === 0 && (
        <div style={{ borderRadius: 14, border: "1px dashed #e4e4e7", padding: 14 }}>
          <Small>No notes yet.</Small>
        </div>
      )}
    </div>
  </div>
)}

{/* FILES (URLs + local selection list) */}
{estimatePickerTab === "files" && (
  <div style={{ display: "grid", gap: 10 }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
      <H3 style={{ margin: 0 }}>Files</H3>
      <Small>Links to SharePoint/Drive/OneDrive/local paths.</Small>
    </div>

    <div style={{ display: "grid", gap: 10, borderRadius: 14, border: "1px solid #e4e4e7", padding: 12, background: "#fff" }}>
      <div style={{ display: "grid", gap: 6 }}>
        <Small>Label</Small>
        <input
          value={clientFileLabel}
          onChange={(e) => setClientFileLabel(e.currentTarget.value)}
          placeholder="e.g. Site photos / Survey PDF / CAD"
          style={{ height: 38, borderRadius: 12, border: "1px solid #e4e4e7", padding: "0 12px" }}
        />
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        <Small>URL / Path</Small>
        <input
          value={clientFileUrl}
          onChange={(e) => setClientFileUrl(e.currentTarget.value)}
          placeholder="https://...  or  C:\path\file.pdf"
          style={{ height: 38, borderRadius: 12, border: "1px solid #e4e4e7", padding: "0 12px" }}
        />
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        <Small>Attach files (optional)</Small>
        <input
          type="file"
          multiple
          accept=".dwg,.dxf,.xls,.xlsx,.doc,.docx,.pdf,.skp,.png,.jpg,.jpeg,.webp,.txt"
          onChange={(e) => {
            const names = Array.from(e.currentTarget.files ?? []).map((f) => f.name);
            setClientFileNames(names);
          }}
        />
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
        <Button
          variant="secondary"
          onClick={() => {
            if (!clientFileUrl.trim()) return;
            window.open(clientFileUrl, "_blank");
          }}
        >
          Open link
        </Button>

        <Button
          variant="primary"
          onClick={() => {
            const url = clientFileUrl.trim();
            if (!url) return;
            const addedAt = new Date().toISOString();
            setClientFiles((prev) => [
              { id: "file_" + addedAt, label: (clientFileLabel || "File").trim(), url, addedAt, addedBy: activeUserName, fileNames: clientFileNames },
              ...prev,
            ]);
            setClientFileLabel("");
            setClientFileUrl("");
            setClientFileNames([]);
          }}
        >
          Add
        </Button>
      </div>
    </div>

    <div style={{ display: "grid", gap: 10 }}>
      {clientFiles.map((f) => (
        <div key={f.id} style={{ borderRadius: 14, border: "1px solid #e4e4e7", padding: 12, background: "#fff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div style={{ display: "grid", gap: 4 }}>
              <div style={{ fontWeight: 800 }}>{f.label}</div>
              <Small style={{ wordBreak: "break-all" }}>{f.url}</Small>
            </div>
            <div style={{ display: "grid", justifyItems: "end", gap: 4 }}>
              <Small>{new Date(f.addedAt).toLocaleString()}</Small>
              <Small>By: {f.addedBy}</Small>
            </div>
          </div>

          {!!(f.fileNames && f.fileNames.length) && (
            <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {f.fileNames.map((n) => (
                <Pill key={n}>{n}</Pill>
              ))}
            </div>
          )}

          <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
            <Button variant="secondary" onClick={() => window.open(f.url, "_blank")}>
              Open link
            </Button>
          </div>
        </div>
      ))}
      {clientFiles.length === 0 && (
        <div style={{ borderRadius: 14, border: "1px dashed #e4e4e7", padding: 14 }}>
          <Small>No files yet.</Small>
        </div>
      )}
    </div>
  </div>
)}
    </>
  );
}

