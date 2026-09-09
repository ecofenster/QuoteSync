import { useEffect, useState } from "react";
import Toggle from "../../components/Toggle";
import { apiFetch } from "../../services/api/apiClient";
import { getAllSettings } from "../../services/settings/settingsService";

const controls = [
  { key: "feature.configurator.enabled", label: "Configurator", description: "Make product configuration features available." },
  { key: "feature.clientPortal.enabled", label: "Customer Portal", description: "Make customer portal capabilities available." },
] as const;
const portalControls=[
  ["dashboard","Dashboard"],["estimates","Estimates"],["orders","Orders"],["rejected","Rejected / Lost"],["documents","Documents"],["certificates","Certificates"],["system_drawings","System Drawings"],["compare_options","Compare / Options"],["review_estimate","Review Estimate"],["request_amendments","Request Amendments"],["decline_estimate","Decline Estimate"],["intent_to_proceed","Intent to Proceed / Raise Order"],["payments","Payments (future)"],["delivery_installation","Delivery / Installation (future)"],
] as const;
const enabled = (value: unknown) => typeof value === "object" && value !== null && "enabled" in value ? Boolean((value as { enabled?: unknown }).enabled) : Boolean(value);

export default function AdminFeatureControls() {
  const [values,setValues]=useState<Record<string,boolean>>({}),[portalValues,setPortalValues]=useState<Record<string,boolean>>({});
  const [status,setStatus]=useState("");
  useEffect(()=>{
    const featureRequest:Promise<Array<{featureKey:string;enabled:boolean}>>=apiFetch("/api/client-portal/internal/features");
    void Promise.all([getAllSettings(),featureRequest]).then(([rows,features])=>{setValues(Object.fromEntries(controls.map(control=>[control.key,enabled(rows.find(row=>row.key===control.key)?.value)])));setPortalValues(Object.fromEntries(features.map(feature=>[feature.featureKey,feature.enabled])))}).catch(error=>setStatus(error instanceof Error?error.message:"Feature controls could not be loaded."));
  },[]);
  async function update(key:string,value:boolean){setStatus("Saving…");try{setValues(current=>({...current,[key]:value}));await apiFetch("/api/settings",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({key,value:{enabled:value},group_name:"features"})});setStatus("Feature control saved.");}catch(error){setStatus(error instanceof Error?error.message:"Feature control could not be saved.");}}
  async function updatePortal(key:string,value:boolean){setStatus("Saving Client Portal capability…");try{setPortalValues(current=>({...current,[key]:value}));await apiFetch(`/api/client-portal/internal/features/${encodeURIComponent(key)}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({enabled:value})});setStatus("Client Portal capability saved.");}catch(error){setStatus(error instanceof Error?error.message:"Client Portal capability could not be saved.");}}
  return <div className="admin-page-stack"><section className="admin-card admin-card--content ui-card"><div className="admin-page-title">Feature Controls</div><div className="admin-body-copy admin-copy-width">Enable or disable genuinely optional system capabilities. Portal disclosure requires both an enabled company capability and an explicitly released Client/Project resource.</div></section><section className="admin-card admin-card--section ui-card">{controls.map(control=><div className="admin-project-pref-row" key={control.key}><div><div className="admin-group-title">{control.label}</div><div className="admin-body-copy admin-copy-width--narrow">{control.description}</div></div><Toggle value={values[control.key]??false} onChange={value=>void update(control.key,value)}/></div>)}</section><section className="admin-card admin-card--section ui-card"><div><div className="admin-group-title">Client Portal capabilities</div><div className="admin-body-copy admin-copy-width">Company defaults only. Enabling a module does not release any Client, Project, Estimate, Order or Document.</div></div>{portalControls.map(([key,label])=><div className="admin-project-pref-row" key={key}><div><div className="admin-group-title">{label}</div><div className="admin-body-copy admin-copy-width--narrow">Customer-facing capability · explicit Project/resource release remains required.</div></div><Toggle value={portalValues[key]??false} onChange={value=>void updatePortal(key,value)}/></div>)}{status?<p role="status" className="admin-body-copy">{status}</p>:null}</section></div>;
}
