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
  const className = `ep-button ${variant === "primary" ? "ep-button--primary" : variant === "outline" ? "ep-button--outline" : "ep-button--secondary"}`;
  return (
    <button
      type="button"
      disabled={!!disabled}
      onClick={onClick}
      className={className}
      style={{
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
  return <input {...rest} className="ep-shared-input" disabled={disabled} style={{ background: disabled ? "#f4f4f5" : "#ffffff", ...(style as any) }} />;
}

export function Pill({ children }: { children: React.ReactNode }) {
  return <span className="ep-pill-base">{children}</span>;
}

export function Small({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div className="ep-small" style={style}>{children}</div>;
}

export function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="ep-h3">{children}</h3>;
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
    <div className="ep-timeline">
      <div className="ep-timeline-header">
        <div className="ep-timeline-label">Order timeline</div>
        <div className="ep-timeline-label">{completedCount}/{timeline.length} complete ({percent}%)</div>
      </div>
      <div className="ep-timeline-progress">
        <div style={{ width: `${percent}%`, height: "100%", background: "#22c55e" }} />
      </div>
      <div className="ep-timeline-grid">
        {timeline.map((t, i) => (
          <div key={i} className="ep-timeline-item" style={{ background: t.completed ? "#f0fdf4" : "#fff" }}>
            <div className="ep-timeline-item-label" style={{ color: t.completed ? "#166534" : "#52525b" }}>
              {t.completed ? "Complete" : "Pending"}
            </div>
            <div className="ep-timeline-item-stage">{stageLabel(t.stage)}</div>
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
    <div className="ep-pane-card ep-client-details-card">
      <div className="ep-pane-header" style={{ gap: 12 }}>
        <H3>Client contact information</H3>
        <Button variant="secondary" onClick={onEdit}>Edit</Button>
      </div>

      <div className="ep-client-details-body">
        <div className="ep-client-details-inline">
          <label className="ep-client-details-checkbox">
            <input type="checkbox" checked={c.type === "Business"} disabled />
            <span className="ep-client-details-checkbox-label">Business customer</span>
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

        <div className="ep-row">
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

        <div className="ep-client-details-section">
          <button type="button" onClick={() => setCustomerAddressOpen((prev) => !prev)} className="ep-accordion-button">
            <>
            <ExpandToggle expanded={customerAddressOpen} />
            <H3>Customer address</H3>
          </>
          </button>

          {customerAddressOpen && (
            <div className="ep-client-details-section-body">
              <div className="ep-row">
                <div><div style={labelStyle}>Address line 1</div><Input value={ca1} onChange={() => {}} disabled /></div>
                <div><div style={labelStyle}>Address line 2</div><Input value={ca2} onChange={() => {}} disabled /></div>
              </div>
              <div><div style={labelStyle}>Address line 3</div><Input value={ca3} onChange={() => {}} disabled /></div>
              <div className="ep-row">
                <div><div style={labelStyle}>Town</div><Input value={ct} onChange={() => {}} disabled /></div>
                <div><div style={labelStyle}>City</div><Input value={cc} onChange={() => {}} disabled /></div>
              </div>
              <div className="ep-row">
                <div><div style={labelStyle}>County/District</div><Input value={cco} onChange={() => {}} disabled /></div>
                <div><div style={labelStyle}>Postcode</div><Input value={cp} onChange={() => {}} disabled /></div>
              </div>
            </div>
          )}
        </div>

        <div className="ep-client-details-section">
          <button type="button" onClick={() => setInvoiceAddressOpen((prev) => !prev)} className="ep-accordion-button">
            <>
            <ExpandToggle expanded={invoiceAddressOpen} />
            <H3>Invoice address</H3>
          </>
          </button>

          {invoiceAddressOpen && (
            <div className="ep-client-details-section-body">
              <div className="ep-row">
                <div><div style={labelStyle}>Address line 1</div><Input value={i1} onChange={() => {}} disabled /></div>
                <div><div style={labelStyle}>Address line 2</div><Input value={i2} onChange={() => {}} disabled /></div>
              </div>
              <div><div style={labelStyle}>Address line 3</div><Input value={i3} onChange={() => {}} disabled /></div>
              <div className="ep-row">
                <div><div style={labelStyle}>Town</div><Input value={it} onChange={() => {}} disabled /></div>
                <div><div style={labelStyle}>City</div><Input value={ic} onChange={() => {}} disabled /></div>
              </div>
              <div className="ep-row">
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


