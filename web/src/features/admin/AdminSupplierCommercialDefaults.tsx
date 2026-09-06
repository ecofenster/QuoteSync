import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import Toggle from "../../components/Toggle";
import { apiFetch } from "../../services/api/apiClient";

const displayPolicy = {
  positionPrices: "show",
  discountPresentation: "project_total",
  showOriginalTotal: true,
  showDiscountPercentage: true,
  showDiscountAmount: true,
  showNetTotal: true,
  showCategoryTotals: true,
  showOverallTotal: true,
};
const newStages = () => [1, 2, 3, 4].map((number, sequence) => ({ id: `discount-${number}`, sequence, label: `Discount ${number}`, percentage: "0", enabled: true }));
const empty = () => ({
  supplierCode: "",
  supplierName: "",
  active: true,
  policy: {
    pricingBasis: "factory_price",
    pricingMethod: "factory_price",
    pricingPolicyVersion: 2,
    paidInQuotedCurrency: true,
    settlementCurrency: "GBP",
    discountPolicy: { type: "net", thresholdBasis: "manufacturer_list_gbp_before_discounts", stages: newStages(), bands: [] as any[] },
    packagePricingAvailable: false,
    packages: [] as any[],
    discountApplicationBasis: "selected_complete_package",
  },
  pricingDisplayPolicy: { ...displayPolicy },
});
const legacyMethod = (value: string) => value.startsWith("legacy_");
const methodLabels: Record<string, string> = { factory_price: "Factory Price", parity_1_to_1: "1 to 1 Pricing", staged_discount: "Staged Discount" };
const methodPlaceholders = new Set(["FACTORY PRICE", "1 TO 1 PRICING", "STAGED DISCOUNT"]);
const isMethodPlaceholder = (item: any) => String(item?.supplierName ?? "").trim().toUpperCase() === "ANY"
  && methodPlaceholders.has(String(item?.supplierCode ?? "").trim().toUpperCase());

type SupplierDefaultsTab = "methods" | "suppliers" | "presentation";
const tabs: Array<{ id: SupplierDefaultsTab; label: string }> = [
  { id: "methods", label: "Pricing Methods" },
  { id: "suppliers", label: "Suppliers" },
  { id: "presentation", label: "Customer Presentation" },
];

function normalizeRecord(value: any) {
  const base = empty();
  return {
    ...base,
    ...value,
    policy: {
      ...base.policy,
      ...(value?.policy ?? {}),
      discountPolicy: { ...base.policy.discountPolicy, ...(value?.policy?.discountPolicy ?? {}) },
      packages: Array.isArray(value?.policy?.packages) ? value.policy.packages : [],
    },
    pricingDisplayPolicy: { ...displayPolicy, ...(value?.pricingDisplayPolicy ?? {}) },
  };
}

