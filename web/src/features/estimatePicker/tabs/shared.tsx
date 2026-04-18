import React, { useState } from "react";
import { resolveStructuredAddress, addressTuple } from "../../../domain/address";
import { createDefaultTimeline } from "../../../system/orderTimeline";
import type { Client } from "../../../models/types";
import ExpandToggle from "../../../components/common/ExpandToggle";
import "./shared.css";

export function Button({
  children,
  onClick,
  variant = "primary",
  disabled,
  style,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "outline";
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

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { style, disabled, ...rest } = props;
  const base: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid #e4e4e7",
    background: disabled ? "#f4f4f5" : "#ffffff",
    color: "#111827",
    fontSize: 14,
    outline: "none",
  };
  return <input {...rest} disabled={disabled} style={{ ...base, ...(style as any) }} />;
}

export function Pill({ children }: { children: React.ReactNode }) {
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

export function Small({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ fontSize: 12, color: "#71717a", ...(style || {}) }}>{children}</div>;
}

export function H3({ children }: { children: React.ReactNode }) {
  return <h3 style={{ fontSize: 14, margin: 0, fontWeight: 800, color: "#18181b" }}>{children}</h3>;
}

export function noteCategoryLabel(category: "general" | "follow_up" | "service" | "installer" | "client_request") {
  if (category === "follow_up") return "Follow Up";
  if (category === "client_request") return "Client Request";
  return category.charAt(0).toUpperCase() + category.slice(1);
}

export function noteCategoryPillStyle(category: "general" | "follow_up" | "service" | "installer" | "client_request"): React.CSSProperties {
  if (category === "follow_up") return { background: "#eef2ff", color: "#3730a3", border: "1px solid #c7d2fe" };
  if (category === "service") return { background: "#ecfeff", color: "#155e75", border: "1px solid #a5f3fc" };
  if (category === "installer") return { background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0" };
  if (category === "client_request") return { background: "#fff7ed", color: "#9a3412", border: "1px solid #fed7aa" };
  return { background: "#f4f4f5", color: "#18181b", border: "1px solid #e4e4e7" };
}

export const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#3f3f46",
  marginBottom: 6,
};

export function qsOutcomeStyle(outcome: string): React.CSSProperties {
  const o = (outcome || "").toLowerCase();
  if (o === "order") return { background: "#22c55e", color: "#000", fontWeight: 800, border: "1px solid #22c55e" };
  if (o === "lost") return { background: "#ef4444", color: "#fff", fontWeight: 800, border: "1px solid #ef4444" };
  return { background: "#f59e0b", color: "#000", fontWeight: 800, border: "1px solid #f59e0b" };
}

export function ensureOrderMeta(e: any) {
  if (!e.orderMeta) {
    e.orderMeta = {
      timeline: createDefaultTimeline(),
    };
  }
}

export function stageLabel(stage: string) {
  if (stage === "signoff_sent") return "Sign-off sent";
  if (stage === "signoff_received") return "Sign-off received";
  if (stage === "factory_order") return "Factory order";
  if (stage === "in_production") return "Production start";
  if (stage === "pre_dispatch_invoice") return "Balance due";
  if (stage === "production_complete") return "Production complete";
  if (stage === "factory_dispatch") return "Dispatch";
  if (stage === "delivery") return "Delivery";
  if (stage === "installation") return "Installation";
  return stage;
}

export function OrderTimelineBar({ timeline }: { timeline: any[] }) {
  const completedCount = timeline.filter((t) => t.completed).length;
  const percent = timeline.length ? Math.round((completedCount / timeline.length) * 100) : 0;

  return (
    <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#3f3f46" }}>Order timeline</div>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#3f3f46" }}>{completedCount}/{timeline.length} complete ({percent}%)</div>
      </div>
      <div style={{ height: 10, borderRadius: 999, background: "#e4e4e7", overflow: "hidden" }}>
        <div style={{ width: `${percent}%`, height: "100%", background: "#22c55e" }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
        {timeline.map((t, i) => (
          <div key={i} style={{ borderRadius: 10, border: "1px solid #e4e4e7", padding: 8, background: t.completed ? "#f0fdf4" : "#fff" }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: t.completed ? "#166534" : "#52525b", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              {t.completed ? "Complete" : "Pending"}
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#18181b", marginTop: 4 }}>{stageLabel(t.stage)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ClientDetailsReadonly({ c, onEdit }: { c: Client; onEdit: () => void }) {
  const [customerAddressOpen, setCustomerAddressOpen] = useState(false);
  const [invoiceAddressOpen, setInvoiceAddressOpen] = useState(false);

  const customerStructured = resolveStructuredAddress((c as any).customerAddressStructured, (c as any).customerAddress || "");
  const [ca1, ca2, ca3, ct, cc, cco, cp] = addressTuple(customerStructured);

  const invoiceStructured = resolveStructuredAddress(c.invoiceAddressStructured, c.invoiceAddress || "");
  const [i1, i2, i3, it, ic, ico, ip] = addressTuple(invoiceStructured);

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
          <button type="button" onClick={() => setCustomerAddressOpen((prev) => !prev)} style={{ border: "none", background: "transparent", padding: 0, margin: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, font: "inherit", color: "#18181b" }}>
            <>
            <ExpandToggle expanded={customerAddressOpen} />
            <H3>Customer address</H3>
          </>
          </button>

          {customerAddressOpen && (
            <div style={{ marginTop: 10, display: "grid", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><div style={labelStyle}>Address line 1</div><Input value={ca1} onChange={() => {}} disabled /></div>
                <div><div style={labelStyle}>Address line 2</div><Input value={ca2} onChange={() => {}} disabled /></div>
              </div>
              <div><div style={labelStyle}>Address line 3</div><Input value={ca3} onChange={() => {}} disabled /></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><div style={labelStyle}>Town</div><Input value={ct} onChange={() => {}} disabled /></div>
                <div><div style={labelStyle}>City</div><Input value={cc} onChange={() => {}} disabled /></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><div style={labelStyle}>County/District</div><Input value={cco} onChange={() => {}} disabled /></div>
                <div><div style={labelStyle}>Postcode</div><Input value={cp} onChange={() => {}} disabled /></div>
              </div>
            </div>
          )}
        </div>

        <div style={{ marginTop: 10, borderTop: "1px solid #e4e4e7", paddingTop: 10 }}>
          <button type="button" onClick={() => setInvoiceAddressOpen((prev) => !prev)} style={{ border: "none", background: "transparent", padding: 0, margin: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, font: "inherit", color: "#18181b" }}>
            <>
            <ExpandToggle expanded={invoiceAddressOpen} />
            <H3>Invoice address</H3>
          </>
          </button>

          {invoiceAddressOpen && (
            <div style={{ marginTop: 10, display: "grid", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><div style={labelStyle}>Address line 1</div><Input value={i1} onChange={() => {}} disabled /></div>
                <div><div style={labelStyle}>Address line 2</div><Input value={i2} onChange={() => {}} disabled /></div>
              </div>
              <div><div style={labelStyle}>Address line 3</div><Input value={i3} onChange={() => {}} disabled /></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><div style={labelStyle}>Town</div><Input value={it} onChange={() => {}} disabled /></div>
                <div><div style={labelStyle}>City</div><Input value={ic} onChange={() => {}} disabled /></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><div style={labelStyle}>County/District</div><Input value={ico} onChange={() => {}} disabled /></div>
                <div><div style={labelStyle}>Postcode</div><Input value={ip} onChange={() => {}} disabled /></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


