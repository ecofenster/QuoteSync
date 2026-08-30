import React, { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type {
  CalculatorProductRow,
  CalculatorScenario,
  CalculatorSupplierCost,
} from "./domain/projectCalculatorLab.types";
import {
  addDecimalAmounts,
  applyMarkupPercentage,
  calculateProductSelling,
  MARKUP_CATEGORIES,
  percentageRatio,
  validateMarkupPercentage,
  type MarkupCategory,
  type ProjectCostingMarkups,
} from "./domain/projectCostingMarkup";
import {
  originalSupplierPurchaseGroups,
  supplierNameForProduct,
} from "./domain/projectCostingPresentation";
import {
  calculateCommercialMargin,
  DEFAULT_COMMERCIAL_MARGIN_POLICY,
  resolveMarginStatus,
  validateGrossMarginPercentage,
  type CommercialMarginPolicy,
} from "./domain/commercialMargin";
import Toggle from "../../components/Toggle";
import SupplierCommercialReview, {
  type SupplierCommercialResult,
} from "./SupplierCommercialReview";
import { projectCalculatorLabApi } from "./api/projectCalculatorLabApi";
import SiteVisitTravelPanel from "./SiteVisitTravelPanel";
import InstallationMaterialsAssumptions from "./InstallationMaterialsAssumptions";
import ConfigureInstallation from "./ConfigureInstallation";
import { useEstimateCommercialActions } from "../estimateCommercial/EstimateCommercialActionsContext";
import { resolveManufacturerVisualAssetUrl } from "../manufacturerVisuals/manufacturerVisualAssetUrl";
import { manufacturerVisualOrientation, manufacturerVisualOrientationLabel } from "../manufacturerVisuals/manufacturerVisualRole";
import { useCustomerViewPolicy } from "../estimateCommercial/customerViewPolicy";
import {
  deriveProjectCostingCommercialResult,
  percentageAmount,
  type ProjectCostingScenarioView,
} from "./domain/projectCostingCommercialResult";
import { resolveVatTreatment, VAT_TREATMENTS, type VatTreatmentCode } from "./domain/vatTreatment";

type WorksheetScenario = ProjectCostingScenarioView & {
  commercialMarginPolicy?: CommercialMarginPolicy;
  me508Calculation?: {
    rollsRequired: number;
    boxesRequired: number;
    totalCost: string | null;
  };
  fixingBreakdown?: Array<Record<string, unknown>>;
};
type SectionKey =
  | "products"
  | "extras"
  | "transport"
  | "siteVisit"
  | "equipment"
  | "installation"
  | "materials"
  | "duties";
const number = (value: string | null | undefined) => Number(value || 0);
const money = (value: string | null | undefined, currency = "GBP") =>
  value == null || value === ""
    ? "—"
    : new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
      }).format(number(value));
const original = (rows: Array<{ originalAmount: string | null }>) =>
  rows.reduce((sum, row) => sum + number(row.originalAmount), 0);
const originalTotals = (
  rows: Array<{
    originalAmount: string | null;
    originalCurrency: string | null;
  }>,
) =>
  Object.entries(
    rows.reduce<Record<string, string[]>>((groups, row) => {
      if (row.originalAmount != null && row.originalCurrency)
        (groups[row.originalCurrency] ??= []).push(row.originalAmount);
      return groups;
    }, {}),
  )
    .map(([currency, values]) => money(addDecimalAmounts(values), currency))
    .join(" + ") || "—";
const quotationTotals = (
  scenario: CalculatorScenario,
  field: "productSubtotal" | "deliveryTotal" | "finalSupplierTotal",
) =>
  scenario.supplierSummary?.quotations.reduce<Record<string, string[]>>(
    (groups, item) => {
      const value = item[field];
      if (value != null) (groups[item.currency] ??= []).push(value);
      return groups;
    },
    {},
  ) ?? {};
const formatGroupedTotals = (groups: Record<string, string[]>) =>
  Object.entries(groups)
    .map(([currency, values]) => money(addDecimalAmounts(values), currency))
    .join(" + ") || "—";
const productOverrides = (products: CalculatorProductRow[]) =>
  Object.fromEntries(
    products.map((row) => [row.id, row.markupOverridePercent ?? ""]),
  );
const thermalText = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : null;
function positionThermal(row: CalculatorProductRow) {
  const snapshot = (row.sourceSnapshot ?? {}) as Record<string, unknown>;
  const evidence = (snapshot.manufacturerEvidence ?? {}) as Record<string, unknown>;
  const contract = (snapshot.configuredContract ?? {}) as Record<string, unknown>;
  const contractThermal = (contract.thermal ?? {}) as Record<string, unknown>;
  const pricing = (contract.pricing ?? {}) as Record<string, unknown>;
  const pricingInputs = (pricing.inputs ?? {}) as Record<string, unknown>;
  return {
    ug: thermalText(evidence.manufacturerQuotedUg) ?? thermalText(contractThermal.ug) ?? thermalText(pricingInputs.ug),
    uw: thermalText(evidence.manufacturerQuotedUw) ?? thermalText(contractThermal.uw) ?? thermalText(pricingInputs.uw),
  };
}

const sourceRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const sourceText = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : null;
const canonicalText = (canonical: Record<string, unknown>, key: string) =>
  sourceText(sourceRecord(canonical[key]).value);

function ManufacturerPositionSourceDetail({ row, evidence, onClose }: { row: CalculatorProductRow; evidence: Record<string, unknown>; onClose: () => void }) {
  const sourceSpecification = sourceRecord(evidence.sourceSpecification);
  const internalSpecification = sourceRecord(evidence.internalSpecification);
  const internalGroups = Array.isArray(internalSpecification.groups) ? internalSpecification.groups.map(sourceRecord) : [];
  const canonical = sourceRecord(evidence.canonicalSpecification ?? sourceSpecification.canonical);
  const sashes = Array.isArray(canonical.sashes) ? canonical.sashes.map(sourceRecord) : [];
  const accessories = Array.isArray(canonical.accessories) ? canonical.accessories.map(sourceRecord) : [];
  const messages = Array.isArray(canonical.messages) ? canonical.messages.map(sourceRecord) : [];
  const sections = Array.isArray(sourceSpecification.sections) ? sourceSpecification.sections.map(sourceRecord) : [];
  const internal = canonicalText(canonical, "internalFinish");
  const externalEvidence = sourceRecord(canonical.externalFinish);
  const external = [sourceText(externalEvidence.value), sourceText(externalEvidence.manufacturerCode)].filter(Boolean).join(" · ") || null;
  const frame = canonicalText(canonical, "frameProfile");
  const glazing = canonicalText(canonical, "glazing") ?? sourceText(evidence.glassSpecification);
  const weight = canonicalText(canonical, "weightKg") ?? sourceText(evidence.weightKg);
  const perimeter = canonicalText(canonical, "perimeterMetres");
  const canonicalRows = [
    ["Product / system", sourceText(evidence.productSystem) ?? sourceText(evidence.product) ?? row.productClass],
    ["Dimensions", `${row.widthMm} × ${row.heightMm} mm · Qty ${row.quantity}`],
    ["Opening / configuration", sourceText(evidence.configurationDescription)],
    ["Internal finish", internal],
    ["External finish", external],
    ["Frame / profile", frame],
    ["Glazing", glazing],
    ["Hardware / fittings", sourceText(evidence.fittingsSpecification)],
    ["Thermal", [sourceText(evidence.manufacturerQuotedUg) ? `Ug ${sourceText(evidence.manufacturerQuotedUg)}` : null, sourceText(evidence.manufacturerQuotedUw) ? `Uw ${sourceText(evidence.manufacturerQuotedUw)}` : null].filter(Boolean).join(" · ") || null],
    ["Weight / perimeter", [weight ? `${weight} kg` : null, perimeter ? `${perimeter} m` : null].filter(Boolean).join(" · ") || null],
  ].filter((item): item is [string, string] => Boolean(item[1]));
  const titleId = `manufacturer-specification-${row.id}`;
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);
  return createPortal(<div className="ui-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="ui-modal costing-sheet__source-detail costing-sheet__specification-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <header><div><h3 id={titleId}>{row.displayReference} specification</h3><small>Internal product and manufacturer evidence</small></div><button type="button" className="ui-button" onClick={onClose} aria-label={`Close specification for ${row.displayReference}`}>Close</button></header>
      <div className="costing-sheet__source-detail-body">
        {internalGroups.length ? <div className="costing-sheet__internal-specification">{internalGroups.map((group, groupIndex) => { const items = Array.isArray(group.items) ? group.items.map(sourceRecord) : []; return items.length ? <section key={sourceText(group.id) ?? groupIndex}><strong>{sourceText(group.label) ?? "Technical evidence"}</strong><dl>{items.map((item, itemIndex) => <React.Fragment key={`${sourceText(item.label) ?? "field"}-${itemIndex}`}><dt>{sourceText(item.label) ?? "Detail"}</dt><dd>{sourceText(item.value) ?? "—"}</dd></React.Fragment>)}</dl></section> : null })}</div> : <dl>{canonicalRows.map(([label, value]) => <React.Fragment key={label}><dt>{label}</dt><dd>{value}</dd></React.Fragment>)}</dl>}
        {!internalGroups.length && sashes.length ? <section><strong>Manufacturer sash / opening evidence</strong><ul>{sashes.map((sash, index) => <li key={sourceText(sash.sourceElementReference) ?? index}><b>{sourceText(sash.sourceElementReference) ?? `Sash ${index + 1}`}</b>: {[sourceText(sash.fitting), sourceText(sash.profile), sourceText(sash.hardware), sourceText(sash.security), sourceText(sash.closing), sourceText(sash.locking)].filter(Boolean).join(" · ")}</li>)}</ul></section> : null}
        {!internalGroups.length && accessories.length ? <section><strong>Accessories</strong><ul>{accessories.map((item, index) => <li key={sourceText(item.sourceFieldId) ?? index}>{sourceText(item.description)}{sourceText(item.quantity) ? ` · Qty ${sourceText(item.quantity)}` : ""}</li>)}</ul></section> : null}
        {!internalGroups.length && messages.length ? <section><strong>Manufacturer messages / warnings</strong><ul>{messages.map((item, index) => <li key={sourceText(item.sourceFieldId) ?? index}>{sourceText(item.label) && sourceText(item.label) !== "Message" ? <b>{sourceText(item.label)}: </b> : null}{sourceText(item.value)}</li>)}</ul></section> : null}
        {sections.length ? <details className="costing-sheet__manufacturer-specification"><summary>Complete manufacturer specification</summary>{sections.map((section, index) => { const fields = Array.isArray(section.fields) ? section.fields.map(sourceRecord) : []; return fields.length ? <section key={sourceText(section.name) ?? index}><strong>{sourceText(section.name) ?? "Manufacturer details"}</strong><dl>{fields.map((field, fieldIndex) => <React.Fragment key={sourceText(field.id) ?? fieldIndex}><dt>{sourceText(field.label) ?? "Detail"}</dt><dd>{sourceText(field.rawValue) ?? "—"}</dd></React.Fragment>)}</dl></section> : null })}</details> : null}
      </div>
    </section>
  </div>, document.body);
}

