import { useEffect, useState } from "react";
import { apiFetch } from "../../services/api/apiClient";

const KEY = "projectCalculator.markupDefaults";
const EMPTY = { product: "0", extras: "0", transport: "0", installation: "0", materials: "0" };
const LABELS = { product: "Products / Supply Only", extras: "Extras", transport: "Transport", installation: "Installation", materials: "Installation Materials" } as const;

export default function AdminProjectCostingMarkupDefaults() {
  const [values, setValues] = useState(EMPTY), [exists, setExists] = useState(false), [status, setStatus] = useState("");
  useEffect(() => { void apiFetch("/api/settings/projectPreferences").then((rows) => { const row = (Array.isArray(rows) ? rows : []).find((item: any) => item.key === KEY); if (row) { setValues({ ...EMPTY, ...(row.value || {}) }); setExists(true); } }); }, []);
  const invalid = Object.values(values).some((value) => !/^\d+(?:\.\d{1,2})?$/.test(value) || Number(value) > 999.99);
  async function save() { if (invalid) return; await apiFetch(exists ? `/api/settings/${KEY}` : "/api/settings", { method: exists ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(exists ? { value: values, group_name: "projectPreferences" } : { key: KEY, value: values, group_name: "projectPreferences" }) }); setExists(true); setStatus("Defaults saved. Existing Estimate costings are unchanged."); }
  return <section className="admin-card admin-card--section ui-card"><div className="admin-group-title">Project Costing Markup Defaults</div><div className="admin-body-copy">Applied once when a new costing scenario is created. Persisted Estimates retain their own values.</div><div className="admin-dimensions-grid">{(Object.keys(LABELS) as Array<keyof typeof LABELS>).map((key) => <label key={key}><span className="admin-setting-label">{LABELS[key]} %</span><input className="admin-input ui-input" inputMode="decimal" value={values[key]} onChange={(event) => { const value = event.currentTarget.value; setValues((current) => ({ ...current, [key]: value })); }} /></label>)}</div><div className="admin-flex-row"><button className="ui-button ui-button--primary" disabled={invalid} onClick={() => void save()}>Save Markup Defaults</button>{status ? <span role="status" className="admin-body-copy">{status}</span> : null}</div></section>;
}
