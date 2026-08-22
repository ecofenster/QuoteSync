import {
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import type { Client, Estimate, Position } from "../../models/types";
import { projectCalculatorLabApi } from "../projectCalculatorLab/api/projectCalculatorLabApi";
import {
  DEFAULT_CUSTOMER_QUOTATION_DISPLAY_OPTIONS,
  type CustomerQuotationDisplayOptions,
} from "./customerQuotationDisplay";
import { paginateCustomerQuotationPositions } from "./customerQuotationPagination";
import {
  buildCustomerQuotationProjection,
  type CustomerQuotationProjection,
} from "./customerQuotationProjection";
import CustomerQuotationPositionCard from "./CustomerQuotationPositionCard";
import "./customerQuotation.css";
import "./customerQuotationBrand.css";

type DocumentTemplate = "technical_schedule" | "customer_quotation";
const money = (value: string | null | undefined) =>
  value == null
    ? "—"
    : new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: "GBP",
      }).format(Number(value));

function PageHeader({
  projection,
}: {
  projection: CustomerQuotationProjection;
}) {
  return (
    <header className="customer-quotation-page__header">
      {projection.brand.logoLightUrl ? (
        <img
          src={projection.brand.logoLightUrl}
          alt={projection.brand.tradingName}
        />
      ) : (
        <strong>{projection.brand.tradingName}</strong>
      )}
      <div>
        <b>Customer</b>
        <span>{projection.clientName}</span>
        <small>{projection.projectAddress}</small>
      </div>
      <div>
        <b>Reference</b>
        <span>{projection.estimateReference}</span>
      </div>
      <div>
        <b>Date</b>
        <span>
          {new Date(projection.previewDate).toLocaleDateString("en-GB")}
        </span>
      </div>
      <div className="customer-quotation-page__quote">
        <small>QUOTATION</small>
        <strong>{projection.estimateReference}</strong>
        <span>Commercial revision {projection.commercialRevision}</span>
      </div>
    </header>
  );
}
function PageFooter({
  projection,
  page,
  total,
}: {
  projection: CustomerQuotationProjection;
  page: number;
  total: number;
}) {
  return (
    <footer className="customer-quotation-page__footer">
      <span>
        {projection.brand.companyName}
        {projection.brand.address ? ` · ${projection.brand.address}` : ""}
      </span>
      <span>
        {[
          projection.brand.telephone,
          projection.brand.email,
          projection.brand.website,
        ]
          .filter(Boolean)
          .join(" · ")}
      </span>
      <span>
        Page {page} of {total}
      </span>
    </footer>
  );
}