export default function AdminSupplierCommercialDefaults() {
  const [records, setRecords] = useState<any[]>([]);
  const [draft, setDraft] = useState<any>(empty());
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState("");
  const [activeTab, setActiveTab] = useState<SupplierDefaultsTab>("methods");
  const [selectedCode, setSelectedCode] = useState("");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const supplierRecords = useMemo(() => records.filter((item) => !isMethodPlaceholder(item)), [records]);
  const selectedRecord = supplierRecords.find((item) => item.supplierCode === selectedCode) ?? supplierRecords[0] ?? null;

  const load = async () => {
    const values = (await apiFetch("/api/admin/project-calculator-lab/supplier-commercial-defaults")) as any[];
    setRecords(values);
    setSelectedCode((current) => values.some((item) => !isMethodPlaceholder(item) && item.supplierCode === current)
      ? current
      : values.find((item) => !isMethodPlaceholder(item))?.supplierCode ?? "");
  };

  useEffect(() => { void load(); }, []);

  const policy = (value: Record<string, unknown>) => setDraft((current: any) => ({ ...current, policy: { ...current.policy, ...value } }));
  const discount = (value: Record<string, unknown>) => policy({ discountPolicy: { ...draft.policy.discountPolicy, ...value } });
  const stage = (index: number, value: Record<string, unknown>) => discount({ stages: (draft.policy.discountPolicy.stages ?? []).map((item: any, position: number) => position === index ? { ...item, ...value } : item) });
  const band = (index: number, value: Record<string, unknown>) => discount({ bands: (draft.policy.discountPolicy.bands ?? []).map((item: any, position: number) => position === index ? { ...item, ...value } : item) });
  const chooseMethod = (pricingBasis: string) => policy({ pricingBasis, pricingMethod: pricingBasis, pricingPolicyVersion: 2, discountPolicy: { ...draft.policy.discountPolicy, type: pricingBasis === "staged_discount" ? "staged" : "net" } });
  const stages = draft.policy.discountPolicy.stages ?? [];
  const bands = draft.policy.discountPolicy.bands ?? [];
  const method = draft.policy.pricingMethod ?? draft.policy.pricingBasis;

  const selectTab = (tab: SupplierDefaultsTab) => { setActiveTab(tab); setStatus(""); setEditing(false); };
  const onTabKeyDown = (index: number, event: KeyboardEvent<HTMLButtonElement>) => {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault();
    selectTab(tabs[next].id);
    tabRefs.current[next]?.focus();
  };

  const beginEdit = (record: any) => { setDraft(normalizeRecord(record)); setEditing(true); setStatus(""); };

  async function save(nextDraft = draft, message = "Supplier pricing saved. Existing quotation and Estimate snapshots are unchanged.") {
    setStatus("Saving…");
    try {
      await apiFetch(`/api/admin/project-calculator-lab/supplier-commercial-defaults/${encodeURIComponent(nextDraft.supplierCode)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...nextDraft, active: true }),
      });
      await load();
      setEditing(false);
      setStatus(message);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Supplier settings could not be saved.");
    }
  }

  async function remove(item: any) {
    if (!window.confirm(`Delete ${item.supplierName} from current supplier choices? Historical snapshots will remain readable.`)) return;
    setStatus("Deleting supplier…");
    try {
      await apiFetch(`/api/admin/project-calculator-lab/supplier-commercial-defaults/${encodeURIComponent(item.supplierCode)}`, { method: "DELETE" });
      await load();
      if (draft.supplierCode === item.supplierCode) { setDraft(empty()); setEditing(false); }
      setStatus("Supplier deleted from current choices. Historical quotation and Estimate snapshots are unchanged.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Supplier could not be deleted.");
    }
  }

  const openSelected = () => {
    if (!selectedRecord) return;
    beginEdit(selectedRecord);
  };

  const supplierContext = (description: string) => <div className="admin-supplier-context">
    <label><span className="admin-setting-label">Supplier</span><select className="ui-input" value={selectedRecord?.supplierCode ?? ""} onChange={(event) => setSelectedCode(event.currentTarget.value)}>{supplierRecords.map((item) => <option key={item.supplierCode} value={item.supplierCode}>{item.supplierName}</option>)}</select></label>
    <p>{description}</p>
  </div>;

  return <div className="admin-content">
    <section className="ui-card admin-theme-section">
      <h2>Supplier / Product Defaults</h2>
      <p>Define canonical pricing methods, then assign them to actual suppliers. Saved quotation and Estimate snapshots remain historical.</p>
      <div className="ui-tabs calculator-admin__tabs" role="tablist" aria-label="Supplier and product default sections">
        {tabs.map((tab, index) => <button key={tab.id} ref={(node) => { tabRefs.current[index] = node; }} type="button" role="tab" id={`supplier-defaults-tab-${tab.id}`} aria-selected={activeTab === tab.id} aria-controls={`supplier-defaults-panel-${tab.id}`} tabIndex={activeTab === tab.id ? 0 : -1} className="ui-tab" onClick={() => selectTab(tab.id)} onKeyDown={(event) => onTabKeyDown(index, event)}>{tab.label}</button>)}
      </div>
      <div className="admin-supplier-tab-panel" role="tabpanel" id={`supplier-defaults-panel-${activeTab}`} aria-labelledby={`supplier-defaults-tab-${activeTab}`}>
        {activeTab === "methods" ? <div className="admin-pricing-methods">
          <article><h3>Factory Price</h3><p>Use the supplier factory price and governed settlement/FX evidence as the purchase basis.</p></article>
          <article><h3>1 to 1 Pricing</h3><p>The quoted numeric supplier amount becomes the same numeric GBP costing basis. Source and saved FX evidence remain preserved.</p></article>
          <article><h3>Staged Discount</h3><p>Apply enabled supplier discounts sequentially, with optional order-value bands.</p></article>
        </div> : null}

        {activeTab === "suppliers" ? <>
          <div className="admin-flex-row admin-supplier-toolbar"><button type="button" className="ui-button ui-button--primary" onClick={() => beginEdit(empty())}>Add Supplier</button>{status ? <span role="status" className="admin-body-copy">{status}</span> : null}</div>
          <div className="admin-supplier-list"><table><thead><tr><th>Supplier</th><th>Pricing Method</th><th>Actions</th></tr></thead><tbody>{supplierRecords.map((item) => <tr key={item.supplierCode}><td><strong>{item.supplierName}</strong><small>{item.supplierCode}</small></td><td>{methodLabels[item.policy.pricingMethod ?? item.policy.pricingBasis] ?? "Legacy policy"}</td><td><div className="admin-supplier-list__actions"><button type="button" className="ui-button" aria-label={`Edit ${item.supplierName}`} onClick={() => beginEdit(item)}>Edit</button><button type="button" className="ui-button ui-button--danger" aria-label={`Delete ${item.supplierName}`} onClick={() => void remove(item)}>Delete</button></div></td></tr>)}</tbody></table>{!supplierRecords.length ? <p className="admin-body-copy">No suppliers are configured.</p> : null}</div>
          {editing ? <SupplierEditor draft={draft} setDraft={setDraft} records={supplierRecords} method={method} chooseMethod={chooseMethod} policy={policy} discount={discount} stage={stage} band={band} stages={stages} bands={bands} save={() => void save()} cancel={() => { setEditing(false); setDraft(empty()); }} /> : null}
        </> : null}

        {activeTab === "presentation" ? <>
          {supplierContext("These controls affect customer-facing presentation only; they do not change supplier calculation logic.")}
          {selectedRecord ? <section className="admin-supplier-editor" aria-label="Customer presentation editor">
            <header><div><h3>{selectedRecord.supplierName} Customer Presentation</h3><p>Choose which supplier-pricing totals may be shown in customer-safe output.</p></div>{editing && draft.supplierCode === selectedRecord.supplierCode ? null : <button type="button" className="ui-button" onClick={openSelected}>Edit Presentation</button>}</header>
            {editing && draft.supplierCode === selectedRecord.supplierCode ? <><CustomerPresentationEditor draft={draft} setDraft={setDraft} /><button type="button" className="ui-button ui-button--primary" onClick={() => void save(draft, "Customer presentation saved. Supplier calculations are unchanged.")}>Save Customer Presentation</button></> : <CustomerPresentationEditor draft={normalizeRecord(selectedRecord)} readOnly />}
          </section> : <p className="admin-body-copy">Add a supplier before configuring Customer Presentation.</p>}
          {status ? <span role="status" className="admin-body-copy">{status}</span> : null}
        </> : null}
      </div>
    </section>
  </div>;
}

function SupplierEditor({ draft, setDraft, records, method, chooseMethod, policy, discount, stage, band, stages, bands, save, cancel }: any) {
  return <section className="admin-supplier-editor" aria-label="Supplier pricing editor">
    <header><div><h3>{draft.supplierCode ? `Edit ${draft.supplierName || "Supplier"}` : "Add Supplier"}</h3><p>Only settings relevant to the selected pricing method are shown.</p></div><button type="button" className="ui-button" onClick={cancel}>Cancel</button></header>
    <div className="admin-form-grid admin-aligned-fields">
      <label><span className="admin-setting-label">Supplier code</span><input className="ui-input" disabled={records.some((item: any) => item.supplierCode === draft.supplierCode)} value={draft.supplierCode} onChange={(event) => setDraft({ ...draft, supplierCode: event.currentTarget.value.toUpperCase() })} /></label>
      <label><span className="admin-setting-label">Supplier name</span><input className="ui-input" value={draft.supplierName} onChange={(event) => setDraft({ ...draft, supplierName: event.currentTarget.value })} /></label>
      <label><span className="admin-setting-label">Pricing Method</span><select className="ui-input" value={method} onChange={(event) => chooseMethod(event.currentTarget.value)}><option value="factory_price">Factory Price</option><option value="parity_1_to_1">1 to 1 Pricing</option><option value="staged_discount">Staged Discount</option>{legacyMethod(method) ? <option value={method}>Legacy policy (read only)</option> : null}</select></label>
      {method !== "parity_1_to_1" ? <label><span className="admin-setting-label">Quoted currency used for settlement?</span><Toggle value={draft.policy.paidInQuotedCurrency} onChange={(value) => policy({ paidInQuotedCurrency: value })} /></label> : null}
      {method !== "parity_1_to_1" && !draft.policy.paidInQuotedCurrency ? <label><span className="admin-setting-label">Default settlement currency</span><input className="ui-input" maxLength={3} value={draft.policy.settlementCurrency} onChange={(event) => policy({ settlementCurrency: event.currentTarget.value.toUpperCase() })} /></label> : null}
    </div>
    {method === "parity_1_to_1" ? <p className="ui-status-badge">Commercial parity: quoted numeric supplier amounts use the same numeric GBP costing basis.</p> : null}
    {method === "staged_discount" ? <div className="admin-supplier-discounts">
      <section><h4>Discount stages</h4>{stages.map((item: any, index: number) => <div className="calculator-lab__form" key={item.id}><label>Stage label<input className="ui-input" value={item.label} onChange={(event) => stage(index, { label: event.currentTarget.value })} /></label><label>Discount %<input className="ui-input" inputMode="decimal" value={item.percentage} onChange={(event) => stage(index, { percentage: event.currentTarget.value })} /></label><label>Enabled<Toggle value={item.enabled !== false} onChange={(value) => stage(index, { enabled: value })} /></label>{index >= 4 ? <button type="button" className="ui-button" onClick={() => discount({ stages: stages.filter((_: any, position: number) => position !== index) })}>Remove</button> : null}</div>)}<button type="button" className="ui-button" onClick={() => discount({ stages: [...stages, { id: crypto.randomUUID(), sequence: stages.length, label: `Discount ${stages.length + 1}`, percentage: "0", enabled: true }] })}>Add discount stage</button></section>
      <section><h4>Optional order-value bands</h4><p className="admin-body-copy">Lower bound is inclusive; upper bound is exclusive.</p>{bands.map((item: any, index: number) => <div className="calculator-lab__form" key={item.id}><label>Band label<input className="ui-input" value={item.label} onChange={(event) => band(index, { label: event.currentTarget.value })} /></label><label>Lower bound GBP<input className="ui-input" inputMode="decimal" value={item.lowerBoundGbp} onChange={(event) => band(index, { lowerBoundGbp: event.currentTarget.value })} /></label><label>Upper bound GBP<input className="ui-input" inputMode="decimal" value={item.upperBoundGbp ?? ""} onChange={(event) => band(index, { upperBoundGbp: event.currentTarget.value || null })} /></label><button type="button" className="ui-button" onClick={() => discount({ bands: bands.filter((_: any, position: number) => position !== index) })}>Remove band</button></div>)}<button type="button" className="ui-button" onClick={() => discount({ bands: [...bands, { id: crypto.randomUUID(), label: `Band ${bands.length + 1}`, lowerBoundGbp: "0", upperBoundGbp: null, stageIds: stages.filter((item: any) => item.enabled !== false).map((item: any) => item.id), enabled: true }] })}>Add order-value band</button></section>
    </div> : null}
    <button type="button" className="ui-button ui-button--primary" disabled={!draft.supplierCode || !draft.supplierName || legacyMethod(method)} onClick={save}>Save Supplier</button>
  </section>;
}

const presentationOptions = {
  showOriginalTotal: "Show original total",
  showDiscountPercentage: "Show discount percentage",
  showDiscountAmount: "Show discount monetary value",
  showNetTotal: "Show discounted/net total",
  showCategoryTotals: "Show category totals",
  showOverallTotal: "Show overall project total",
};

function CustomerPresentationEditor({ draft, setDraft, readOnly = false }: any) {
  return <div className="admin-customer-view-controls">{Object.entries(presentationOptions).map(([key, label]) => <label key={key}><span>{label}</span><Toggle disabled={readOnly} value={Boolean(draft.pricingDisplayPolicy[key])} onChange={(value) => setDraft?.({ ...draft, pricingDisplayPolicy: { ...draft.pricingDisplayPolicy, [key]: value } })} /></label>)}</div>;
}
