import { useEffect, useState, type ComponentType } from "react";
import type { Client, Estimate, Position } from "../../models/types";
import { projectCalculatorLabApi } from "../projectCalculatorLab/api/projectCalculatorLabApi";
import { buildCustomerQuotationProjection, type CustomerQuotationProjection } from "./customerQuotationProjection";
import "./customerQuotation.css";
import "./customerQuotationBrand.css";

const money = (value: string | null | undefined) => value == null ? "—" : new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(Number(value));

export default function CustomerQuotationPreview({ client, estimate, PositionPreview, onClose }: {
  client: Client;
  estimate: Estimate;
  PositionPreview?: ComponentType<{ position: Position }>;
  onClose: () => void;
}) {
  const [projection, setProjection] = useState<CustomerQuotationProjection | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    projectCalculatorLabApi.listScenarios(String(estimate.id)).then(async (scenarios) => {
      const saved = scenarios[0];
      if (!saved) throw new Error("Save Project Costing before previewing the customer quotation.");
      const scenario = await projectCalculatorLabApi.getScenario(saved.id, String(estimate.id));
      if (!cancelled) setProjection(buildCustomerQuotationProjection({ scenario, client, estimate }));
    }).catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Customer quotation could not be prepared."); });
    return () => { cancelled = true; };
  }, [client, estimate]);

  return <div className="customer-quotation__scrim" role="presentation">
    <section className="customer-quotation__dialog ui-card" role="dialog" aria-modal="true" aria-labelledby="customer-quotation-title">
      <div className="customer-quotation__controls no-print"><div><strong>Customer Quotation Preview</strong><small>Generated from saved Project Costing. This is not an issued quotation.</small></div><div><button className="ui-button" onClick={onClose}>Close</button><button className="ui-button ui-button--primary" disabled={!projection} onClick={() => window.print()}>Print / Save PDF</button></div></div>
      {error ? <p role="alert" className="customer-quotation__error">{error}</p> : null}
      {!projection && !error ? <p className="customer-quotation__loading">Loading saved commercial revision…</p> : null}
      {projection ? <article className="customer-quotation__print-root">
        <header className="customer-quotation__header">{projection.brand.logoLightUrl ? <img className="customer-quotation__brand-logo" src={projection.brand.logoLightUrl} alt={projection.brand.tradingName} /> : <strong>{projection.brand.tradingName}</strong>}<div><h1 id="customer-quotation-title">Customer Quotation</h1><p>{projection.brand.companyName}</p></div><dl><div><dt>Reference</dt><dd>{projection.estimateReference}</dd></div><div><dt>Commercial revision</dt><dd>{projection.commercialRevision}</dd></div><div><dt>Preview date</dt><dd>{new Date(projection.previewDate).toLocaleDateString("en-GB")}</dd></div></dl></header>
        <section className="customer-quotation__customer"><div><span>Customer</span><strong>{projection.clientName}</strong></div>{projection.projectName ? <div><span>Project</span><strong>{projection.projectName}</strong></div> : null}{projection.projectAddress ? <div><span>Site</span><strong>{projection.projectAddress}</strong></div> : null}</section>
        <section><h2>Window and door schedule</h2><div className="customer-quotation__table-wrap"><table><thead><tr><th>Position</th><th>Product / specification</th><th>Preview / Product Image</th><th>Size</th><th>Qty</th><th>Unit</th><th>Total</th></tr></thead><tbody>{projection.positions.map((position) => <tr key={position.id}><td><strong>{position.sequence}. {position.customerReference}</strong>{position.manufacturerItemNumber ? <small>Manufacturer item {position.manufacturerItemNumber}</small> : null}{position.roomName ? <small>{position.roomName}</small> : null}</td><td><strong>{position.productSystem || position.description}</strong>{position.configurationDescription ? <small>{position.configurationDescription}</small> : null}{position.specification.map(item => <small key={`${item.label}-${item.value}`}>{item.label}: {item.value}</small>)}</td><td>{position.drawing.source === "manufacturer" ? <img className="customer-quotation__source-image" src={position.drawing.imageUrl} alt={`Manufacturer elevation for ${position.customerReference}`} /> : position.hasConfiguredDrawing && position.estimatePosition && PositionPreview ? <PositionPreview position={position.estimatePosition} /> : <small>Drawing unavailable</small>}{position.thermal?.ug ? <small>Manufacturer quoted Ug: {position.thermal.ug}</small> : null}{position.thermal?.manufacturerQuotedUw ? <small>Manufacturer quoted Uw: {position.thermal.manufacturerQuotedUw}</small> : null}</td><td>{position.widthMm} × {position.heightMm} mm</td><td>{position.quantity}</td><td>{money(position.unitSellingPriceGbp)}</td><td><strong>{money(position.totalSellingPriceGbp)}</strong></td></tr>)}</tbody></table></div></section>
        {projection.charges.length ? <section><h2>Additional charges</h2><div className="customer-quotation__charges">{projection.charges.map((charge) => <div key={charge.id}><span>{charge.label}</span><strong>{money(charge.amountGbp)}</strong></div>)}</div></section> : null}
        {projection.alternatives.length ? <section className="customer-quotation__alternatives"><h2>Options / Alternatives</h2><p>Excluded from the primary quotation total.</p>{projection.alternatives.map((item) => <div key={item.id}><strong>{item.reference}</strong><span>{item.description} · {item.widthMm} × {item.heightMm} mm · Qty {item.quantity}</span></div>)}</section> : null}
        <section className="customer-quotation__totals"><div><span>Customer discount</span><strong>−{money(projection.customerDiscountGbp)}</strong></div>{projection.fixedSellingPriceEnabled && Number(projection.fixedPriceAdjustmentGbp) !== 0 ? <div><span>Project fixed-price adjustment</span><strong>{money(projection.fixedPriceAdjustmentGbp)}</strong></div> : null}<div><span>Subtotal excluding VAT</span><strong>{money(projection.subtotalExVatGbp)}</strong></div><div><span>VAT ({projection.vatRatePercent}%)</span><strong>{money(projection.vatGbp)}</strong></div><div className="customer-quotation__grand-total"><span>Total including VAT</span><strong>{money(projection.totalIncVatGbp)}</strong></div></section>
        <footer><p>This preview is based on saved Project Costing commercial revision {projection.commercialRevision}. Prices are in GBP.</p></footer>
      </article> : null}
    </section>
  </div>;
}
