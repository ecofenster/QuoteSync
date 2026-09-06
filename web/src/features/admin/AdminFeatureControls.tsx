import { useEffect, useState } from "react";
import Toggle from "../../components/Toggle";
import { apiFetch } from "../../services/api/apiClient";
import { getAllSettings } from "../../services/settings/settingsService";

const controls = [
  { key: "feature.configurator.enabled", label: "Configurator", description: "Make product configuration features available." },
  { key: "feature.clientPortal.enabled", label: "Customer Portal", description: "Make customer portal capabilities available." },
] as const;
const enabled = (value: unknown) => typeof value === "object" && value !== null && "enabled" in value ? Boolean((value as { enabled?: unknown }).enabled) : Boolean(value);

export default function AdminFeatureControls() {
  const [values,setValues]=useState<Record<string,boolean>>({});
  const [status,setStatus]=useState("");
  useEffect(()=>{void getAllSettings().then(rows=>setValues(Object.fromEntries(controls.map(control=>[control.key,enabled(rows.find(row=>row.key===control.key)?.value)]))));},[]);
  async function update(key:string,value:boolean){setStatus("Saving…");try{setValues(current=>({...current,[key]:value}));await apiFetch("/api/settings",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({key,value:{enabled:value},group_name:"features"})});setStatus("Feature control saved.");}catch(error){setStatus(error instanceof Error?error.message:"Feature control could not be saved.");}}
  return <div className="admin-page-stack"><section className="admin-card admin-card--content ui-card"><div className="admin-page-title">Feature Controls</div><div className="admin-body-copy admin-copy-width">Enable or disable genuinely optional system capabilities. Estimate Project Costing remains an operational workspace and is protected separately by runtime health.</div></section><section className="admin-card admin-card--section ui-card">{controls.map(control=><div className="admin-project-pref-row" key={control.key}><div><div className="admin-group-title">{control.label}</div><div className="admin-body-copy admin-copy-width--narrow">{control.description}</div></div><Toggle value={values[control.key]??false} onChange={value=>void update(control.key,value)}/></div>)}{status?<p role="status" className="admin-body-copy">{status}</p>:null}</section></div>;
}
