import React, { useMemo, useState } from "react";

/* =========================
   Types
========================= */

type MenuKey =
  | "customers_business"
  | "customers_individual"
  | "project_preferences"
  | "address_database"
  | "reports"
  | "cad_drawing"
  | "remote_support";

type ClientType = "Business" | "Individual";
type EstimateStatus = "Draft" | "Completed";

type View =
  | "customers"
  | "estimate_workspace";

type Client = {
  id: string;
  type: ClientType;
  clientRef: string; // EF-CL-001
  clientName: string; // Individual: name, Business: display name (usually business name)
  email: string;
  mobile: string;
  home: string;

  projectName: string;
  projectAddress: string;
  invoiceAddress: string;

  businessName?: string;
  contactPerson?: string;

  estimates: Estimate[];
};

type Estimate = {
  id: string;
  estimateRef: string;        // EF-2026-001 or EF-2026-001-01
  baseEstimateRef: string;    // EF-2026-001
  revisionNo: number;         // 0 = base, 1..n revisions
  status: EstimateStatus;
  positions: Position[];
};

type Position = {
  id: string;
  positionRef: string;
  qty: number;
  roomName: string;

  supplier: string;
  product: string;

  widthMm: number;
  heightMm: number;
  fieldsX: number;
  fieldsY: number;

  insertion: string;
};

/* =========================
   Helpers
========================= */

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function pad3(n: number) {
  const s = String(n);
  return s.length >= 3 ? s : "0".repeat(3 - s.length) + s;
}

function nextClientRef(n: number) {
  return `EF-CL-${pad3(n)}`;
}

function nextEstimateBaseRef(year: number, n: number) {
  return `EF-${year}-${pad3(n)}`;
}

function estimateRefWithRevision(base: string, revisionNo: number) {
  if (revisionNo <= 0) return base;
  return `${base}-${String(revisionNo).padStart(2, "0")}`;
}

/* =========================
   UI primitives (inline only)
========================= */

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        borderRadius: 18,
        border: "1px solid #e4e4e7",
        background: "#fff",
        padding: 16,
        boxShadow: "0 1px 2px rgba(0,0,0,.06)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function H1({ children }: { children: React.ReactNode }) {
  return <h1 style={{ fontSize: 22, margin: 0, fontWeight: 800, color: "#18181b" }}>{children}</h1>;
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontSize: 16, margin: 0, fontWeight: 800, color: "#18181b" }}>{children}</h2>;
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 style={{ fontSize: 14, margin: 0, fontWeight: 800, color: "#18181b" }}>{children}</h3>;
}

function Small({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, color: "#71717a" }}>{children}</div>;
}

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

function Input({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: "100%",
        borderRadius: 12,
        border: "1px solid #e4e4e7",
        padding: "10px 12px",
        fontSize: 14,
        outline: "none",
      }}
    />
  );
}

function TextArea({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <textarea
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      rows={3}
      style={{
        width: "100%",
        borderRadius: 12,
        border: "1px solid #e4e4e7",
        padding: "10px 12px",
        fontSize: 14,
        outline: "none",
        resize: "vertical",
      }}
    />
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        padding: "2px 8px",
        fontSize: 11,
        color: "#fff",
        background: "#18181b",
      }}
    >
      {children}
    </span>
  );
}

function MenuItem({
  label,
  active,
  onClick,
  indent = false,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
  indent?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        borderRadius: 12,
        padding: "10px 12px",
        cursor: "pointer",
        background: active ? "#18181b" : "transparent",
        color: active ? "#fff" : "#3f3f46",
        fontSize: 14,
        fontWeight: active ? 800 : 600,
        paddingLeft: indent ? 24 : 12,
      }}
    >
      {label}
    </div>
  );
}

/* =========================
   Main App
========================= */