function Icon({ kind }: { kind: SectionKey }) {
  const glyph = {
    products: "▦",
    extras: "◫",
    transport: "◆",
    siteVisit: "⌖",
    equipment: "♜",
    installation: "♟",
    materials: "⬡",
    duties: "◎",
  }[kind];
  return (
    <span
      className={`costing-sheet__icon costing-sheet__icon--${kind}`}
      aria-hidden="true"
    >
      {glyph}
    </span>
  );
}
function CommercialRow({
  description,
  cost,
  converted,
  rate,
  sale,
}: {
  description: string;
  cost: string;
  converted: string;
  rate: string;
  sale: string;
}) {
  return (
    <div className="costing-sheet__commercial-row">
      <span>{description}</span>
      <span>{cost}</span>
      <span>{converted}</span>
      <span>{rate}</span>
      <strong>{sale}</strong>
    </div>
  );
}
function ProductRow({
  row,
  allocation,
  previousReference,
  references,
  categoryMarkup,
  override,
  onReview,
  commercialView,
  showThermal,
}: {
  row: CalculatorProductRow;
  allocation?: {
    amount: string;
    currency: string;
    purchaseGbpAmount: string;
    commercialGbpAmount: string;
  };
  previousReference: string | null;
  references: string[];
  categoryMarkup: string;
  override: string;
  onReview: (input: Record<string, unknown>) => void;
  commercialView: "internal" | "customer";
  showThermal: boolean;
}) {
  const [specificationOpen, setSpecificationOpen] = useState(false);
  const customerPolicy=useCustomerViewPolicy();
  const commercialActions=useEstimateCommercialActions();
  const positionAction = (action: "up" | "down" | "duplicate" | "alternative" | "delete") => row.estimatePositionId && commercialActions?.positionAction?.(row.estimatePositionId,action);
  const alternative = row.classification === "alternative",
    included = row.includedInCurrentEstimate !== false && !alternative,
    commercialCost = addDecimalAmounts([
      row.commercialGbpAmount,
      allocation?.commercialGbpAmount,
    ]),
    pricing =
      included && Number(commercialCost)
        ? calculateProductSelling(
            commercialCost,
            row.quantity,
            categoryMarkup,
            override === "" ? null : override,
          )
        : null,
    usesPrevious =
      alternative &&
      Boolean(previousReference) &&
      row.alternativeTo === previousReference,
    configured = Boolean(
      (row.sourceSnapshot as { configuredContract?: unknown } | null)
        ?.configuredContract,
    ),
    evidence =
      (
        row.sourceSnapshot as {
          manufacturerEvidence?: Record<string, unknown>;
        } | null
      )?.manufacturerEvidence ?? {},
    visual =
      (evidence.sourceVisual as Record<string, unknown> | undefined) ?? {},
    imageUrl =
      visual.status === "available" && typeof visual.url === "string"
        ? resolveManufacturerVisualAssetUrl(visual.url)
        : null,
    visualOrientation = manufacturerVisualOrientation(visual, evidence.configurationDescription),
    thermal = positionThermal(row);
  if (commercialView === "customer") {
    const room = typeof evidence.roomLocation === "string" && evidence.roomLocation.trim() ? evidence.roomLocation : "—";
    return <tr className={!included ? "is-excluded" : "is-inherited"}><td><strong>{row.displayReference}</strong><small>{supplierNameForProduct(row)}</small></td>{customerPolicy.room?<td>{room}</td>:null}<td className="costing-sheet__product-image"><div className="costing-sheet__product-preview">{imageUrl ? <button type="button" onClick={() => row.estimatePositionId && configured && customerPolicy.quickConfigurator ? commercialActions?.configurePosition?.(row.estimatePositionId) : window.open(imageUrl, "_blank", "noopener,noreferrer")} aria-label={`Open manufacturer preview for ${row.displayReference}`}><img src={imageUrl} alt={`Manufacturer preview for ${row.displayReference}`} /></button> : <span aria-label="Preview unavailable">▧</span>}<span>{typeof evidence.product === "string" ? evidence.product : row.productClass}</span></div></td>{customerPolicy.dimensions?<><td className="is-dimension">{row.widthMm}</td><td className="is-dimension">{row.heightMm}</td></>:null}<td>{row.quantity}</td>{customerPolicy.itemPrice?<td>{!included ? "Excluded" : money(pricing?.unitSellingPrice)}</td>:null}{customerPolicy.quantityPrice?<td>{!included ? "Excluded" : money(pricing?.totalSellingPrice)}</td>:null}<td>{customerPolicy.alternative?<label className="costing-sheet__alternative-control"><span>Alternative</span><Toggle ariaLabel={`${row.displayReference} alternative`} value={alternative} onChange={() => positionAction("alternative")} /></label>:null}{row.estimatePositionId ? <span className="costing-sheet__position-actions">{customerPolicy.reorder?<><button className="ui-button" onClick={() => positionAction("up")} aria-label={`Move ${row.displayReference} up`} title="Move Up">↑</button><button className="ui-button" onClick={() => positionAction("down")} aria-label={`Move ${row.displayReference} down`} title="Move Down">↓</button></>:null}{customerPolicy.duplicate?<button className="ui-button" onClick={() => positionAction("duplicate")} aria-label={`Duplicate ${row.displayReference}`} title="Duplicate Position">⧉</button>:null}<button className="ui-button" onClick={() => positionAction("delete")} aria-label={`Delete ${row.displayReference}`} title="Delete Position">×</button></span> : null}</td></tr>;
  }
  return (
    <>
    <tr
      className={
        !included
          ? "is-excluded"
          : override !== ""
            ? "is-overridden"
            : "is-inherited"
      }
    >
      <td>
        <strong>{row.displayReference}</strong>
        <small>{supplierNameForProduct(row)}</small>
      </td>
      <td className="costing-sheet__product-image">
        <div className="costing-sheet__product-preview">
          {imageUrl ? (
            <button type="button" onClick={() => window.open(imageUrl, "_blank", "noopener,noreferrer")} aria-label={`Open manufacturer preview for ${row.displayReference}`}>
              <img src={imageUrl} alt={`Manufacturer preview for ${row.displayReference}`} />
            </button>
          ) : (
            <span aria-label="Preview unavailable">▧</span>
          )}
          {imageUrl ? <small>{manufacturerVisualOrientationLabel(visualOrientation)}</small> : null}
        </div>
      </td>
      {showThermal ? <><td className="costing-sheet__thermal-value">{thermal.ug ?? "—"}</td><td className="costing-sheet__thermal-value">{thermal.uw ?? "—"}</td></> : null}
      <td>
        <Toggle
          ariaLabel={`${row.displayReference} alternative`}
          value={alternative}
          onChange={(value) =>
            row.estimatePositionId ? positionAction("alternative") : onReview(
              value
                ? {
                    isAlternative: true,
                    includedInCurrentEstimate: false,
                    alternativeTo: previousReference,
                  }
                : { isAlternative: false, includedInCurrentEstimate: true },
            )
          }
        />
        {alternative ? (
          <>
            <label>
              Previous position?
              <Toggle
                ariaLabel={`${row.displayReference} use previous position`}
                value={usesPrevious}
                onChange={(value) =>
                  value && previousReference
                    ? onReview({
                        isAlternative: true,
                        alternativeTo: previousReference,
                      })
                    : onReview({ isAlternative: true, alternativeTo: "" })
                }
              />
            </label>
            {!usesPrevious ? (
              <label>
                Alternative to
                <select
                  aria-label={`${row.displayReference} alternative to`}
                  value={row.alternativeTo ?? ""}
                  onChange={(event) =>
                    onReview({
                      isAlternative: true,
                      alternativeTo: event.currentTarget.value,
                    })
                  }
                >
                  <option value="">Select position</option>
                  {references
                    .filter((reference) => reference !== row.displayReference)
                    .map((reference) => (
                      <option key={reference}>{reference}</option>
                    ))}
                </select>
              </label>
            ) : (
              <small>Alternative to {row.alternativeTo}</small>
            )}
          </>
        ) : null}
      </td>
      <td>{row.quantity}</td>
      <td>{money(row.unitSupplyCost, row.currency)}</td>
      <td>
        <span>{money(row.gbpAmount)}</span>
        {allocation ? (
          <small>+ {money(allocation.purchaseGbpAmount)} transport</small>
        ) : null}
      </td>
      <td>{!included ? "Excluded" : money(pricing?.unitSellingPrice)}</td>
      <td>{!included ? "Excluded" : money(pricing?.totalSellingPrice)}</td>
      <td className="costing-sheet__specification-action"><button type="button" className="ui-button" onClick={() => setSpecificationOpen(true)} aria-label={`Open specification for ${row.displayReference}`}>Specification</button></td>
      <td>
        {row.estimatePositionId && configured ? (
          <button
            className="ui-button costing-sheet__position-action"
            onClick={() => commercialActions?.configurePosition?.(row.estimatePositionId!)}
          >
            Edit Configuration
          </button>
        ) : null}
        {row.estimatePositionId ? <span className="costing-sheet__position-actions"><button className="ui-button" onClick={() => positionAction("up")} aria-label={`Move ${row.displayReference} up`} title="Move Up">↑</button><button className="ui-button" onClick={() => positionAction("down")} aria-label={`Move ${row.displayReference} down`} title="Move Down">↓</button><button className="ui-button" onClick={() => positionAction("duplicate")} aria-label={`Duplicate ${row.displayReference}`} title="Duplicate Position">⧉</button><button className="ui-button" onClick={() => positionAction("delete")} aria-label={`Delete ${row.displayReference}`} title="Delete Position">×</button></span> : null}
      </td>
    </tr>
    {specificationOpen ? <ManufacturerPositionSourceDetail row={row} evidence={evidence} onClose={() => setSpecificationOpen(false)} /> : null}
    </>
  );
}
function Section({
  index,
  kind,
  title,
  summary,
  cost,
  converted,
  markup,
  sale,
  open,
  onToggle,
  onMarkupChange,
  onMarkupKeyDown,
  invalid,
  children,
}: {
  index: number;
  kind: SectionKey;
  title: string;
  summary: string;
  cost: string;
  converted: string;
  markup: string;
  sale: string;
  open: boolean;
  onToggle: () => void;
  onMarkupChange: (value: string) => void;
  onMarkupKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  invalid: boolean;
  children?: ReactNode;
}) {
  return (
    <section
      className={`costing-sheet__section costing-sheet__section--${kind}${open ? " costing-sheet__section--open" : ""}`}
    >
      <div className="costing-sheet__section-row">
        <button
          className="costing-sheet__section-label"
          onClick={onToggle}
          aria-expanded={open}
        >
          <Icon kind={kind} />
          <span>
            <b>
              {index}. {title}
            </b>
            <small>{summary}</small>
          </span>
        </button>
        <strong>{cost}</strong>
        <strong>{converted}</strong>
        <label
          className={`costing-sheet__markup${invalid ? " is-invalid" : ""}`}
        >
          <span className="sr-only">{title} markup percentage</span>
          <input
            aria-label={`${title} markup percentage`}
            inputMode="decimal"
            value={markup}
            onChange={(event) => onMarkupChange(event.currentTarget.value)}
            onBlur={(event) => onMarkupChange(event.currentTarget.value)}
            onKeyDown={onMarkupKeyDown}
          />
          <small>%</small>
        </label>
        <strong className="costing-sheet__sale">{sale}</strong>
        <button
          className="costing-sheet__chevron"
          onClick={onToggle}
          aria-label={`${open ? "Collapse" : "Expand"} ${title}`}
        >
          {open ? "⌃" : "⌄"}
        </button>
      </div>
      {open ? (
        <div className="costing-sheet__section-detail">{children}</div>
      ) : null}
    </section>
  );
}

