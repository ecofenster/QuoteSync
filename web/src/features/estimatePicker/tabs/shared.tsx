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
  className = "",
  "data-testid": dataTestId,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "outline" | "selected" | "danger";
  disabled?: boolean;
  className?: string;
  "data-testid"?: string;
}) {
  const variantClassName = `ep-button ui-button ${variant === "primary" ? "ui-button--primary" : variant === "selected" ? "ui-button--selected" : variant === "danger" ? "ui-button--danger" : ""}`;
  return (
    <button
      type="button"
      disabled={!!disabled}
      onClick={onClick}
      className={`${variantClassName} ${className}`.trim()}
      data-testid={dataTestId}
    >
      {children}
    </button>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { disabled, className = "", ...rest } = props;
  return <input {...rest} className={`ep-shared-input ${className}`.trim()} disabled={disabled} />;
}

export function Pill({ children }: { children: React.ReactNode }) {
  return <span className="ep-pill-base">{children}</span>;
}

export function Small({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`ep-small ${className}`.trim()}>{children}</div>;
}

export function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="ep-h3">{children}</h3>;
}

export function noteCategoryLabel(category: "general" | "follow_up" | "service" | "installer" | "client_request") {
  if (category === "follow_up") return "Follow Up";
  if (category === "client_request") return "Client Request";
  return category.charAt(0).toUpperCase() + category.slice(1);
}

export function noteCategoryPillClassName(category: "general" | "follow_up" | "service" | "installer" | "client_request") {
  if (category === "follow_up") return "ep-note-pill--follow-up";
  if (category === "client_request") return "ep-note-pill--client-request";
  return category === "general" ? "" : `ep-note-pill--${category}`;
}

export function qsOutcomeClassName(outcome: string) {
  const normalized = (outcome || "").toLowerCase();
  if (normalized === "order") return "ep-outcome-control--order";
  if (normalized === "lost") return "ep-outcome-control--lost";
  return "ep-outcome-control--open";
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
      <progress className="ep-timeline-progress" max={100} value={percent} aria-label="Order timeline progress" />
      <div className="ep-timeline-grid">
        {timeline.map((t, i) => (
          <div key={i} className={`ep-timeline-item ep-timeline-item--${t.completed ? "complete" : "pending"}`}>
            <div className="ep-timeline-item-label">
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
      <div className="ep-pane-header qs-migrated-259">
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
              <div className="qs-migrated-243">Business name</div>
              <Input value={c.businessName || c.clientName || ""} onChange={() => {}} disabled />
            </div>
            <div>
              <div className="qs-migrated-243">Contact name</div>
              <Input value={c.contactPerson || ""} onChange={() => {}} disabled />
            </div>
          </>
        ) : (
          <div>
            <div className="qs-migrated-243">Client name</div>
            <Input value={c.clientName || ""} onChange={() => {}} disabled />
          </div>
        )}

        <div className="ep-row">
          <div>
            <div className="qs-migrated-243">Email</div>
            <Input value={c.email || ""} onChange={() => {}} disabled />
          </div>
          <div>
            <div className="qs-migrated-243">Mobile</div>
            <Input value={c.mobile || ""} onChange={() => {}} disabled />
          </div>
        </div>

        <div>
          <div className="qs-migrated-243">Home</div>
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
                <div><div className="qs-migrated-243">Address line 1</div><Input value={ca1} onChange={() => {}} disabled /></div>
                <div><div className="qs-migrated-243">Address line 2</div><Input value={ca2} onChange={() => {}} disabled /></div>
              </div>
              <div><div className="qs-migrated-243">Address line 3</div><Input value={ca3} onChange={() => {}} disabled /></div>
              <div className="ep-row">
                <div><div className="qs-migrated-243">Town</div><Input value={ct} onChange={() => {}} disabled /></div>
                <div><div className="qs-migrated-243">City</div><Input value={cc} onChange={() => {}} disabled /></div>
              </div>
              <div className="ep-row">
                <div><div className="qs-migrated-243">County/District</div><Input value={cco} onChange={() => {}} disabled /></div>
                <div><div className="qs-migrated-243">Postcode</div><Input value={cp} onChange={() => {}} disabled /></div>
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
                <div><div className="qs-migrated-243">Address line 1</div><Input value={i1} onChange={() => {}} disabled /></div>
                <div><div className="qs-migrated-243">Address line 2</div><Input value={i2} onChange={() => {}} disabled /></div>
              </div>
              <div><div className="qs-migrated-243">Address line 3</div><Input value={i3} onChange={() => {}} disabled /></div>
              <div className="ep-row">
                <div><div className="qs-migrated-243">Town</div><Input value={it} onChange={() => {}} disabled /></div>
                <div><div className="qs-migrated-243">City</div><Input value={ic} onChange={() => {}} disabled /></div>
              </div>
              <div className="ep-row">
                <div><div className="qs-migrated-243">County/District</div><Input value={ico} onChange={() => {}} disabled /></div>
                <div><div className="qs-migrated-243">Postcode</div><Input value={ip} onChange={() => {}} disabled /></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