export default function App() {
  const [menu, setMenu] = useState<MenuKey>("customers_business");
  const [view, setView] = useState<View>("customers");

  // In-memory counters
  const [clientCounter, setClientCounter] = useState(1);
  const [estimateCounter, setEstimateCounter] = useState(1);

  // Stores
  const [clients, setClients] = useState<Client[]>([]);

  // Selection
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const selectedClient = useMemo(
    () => clients.find((c) => c.id === selectedClientId) ?? null,
    [clients, selectedClientId]
  );

  const [selectedEstimateId, setSelectedEstimateId] = useState<string | null>(null);
  const selectedEstimate = useMemo(() => {
    if (!selectedClient) return null;
    return selectedClient.estimates.find((e) => e.id === selectedEstimateId) ?? null;
  }, [selectedClient, selectedEstimateId]);

  // Revision tickboxes
  const [revisionSelection, setRevisionSelection] = useState<Record<string, boolean>>({});

  // Add client UI
  const [showAddClient, setShowAddClient] = useState(false);

  // Client form drafts
  const [draftClientName, setDraftClientName] = useState("");
  const [draftProjectName, setDraftProjectName] = useState("");
  const [draftProjectAddress, setDraftProjectAddress] = useState("");
  const [draftInvoiceAddress, setDraftInvoiceAddress] = useState("");
  const [draftEmail, setDraftEmail] = useState("");
  const [draftMobile, setDraftMobile] = useState("");
  const [draftHome, setDraftHome] = useState("");

  const [draftBusinessName, setDraftBusinessName] = useState("");
  const [draftContactPerson, setDraftContactPerson] = useState("");

  // Position wizard (UI-only)
  const [showPositionWizard, setShowPositionWizard] = useState(false);
  const [posStep, setPosStep] = useState<1 | 2 | 3 | 4>(1);
  const [posDraft, setPosDraft] = useState<Position>(() => ({
    id: uid(),
    positionRef: "W-001",
    qty: 1,
    roomName: "",
    supplier: "",
    product: "",
    widthMm: 1000,
    heightMm: 1200,
    fieldsX: 1,
    fieldsY: 1,
    insertion: "Fixed",
  }));

  // Derived
  const activeClientType: ClientType = menu === "customers_business" ? "Business" : "Individual";
  const filteredClients = useMemo(
    () => clients.filter((c) => c.type === activeClientType),
    [clients, activeClientType]
  );

  function selectMenu(k: MenuKey) {
    setMenu(k);
    if (k === "customers_business" || k === "customers_individual") {
      setView("customers");
      setSelectedClientId(null);
      setSelectedEstimateId(null);
      setRevisionSelection({});
      setShowAddClient(false);
      setShowPositionWizard(false);
    } else {
      setView("customers");
      setShowPositionWizard(false);
    }
  }

  function resetClientDrafts() {
    setDraftClientName("");
    setDraftProjectName("");
    setDraftProjectAddress("");
    setDraftInvoiceAddress("");
    setDraftEmail("");
    setDraftMobile("");
    setDraftHome("");
    setDraftBusinessName("");
    setDraftContactPerson("");
  }

  function openAddClient() {
    setShowAddClient(true);
    resetClientDrafts();
  }

  function closeAddClient() {
    setShowAddClient(false);
  }

  function createClient(type: ClientType) {
    const newClient: Client = {
      id: uid(),
      type,
      clientRef: nextClientRef(clientCounter),
      clientName: type === "Business" ? (draftBusinessName.trim() || draftClientName.trim()) : draftClientName.trim(),
      email: draftEmail.trim(),
      mobile: draftMobile.trim(),
      home: draftHome.trim(),
      projectName: draftProjectName.trim(),
      projectAddress: draftProjectAddress.trim(),
      invoiceAddress: draftInvoiceAddress.trim(),
      businessName: type === "Business" ? draftBusinessName.trim() : undefined,
      contactPerson: type === "Business" ? draftContactPerson.trim() : undefined,
      estimates: [],
    };

    setClients((prev) => [newClient, ...prev]);
    setClientCounter((n) => n + 1);
    setSelectedClientId(newClient.id);
    setSelectedEstimateId(null);
    setRevisionSelection({});
    setShowAddClient(false);
  }

  function openEstimateWorkspace(clientId: string, estimateId: string) {
    setSelectedClientId(clientId);
    setSelectedEstimateId(estimateId);
    setShowPositionWizard(false);
    setPosStep(1);
    setRevisionSelection({});
    setView("estimate_workspace");
  }

  function createNewEstimateForSelectedClient() {
    if (!selectedClient) return;

    const year = 2026;
    const baseRef = nextEstimateBaseRef(year, estimateCounter);

    const est: Estimate = {
      id: uid(),
      estimateRef: baseRef,
      baseEstimateRef: baseRef,
      revisionNo: 0,
      status: "Draft",
      positions: [],
    };

    setClients((prev) =>
      prev.map((c) => {
        if (c.id !== selectedClient.id) return c;
        return { ...c, estimates: [est, ...c.estimates] };
      })
    );

    setEstimateCounter((n) => n + 1);

    openEstimateWorkspace(selectedClient.id, est.id);
  }

  function setRevisionTick(id: string, v: boolean) {
    setRevisionSelection((prev) => ({ ...prev, [id]: v }));
  }

  function createRevisionsFromSelectionAndOpenNewest() {
    if (!selectedClient) return;

    const chosenIds = Object.keys(revisionSelection).filter((id) => revisionSelection[id]);
    if (chosenIds.length === 0) return;

    let newestCreatedId: string | null = null;

    setClients((prev) =>
      prev.map((c) => {
        if (c.id !== selectedClient.id) return c;

        const maxRevByBase: Record<string, number> = {};
        for (const e of c.estimates) {
          maxRevByBase[e.baseEstimateRef] = Math.max(maxRevByBase[e.baseEstimateRef] ?? 0, e.revisionNo);
        }

        const toAdd: Estimate[] = [];

        for (const id of chosenIds) {
          const base = c.estimates.find((e) => e.id === id);
          if (!base) continue;

          const nextRev = (maxRevByBase[base.baseEstimateRef] ?? 0) + 1;
          maxRevByBase[base.baseEstimateRef] = nextRev;

          const newRef = estimateRefWithRevision(base.baseEstimateRef, nextRev);

          const clone: Estimate = {
            id: uid(),
            estimateRef: newRef,
            baseEstimateRef: base.baseEstimateRef,
            revisionNo: nextRev,
            status: "Draft",
            positions: base.positions.map((p) => ({ ...p, id: uid() })),
          };

          newestCreatedId = clone.id;
          toAdd.push(clone);
        }

        if (toAdd.length === 0) return c;
        return { ...c, estimates: [...toAdd, ...c.estimates] };
      })
    );

    setRevisionSelection({});

    if (newestCreatedId) {
      openEstimateWorkspace(selectedClient.id, newestCreatedId);
    }
  }

  function startAddPosition() {
    if (!selectedClient || !selectedEstimate) return;

    const nextIndex = (selectedEstimate.positions?.length ?? 0) + 1;

    setPosStep(1);
    setPosDraft({
      id: uid(),
      positionRef: `W-${pad3(nextIndex)}`,
      qty: 1,
      roomName: "",
      supplier: "",
      product: "",
      widthMm: 1000,
      heightMm: 1200,
      fieldsX: 1,
      fieldsY: 1,
      insertion: "Fixed",
    });
    setShowPositionWizard(true);
  }

  function savePositionToEstimate() {
    if (!selectedClient || !selectedEstimate) return;

    const newPos = { ...posDraft, id: uid() };

    setClients((prev) =>
      prev.map((c) => {
        if (c.id !== selectedClient.id) return c;
        return {
          ...c,
          estimates: c.estimates.map((e) => {
            if (e.id !== selectedEstimate.id) return e;
            return { ...e, positions: [newPos, ...e.positions] };
          }),
        };
      })
    );

    setShowPositionWizard(false);
    setPosStep(1);
  }

  function saveEstimateAndReturnToCustomer() {
    if (!selectedClient || !selectedEstimate) return;

    setClients((prev) =>
      prev.map((c) => {
        if (c.id !== selectedClient.id) return c;
        return {
          ...c,
          estimates: c.estimates.map((e) => {
            if (e.id !== selectedEstimate.id) return e;
            return { ...e, status: "Completed" };
          }),
        };
      })
    );

    // Return to customer screen, keep client selected
    setView("customers");
    setShowPositionWizard(false);
    setRevisionSelection({});
  }

  function stepLabel(s: 1 | 2 | 3 | 4) {
    return s === 1 ? "Position" : s === 2 ? "Supplier & Product" : s === 3 ? "Dimensions" : "Configuration";
  }

  const addLabel = activeClientType === "Business" ? "Add Business" : "Add Individual Client";

  return (
    <div style={{ minHeight: "100vh", width: "100%", background: "#fafafa", padding: 24 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div>
          <H1>QuoteSync</H1>
          <div style={{ marginTop: 8, fontSize: 13, color: "#52525b" }}>
            Customers → Estimates → Positions
          </div>
        </div>
      </div>

      <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "280px 1fr", gap: 24 }}>
        {/* LEFT MENU */}
        <Card>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#18181b" }}>Project Centre</div>

          <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#71717a", paddingLeft: 2 }}>Customers</div>
            <MenuItem label="Business" indent active={menu === "customers_business"} onClick={() => selectMenu("customers_business")} />
            <MenuItem label="Individual Client" indent active={menu === "customers_individual"} onClick={() => selectMenu("customers_individual")} />

            <div style={{ height: 8 }} />

            <MenuItem label="Project Preferences" active={menu === "project_preferences"} onClick={() => selectMenu("project_preferences")} />
            <MenuItem label="Address Database" active={menu === "address_database"} onClick={() => selectMenu("address_database")} />
            <MenuItem label="Reports" active={menu === "reports"} onClick={() => selectMenu("reports")} />
            <MenuItem label="CAD Drawing" active={menu === "cad_drawing"} onClick={() => selectMenu("cad_drawing")} />
            <MenuItem label="Remote Support" active={menu === "remote_support"} onClick={() => selectMenu("remote_support")} />
          </div>
        </Card>

        {/* RIGHT CONTENT */}
        <div style={{ display: "grid", gap: 24 }}>
          {/* Non-customer placeholders */}
          {menu !== "customers_business" && menu !== "customers_individual" && (
            <Card>
              <H2>
                {menu === "project_preferences"
                  ? "Project Preferences"
                  : menu === "address_database"
                  ? "Address Database"
                  : menu === "reports"
                  ? "Reports"
                  : menu === "cad_drawing"
                  ? "CAD Drawing"
                  : "Remote Support"}
              </H2>
              <div style={{ marginTop: 10, fontSize: 13, color: "#71717a" }}>
                Placeholder for this section (UI-only scaffold).
              </div>
            </Card>
          )}

          {/* CUSTOMERS VIEW */}
          {(menu === "customers_business" || menu === "customers_individual") && view === "customers" && (
            <Card>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <H2>{activeClientType === "Business" ? "Business Customers" : "Individual Clients"}</H2>
                  <Small>Select a customer to view details and manage estimates.</Small>
                </div>

                <Button variant="primary" onClick={openAddClient}>
                  {addLabel}
                </Button>
              </div>

              {/* Add client form */}
              {showAddClient && (
                <div style={{ marginTop: 16, borderRadius: 14, border: "1px solid #e4e4e7", padding: 12, background: "#fff" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <H3>{addLabel}</H3>
                    <Button variant="secondary" onClick={closeAddClient} style={{ borderRadius: 14, padding: "8px 10px" }}>
                      Close
                    </Button>
                  </div>

                  <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <div style={labelStyle}>Client name</div>
                      <Input value={draftClientName} onChange={setDraftClientName} placeholder="Client name" />
                    </div>

                    <div>
                      <div style={labelStyle}>Project name</div>
                      <Input value={draftProjectName} onChange={setDraftProjectName} placeholder="Project name" />
                    </div>

                    <div style={{ gridColumn: "1 / -1" }}>
                      <div style={labelStyle}>Project address</div>
                      <TextArea value={draftProjectAddress} onChange={setDraftProjectAddress} placeholder="Project address" />
                    </div>

                    <div style={{ gridColumn: "1 / -1" }}>
                      <div style={labelStyle}>Invoice address</div>
                      <TextArea value={draftInvoiceAddress} onChange={setDraftInvoiceAddress} placeholder="Invoice address" />
                    </div>

                    <div>
                      <div style={labelStyle}>Email</div>
                      <Input value={draftEmail} onChange={setDraftEmail} placeholder="Email" />
                    </div>

                    <div>
                      <div style={labelStyle}>Mobile</div>
                      <Input value={draftMobile} onChange={setDraftMobile} placeholder="Mobile" />
                    </div>

                    <div>
                      <div style={labelStyle}>Home</div>
                      <Input value={draftHome} onChange={setDraftHome} placeholder="Home" />
                    </div>

                    {activeClientType === "Business" && (
                      <>
                        <div>
                          <div style={labelStyle}>Business name</div>
                          <Input value={draftBusinessName} onChange={setDraftBusinessName} placeholder="Business name" />
                        </div>
                        <div>
                          <div style={labelStyle}>Contact person</div>
                          <Input value={draftContactPerson} onChange={setDraftContactPerson} placeholder="Contact person" />
                        </div>
                      </>
                    )}
                  </div>

                  <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end", gap: 10 }}>
                    <Button
                      variant="primary"
                      onClick={() => createClient(activeClientType)}
                      disabled={!draftClientName.trim() && !(activeClientType === "Business" && draftBusinessName.trim())}
                    >
                      Save
                    </Button>
                  </div>
                </div>
              )}

              {/* Clients list + details */}
              <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {/* List */}
                <div style={{ borderRadius: 14, border: "1px solid #e4e4e7", padding: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <H3>Customers</H3>
                    <Small>{filteredClients.length} total</Small>
                  </div>

                  <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                    {filteredClients.length === 0 && (
                      <div style={{ fontSize: 13, color: "#71717a" }}>No customers yet.</div>
                    )}

                    {filteredClients.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setSelectedClientId(c.id);
                          setSelectedEstimateId(null);
                          setRevisionSelection({});
                          setShowPositionWizard(false);
                        }}
                        style={{
                          textAlign: "left",
                          borderRadius: 14,
                          border: "1px solid #e4e4e7",
                          background: selectedClientId === c.id ? "#18181b" : "#fff",
                          color: selectedClientId === c.id ? "#fff" : "#18181b",
                          padding: 12,
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                          <div style={{ fontWeight: 900, fontSize: 13 }}>{c.clientRef}</div>
                          <div style={{ fontSize: 12, opacity: 0.85 }}>{c.estimates.length} estimate(s)</div>
                        </div>
                        <div style={{ marginTop: 6, fontSize: 13, fontWeight: 800 }}>
                          {c.type === "Business" ? (c.businessName || c.clientName) : c.clientName}
                        </div>
                        <div style={{ marginTop: 4, fontSize: 12, opacity: 0.85 }}>
                          {c.email || "—"} • {c.mobile || "—"}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Details */}
                <div style={{ borderRadius: 14, border: "1px solid #e4e4e7", padding: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <H3>Customer details</H3>
                    {!selectedClient && <Small>Select a customer</Small>}
                  </div>

                  {!selectedClient && (
                    <div style={{ marginTop: 10, fontSize: 13, color: "#71717a" }}>
                      Select a customer to view their information and estimates.
                    </div>
                  )}

                  {selectedClient && (
                    <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <Pill>{selectedClient.clientRef}</Pill>
                        <Pill>{selectedClient.type}</Pill>
                        <Small>{selectedClient.estimates.length} estimate(s)</Small>
                      </div>

                      <div style={{ fontSize: 14, fontWeight: 900 }}>
                        {selectedClient.type === "Business"
                          ? (selectedClient.businessName || selectedClient.clientName)
                          : selectedClient.clientName}
                      </div>

                      {selectedClient.type === "Business" && (
                        <div style={{ fontSize: 13, color: "#3f3f46" }}>
                          <b>Contact person:</b> {selectedClient.contactPerson || "—"}
                        </div>
                      )}

                      <div style={{ fontSize: 13, color: "#3f3f46" }}>
                        <b>Project name:</b> {selectedClient.projectName || "—"}
                      </div>

                      <div style={{ fontSize: 13, color: "#3f3f46" }}>
                        <b>Project address:</b> {selectedClient.projectAddress || "—"}
                      </div>

                      <div style={{ fontSize: 13, color: "#3f3f46" }}>
                        <b>Invoice address:</b> {selectedClient.invoiceAddress || "—"}
                      </div>

                      <div style={{ fontSize: 13, color: "#3f3f46" }}>
                        <b>Email:</b> {selectedClient.email || "—"}
                      </div>
                      <div style={{ fontSize: 13, color: "#3f3f46" }}>
                        <b>Mobile:</b> {selectedClient.mobile || "—"}
                      </div>
                      <div style={{ fontSize: 13, color: "#3f3f46" }}>
                        <b>Home:</b> {selectedClient.home || "—"}
                      </div>

                      {/* Estimates */}
                      <div style={{ marginTop: 6, borderTop: "1px solid #e4e4e7", paddingTop: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                          <H3>Estimates</H3>
                          <Button variant="primary" onClick={createNewEstimateForSelectedClient}>
                            New Estimate
                          </Button>
                        </div>

                        <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                          {selectedClient.estimates.length === 0 && (
                            <div style={{ fontSize: 13, color: "#71717a" }}>
                              No estimates yet. Click <b>New Estimate</b> to create one.
                            </div>
                          )}

                          {selectedClient.estimates.map((e) => {
                            const showTick = e.status === "Completed";
                            return (
                              <div
                                key={e.id}
                                style={{
                                  borderRadius: 14,
                                  border: "1px solid #e4e4e7",
                                  padding: 10,
                                  background: "#fff",
                                }}
                              >
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                                  <button
                                    type="button"
                                    onClick={() => openEstimateWorkspace(selectedClient.id, e.id)}
                                    style={{
                                      textAlign: "left",
                                      background: "transparent",
                                      border: "none",
                                      color: "#18181b",
                                      cursor: "pointer",
                                      padding: 0,
                                      flex: 1,
                                    }}
                                  >
                                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                                      <div style={{ fontWeight: 900, fontSize: 13 }}>{e.estimateRef}</div>
                                      <span
                                        style={{
                                          display: "inline-flex",
                                          alignItems: "center",
                                          borderRadius: 999,
                                          padding: "2px 8px",
                                          fontSize: 11,
                                          background: e.status === "Completed" ? "#16a34a" : "#52525b",
                                          color: "#fff",
                                        }}
                                      >
                                        {e.status}
                                      </span>
                                      <Small>{e.positions.length} position(s)</Small>
                                    </div>
                                  </button>

                                  <Button
                                    variant="secondary"
                                    onClick={() => toggleEstimateCompleted(e.id)}
                                    style={{ borderRadius: 14, padding: "8px 10px" }}
                                  >
                                    Toggle Completed
                                  </Button>
                                </div>

                                {showTick && (
                                  <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
                                    <input
                                      type="checkbox"
                                      checked={!!revisionSelection[e.id]}
                                      onChange={(ev) => setRevisionTick(e.id, ev.target.checked)}
                                    />
                                    <div style={{ fontSize: 12, color: "#3f3f46" }}>
                                      Select for revision
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end", gap: 10 }}>
                          <Button
                            variant="secondary"
                            disabled={Object.keys(revisionSelection).filter((id) => revisionSelection[id]).length === 0}
                            onClick={createRevisionsFromSelectionAndOpenNewest}
                          >
                            Create Revision
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* ESTIMATE WORKSPACE */}
          {(menu === "customers_business" || menu === "customers_individual") && view === "estimate_workspace" && selectedClient && selectedEstimate && (
            <Card style={{ minHeight: 520, display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <H2>Estimate</H2>
                  <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <Pill>{selectedClient.clientRef}</Pill>
                    <Pill>{selectedEstimate.estimateRef}</Pill>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        borderRadius: 999,
                        padding: "2px 8px",
                        fontSize: 11,
                        background: selectedEstimate.status === "Completed" ? "#16a34a" : "#52525b",
                        color: "#fff",
                      }}
                    >
                      {selectedEstimate.status}
                    </span>
                    <Small>{selectedClient.type === "Business" ? (selectedClient.businessName || selectedClient.clientName) : selectedClient.clientName}</Small>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  <Button variant="secondary" onClick={() => { setView("customers"); setShowPositionWizard(false); }}>
                    Back
                  </Button>
                  <Button variant="primary" onClick={saveEstimateAndReturnToCustomer}>
                    Save Estimate
                  </Button>
                </div>
              </div>

              {/* Add Position at the top */}
              <div style={{ marginTop: 16 }}>
                <Button variant="primary" onClick={startAddPosition} style={{ width: "100%" }}>
                  Add Position
                </Button>
              </div>

              <div style={{ marginTop: 16, borderTop: "1px solid #e4e4e7", paddingTop: 12, flex: 1 }}>
                <H3>Positions</H3>
                <Small>Positions added to this estimate appear below.</Small>

                <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                  {selectedEstimate.positions.length === 0 && (
                    <div style={{ fontSize: 13, color: "#71717a" }}>No positions yet.</div>
                  )}

                  {selectedEstimate.positions.map((p) => (
                    <div
                      key={p.id}
                      style={{
                        borderRadius: 14,
                        border: "1px solid #e4e4e7",
                        padding: 10,
                        background: "#fff",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                        <div style={{ fontWeight: 900, fontSize: 13 }}>{p.positionRef}</div>
                        <div style={{ fontSize: 12, color: "#71717a" }}>
                          Qty {p.qty} • {p.widthMm}×{p.heightMm} • {p.fieldsX}×{p.fieldsY}
                        </div>
                      </div>
                      <div style={{ marginTop: 4, fontSize: 12, color: "#71717a" }}>
                        {p.roomName || "—"} • {p.supplier || "—"} / {p.product || "—"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Position wizard inline panel */}
              {showPositionWizard && (
                <div style={{ marginTop: 14, borderRadius: 14, border: "1px solid #e4e4e7", padding: 12, background: "#fff" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <H3>Add Position</H3>
                    <Button variant="secondary" onClick={() => setShowPositionWizard(false)} style={{ borderRadius: 14, padding: "8px 10px" }}>
                      Close
                    </Button>
                  </div>

                  <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {[1, 2, 3, 4].map((s) => (
                      <div
                        key={s}
                        style={{
                          borderRadius: 14,
                          border: "1px solid " + (posStep === s ? "#18181b" : "#e4e4e7"),
                          background: posStep === s ? "#18181b" : "#fff",
                          color: posStep === s ? "#fff" : "#3f3f46",
                          padding: "8px 10px",
                          fontSize: 14,
                          fontWeight: 800,
                        }}
                      >
                        {s}. {stepLabel(s as any)}
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: 12, borderRadius: 14, border: "1px solid #e4e4e7", padding: 12 }}>
                    {posStep === 1 && (
                      <div style={{ display: "grid", gap: 12 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                          <div>
                            <div style={labelStyle}>Position reference</div>
                            <Input value={posDraft.positionRef} onChange={(v) => setPosDraft((p) => ({ ...p, positionRef: v }))} />
                          </div>
                          <div>
                            <div style={labelStyle}>Quantity</div>
                            <Input
                              type="number"
                              value={String(posDraft.qty)}
                              onChange={(v) => setPosDraft((p) => ({ ...p, qty: Math.max(1, Math.min(999, Number(v || 1))) }))}
                            />
                          </div>
                        </div>
                        <div>
                          <div style={labelStyle}>Room name</div>
                          <Input value={posDraft.roomName} onChange={(v) => setPosDraft((p) => ({ ...p, roomName: v }))} />
                        </div>
                      </div>
                    )}

                    {posStep === 2 && (
                      <div style={{ display: "grid", gap: 12 }}>
                        <div>
                          <div style={labelStyle}>Supplier</div>
                          <Input value={posDraft.supplier} onChange={(v) => setPosDraft((p) => ({ ...p, supplier: v }))} placeholder="Supplier" />
                        </div>
                        <div>
                          <div style={labelStyle}>Product</div>
                          <Input value={posDraft.product} onChange={(v) => setPosDraft((p) => ({ ...p, product: v }))} placeholder="Product/System" />
                        </div>
                      </div>
                    )}

                    {posStep === 3 && (
                      <div style={{ display: "grid", gap: 12 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                          <div>
                            <div style={labelStyle}>Total width (mm)</div>
                            <Input
                              type="number"
                              value={String(posDraft.widthMm)}
                              onChange={(v) => setPosDraft((p) => ({ ...p, widthMm: Math.max(300, Math.min(6000, Number(v || 1000))) }))}
                            />
                          </div>
                          <div>
                            <div style={labelStyle}>Total height (mm)</div>
                            <Input
                              type="number"
                              value={String(posDraft.heightMm)}
                              onChange={(v) => setPosDraft((p) => ({ ...p, heightMm: Math.max(300, Math.min(6000, Number(v || 1200))) }))}
                            />
                          </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                          <div>
                            <div style={labelStyle}>Fields (width)</div>
                            <Input
                              type="number"
                              value={String(posDraft.fieldsX)}
                              onChange={(v) => setPosDraft((p) => ({ ...p, fieldsX: Math.max(1, Math.min(8, Number(v || 1))) }))}
                            />
                          </div>
                          <div>
                            <div style={labelStyle}>Fields (height)</div>
                            <Input
                              type="number"
                              value={String(posDraft.fieldsY)}
                              onChange={(v) => setPosDraft((p) => ({ ...p, fieldsY: Math.max(1, Math.min(8, Number(v || 1))) }))}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {posStep === 4 && (
                      <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 16 }}>
                        <div style={{ display: "grid", gap: 12 }}>
                          <div style={{ borderRadius: 14, border: "1px solid #e4e4e7", padding: 12 }}>
                            <H3>Insertion</H3>
                            <div style={{ marginTop: 8 }}>
                              <select
                                value={posDraft.insertion}
                                onChange={(e) => setPosDraft((p) => ({ ...p, insertion: e.target.value }))}
                                style={{ width: "100%", borderRadius: 12, border: "1px solid #e4e4e7", padding: "10px 12px", fontSize: 14 }}
                              >
                                <option>Fixed</option>
                                <option>Turn</option>
                                <option>Tilt</option>
                                <option>Tilt & Turn</option>
                              </select>
                            </div>
                          </div>

                          <div style={{ borderRadius: 14, border: "1px solid #e4e4e7", padding: 12 }}>
                            <H3>Position information</H3>
                            <div style={{ marginTop: 8, fontSize: 14, color: "#3f3f46", display: "grid", gap: 6 }}>
                              <div><b>Ref:</b> {posDraft.positionRef}</div>
                              <div><b>Room:</b> {posDraft.roomName || "—"}</div>
                              <div><b>Qty:</b> {posDraft.qty}</div>
                              <div><b>Supplier:</b> {posDraft.supplier || "—"}</div>
                              <div><b>Product:</b> {posDraft.product || "—"}</div>
                              <div><b>Size:</b> {posDraft.widthMm}×{posDraft.heightMm}</div>
                              <div><b>Grid:</b> {posDraft.fieldsX}×{posDraft.fieldsY}</div>
                            </div>
                          </div>
                        </div>

                        <div style={{ borderRadius: 14, border: "1px solid #e4e4e7", padding: 12, height: 360 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                            <H3>Preview</H3>
                            <Pill>{posDraft.insertion}</Pill>
                          </div>
                          <div style={{ marginTop: 10, fontSize: 12, color: "#71717a" }}>
                            Technical drawing placeholder (UI-only).
                          </div>
                          <div style={{ marginTop: 12, borderRadius: 14, border: "1px solid #e4e4e7", height: 260, display: "flex", alignItems: "center", justifyContent: "center", color: "#a1a1aa" }}>
                            Drawing
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <Button
                      variant="secondary"
                      onClick={() => setPosStep((s) => (s === 1 ? 1 : ((s - 1) as any)))}
                      disabled={posStep === 1}
                    >
                      Back
                    </Button>

                    {posStep < 4 ? (
                      <Button variant="primary" onClick={() => setPosStep((s) => ((s + 1) as any))}>
                        Next
                      </Button>
                    ) : (
                      <Button variant="primary" onClick={savePositionToEstimate}>
                        Save Position
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = { fontSize: 13, color: "#3f3f46", fontWeight: 700, marginBottom: 6 };
