import { useEffect, useMemo, useState } from "react";
import type { Client } from "../../models/types";
import { commercialIdentityApi, type EnquiryRecord } from "../../services/commercialIdentity/commercialIdentityApi";
import CanonicalDocumentsPanel from "../documents/CanonicalDocumentsPanel";
import "./commercialIdentity.css";

type Draft = { displayName: string; companyName: string; email: string; telephone: string; source: string; leadSource: string; projectName: string; siteAddress: string; notes: string };
const emptyDraft = (): Draft => ({ displayName: "", companyName: "", email: "", telephone: "", source: "", leadSource: "", projectName: "", siteAddress: "", notes: "" });
const clientName = (client: Client) => client.type === "Business" ? client.businessName || client.clientName : client.clientName;

export function EnquiryWorkspace({ clients, onCommercialIdentityChanged }: { clients: Client[]; onCommercialIdentityChanged: () => Promise<unknown> | void }) {
  const [enquiries, setEnquiries] = useState<EnquiryRecord[]>([]), [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft), [creating, setCreating] = useState(false), [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"existing_client" | "new_client">("existing_client"), [clientId, setClientId] = useState("");
  const [projectName, setProjectName] = useState(""), [projectYear, setProjectYear] = useState(new Date().getFullYear()), [message, setMessage] = useState("");
  const selected = useMemo(() => enquiries.find((item) => item.id === selectedId) || null, [enquiries, selectedId]);
  const load = async () => { const rows = await commercialIdentityApi.listEnquiries(); setEnquiries(rows); setSelectedId((current) => current && rows.some((item) => item.id === current) ? current : rows[0]?.id || null); };
  useEffect(() => { void load().catch((error) => setMessage(error instanceof Error ? error.message : "Enquiries could not be loaded.")); }, []);

  async function create() {
    if (!draft.displayName.trim() && !draft.companyName.trim()) return;
    setBusy(true); setMessage("");
    try { const value = await commercialIdentityApi.createEnquiry(draft); setDraft(emptyDraft()); setCreating(false); await load(); setSelectedId(value.id); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Enquiry could not be created."); }
    finally { setBusy(false); }
  }

  async function qualify() {
    if (!selected || !projectName.trim() || (mode === "existing_client" && !clientId)) return;
    setBusy(true); setMessage("");
    try {
      const result = await commercialIdentityApi.qualifyEnquiry(selected.id, {
        mode,
        clientId: mode === "existing_client" ? clientId : undefined,
        client: mode === "new_client" ? { name: selected.displayName || selected.companyName, companyName: selected.companyName, email: selected.email, telephone: selected.telephone } : undefined,
        project: { name: projectName, contextYear: projectYear, siteAddress: selected.siteAddress },
      });
      setMessage(`${result.enquiry.enquiryRef} qualified to ${result.client.clientRef} · ${result.project.name}.`);
      await Promise.all([load(), onCommercialIdentityChanged()]);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Enquiry qualification failed."); }
    finally { setBusy(false); }
  }

  return <section className="commercial-identity-workspace" aria-labelledby="enquiries-title">
    <header><div><h2 id="enquiries-title">Enquiries</h2><p>Unqualified opportunities retain permanent EF-ENQ identity. Qualification explicitly chooses an existing or new Client, then creates a Project.</p></div><button type="button" className="ui-button ui-button--primary" onClick={() => setCreating(true)}>+ New Enquiry</button></header>
    {message ? <p className="commercial-identity-workspace__status" role="status">{message}</p> : null}
    {creating ? <section className="ui-card commercial-identity-form" aria-label="New Enquiry">
      <h3>New Enquiry</h3><div className="commercial-identity-form__grid">
        {([['displayName','Name'],['companyName','Company'],['email','Email'],['telephone','Telephone'],['source','Source'],['leadSource','Lead source'],['projectName','Project / site name'],['siteAddress','Site address']] as const).map(([key,label]) => <label key={key}><span>{label}</span><input className="ui-input" value={draft[key]} onChange={(event) => setDraft((current) => ({ ...current, [key]: event.currentTarget.value }))}/></label>)}
        <label className="commercial-identity-form__wide"><span>Notes</span><textarea className="ui-input" rows={3} value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.currentTarget.value }))}/></label>
      </div><footer><button className="ui-button" onClick={() => setCreating(false)}>Cancel</button><button className="ui-button ui-button--primary" disabled={busy || (!draft.displayName.trim() && !draft.companyName.trim())} onClick={() => void create()}>{busy ? "Saving…" : "Create Enquiry"}</button></footer>
    </section> : null}
    <div className="commercial-identity-workspace__layout">
      <nav className="ui-card commercial-identity-list" aria-label="Enquiry list">{enquiries.map((item) => <button type="button" key={item.id} className={item.id === selectedId ? "is-selected" : ""} onClick={() => { setSelectedId(item.id); setProjectName(item.projectName); }}><strong>{item.enquiryRef}</strong><span>{item.companyName || item.displayName}</span><small>{item.status.replaceAll("_", " ")} · {item.projectName || "Project not reviewed"}</small></button>)}{!enquiries.length ? <p>No enquiries yet.</p> : null}</nav>
      <article className="ui-card commercial-identity-detail">{selected ? <>
        <header><div><strong>{selected.enquiryRef}</strong><h3>{selected.companyName || selected.displayName}</h3></div><span className="ui-chip">{selected.status.replaceAll("_", " ")}</span></header>
        <dl><div><dt>Contact</dt><dd>{selected.email || selected.telephone || "Not recorded"}</dd></div><div><dt>Project/site</dt><dd>{selected.projectName || selected.siteAddress || "Needs review"}</dd></div><div><dt>Source</dt><dd>{selected.leadSource || selected.source || "Not recorded"}</dd></div></dl>
        {selected.status === "new" ? <section className="commercial-identity-qualify"><h4>Qualify Enquiry</h4><fieldset><legend>Client decision</legend><label><input type="radio" checked={mode === "existing_client"} onChange={() => setMode("existing_client")}/> Existing Client</label><label><input type="radio" checked={mode === "new_client"} onChange={() => setMode("new_client")}/> New Client</label></fieldset>{mode === "existing_client" ? <label><span>Permanent Client</span><select className="ui-input" value={clientId} onChange={(event) => setClientId(event.currentTarget.value)}><option value="">Select existing Client</option>{clients.filter((client) => client.referenceNamespace !== "demo" && client.referenceNamespace !== "test").map((client) => <option key={client.id} value={client.id}>{client.clientRef} · {clientName(client)}</option>)}</select></label> : <p>A new permanent EF-CL will be allocated only when qualification is confirmed.</p>}<div className="commercial-identity-form__grid"><label><span>Reviewed Project name</span><input className="ui-input" value={projectName} onChange={(event) => setProjectName(event.currentTarget.value)}/></label><label><span>Operational year</span><input className="ui-input" type="number" min="2000" max="2200" value={projectYear} onChange={(event) => setProjectYear(Number(event.currentTarget.value))}/></label></div><button className="ui-button ui-button--primary" disabled={busy || !projectName.trim() || (mode === "existing_client" && !clientId)} onClick={() => void qualify()}>{busy ? "Qualifying…" : "Qualify Enquiry"}</button></section> : <p>Conversion retained: {selected.convertedClientId ? "Client linked" : "Client link pending"} · {selected.convertedProjectId ? "Project linked" : "Project link pending"}.</p>}
        <CanonicalDocumentsPanel enquiryId={selected.id} />
      </> : <p>Select an Enquiry.</p>}</article>
    </div>
  </section>;
}
