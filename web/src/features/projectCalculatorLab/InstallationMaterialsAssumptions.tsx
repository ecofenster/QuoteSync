import React, { useMemo, useState } from "react";
import Toggle from "../../components/Toggle";
import { projectCalculatorLabApi } from "./api/projectCalculatorLabApi";
import { applyMarkupPercentage } from "./domain/projectCostingMarkup";
import type { CalculatorCatalogueItem, CalculatorScenario, InstallationMaterialResultRow } from "./domain/projectCalculatorLab.types";

type MaterialCode = InstallationMaterialResultRow["code"];
type MaterialSelection = { required?: boolean; productId?: string | null; quantity?: number | null };

const MATERIAL_CODES: MaterialCode[] = ["ME508", "ME501", "TP600", "FM330", "ME902", "AA270", "AB005"];
const CATEGORIES: Record<MaterialCode, string[]> = {
  ME508: ["illbruck_me508"],
  ME501: ["illbruck_me501"],
  TP600: ["illbruck_tp600"],
  FM330: ["illbruck_fm330"],
  ME902: ["illbruck_me902"],
  AA270: ["tool"],
  AB005: ["tool"],
};
const LABELS: Record<MaterialCode, string> = {
  ME508: "Illbruck ME508 Airtightness Membrane Internal",
  ME501: "Illbruck ME501 External Membrane",
  TP600: "Illbruck TP600 Compriband",
  FM330: "Illbruck FM330 PU Foam",
  ME902: "Illbruck ME902 Primer (Spray Can)",
  AA270: "Illbruck AA270 Foam Gun",
  AB005: "Illbruck AB005 Cutting Shears",
};

const money = (value: string | null, currency = "GBP") => value == null ? "—" : new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(Number(value));
const numeric = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : null;

function matches(code: MaterialCode, item: CalculatorCatalogueItem) {
  if (!item.active || !CATEGORIES[code].includes(item.category)) return false;
  if (code !== "AA270" && code !== "AB005") return true;
  return String(item.variant.productCode ?? item.variant.productName ?? "").toUpperCase() === code;
}

function variantLabel(code: MaterialCode, item: CalculatorCatalogueItem) {
  const width = numeric(item.variant.rollWidthMm), roll = numeric(item.variant.rollLengthM);
  if ((code === "ME508" || code === "ME501") && width && roll) return `${width} mm × ${roll} m`;
  if (code === "TP600") {
    const tape = numeric(item.variant.tapeWidthMm), minimum = numeric(item.variant.jointGapMinMm), maximum = numeric(item.variant.jointGapMaxMm);
    if (tape && minimum != null && maximum != null && roll) return `${tape} mm · ${minimum}–${maximum} mm joint · ${roll} m roll${String(item.variant.productCode ?? "").includes("NG") ? " · TP600 NG" : ""}`;
  }
  return item.label;
}

function currentOptionLabel(code: MaterialCode, item: CalculatorCatalogueItem) {
  const price = item.priceAmount == null ? "Cost required" : `${money(item.priceAmount, item.currency)} / ${item.rateType === "unit" ? "each" : item.rateType}`;
  return `${variantLabel(code, item)} — ${price}`;
}

function compareOptions(code: MaterialCode, left: CalculatorCatalogueItem, right: CalculatorCatalogueItem) {
  const leftVariant = left.variant, rightVariant = right.variant;
  if (code === "ME508" || code === "ME501") return (numeric(leftVariant.rollWidthMm) ?? 0) - (numeric(rightVariant.rollWidthMm) ?? 0);
  if (code === "TP600") return (numeric(leftVariant.jointGapMinMm) ?? 0) - (numeric(rightVariant.jointGapMinMm) ?? 0)
    || (numeric(leftVariant.jointGapMaxMm) ?? 0) - (numeric(rightVariant.jointGapMaxMm) ?? 0)
    || (numeric(leftVariant.tapeWidthMm) ?? 0) - (numeric(rightVariant.tapeWidthMm) ?? 0);
  return left.label.localeCompare(right.label);
}

function requirementText(row: InstallationMaterialResultRow | undefined) {
  if (!row?.required) return "Not required";
  if (row.quantityStrategy === "linear_roll") return row.requiredLengthM == null ? row.status : `${row.requiredLengthM} m including ${row.contingencyPercent}% contingency`;
  if (row.quantityStrategy === "foam_volume_box") return row.requiredCansRaw == null ? row.status : `${row.baseLinearMetres} m · ${row.requiredCansRaw.toFixed(2)} cans calculated`;
  if (row.quantityStrategy === "coverage_can") return row.requiredLengthM == null ? row.status : `${row.requiredLengthM} m including ${row.contingencyPercent}% contingency`;
  return "One per order · no contingency";
}

function purchaseCostText(row: InstallationMaterialResultRow | undefined, required: boolean) {
  if (!required) return money("0");
  if (row?.purchaseCost != null) return money(row.purchaseCost, row.currency ?? "GBP");
  if (row?.unitCost != null) return `${money(row.unitCost, row.currency ?? "GBP")} / ${row.purchaseUnit ?? "unit"} configured · ${row.status}`;
  return row?.status ?? "Cost required";
}