export default function CustomerQuotationPreview({
  client,
  estimate,
  PositionPreview,
  onClose,
}: {
  client: Client;
  estimate: Estimate;
  PositionPreview?: ComponentType<{ position: Position }>;
  onClose: () => void;
}) {
  const [projection, setProjection] =
    useState<CustomerQuotationProjection | null>(null);
  const [error, setError] = useState("");
  const [options, setOptions] = useState<CustomerQuotationDisplayOptions>(
    DEFAULT_CUSTOMER_QUOTATION_DISPLAY_OPTIONS,
  );
  const [template, setTemplate] =
    useState<DocumentTemplate>("customer_quotation");
  useEffect(() => {
    let cancelled = false;
    projectCalculatorLabApi
      .listScenarios(String(estimate.id))
      .then(async (scenarios) => {
        const saved = scenarios[0];
        if (!saved)
          throw new Error(
            "Save Project Costing before previewing the customer quotation.",
          );
        const scenario = await projectCalculatorLabApi.getScenario(
          saved.id,
          String(estimate.id),
        );
        if (!cancelled)
          setProjection(
            buildCustomerQuotationProjection({ scenario, client, estimate }),
          );
      })
      .catch((reason) => {
        if (!cancelled)
          setError(
            reason instanceof Error
              ? reason.message
              : "Customer quotation could not be prepared.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [client, estimate]);
  const pages = useMemo(
    () =>
      projection
        ? paginateCustomerQuotationPositions(projection.positions)
        : [],
    [projection],
  );
  const totalPages = pages.length + (projection ? 1 : 0);
  const style = projection
    ? ({
        "--document-primary": projection.brand.primaryColour,
        "--document-accent": projection.brand.accentColour,
      } as CSSProperties)
    : undefined;
  const summary = projection ? (
    <section className="customer-quotation-page customer-quotation-page--summary">
      <PageHeader projection={projection} />
      <main>
        <section className="customer-quotation-summary">
          <h2>Quotation Summary</h2>
          <p>
            {projection.positions.length} quoted positions for{" "}
            {projection.projectName || projection.clientName}.
          </p>
          {projection.charges.length ? (
            <div className="customer-quotation__charges">
              {projection.charges.map((charge) => (
                <div key={charge.id}>
                  <span>{charge.label}</span>
                  <strong>{money(charge.amountGbp)}</strong>
                </div>
              ))}
            </div>
          ) : null}
          <div className="customer-quotation__totals">
            {projection.showCustomerDiscount ? <div>
              <span>Customer discount</span>
              <strong>−{money(projection.customerDiscountGbp)}</strong>
            </div> : null}
            {projection.fixedSellingPriceEnabled &&
            Number(projection.fixedPriceAdjustmentGbp) !== 0 ? (
              <div>
                <span>Project fixed-price adjustment</span>
                <strong>{money(projection.fixedPriceAdjustmentGbp)}</strong>
              </div>
            ) : null}
            <div>
              <span>Subtotal excluding VAT</span>
              <strong>{money(projection.subtotalExVatGbp)}</strong>
            </div>
            <div>
              <span>VAT ({projection.vatRatePercent}%)</span>
              <strong>{money(projection.vatGbp)}</strong>
            </div>
            <div className="customer-quotation__grand-total">
              <span>Total including VAT</span>
              <strong>{money(projection.totalIncVatGbp)}</strong>
            </div>
          </div>
        </section>
      </main>
      <PageFooter
        projection={projection}
        page={totalPages}
        total={totalPages}
      />
    </section>
  ) : null;
  return createPortal(
    <div className="customer-quotation__scrim" role="presentation">
      <section
        className="customer-quotation__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="customer-quotation-title"
      >
        <div className="customer-quotation__controls no-print">
          <div>
            <strong id="customer-quotation-title">
              Customer Quotation Preview
            </strong>
            <small>Saved Project Costing · customer-safe preview</small>
          </div>
          <label>
            Document style
            <select
              aria-label="Document style"
              className="ui-input"
              value={template}
              onChange={(event) =>
                setTemplate(event.currentTarget.value as DocumentTemplate)
              }
            >
              <option value="technical_schedule">Technical Schedule</option>
              <option value="customer_quotation">Customer Quotation</option>
            </select>
          </label>
          <label>
            Thermal
            <select
              aria-label="Thermal display"
              className="ui-input"
              value={options.thermalPerformance}
              onChange={(event) => { const thermalPerformance = event.currentTarget.value as CustomerQuotationDisplayOptions["thermalPerformance"]; setOptions((current) => ({ ...current, thermalPerformance })); }}
            >
              <option value="full">Full</option>
              <option value="compact">Compact</option>
              <option value="hide">Hide</option>
            </select>
          </label>
          <label>
            Section Details
            <select
              aria-label="Section details display"
              className="ui-input"
              value={options.sectionDetails}
              onChange={(event) => { const sectionDetails = event.currentTarget.value as CustomerQuotationDisplayOptions["sectionDetails"]; setOptions((current) => ({ ...current, sectionDetails })); }}
            >
              <option value="show">Show</option>
              <option value="hide">Hide</option>
            </select>
          </label>
          <div>
            <button className="ui-button" onClick={onClose}>
              Close
            </button>
            <button
              className="ui-button ui-button--primary"
              disabled={!projection}
              onClick={() => window.print()}
            >
              Print / Save PDF
            </button>
          </div>
        </div>
        {error ? (
          <p role="alert" className="customer-quotation__error">
            {error}
          </p>
        ) : null}
        {!projection && !error ? (
          <p className="customer-quotation__loading">
            Loading saved commercial revision…
          </p>
        ) : null}
        {projection ? (
          <article
            className={`customer-quotation__print-root customer-quotation__print-root--${template.replace("_", "-")}`}
            data-document-template={template}
            data-thermal-mode={options.thermalPerformance}
            data-section-details={options.sectionDetails}
            style={style}
          >
            {pages.map((page, index) => (
              <section
                className={`customer-quotation-page${page.wide ? " customer-quotation-page--wide" : ""}`}
                key={page.positions.map((item) => item.id).join("-")}
              >
                <PageHeader projection={projection} />
                <main>
                  {page.positions.map((position) => (
                    <CustomerQuotationPositionCard
                      key={position.id}
                      position={position}
                      options={options}
                      wide={page.wide}
                      PositionPreview={PositionPreview}
                    />
                  ))}
                </main>
                <PageFooter
                  projection={projection}
                  page={index + 1}
                  total={totalPages}
                />
              </section>
            ))}
            {summary}
          </article>
        ) : null}
      </section>
    </div>,
    document.body,
  );
}