export default function ScenarioCostingWorksheet({
  scenario,
  commercialView = "internal",
  estimateMetrics,
  onNew,
  onSaveMarkups,
  onUpdateProduct,
  onUpdateSupplierCost,
  onUpdateManualCost,
  onUpdateSupplierCommercial,
  onUpdateCustomerPricing,
  onCreateRevision,
  onRefreshRate,
}: {
  scenario: WorksheetScenario;
  commercialView?: "internal" | "customer";
  estimateMetrics?: {
    positions: number;
    totalAreaSquareMetres: number;
    totalLinearMetres: number;
    totalQuantity: number;
    customerEstimateValue: string;
  };
  onNew?: () => void;
  onSaveMarkups: (
    markups: ProjectCostingMarkups & { targetGrossMarginPercent: string },
    productOverrides: Array<{
      rowId: string;
      markupOverridePercent: string | null;
    }>,
  ) => Promise<void>;
  onUpdateProduct: (
    rowId: string,
    input: Record<string, unknown>,
  ) => Promise<void>;
  onUpdateSupplierCost: (
    rowId: string,
    input: Record<string, unknown>,
  ) => Promise<void>;
  onUpdateManualCost: (
    rowId: string,
    input: Record<string, unknown>,
  ) => Promise<void>;
  onUpdateSupplierCommercial?: (
    revisionId: string,
    input: Record<string, unknown>,
  ) => Promise<void>;
  onUpdateCustomerPricing?: (input: Record<string, unknown>) => Promise<void>;
  onCreateRevision: () => Promise<void>;
  onRefreshRate: () => Promise<void>;
}) {
  const commercialActions = useEstimateCommercialActions();
  const customerPolicy = useCustomerViewPolicy();
  useEffect(() => {
    if (!commercialActions) return;
    const open = () => commercialActions.openManufacturerImport();
    window.addEventListener("quotesuite:import-manufacturer-quote", open);
    return () =>
      window.removeEventListener("quotesuite:import-manufacturer-quote", open);
  }, [commercialActions]);
  const commercialScenario = scenario as WorksheetScenario & {
    supplierCommercialPolicies?: SupplierCommercialResult[];
    customerPricing?: {
      discount?: {
        mode: "percentage" | "fixed";
        percentage: string;
        amount: string;
      };
      fixedSellingPrice?: {
        enabled: boolean;
        amount: string;
        currency: "GBP";
        basis: "ex_vat";
      };
      displayPolicy?: Record<string, unknown>;
    };
  };
  const initialTarget =
    scenario.targetGrossMarginPercent ??
    scenario.commercialMarginPolicy?.targetGrossMarginPercent ??
    DEFAULT_COMMERCIAL_MARGIN_POLICY.targetGrossMarginPercent;
  const initialCustomerDiscount = commercialScenario.customerPricing
    ?.discount ?? { mode: "percentage" as const, percentage: "0", amount: "0" };
  const initialFixedPrice = commercialScenario.customerPricing
    ?.fixedSellingPrice ?? {
    enabled: false,
    amount: "0",
    currency: "GBP" as const,
    basis: "ex_vat" as const,
  };
  const [open, setOpen] = useState<SectionKey | null>("products"),
    [markupDraft, setMarkupDraft] = useState<ProjectCostingMarkups>(
      scenario.markups,
    ),
    [persistedMarkups, setPersistedMarkups] = useState<ProjectCostingMarkups>(
      scenario.markups,
    ),
    [targetDraft, setTargetDraft] = useState(initialTarget),
    [persistedTarget, setPersistedTarget] = useState(initialTarget),
    [rowOverrides, setRowOverrides] = useState<Record<string, string>>(() =>
      productOverrides(scenario.products),
    ),
    [persistedOverrides, setPersistedOverrides] = useState<
      Record<string, string>
    >(() => productOverrides(scenario.products)),
    [customerDraft, setCustomerDraft] = useState(initialCustomerDiscount),
    [fixedPriceDraft, setFixedPriceDraft] = useState(initialFixedPrice),
    [fixedPriceOpen, setFixedPriceOpen] = useState(false),
    [sellingPriceHost, setSellingPriceHost] = useState<Element | null>(null),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  useEffect(() => {
    setSellingPriceHost(document.querySelector(".costing-sheet__summary-sale"));
  }, [scenario.id]);
  useEffect(() => {
    const overrides = productOverrides(scenario.products),
      target =
        scenario.targetGrossMarginPercent ??
        scenario.commercialMarginPolicy?.targetGrossMarginPercent ??
        DEFAULT_COMMERCIAL_MARGIN_POLICY.targetGrossMarginPercent;
    setMarkupDraft(scenario.markups);
    setPersistedMarkups(scenario.markups);
    setTargetDraft(target);
    setPersistedTarget(target);
    setRowOverrides(overrides);
    setPersistedOverrides(overrides);
    setCustomerDraft(
      commercialScenario.customerPricing?.discount ?? {
        mode: "percentage",
        percentage: "0",
        amount: "0",
      },
    );
    setFixedPriceDraft(
      commercialScenario.customerPricing?.fixedSellingPrice ?? {
        enabled: false,
        amount: "0",
        currency: "GBP",
        basis: "ex_vat",
      },
    );
  }, [
    scenario.id,
    scenario.markups,
    scenario.products,
    scenario.targetGrossMarginPercent,
    scenario.commercialMarginPolicy,
    commercialScenario.customerPricing,
  ]);
  const dirty =
      targetDraft !== persistedTarget ||
      MARKUP_CATEGORIES.some(
        (key) => markupDraft[key] !== persistedMarkups[key],
      ) ||
      scenario.products.some(
        (row) =>
          (rowOverrides[row.id] ?? "") !== (persistedOverrides[row.id] ?? ""),
      ),
    invalidCategories = MARKUP_CATEGORIES.filter((key) =>
      validateMarkupPercentage(markupDraft[key]),
    ),
    invalidOverrides = scenario.products.filter(
      (row) =>
        rowOverrides[row.id] !== "" &&
        validateMarkupPercentage(rowOverrides[row.id]),
    );
  const editMarkup = (category: MarkupCategory, value: string) => {
    setMarkupDraft((current) => ({ ...current, [category]: value }));
    setError("");
  };
  const markupKeys =
    (category: MarkupCategory) =>
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Escape") {
        editMarkup(category, persistedMarkups[category]);
        event.currentTarget.blur();
      }
      if (event.key === "Enter") event.currentTarget.blur();
    };
  async function save() {
    if (
      invalidCategories.length ||
      invalidOverrides.length ||
      validateGrossMarginPercentage(targetDraft)
    ) {
      setError(
        "Correct invalid markup or target-margin percentages before saving.",
      );
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSaveMarkups(
        { ...markupDraft, targetGrossMarginPercent: targetDraft },
        scenario.products.map((row) => ({
          rowId: row.id,
          markupOverridePercent:
            rowOverrides[row.id] === "" ? null : rowOverrides[row.id],
        })),
      );
      setPersistedMarkups(markupDraft);
      setPersistedTarget(targetDraft);
      setPersistedOverrides(rowOverrides);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Commercial pricing save failed. No values were persisted.",
      );
    } finally {
      setSaving(false);
    }
  }
  const toggle = (key: SectionKey) =>
    setOpen((current) => (current === key ? null : key));
  const commercialResult = deriveProjectCostingCommercialResult(scenario, {
    markups: markupDraft,
    productMarkupOverrides: rowOverrides,
    customerPricing: {
      discount: customerDraft,
      fixedSellingPrice: fixedPriceDraft,
    },
  });
  const {
    transportOptions,
    transportModel,
    transportAllocation,
    transportAllocationByProduct,
    includedProducts,
    alternativeProducts,
    costs,
    transport,
    installation,
    fees,
    extras,
    includedExtras,
    equipment,
    materials,
    unpricedTotals,
    packageUplifts,
    installationPackageUplifts,
    productGbp,
    extrasGbp,
    transportGbp,
    installationGbp,
    feeGbp,
    equipmentCost,
    materialsCost,
    productPricing,
    extrasSale,
    transportSale,
    supplierTransportSale,
    storageTransportSale,
    hiabTransportSale,
    equipmentSale,
    installationSale,
    materialsSale,
    feeSale,
    siteVisitCost,
    siteVisitAllocatedToProducts,
    siteVisitSale,
    productSale,
    customerDiscountAmount,
    customerDiscountPercentage,
    discountedProductSale,
    projectCost,
    calculatedSale,
    actualSale,
    commercialAdjustment,
    profit,
  } = commercialResult;
  const saveCustomerPricing = async () => {
    setSaving(true);
    setError("");
    try {
      const input = {
        discount: customerDraft,
        fixedSellingPrice: fixedPriceDraft,
        displayPolicy: commercialScenario.customerPricing?.displayPolicy,
      };
      if (onUpdateCustomerPricing) await onUpdateCustomerPricing(input);
      else {
        const updated = await projectCalculatorLabApi.updateCustomerPricing(
          scenario.id,
          input,
        );
        window.dispatchEvent(
          new CustomEvent("quotesuite:costing-updated", { detail: updated }),
        );
      }
      setFixedPriceOpen(false);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Customer pricing could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  };
  const updateTransport = async (input: Record<string, unknown>) => {
    const next = { ...transportOptions, ...input },
      allocation = String(next.allocationAmount),
      storageAllocation = String(next.storageAllocationAmount),
      hiabAllocation = String(next.hiabAllocationAmount);
    if (
      next.allocateToProducts &&
      Number(allocation) > Number(transportModel.originalSupplierTransport)
    ) {
      setError("Amount to allocate cannot exceed Original Supplier Transport.");
      return;
    }
    if (
      next.storageAllocateToProducts &&
      Number(storageAllocation) > Number(next.storageCosts)
    ) {
      setError("Storage allocation cannot exceed Storage Costs.");
      return;
    }
    if (
      next.hiabAllocateToProducts &&
      Number(hiabAllocation) > Number(next.hiabDeliveryOffloadFee)
    ) {
      setError(
        "HIAB allocation cannot exceed the HIAB Delivery / Offload Fee.",
      );
      return;
    }
    setSaving(true);
    setError("");
    try {
      const updated = await projectCalculatorLabApi.updateOptions(scenario.id, {
        transportCosting: next,
      });
      window.dispatchEvent(
        new CustomEvent("quotesuite:costing-updated", { detail: updated }),
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Transport costing could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  };
  const updateInstallationRequired = async (required: boolean) => {
    setSaving(true);
    setError("");
    try {
      const updated = await projectCalculatorLabApi.updateOptions(scenario.id, {
        installationRequired: required,
      });
      window.dispatchEvent(
        new CustomEvent("quotesuite:costing-updated", { detail: updated }),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Installation requirement could not be saved.");
    } finally {
      setSaving(false);
    }
  };
  const updateMaterialsRequired = async (required: boolean) => {
    setSaving(true);
    setError("");
    try {
      const current = (scenario.options?.installationMaterials ?? {}) as Record<string, unknown>;
      const updated = await projectCalculatorLabApi.updateInstallationMaterials(scenario.id, {
        fixingMethod: current.fixingMethod ?? "brackets",
        contingencyPercent: current.contingencyPercent ?? "15",
        ...current,
        enabled: required,
      });
      window.dispatchEvent(new CustomEvent("quotesuite:costing-updated", { detail: updated }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Installation Materials requirement could not be saved.");
    } finally {
      setSaving(false);
    }
  };
  const saveCustomerDiscount = saveCustomerPricing,
    sale = actualSale;
  const policy =
      scenario.commercialMarginPolicy ?? DEFAULT_COMMERCIAL_MARGIN_POLICY,
    margin = calculateCommercialMargin(projectCost, actualSale, targetDraft),
    resolvedMarginStatus = resolveMarginStatus(
      margin?.grossMarginPercent ?? "0",
      policy.bands,
    ),
    belowMinimum =
      Number(margin?.grossMarginPercent ?? 0) <
      Number(policy.minimumAcceptableGrossMarginPercent),
    lossMaking = Number(actualSale) < Number(projectCost),
    marginStatus = belowMinimum ? "low" : resolvedMarginStatus;
  const productOriginal =
      formatGroupedTotals(quotationTotals(scenario, "productSubtotal")) === "—"
        ? originalTotals([...scenario.products, ...unpricedTotals])
        : formatGroupedTotals(quotationTotals(scenario, "productSubtotal")),
    supplierTotal = formatGroupedTotals(
      originalSupplierPurchaseGroups(scenario, unpricedTotals),
    ),
    supplierPurchaseGbp = addDecimalAmounts([
      productGbp,
      extrasGbp,
      transportGbp,
      installationGbp,
      feeGbp,
    ]),
    hasPackagePricing = Boolean(
      commercialScenario.supplierCommercialPolicies?.some(
        (item) => item.policy.packagePricingAvailable,
      ),
    );
  const quote = scenario.sourceRevision
    ? scenario.name.replace(/\s*·\s*revision\s+\d+$/i, "")
    : scenario.name;
  const supplier =
    scenario.origin === "supplier_import"
      ? quote.split(/\s+\d{4,}/)[0] || "Supplier quotation"
      : "Manual costing";
  const rateSummary = scenario.exchangeRates.length
    ? scenario.exchangeRates
        .map(
          (item) =>
            `${item.supplierCurrency} 1 = GBP ${item.supplierToGbpLiveRate} live / ${item.supplierToGbpSellingRate} selling${item.providerTimestamp ? ` · captured ${item.providerTimestamp}` : ""}`,
        )
        .join(" · ")
    : scenario.exchangeRate
      ? `${scenario.currency} 1 = GBP ${scenario.exchangeRate.supplierToGbpLiveRate} live / ${scenario.exchangeRate.supplierToGbpSellingRate} selling${scenario.exchangeRate.providerTimestamp ? ` · captured ${scenario.exchangeRate.providerTimestamp}` : ""}`
      : "No foreign-currency rate";
  const installVisible =
    commercialView === "internal" ||
    scenario.packageCode === "full_installation" ||
    installation.length > 0 ||
    installationPackageUplifts.length > 0;
  const materialsVisible =
    commercialView === "internal" ||
    materials.length > 0 ||
    Boolean(scenario.installationMaterials) ||
    Boolean(
      scenario.options?.useIllbruck || scenario.options?.bracketsRequired,
    );
  const showProductThermal = scenario.products.some((row) => {
    const thermal = positionThermal(row);
    return Boolean(thermal.ug || thermal.uw);
  });
  const vatTreatment=resolveVatTreatment(scenario.options?.vatTreatment,scenario.options?.projectType),vatAmount=percentageAmount(actualSale,vatTreatment.percentage),totalIncludingVat=addDecimalAmounts([actualSale,vatAmount]);
  const saveVatTreatment=async(code:VatTreatmentCode)=>{setSaving(true);setError("");try{const selected=VAT_TREATMENTS[code],updated=await projectCalculatorLabApi.updateVatTreatment(scenario.id,{code,percentage:selected.percentage,source:"manual_override",manuallyOverridden:true});window.dispatchEvent(new CustomEvent("quotesuite:costing-updated",{detail:updated}));}catch(reason){setError(reason instanceof Error?reason.message:"VAT Treatment could not be saved.");}finally{setSaving(false);}};
  const nav = [
    "Quotation",
    "Extraction Review",
    "Project Costing",
    "Documents",
    "History",
  ];
  return (
    <>
      <div className={`project-costing project-costing--${commercialView}`} data-commercial-view={commercialView}>
        <header className="project-costing__topbar">
          <div className="project-costing__brand">
            <span>▧</span>
            <strong>Ecofenster</strong>
            <small>ARCHITECTURAL WINDOWS &amp; DOORS</small>
          </div>
          <div className="project-costing__breadcrumbs">
            <span>Supplier Quotations</span>
            <b>›</b>
            <span>
              {scenario.estimateRef ||
                scenario.estimateId ||
                "Legacy commercial record"}
            </span>
            <b>›</b>
            <strong>Project Costing</strong>
          </div>
          <div className="project-costing__rate">{rateSummary}</div>
          {commercialView === "internal" ? <SupplierCommercialReview scenarioId={scenario.id} policies={commercialScenario.supplierCommercialPolicies ?? []} onSaveSupplier={onUpdateSupplierCommercial}/> : null}
          <button className="ui-button">View rate history</button>
          <button
            className="ui-button"
            disabled={saving}
            onClick={() => void onRefreshRate()}
          >
            Refresh Rate
          </button>
          <button
            className="ui-button"
            disabled={
              !dirty ||
              saving ||
              invalidCategories.length > 0 ||
              invalidOverrides.length > 0
            }
            onClick={() => void save()}
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <span className={dirty ? "costing-sheet__unsaved" : "costing-sheet__saved"}>{dirty ? "Unsaved" : `Saved · Revision ${scenario.revisionNumber}`}</span>
          <button
            className="ui-button ui-button--primary"
            disabled={dirty || saving}
            onClick={() => void onCreateRevision()}
          >
            Create Revision
          </button>
          <button
            className="ui-button project-costing__more"
            aria-label="More actions"
          >
            ⋮
          </button>
        </header>
        <div className="project-costing__layout">
          <aside className="project-costing__sidebar">
            <section className="project-costing__quote-card">
              <h3>{supplier}</h3>
              <strong>{quote}</strong>
              <span className="project-costing__extracted">✓ Extracted</span>
              <small>
                Extracted: {new Date(scenario.createdAt).toLocaleString()}
              </small>
              <nav aria-label="Project workflow">
                {nav.map((label, index) => (
                  <button
                    key={label}
                    className={label === "Project Costing" ? "is-active" : ""}
                  >
                    <span>{["▤", "◫", "▦", "□", "◷"][index]}</span>
                    <span>
                      <b>{label}</b>
                      <small>
                        {
                          [
                            "Document & extraction",
                            `${scenario.products.length} items, ${extras.length} extras`,
                            "Commercial worksheet",
                            "Attachments & notes",
                            "Revisions & activity",
                          ][index]
                        }
                      </small>
                    </span>
                    {index < 2 ? <i>✓</i> : null}
                  </button>
                ))}
              </nav>
            </section>
            <section className="project-costing__session">
              <h3>Session Summary</h3>
              <div>
                <span>Products ({scenario.products.length})</span>
                <b>{productOriginal}</b>
              </div>
              <div>
                <span>Extras ({extras.length})</span>
                <b>{originalTotals(extras)}</b>
              </div>
              <div>
                <span>Transport</span>
                <b>{originalTotals(transport)}</b>
              </div>
              <hr />
              <div>
                <span>Supplier Total</span>
                <b>{supplierTotal}</b>
              </div>
              {onNew ? (
                <button className="ui-button" onClick={onNew}>
                  View extraction summary
                </button>
              ) : null}
            </section>
          </aside>
          <main className="costing-sheet">
            <div className="costing-sheet__title">
              <div>
                <h1>Project Costing</h1>
                <p>Commercial worksheet for this quotation</p>
              </div>
            </div>
            {error ? (
              <p
                role="alert"
                className="calculator-lab__message calculator-lab__message--error"
              >
                {error}
              </p>
            ) : null}
            <div className="costing-sheet__columns">
              <span>Description</span>
              <span>
                Supplier Cost<small>Original currency</small>
              </span>
              <span>
                Purchase Cost<small>GBP</small>
              </span>
              <span>Markup %</span>
              <span>
                Selling Price<small>GBP</small>
              </span>
              <span />
            </div>
            <Section
              index={1}
              kind="products"
              title="Products / Supply Only"
              summary={`${scenario.products.length} positions · ${includedProducts.length} included · ${alternativeProducts.length} alternatives · ${productOriginal} supplier subtotal`}
              cost={productOriginal}
              converted={money(productGbp)}
              markup={markupDraft.product}
              sale={money(productSale)}
              open={open === "products"}
              onToggle={() => toggle("products")}
              onMarkupChange={(value) => editMarkup("product", value)}
              onMarkupKeyDown={markupKeys("product")}
              invalid={Boolean(validateMarkupPercentage(markupDraft.product))}
            >
              <div className="costing-sheet__product-actions">
                <button
                  className="ui-button"
                  onClick={() =>
                    window.dispatchEvent(
                      new CustomEvent("quotesuite:import-manufacturer-quote"),
                    )
                  }
                >
                  Import Manufacturer Quote
                </button>
                <button
                  className="ui-button ui-button--primary"
                  onClick={() =>
                    window.dispatchEvent(
                      new CustomEvent("quotesuite:add-position"),
                    )
                  }
                >
                  Add Position
                </button>
              </div>
              {scenario.products.length ? (
                <div className="costing-sheet__detail-table">
                  <table className={commercialView === "internal" ? "costing-sheet__products-table--internal" : undefined}>
                    {commercialView === "internal" ? <colgroup>
                      <col className="costing-sheet__col-reference" />
                      <col className="costing-sheet__col-preview" />
                      {showProductThermal ? <><col className="costing-sheet__col-thermal" /><col className="costing-sheet__col-thermal" /></> : null}
                      <col className="costing-sheet__col-alternative" />
                      <col className="costing-sheet__col-quantity" />
                      <col className="costing-sheet__col-commercial" />
                      <col className="costing-sheet__col-commercial" />
                      <col className="costing-sheet__col-commercial" />
                      <col className="costing-sheet__col-commercial" />
                      <col className="costing-sheet__col-specification" />
                      <col className="costing-sheet__col-actions" />
                    </colgroup> : null}
                    <thead>
                      {commercialView === "customer" ? <tr><th>Reference</th>{customerPolicy.room?<th>Room</th>:null}<th>Item Type / Picture</th>{customerPolicy.dimensions?<><th>Width</th><th>Height</th></>:null}<th>Qty</th>{customerPolicy.itemPrice?<th>Item Price</th>:null}{customerPolicy.quantityPrice?<th>Quantity Price</th>:null}<th>Actions</th></tr> : <tr>
                        <th>Reference</th>
                        <th>Preview / Product Image</th>
                        {showProductThermal ? <><th>Ug</th><th>Uw</th></> : null}
                        <th>Alternative?</th>
                        <th>Qty</th>
                        <th>Supplier unit</th>
                        <th>GBP cost</th>
                        <th>Sale unit</th>
                        <th>Sale total</th>
                        <th>Specification</th>
                        <th>Action</th>
                      </tr>}
                    </thead>
                    <tbody>
                      {scenario.products.map((row, index) => (
                        <ProductRow
                          key={row.id}
                          row={row}
                          allocation={transportAllocationByProduct.get(row.id)}
                          previousReference={
                            index > 0
                              ? scenario.products[index - 1].displayReference
                              : null
                          }
                          references={scenario.products.map(
                            (item) => item.displayReference,
                          )}
                          categoryMarkup={markupDraft.product}
                          override={rowOverrides[row.id] ?? ""}
                          onReview={(input) => {
                            setSaving(true);
                            void onUpdateProduct(row.id, input)
                              .catch((reason) =>
                                setError(
                                  reason instanceof Error
                                    ? reason.message
                                    : "Alternative review could not be saved.",
                                ),
                              )
                              .finally(() => setSaving(false));
                          }}
                          commercialView={commercialView}
                          showThermal={showProductThermal}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="costing-sheet__products-empty">
                  <strong>No positions yet.</strong>
                  <span>
                    Add a position in B92 or import a manufacturer quotation.
                  </span>
                </div>
              )}
            </Section>
            {extras.length ? (
              <Section
                index={2}
                kind="extras"
                title="Extras"
                summary={`${includedExtras.length} included${extras.length > includedExtras.length ? ` · ${extras.length - includedExtras.length} excluded` : ""}`}
                cost={originalTotals(includedExtras)}
                converted={money(extrasGbp)}
                markup={markupDraft.extras}
                sale={money(extrasSale)}
                open={open === "extras"}
                onToggle={() => toggle("extras")}
                onMarkupChange={(value) => editMarkup("extras", value)}
                onMarkupKeyDown={markupKeys("extras")}
                invalid={Boolean(validateMarkupPercentage(markupDraft.extras))}
              >
                <div className="costing-sheet__extras-table">
                  <div className="costing-sheet__extras-head">
                    <span>Description</span>
                    <span>Include</span>
                    <span>Supplier Cost</span>
                    <span>Purchase Cost</span>
                    <span>Markup</span>
                    <span>Selling Price</span>
                  </div>
                  {extras.map((row) => (
                    <div
                      className={
                        row.includedInCurrentEstimate === false
                          ? "is-excluded"
                          : ""
                      }
                      key={row.id}
                    >
                      <strong>{row.label}</strong>
                      <Toggle
                        ariaLabel={`Include extra ${row.label}`}
                        value={row.includedInCurrentEstimate !== false}
                        onChange={(value) => {
                          setSaving(true);
                          const update =
                            row.costKind === "manual"
                              ? onUpdateManualCost
                              : onUpdateSupplierCost;
                          void update(row.id, {
                            includedInCurrentEstimate: value,
                          })
                            .catch((reason) =>
                              setError(
                                reason instanceof Error
                                  ? reason.message
                                  : "Extra-cost review could not be saved.",
                              ),
                            )
                            .finally(() => setSaving(false));
                        }}
                      />
                      <span>
                        {money(
                          row.originalAmount,
                          row.originalCurrency ?? scenario.currency,
                        )}
                      </span>
                      <span>
                        {row.includedInCurrentEstimate === false
                          ? money("0")
                          : money(row.gbpAmount)}
                      </span>
                      <span>
                        {row.includedInCurrentEstimate === false
                          ? "Excluded"
                          : `${row.markupPercent}%`}
                      </span>
                      <strong>
                        {row.includedInCurrentEstimate === false
                          ? money("0")
                          : money(row.markedUpAmount)}
                      </strong>
                    </div>
                  ))}
                </div>
              </Section>
            ) : null}
            {transport.length ||
            scenario.supplierSummary?.deliveryTotal ||
            Number(transportOptions.storageCosts) ||
            Number(transportOptions.hiabDeliveryOffloadFee) ? (
              <Section
                index={3}
                kind="transport"
                title="Transport"
                summary="Supplier and project logistics"
                cost={money(
                  transportModel.remainingOriginalTransport,
                  transportModel.currency,
                )}
                converted={money(transportGbp)}
                markup={markupDraft.transport}
                sale={money(transportSale)}
                open={open === "transport"}
                onToggle={() => toggle("transport")}
                onMarkupChange={(value) => editMarkup("transport", value)}
                onMarkupKeyDown={markupKeys("transport")}
                invalid={Boolean(
                  validateMarkupPercentage(markupDraft.transport),
                )}
              >
                <div className="costing-sheet__transport-table">
                  <div className="costing-sheet__transport-head">
                    <span>Description</span>
                    <span>Supplier / Cost</span>
                    <span>Allocate to Products</span>
                    <span>Markup</span>
                    <span>Selling Price</span>
                  </div>
                  <div className="costing-sheet__transport-item">
                    <strong>Original Supplier Transport</strong>
                    <b>
                      {money(
                        transportModel.originalSupplierTransport,
                        transportModel.currency,
                      )}
                    </b>
                    <span className="costing-sheet__transport-allocation">
                      <Toggle
                        ariaLabel="Allocate Transport into Products Supply Only"
                        value={transportOptions.allocateToProducts}
                        onChange={(value) =>
                          void updateTransport({ allocateToProducts: value })
                        }
                      />
                      {transportOptions.allocateToProducts ? (
                        <span className="costing-sheet__currency-input">
                          <b>{transportModel.currency}</b>
                          <input
                            key={`${scenario.id}-${transportOptions.allocationAmount}`}
                            className="ui-input"
                            aria-label={`Transport Amount to Allocate ${transportModel.currency}`}
                            inputMode="decimal"
                            defaultValue={transportOptions.allocationAmount}
                            onBlur={(event) =>
                              void updateTransport({
                                allocationAmount:
                                  event.currentTarget.value || "0",
                              })
                            }
                          />
                        </span>
                      ) : null}
                    </span>
                    <b>{markupDraft.transport}%</b>
                    <strong>{money(supplierTransportSale)}</strong>
                    <small>
                      {money(
                        transportModel.remainingOriginalTransport,
                        transportModel.currency,
                      )}{" "}
                      remains in Transport
                    </small>
                  </div>
                  <div className="costing-sheet__transport-item">
                    <strong>Storage Costs</strong>
                    <span className="costing-sheet__transport-cost">
                      <Toggle
                        ariaLabel="Include Storage Costs"
                        value={transportOptions.storageCostsEnabled}
                        onChange={(value) =>
                          void updateTransport({ storageCostsEnabled: value })
                        }
                      />
                      {transportOptions.storageCostsEnabled ? (
                        <span className="costing-sheet__currency-input">
                          <b>GBP</b>
                          <input
                            className="ui-input"
                            aria-label="Storage Costs GBP"
                            inputMode="decimal"
                            defaultValue={transportOptions.storageCosts}
                            onBlur={(event) =>
                              void updateTransport({
                                storageCosts: event.currentTarget.value || "0",
                              })
                            }
                          />
                        </span>
                      ) : (
                        money("0")
                      )}
                    </span>
                    <span className="costing-sheet__transport-allocation">
                      <Toggle
                        ariaLabel="Allocate Storage into Products Supply Only"
                        value={transportOptions.storageAllocateToProducts}
                        onChange={(value) =>
                          void updateTransport({
                            storageAllocateToProducts: value,
                          })
                        }
                      />
                      {transportOptions.storageAllocateToProducts ? (
                        <span className="costing-sheet__currency-input">
                          <b>GBP</b>
                          <input
                            className="ui-input"
                            aria-label="Storage Amount to Allocate GBP"
                            inputMode="decimal"
                            defaultValue={
                              transportOptions.storageAllocationAmount
                            }
                            onBlur={(event) =>
                              void updateTransport({
                                storageAllocationAmount:
                                  event.currentTarget.value || "0",
                              })
                            }
                          />
                        </span>
                      ) : null}
                    </span>
                    <b>{markupDraft.transport}%</b>
                    <strong>{money(storageTransportSale)}</strong>
                    <small>
                      {money(transportModel.remainingStorageCosts)} remains in
                      Transport
                    </small>
                  </div>
                  <div className="costing-sheet__transport-item">
                    <strong>HIAB Delivery / Offload Fee</strong>
                    <span className="costing-sheet__transport-cost">
                      <Toggle
                        ariaLabel="Include HIAB Delivery Offload Fee"
                        value={transportOptions.hiabDeliveryOffloadFeeEnabled}
                        onChange={(value) =>
                          void updateTransport({
                            hiabDeliveryOffloadFeeEnabled: value,
                          })
                        }
                      />
                      {transportOptions.hiabDeliveryOffloadFeeEnabled ? (
                        <span className="costing-sheet__currency-input">
                          <b>GBP</b>
                          <input
                            className="ui-input"
                            aria-label="HIAB Delivery Offload Fee GBP"
                            inputMode="decimal"
                            defaultValue={
                              transportOptions.hiabDeliveryOffloadFee
                            }
                            onBlur={(event) =>
                              void updateTransport({
                                hiabDeliveryOffloadFee:
                                  event.currentTarget.value || "0",
                              })
                            }
                          />
                        </span>
                      ) : (
                        money("0")
                      )}
                    </span>
                    <span className="costing-sheet__transport-allocation">
                      <Toggle
                        ariaLabel="Allocate HIAB into Products Supply Only"
                        value={transportOptions.hiabAllocateToProducts}
                        onChange={(value) =>
                          void updateTransport({
                            hiabAllocateToProducts: value,
                          })
                        }
                      />
                      {transportOptions.hiabAllocateToProducts ? (
                        <span className="costing-sheet__currency-input">
                          <b>GBP</b>
                          <input
                            className="ui-input"
                            aria-label="HIAB Amount to Allocate GBP"
                            inputMode="decimal"
                            defaultValue={transportOptions.hiabAllocationAmount}
                            onBlur={(event) =>
                              void updateTransport({
                                hiabAllocationAmount:
                                  event.currentTarget.value || "0",
                              })
                            }
                          />
                        </span>
                      ) : null}
                    </span>
                    <b>{markupDraft.transport}%</b>
                    <strong>{money(hiabTransportSale)}</strong>
                    <small>
                      {money(transportModel.remainingHiabDeliveryOffloadFee)}{" "}
                      remains in Transport
                    </small>
                  </div>
                  {error ? <p role="alert">{error}</p> : null}
                </div>
              </Section>
            ) : null}
            <Section
              index={4}
              kind="siteVisit"
              title="Site Visit / Travel"
              summary={
                siteVisitAllocatedToProducts
                  ? "Allocated to Products / Supply Only"
                  : "Project travel cost"
              }
              cost={money(siteVisitCost)}
              converted={money(siteVisitCost)}
              markup={markupDraft.siteVisit}
              sale={
                siteVisitAllocatedToProducts
                  ? "Included in Products"
                  : money(siteVisitSale)
              }
              open={open === "siteVisit"}
              onToggle={() => toggle("siteVisit")}
              onMarkupChange={(value) => editMarkup("siteVisit", value)}
              onMarkupKeyDown={markupKeys("siteVisit")}
              invalid={Boolean(validateMarkupPercentage(markupDraft.siteVisit))}
            >
              <SiteVisitTravelPanel scenario={scenario} />
            </Section>
            {installVisible ? (
              <Section
                index={6}
                kind="installation"
                title="Installation"
                summary={
                  scenario.packageCode === "full_installation"
                    ? "Full installation"
                    : "Selected installation costs"
                }
                cost={originalTotals(installation)}
                converted={money(addDecimalAmounts([installationGbp,equipmentCost]))}
                markup={markupDraft.installation}
                sale={money(addDecimalAmounts([installationSale,equipmentSale]))}
                open={open === "installation"}
                onToggle={() => toggle("installation")}
                onMarkupChange={(value) => editMarkup("installation", value)}
                onMarkupKeyDown={markupKeys("installation")}
                invalid={Boolean(
                  validateMarkupPercentage(markupDraft.installation),
                )}
              >
                <div className="costing-sheet__detail-list">
                  <div className="costing-sheet__product-actions"><span>Installation Included?</span><Toggle ariaLabel="Installation required" value={Boolean(scenario.options?.installationRequired)} onChange={(value)=>void updateInstallationRequired(value)} /><ConfigureInstallation scenario={scenario}/>{scenario.installationProgramme?.status==="review_required"?<span className="ui-badge">Review Required</span>:null}</div>
                  {scenario.installationProgramme ? <>
                    <h4 className="costing-sheet__group-title">Team / Programme</h4>
                    <div className="costing-sheet__facts"><span>Team <b>{scenario.selectedInstallationTeam?`${scenario.selectedInstallationTeam.companyName} · ${scenario.selectedInstallationTeam.name}`:"Select team"}</b></span><span>Crew <b>{scenario.installationProgramme.crewSize}</b></span><span>Programme <b>{scenario.installationProgramme.programmeDays} full day(s)</b></span><span>Travel <b>{scenario.installationProgramme.travel.mode.replaceAll("_"," ")}</b></span><span>Vehicles <b>{scenario.installationProgramme.travel.vehicleCount}</b></span></div>
                    <h4 className="costing-sheet__group-title">Labour</h4>
                    <CommercialRow description="Installer labour · full-day charging" cost={money(scenario.installationProgramme.costs.labour)} converted={`${scenario.installationProgramme.crewSize} people · ${scenario.installationProgramme.programmeDays} day(s)`} rate={`${markupDraft.installation}%`} sale={money(applyMarkupPercentage(scenario.installationProgramme.costs.labour,markupDraft.installation)?.sellingPrice)} />
                    <h4 className="costing-sheet__group-title">Travel / Vehicles</h4>
                    <CommercialRow description="Mileage" cost={money(scenario.installationProgramme.costs.mileage)} converted={`${scenario.installationProgramme.travel.chargeableMiles} mi · ${scenario.installationProgramme.travel.vehicleCount} vehicle(s)`} rate={`${markupDraft.installation}%`} sale={money(applyMarkupPercentage(scenario.installationProgramme.costs.mileage,markupDraft.installation)?.sellingPrice)} />
                    <h4 className="costing-sheet__group-title">Food / Accommodation</h4>
                    <CommercialRow description="Food allowance" cost={money(scenario.installationProgramme.costs.food)} converted={`${scenario.installationProgramme.allowances.foodDays} day(s)`} rate={`${markupDraft.installation}%`} sale={money(applyMarkupPercentage(scenario.installationProgramme.costs.food,markupDraft.installation)?.sellingPrice)} />
                    <CommercialRow description="Accommodation" cost={money(scenario.installationProgramme.costs.accommodation)} converted={`${scenario.installationProgramme.allowances.nights} night(s)`} rate={`${markupDraft.installation}%`} sale={money(applyMarkupPercentage(scenario.installationProgramme.costs.accommodation,markupDraft.installation)?.sellingPrice)} />
                    <h4 className="costing-sheet__group-title">Survey / Support / Cills</h4>
                    <CommercialRow description="Installation Support" cost={money(scenario.installationProgramme.costs.support)} converted={`${scenario.installationProgramme.allowances.supportDays} full day(s)`} rate={`${markupDraft.installation}%`} sale={money(applyMarkupPercentage(scenario.installationProgramme.costs.support,markupDraft.installation)?.sellingPrice)} />
                    <CommercialRow description="Retrofit Survey" cost={money(scenario.installationProgramme.costs.survey)} converted={`${scenario.installationProgramme.allowances.surveyDays} day(s)`} rate={`${markupDraft.installation}%`} sale={money(applyMarkupPercentage(scenario.installationProgramme.costs.survey,markupDraft.installation)?.sellingPrice)} />
                    <CommercialRow description="Cill Installation" cost={money(scenario.installationProgramme.costs.cillInstallation)} converted={`${scenario.installationProgramme.allowances.cillApplicableQuantity} applicable window(s)`} rate={`${markupDraft.installation}%`} sale={money(applyMarkupPercentage(scenario.installationProgramme.costs.cillInstallation,markupDraft.installation)?.sellingPrice)} />
                    <h4 className="costing-sheet__group-title">Skip / Lifting Review</h4>{scenario.installationProgramme.reviewRequired.length?<details><summary>Review Required ({scenario.installationProgramme.reviewRequired.length})</summary><ul>{scenario.installationProgramme.reviewRequired.map(item=><li key={item}>{item}</li>)}</ul></details>:<p>No skip or lifting review outstanding.</p>}
                    <details><summary>Programme calculation trail</summary>{scenario.installationProgramme.days.map((day,index)=><div className="costing-sheet__facts" key={index}><span><b>Day {String(day.day)}</b> · {String(day.capacityHours)} productive hours available</span><span>{Array.isArray(day.tasks)?day.tasks.map(task=>`${String(task.reference)} (${String(task.durationHours)} h / ${String(task.minimumCrew)} people)`).join(" · "):""}</span></div>)}</details>
                  </> : <p>Configure Installation to create the Estimate-owned programme and costing snapshot.</p>}
                  {equipment.map(item=><CommercialRow key={item.id} description={item.label} cost={money(item.unitCost,item.currency)} converted={money(item.unitCost)} rate={`${markupDraft.equipment}%`} sale={money(applyMarkupPercentage(item.unitCost??"0",markupDraft.equipment)?.sellingPrice)}/>)}
                </div>
                <div className="costing-sheet__facts">
                  <span>
                    Physical quantity{" "}
                    <b>
                      {scenario.products.reduce(
                        (sum, row) => sum + row.quantity,
                        0,
                      )}
                    </b>
                  </span>
                  <span>
                    Installation openings{" "}
                    <b>{scenario.installationOpeningCount}</b>
                  </span>
                  <span>
                    Crew <b>{scenario.options?.crewSize ?? 2}</b>
                  </span>
                  <span>
                    Programme{" "}
                    <b>
                      Day 1 set-out · productive days · completion and return
                    </b>
                  </span>
                </div>
              </Section>
            ) : null}
            {materialsVisible ? (
              <Section
                index={5}
                kind="materials"
                title="Installation Materials"
                summary={`${materials.length + (scenario.me508Calculation ? 1 : 0)} selected`}
                cost={money(String(materialsCost))}
                converted={money(materialsCost)}
                markup={markupDraft.materials}
                sale={money(materialsSale)}
                open={open === "materials"}
                onToggle={() => toggle("materials")}
                onMarkupChange={(value) => editMarkup("materials", value)}
                onMarkupKeyDown={markupKeys("materials")}
                invalid={Boolean(
                  validateMarkupPercentage(markupDraft.materials),
                )}
              >
                <div className="costing-sheet__product-actions"><span>Installation Materials Included?</span><Toggle ariaLabel="Installation Materials required" value={Boolean(scenario.options?.installationMaterials&&String((scenario.options.installationMaterials as Record<string,unknown>).enabled)!=="false")} onChange={(value)=>void updateMaterialsRequired(value)}/><InstallationMaterialsAssumptions scenario={scenario}/><span>Building Type: <b>{String(scenario.installationMaterials?.buildingType??"Review required").replaceAll("_"," & ")}</b></span><span>Contingency: <b>{scenario.installationMaterials?.contingencyPercent??"—"}%</b></span></div>
                <div className="costing-sheet__detail-list">
                  {materials.map((item) => (
                    <CommercialRow
                      key={item.id}
                      description={item.label}
                      cost={money(item.unitCost, item.currency)}
                      converted={money(item.unitCost)}
                      rate={`${markupDraft.materials}%`}
                      sale={money(applyMarkupPercentage(item.unitCost??"0",markupDraft.materials)?.sellingPrice)}
                    />
                  ))}
                  {scenario.installationMaterials ? <>
                    <h4 className="costing-sheet__group-title">Sealing &amp; Airtightness</h4>
                    {Object.entries(scenario.installationMaterials.sealingPurchasing).map(([product,requirement])=><CommercialRow key={product} description={requirement.label} cost={requirement.purchaseCost?money(requirement.purchaseCost):requirement.status} converted={`${requirement.requiredLengthM} m · ${requirement.rollsRequired??"—"} rolls / ${requirement.packsRequired??"—"} packs`} rate={`${markupDraft.materials}%`} sale={requirement.purchaseCost?money(applyMarkupPercentage(requirement.purchaseCost,markupDraft.materials)?.sellingPrice):"—"}/>)}
                    <h4 className="costing-sheet__group-title">Mechanical Fixings</h4>
                    <CommercialRow description={`Bracket ${scenario.installationMaterials.bracketLengthMm??"—"} mm`} cost={scenario.installationMaterials.purchasing.brackets.purchaseCost?money(scenario.installationMaterials.purchasing.brackets.purchaseCost):scenario.installationMaterials.purchasing.brackets.status} converted={`${scenario.installationMaterials.purchasing.brackets.requiredQuantity??"—"} required / ${scenario.installationMaterials.purchasing.brackets.packsRequired??"—"} packs`} rate={`${markupDraft.materials}%`} sale={scenario.installationMaterials.purchasing.brackets.purchaseCost?money(applyMarkupPercentage(scenario.installationMaterials.purchasing.brackets.purchaseCost,markupDraft.materials)?.sellingPrice):"—"}/>
                    <CommercialRow description={`Frame screws · ${scenario.installationMaterials.frameScrewsPerBracket} per bracket (Admin rule)`} cost={scenario.installationMaterials.purchasing.frameScrews.purchaseCost?money(scenario.installationMaterials.purchasing.frameScrews.purchaseCost):scenario.installationMaterials.purchasing.frameScrews.status} converted={`${scenario.installationMaterials.purchasing.frameScrews.requiredQuantity??"—"} required / ${scenario.installationMaterials.purchasing.frameScrews.packsRequired??"—"} packs`} rate={`${markupDraft.materials}%`} sale={scenario.installationMaterials.purchasing.frameScrews.purchaseCost?money(applyMarkupPercentage(scenario.installationMaterials.purchasing.frameScrews.purchaseCost,markupDraft.materials)?.sellingPrice):"—"}/>
                    <CommercialRow description="Substrate fixings" cost={scenario.installationMaterials.purchasing.substrateFixings.purchaseCost?money(scenario.installationMaterials.purchasing.substrateFixings.purchaseCost):scenario.installationMaterials.purchasing.substrateFixings.status} converted={`${scenario.installationMaterials.purchasing.substrateFixings.requiredQuantity??"—"} required / ${scenario.installationMaterials.purchasing.substrateFixings.packsRequired??"—"} packs`} rate={`${markupDraft.materials}%`} sale={scenario.installationMaterials.purchasing.substrateFixings.purchaseCost?money(applyMarkupPercentage(scenario.installationMaterials.purchasing.substrateFixings.purchaseCost,markupDraft.materials)?.sellingPrice):"—"}/>
                    <CommercialRow description="Installation packers" cost={scenario.installationMaterials.packers.purchaseCost?money(String(scenario.installationMaterials.packers.purchaseCost)):scenario.installationMaterials.packers.status==="available"?`${scenario.installationMaterials.packers.finalRequiredQuantity} required`:scenario.installationMaterials.packers.reason??"Pending product specification"} converted={scenario.installationMaterials.packers.status==="available"?`${scenario.installationMaterials.packers.allocatedQuantity} allocated`:"—"} rate={`${markupDraft.materials}%`} sale={scenario.installationMaterials.packers.purchaseCost?money(applyMarkupPercentage(String(scenario.installationMaterials.packers.purchaseCost),markupDraft.materials)?.sellingPrice):"—"}/>
                    <h4 className="costing-sheet__group-title">Tools</h4>
                    {(scenario.catalogueSnapshot?.catalogue??[]).filter(item=>item.category==="tool").map(item=><CommercialRow key={item.id} description={item.label} cost={item.priceAmount?money(item.priceAmount):"Price required"} converted="Select when required" rate={`${markupDraft.materials}%`} sale={item.priceAmount?money(applyMarkupPercentage(item.priceAmount,markupDraft.materials)?.sellingPrice):"—"}/>)}
                    <div className="costing-sheet__material-totals"><span>Total installation perimeter <b>{scenario.installationMaterials.totalPerimeterM} m</b></span><span>Total brackets required <b>{scenario.installationMaterials.totals.brackets}</b></span><span>Total frame screws required <b>{scenario.installationMaterials.totals.frameScrews}</b></span><span>Total substrate fixings required <b>{scenario.installationMaterials.totals.substrateFixings}</b></span><span>Total packers required <b>{scenario.installationMaterials.packers.finalRequiredQuantity??"Packer product specification required"}</b></span></div>
                    <details className="costing-sheet__diagnostic"><summary>Position calculation trail · internal diagnostic</summary><div className="costing-sheet__detail-list">{scenario.installationMaterials.positionCalculations.map((item,index)=><div className="costing-sheet__facts" key={`${String(item.reference)}-${index}`}><span><b>{String(item.reference)}</b> · {String(item.widthMm)} × {String(item.heightMm)} · Qty {String(item.quantity)}</span><span>Rule <b>{String(item.fixing?.ruleSource??item.fixing?.reason??"Unavailable")}</b></span><span>Per frame <b>{String(item.fixing?.totalFixingPositionsPerFrame??"—")}</b></span><span>Total brackets <b>{String(item.bracketQuantity??"—")}</b></span></div>)}</div></details>
                  </> : <p>Installation calculation unavailable until an Estimate installation rule and frame material are selected.</p>}
                </div>
              </Section>
            ) : null}
            {fees.length ? (
              <Section
                index={7}
                kind="duties"
                title="Import Fees & Duties"
                summary={`${fees.length} items`}
                cost={originalTotals(fees)}
                converted={money(feeGbp)}
                markup={markupDraft.duties}
                sale={money(feeSale)}
                open={open === "duties"}
                onToggle={() => toggle("duties")}
                onMarkupChange={(value) => editMarkup("duties", value)}
                onMarkupKeyDown={markupKeys("duties")}
                invalid={Boolean(validateMarkupPercentage(markupDraft.duties))}
              >
                <div className="costing-sheet__detail-list">
                  {fees.map((row) => (
                    <CommercialRow
                      key={row.id}
                      description={row.label}
                      cost={money(
                        row.originalAmount,
                        row.originalCurrency ?? scenario.currency,
                      )}
                      converted={money(row.gbpAmount)}
                      rate={`${row.markupPercent}%`}
                      sale={money(row.markedUpAmount)}
                    />
                  ))}
                </div>
              </Section>
            ) : null}
            <section className="costing-sheet__summary">
              <h2>Commercial Summary</h2>
              {estimateMetrics ? (
                <div className="costing-sheet__estimate-metrics" aria-label="Estimate metrics">
                  <span><small>Positions</small><b>{estimateMetrics.positions}</b></span>
                  <span><small>Total area</small><b>{estimateMetrics.totalAreaSquareMetres.toFixed(2)} m²</b></span>
                  <span><small>Linear metreage</small><b>{estimateMetrics.totalLinearMetres.toFixed(2)} lm</b></span>
                  <span><small>Total quantity</small><b>{estimateMetrics.totalQuantity}</b></span>
                  <span><small>Customer Estimate value</small><b>{money(estimateMetrics.customerEstimateValue)}</b></span>
                </div>
              ) : null}
              <div className="costing-sheet__margin-control">
                <label>
                  Target Gross Margin %
                  <input
                    className="ui-input"
                    aria-label="Target Gross Margin percentage"
                    inputMode="decimal"
                    value={targetDraft}
                    onChange={(event) => {
                      setTargetDraft(event.currentTarget.value);
                      setError("");
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        setTargetDraft(persistedTarget);
                        event.currentTarget.blur();
                      }
                      if (event.key === "Enter") event.currentTarget.blur();
                    }}
                  />
                </label>
                <span
                  className={`ui-status-badge costing-sheet__margin-status costing-sheet__margin-status--${marginStatus}`}
                >
                  {marginStatus.replace(/^./, (value) => value.toUpperCase())}
                </span>
                <small>
                  Company minimum {policy.minimumAcceptableGrossMarginPercent}%
                </small>
              </div>
              <div className="costing-sheet__summary-categories">
                <div className="costing-sheet__purchase-total">
                  <strong>Actual GBP Purchase Cost</strong>
                  <b>{money(supplierPurchaseGbp)}</b>
                </div>
                <div>
                  <span>Products / Supply Only</span>
                  <b>{money(productSale)}</b>
                </div>
                <div className="costing-sheet__client-discount">
                  <span>
                    <strong>Customer / Client Discount</strong>
                    <small>Applies only to Products selling price</small>
                  </span>
                  <span className="costing-sheet__client-discount-controls">
                    <select
                      className="ui-input"
                      aria-label="Customer discount input mode"
                      value={customerDraft.mode}
                      onChange={(event) =>
                        setCustomerDraft({
                          ...customerDraft,
                          mode: event.currentTarget.value as
                            | "percentage"
                            | "fixed",
                        })
                      }
                    >
                      <option value="percentage">%</option>
                      <option value="fixed">GBP</option>
                    </select>
                    <input
                      className="ui-input"
                      aria-label="Customer discount value"
                      inputMode="decimal"
                      value={
                        customerDraft.mode === "fixed"
                          ? customerDraft.amount
                          : customerDraft.percentage
                      }
                      onChange={(event) =>
                        setCustomerDraft({
                          ...customerDraft,
                          [customerDraft.mode === "fixed"
                            ? "amount"
                            : "percentage"]: event.currentTarget.value,
                        })
                      }
                    />
                    <button
                      className="ui-button"
                      disabled={saving}
                      onClick={() => void saveCustomerDiscount()}
                    >
                      Save
                    </button>
                  </span>
                  <b>
                    −{money(customerDiscountAmount)}{" "}
                    <small>{customerDiscountPercentage}%</small>
                  </b>
                </div>
                <div className="costing-sheet__products-after-discount">
                  <strong>Products after Client Discount</strong>
                  <b>{money(discountedProductSale)}</b>
                </div>
                {[
                  ["Extras", extrasSale],
                  ["Transport", transportSale],
                  ...(!siteVisitAllocatedToProducts && Number(siteVisitCost) > 0
                    ? [["Site Visit / Travel", siteVisitSale]]
                    : []),
                  ["Installation", addDecimalAmounts([installationSale,equipmentSale])],
                  ["Installation Materials", materialsSale],
                  ["Import Fees & Duties", feeSale],
                ].map(([label, value]) => (
                  <div key={String(label)}>
                    <span>{label}</span>
                    <b>{money(String(value))}</b>
                  </div>
                ))}
              </div>
              <div className="costing-sheet__summary-profit">
                <div className="costing-sheet__summary-sale">
                  <strong>Selling Price (Ex VAT)</strong>
                  <b>{money(sale)}</b>
                </div>
                <div className="costing-sheet__vat-treatment">
                  <label>VAT Treatment<select className="ui-input" aria-label="VAT Treatment" value={vatTreatment.code} disabled={saving} onChange={event=>void saveVatTreatment(event.currentTarget.value as VatTreatmentCode)}>{Object.entries(VAT_TREATMENTS).map(([code,item])=><option key={code} value={code}>{item.label} — {item.percentage}%</option>)}</select></label>
                  <b>{money(vatAmount)}</b><small>{vatTreatment.manuallyOverridden?"Selected for this Estimate":`${vatTreatment.source.replaceAll("_"," ")} · review eligibility`}</small>
                </div>
                <div className="costing-sheet__summary-highlight"><strong>Total Including VAT</strong><b>{money(totalIncludingVat)}</b></div>
                <div>
                  <strong>Gross Profit</strong>
                  <b>{money(profit)}</b>
                </div>
                <div>
                  <strong>Gross Margin</strong>
                  <b>
                    {margin?.grossMarginPercent ??
                      percentageRatio(profit, sale)}
                    %
                  </b>
                </div>
                <div>
                  <strong>Overall Markup</strong>
                  <b>
                    {margin?.overallMarkupPercent ??
                      percentageRatio(profit, projectCost)}
                    %
                  </b>
                </div>
                <div>
                  <strong>Target Selling Price</strong>
                  <b>{money(margin?.targetSellingPrice)}</b>
                </div>
                <div
                  className={`costing-sheet__variance costing-sheet__variance--${margin?.varianceDirection ?? "below"}`}
                >
                  <strong>Variance to Target</strong>
                  <b>
                    {margin
                      ? `${money(margin.varianceAmount)} ${margin.varianceDirection} target`
                      : "—"}
                  </b>
                </div>
                <div>
                  <strong>Required Overall Markup</strong>
                  <b>{margin?.requiredOverallMarkupPercent ?? "—"}%</b>
                </div>
              </div>
            </section>
            <p className="costing-sheet__footer">
              All supplier conversions use their saved quotation-revision FX
              snapshots: {rateSummary}. Supplier costs remain immutable and are
              shown exclusive of VAT.
            </p>
            {sellingPriceHost
              ? createPortal(
                  <>
                    <span className="costing-sheet__fixed-status">
                      {fixedPriceDraft.enabled ? "Fixed" : ""}
                    </span>
                    <button
                      className="ui-button costing-sheet__fix-price-button"
                      onClick={() => {
                        setFixedPriceDraft(
                          commercialScenario.customerPricing
                            ?.fixedSellingPrice ?? {
                            enabled: false,
                            amount: calculatedSale,
                            currency: "GBP",
                            basis: "ex_vat",
                          },
                        );
                        setFixedPriceOpen(true);
                      }}
                    >
                      {fixedPriceDraft.enabled
                        ? "Edit Fixed Price"
                        : "Fix Price"}
                    </button>
                  </>,
                  sellingPriceHost,
                )
              : null}
            {fixedPriceOpen ? (
              <div
                className="costing-sheet__modal-scrim"
                role="presentation"
                onMouseDown={(event) => {
                  if (event.target === event.currentTarget) {
                    setFixedPriceDraft(
                      commercialScenario.customerPricing?.fixedSellingPrice ??
                        initialFixedPrice,
                    );
                    setFixedPriceOpen(false);
                  }
                }}
              >
                <section
                  className="costing-sheet__fixed-price-modal ui-card"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="fix-price-title"
                >
                  <header>
                    <div>
                      <h2 id="fix-price-title">Fix Project Selling Price</h2>
                      <p>GBP, Ex VAT. Category markups remain unchanged.</p>
                    </div>
                    <button
                      className="ui-button"
                      onClick={() => {
                        setFixedPriceDraft(
                          commercialScenario.customerPricing
                            ?.fixedSellingPrice ?? initialFixedPrice,
                        );
                        setFixedPriceOpen(false);
                      }}
                    >
                      Cancel
                    </button>
                  </header>
                  <div className="costing-sheet__fixed-price-grid">
                    <div>
                      <strong>Calculated Selling Price</strong>
                      <b>{money(calculatedSale)}</b>
                    </div>
                    <label>
                      <span>Use Fixed Selling Price?</span>
                      <Toggle
                        ariaLabel="Use Fixed Selling Price"
                        value={fixedPriceDraft.enabled}
                        onChange={(enabled) =>
                          setFixedPriceDraft((current) => ({
                            ...current,
                            enabled,
                            amount:
                              enabled && Number(current.amount) === 0
                                ? calculatedSale
                                : current.amount,
                          }))
                        }
                      />
                    </label>
                    {fixedPriceDraft.enabled ? (
                      <label>
                        Fixed Selling Price (GBP, Ex VAT)
                        <input
                          className="ui-input"
                          aria-label="Fixed Selling Price GBP Ex VAT"
                          inputMode="decimal"
                          value={fixedPriceDraft.amount}
                          onChange={(event) => {
                            const amount = event.currentTarget.value;
                            setFixedPriceDraft((current) => ({
                              ...current,
                              amount,
                            }));
                          }}
                        />
                      </label>
                    ) : null}
                    <div>
                      <strong>Commercial Adjustment</strong>
                      <b>{money(commercialAdjustment)}</b>
                    </div>
                    <div>
                      <strong>Actual Selling Price (Ex VAT)</strong>
                      <b>{money(actualSale)}</b>
                    </div>
                    <div>
                      <strong>Gross Profit</strong>
                      <b>{money(profit)}</b>
                    </div>
                    <div>
                      <strong>Gross Margin</strong>
                      <b>
                        {margin?.grossMarginPercent ??
                          percentageRatio(profit, sale)}
                        %
                      </b>
                    </div>
                    <div>
                      <strong>Effective Overall Markup</strong>
                      <b>
                        {margin?.overallMarkupPercent ??
                          percentageRatio(profit, projectCost)}
                        %
                      </b>
                    </div>
                    <div>
                      <strong>Variance to Target</strong>
                      <b>
                        {margin
                          ? `${money(margin.varianceAmount)} ${margin.varianceDirection} target`
                          : "—"}
                      </b>
                    </div>
                  </div>
                  {lossMaking ? (
                    <p role="alert">
                      Warning: the fixed selling price is below Project Cost and
                      creates a loss.
                    </p>
                  ) : null}
                  <footer>
                    <button
                      className="ui-button"
                      onClick={() => {
                        setFixedPriceDraft(
                          commercialScenario.customerPricing
                            ?.fixedSellingPrice ?? initialFixedPrice,
                        );
                        setFixedPriceOpen(false);
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      className="ui-button ui-button--primary"
                      disabled={saving}
                      onClick={() => void saveCustomerPricing()}
                    >
                      Apply Fixed Price
                    </button>
                  </footer>
                </section>
              </div>
            ) : null}
          </main>
        </div>
      </div>
    </>
  );
}
