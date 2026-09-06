import { useEffect, useMemo, useState } from "react";
import Toggle from "../../components/Toggle";
import { apiFetch } from "../../services/api/apiClient";
import { calculateImportCustoms, GLOBAL_IMPORT_CUSTOMS_DEFAULTS } from "../../../shared/importCustoms.js";

const KEY = "projectCalculator.importCustomsDefaults";
type ImportDefaults = {
  includedByDefault: boolean;
  baseImportCost: string;
  contingencyPercent: string;
  defaultImports: number;
  dutyPercent: string;
  dutyBasisAmount: string;
  markupPercent: string;
};
const initial: ImportDefaults = { ...GLOBAL_IMPORT_CUSTOMS_DEFAULTS };
const decimal = /^\d+(?:\.\d{1,2})?$/;
const currency = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });

export default function AdminImportCustomsDefaults() {
  const [values, setValues] = useState<ImportDefaults>(initial);
  const [exists, setExists] = useState(false);
  const [status, setStatus] = useState("");
  useEffect(() => { void apiFetch("/api/settings/projectPreferences").then(rows => { const row=(Array.isArray(rows)?rows:[]).find((item:any)=>item.key===KEY);if(row){setValues({ ...initial, ...(row.value || {}) });setExists(true);} }); }, []);
  const invalid = !decimal.test(values.baseImportCost) || !decimal.test(values.contingencyPercent) || !decimal.test(values.dutyPercent) || !decimal.test(values.dutyBasisAmount) || !decimal.test(values.markupPercent) || !Number.isInteger(Number(values.defaultImports)) || Number(values.defaultImports) < 1 || [values.contingencyPercent,values.dutyPercent,values.markupPercent].some(value=>Number(value)>999.99);
  const calculated = useMemo(() => invalid ? null : calculateImportCustoms({ ...values, included: values.includedByDefault }, values.markupPercent), [invalid, values]);
  const patch = (value: Partial<ImportDefaults>) => setValues(current => ({ ...current, ...value }));
  async function save() {
    if (invalid) return;
    await apiFetch(exists ? `/api/settings/${KEY}` : "/api/settings", { method: exists ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(exists ? { value: values, group_name: "projectPreferences" } : { key: KEY, value: values, group_name: "projectPreferences" }) });
    setExists(true);
    setStatus("Global defaults saved. Existing Estimate snapshots are unchanged.");
  }
  return <section className="admin-card admin-card--section ui-card">
    <div className="admin-group-title">Import / Customs Defaults</div>
    <div className="admin-body-copy">A standard Estimate-wide commercial allowance. It does not depend on supplier or manufacturer identity, and Import VAT is excluded.</div>
    <div className="admin-dimensions-grid">
      <label><span className="admin-setting-label">Included by Default</span><Toggle value={values.includedByDefault} onChange={value=>patch({includedByDefault:value})}/></label>
      <label><span className="admin-setting-label">Base Import Cost GBP</span><input className="admin-input ui-input" inputMode="decimal" value={values.baseImportCost} onChange={event=>patch({baseImportCost:event.currentTarget.value})}/></label>
      <label><span className="admin-setting-label">Cost Contingency %</span><input className="admin-input ui-input" inputMode="decimal" value={values.contingencyPercent} onChange={event=>patch({contingencyPercent:event.currentTarget.value})}/></label>
      <label><span className="admin-setting-label">Default Number of Imports</span><input className="admin-input ui-input" type="number" min="1" step="1" value={values.defaultImports} onChange={event=>patch({defaultImports:Number(event.currentTarget.value)})}/></label>
      <label><span className="admin-setting-label">Default Duty %</span><input className="admin-input ui-input" inputMode="decimal" value={values.dutyPercent} onChange={event=>patch({dutyPercent:event.currentTarget.value})}/></label>
      <label><span className="admin-setting-label">Default Duty Basis GBP</span><input className="admin-input ui-input" inputMode="decimal" value={values.dutyBasisAmount} onChange={event=>patch({dutyBasisAmount:event.currentTarget.value})}/></label>
      <label><span className="admin-setting-label">Import / Customs Markup %</span><input className="admin-input ui-input" inputMode="decimal" value={values.markupPercent} onChange={event=>patch({markupPercent:event.currentTarget.value})}/></label>
    </div>
    <p className="admin-body-copy">Default purchase allowance: <strong>{calculated ? currency.format(Number(calculated.purchaseCost)) : "Review values"}</strong>{calculated ? ` (${currency.format(Number(calculated.contingencyAmount))} cost contingency)` : ""}.</p>
    <div className="admin-flex-row"><button className="ui-button ui-button--primary" disabled={invalid} onClick={()=>void save()}>Save Import / Customs Defaults</button>{status?<span role="status" className="admin-body-copy">{status}</span>:null}</div>
  </section>;
}