export default function InstallationMaterialsAssumptions({ scenario, markup }: { scenario: CalculatorScenario; markup: string }) {
  const installationCatalogueState = scenario.installationCatalogueState;
  const currentCatalogue = installationCatalogueState?.isCurrent === true;
  const saved = (scenario.options?.installationMaterials ?? {}) as Record<string, unknown>;
  const selections = ((saved.materialSelections && typeof saved.materialSelections === "object") ? saved.materialSelections : {}) as Partial<Record<MaterialCode, MaterialSelection>>;
  const results = new Map((scenario.installationMaterials?.simpleMaterials ?? []).map((row) => [row.code, row]));
  const [saving, setSaving] = useState<MaterialCode | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const options = useMemo(() => {
    const catalogue = scenario.catalogueSnapshot?.catalogue ?? [];
    return Object.fromEntries(MATERIAL_CODES.map((code) => [code, catalogue.filter((item) => matches(code, item)).sort((left, right) => compareOptions(code, left, right))])) as Record<MaterialCode, CalculatorCatalogueItem[]>;
  }, [scenario.catalogueSnapshot?.catalogue]);

  const save = async (code: MaterialCode, patch: MaterialSelection) => {
    setSaving(code); setError("");
    try {
      const current = selections[code] ?? {};
      const next = { ...current, ...patch };
      const productId = next.productId || options[code][0]?.id || null;
      const materialSelections = { ...selections, [code]: { ...next, productId, quantity: code === "AA270" || code === "AB005" ? next.required ? 1 : 0 : null } };
      const legacy = code === "ME508" ? { me508ProductId: productId } : code === "TP600" ? { tp600ProductId: productId } : {};
      const updated = await projectCalculatorLabApi.updateInstallationMaterials(scenario.id, { ...saved, ...legacy, materialSelections });
      window.dispatchEvent(new CustomEvent("quotesuite:costing-updated", { detail: updated }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : `${LABELS[code]} could not be saved.`);
    } finally { setSaving(null); }
  };

  const applyCurrentCatalogue = async () => {
    if (!globalThis.confirm("Use the current Administration Installation catalogue and defaults for a new costing revision? The saved historical catalogue snapshot will be retained.")) return;
    setRefreshing(true); setError("");
    try {
      const updated = await projectCalculatorLabApi.useCurrentInstallationCatalogue(scenario.id, { useCurrentDefaults: true });
      window.dispatchEvent(new CustomEvent("quotesuite:costing-updated", { detail: updated }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The current Installation catalogue could not be applied.");
    } finally { setRefreshing(false); }
  };

  return <div className="costing-sheet__materials-simple">
    <div className="costing-sheet__material-catalogue-binding">
      <span>{installationCatalogueState?.isCurrent ? "Current Administration catalogue snapshot" : "Saved historical catalogue snapshot"}<small>{installationCatalogueState?.isCurrent ? `Captured for amended revision ${scenario.catalogueSnapshot?.scenarioRevision ?? scenario.revisionNumber}.` : "Catalogue prices change only through this explicit amended revision."}</small></span>
      <button type="button" className="ui-button ui-button--secondary" disabled={refreshing || installationCatalogueState?.isCurrent === true} onClick={() => void applyCurrentCatalogue()}>{refreshing ? "Applying…" : installationCatalogueState?.isCurrent ? "Current catalogue applied" : "Use current Installation catalogue"}</button>
    </div>
    {error ? <p role="alert">{error}</p> : null}
    <div className="costing-sheet__materials-simple-head" aria-hidden="true"><span>Material</span><span>Required?</span><span>Variant</span><span>Automatic requirement</span><span>Purchase Cost</span><span>Markup</span><span>Selling Price</span></div>
    {MATERIAL_CODES.map((code) => {
      const result = results.get(code), selection = selections[code] ?? {}, required = result?.required ?? selection.required === true;
      const selectedId = result?.productId ?? selection.productId ?? "";
      const sale = result?.required && result.purchaseCost != null ? applyMarkupPercentage(result.purchaseCost, markup)?.sellingPrice ?? null : "0";
      const catalogueOptions = options[code];
      return <div className={!required ? "is-excluded" : ""} key={code}>
        <strong>{LABELS[code]}<small>{requirementText(result)}</small></strong>
        <span className="costing-sheet__material-required">{currentCatalogue ? <Toggle ariaLabel={`${LABELS[code]} required`} value={required} onChange={(value) => void save(code, { required: value })}/> : <span>{required ? "Yes" : "No"}</span>}</span>
        {!currentCatalogue ? <span>{required ? result?.variantLabel ?? "Historical selection unavailable" : "—"}</span> : required && catalogueOptions.length > 1 ? <select className="ui-input" aria-label={`${LABELS[code]} variant`} title={catalogueOptions.find((item) => item.id === selectedId) ? currentOptionLabel(code, catalogueOptions.find((item) => item.id === selectedId)!) : "Select catalogue variant"} value={selectedId} onChange={(event) => void save(code, { productId: event.currentTarget.value || null })}><option value="">Select catalogue variant</option>{catalogueOptions.map((item) => <option key={item.id} value={item.id}>{currentOptionLabel(code, item)}</option>)}</select> : required ? <span>{catalogueOptions[0] ? currentOptionLabel(code, catalogueOptions[0]) : "Select catalogue variant"}</span> : <span>—</span>}
        <span><b>{required ? result?.purchaseDescription ?? result?.status ?? "Calculating…" : "0"}</b></span>
        <span>{purchaseCostText(result, required)}</span>
        <span>{markup}%</span>
        <strong>{money(sale)}</strong>
        {saving === code ? <small role="status">Saving…</small> : null}
      </div>;
    })}
    {scenario.installationMaterials?.priceStatus === "review_required" ? <p role="alert">Installation Materials costing is incomplete: {(scenario.installationMaterials.reviewRequiredMaterials ?? []).map((item) => `${LABELS[item.code as MaterialCode] ?? item.code}: ${item.status}`).join(" · ") || "required calculation evidence remains unresolved"}.</p> : null}
  </div>;
}
