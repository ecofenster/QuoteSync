import { Component, useEffect, useMemo, useRef, useState, type ErrorInfo, type FormEvent, type ReactNode } from "react";
import type { Client } from "../../models/types";
import { commercialIdentityApi, type EnquiryRecord } from "../../services/commercialIdentity/commercialIdentityApi";
import CanonicalDocumentsPanel from "../documents/CanonicalDocumentsPanel";
import { claimEnquirySubmission, emptyEnquiryDraft, enquiryDraftHasIdentity, readEnquiryControlValue, releaseEnquirySubmission, updateEnquiryDraft, type EnquiryDraft, type EnquiryDraftField } from "./enquiryFormState";
import "./commercialIdentity.css";

const clientName = (client: Client) => client.type === "Business" ? client.businessName || client.clientName : client.clientName;
type WorkspaceProps = { clients: Client[]; onCommercialIdentityChanged: () => Promise<unknown> | void };

class EnquiryFeatureBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("Enquiry workspace could not render", { message: error.message, componentStack: info.componentStack }); }
  render() {
    if (this.state.failed) return <section className="ui-card commercial-identity-workspace commercial-identity-workspace--failed" role="alert"><h2>Enquiries are temporarily unavailable</h2><p>The Enquiry workspace was contained; other QuoteSuite areas remain available.</p><button type="button" className="ui-button" onClick={() => this.setState({ failed: false })}>Try Enquiries again</button></section>;
    return this.props.children;
  }
}

function EnquiryWorkspaceContent({ clients, onCommercialIdentityChanged }: WorkspaceProps) {
  const [enquiries, setEnquiries] = useState<EnquiryRecord[]>([]), [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EnquiryDraft>(emptyEnquiryDraft), [creating, setCreating] = useState(false), [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"existing_client" | "new_client">("existing_client"), [clientId, setClientId] = useState("");
  const [projectName, setProjectName] = useState(""), [projectYear, setProjectYear] = useState(new Date().getFullYear()), [message, setMessage] = useState("");
  const [nextAction, setNextAction] = useState(""), [nextActionDate, setNextActionDate] = useState(""), [waitingFor, setWaitingFor] = useState<"none" | "staff" | "customer" | "supplier">("none"), [savingNextAction, setSavingNextAction] = useState(false);
  const submissionLock = useRef(false);
  const selected = useMemo(() => enquiries.find((item) => item.id === selectedId) || null, [enquiries, selectedId]);
  const likelyClientMatches = useMemo(() => {
    if (!selected) return [];
    const enquiryName = String(selected.companyName || selected.displayName || "").trim().toLowerCase();
    const enquiryEmail = String(selected.email || "").trim().toLowerCase();
    return clients.map((client) => {
      const existingName = clientName(client).trim().toLowerCase();
      const exactEmail = Boolean(enquiryEmail && client.email.trim().toLowerCase() === enquiryEmail);
      const exactName = Boolean(enquiryName && existingName === enquiryName);
      const projectEvidence = Boolean(selected.projectName && client.projectName && selected.projectName.trim().toLowerCase() === client.projectName.trim().toLowerCase());
      const evidence = [exactEmail ? `Same email address: ${selected.email}` : "", exactName ? "Same customer name" : "", projectEvidence ? `Same Project name: ${selected.projectName}` : ""].filter(Boolean);
      const conflict = exactEmail && enquiryName && existingName !== enquiryName ? `The email matches, but this Client is named ${clientName(client)}.` : "";
      return { client, score: (exactEmail ? 100 : 0) + (exactName ? 50 : 0) + (projectEvidence ? 20 : 0), evidence, conflict };
    }).filter((match) => match.score > 0).sort((left, right) => right.score - left.score).slice(0, 4);
  }, [clients, selected]);
  const load = async () => { const rows = await commercialIdentityApi.listEnquiries(); setEnquiries(rows); setSelectedId((current) => current && rows.some((item) => item.id === current) ? current : rows[0]?.id || null); };
  useEffect(() => { void load().catch((error) => setMessage(error instanceof Error ? error.message : "Enquiries could not be loaded.")); }, []);
  useEffect(() => {
    const open = (event: Event) => {
      const id = String((event as CustomEvent<{ id?: string }>).detail?.id || "").trim();
      if (id) setSelectedId(id);
    };
    const create = () => setCreating(true);
    window.addEventListener("quotesuite:open-enquiry", open);
    window.addEventListener("quotesuite:new-enquiry", create);
    return () => { window.removeEventListener("quotesuite:open-enquiry", open); window.removeEventListener("quotesuite:new-enquiry", create); };
  }, []);
  useEffect(() => {
    setNextAction(selected?.nextAction || "");
    setNextActionDate(String(selected?.nextActionDueAt || "").slice(0, 10));
    setWaitingFor(selected?.waitingFor || "none");
  }, [selected?.id, selected?.nextAction, selected?.nextActionDueAt, selected?.waitingFor]);

  function setDraftValue(field: EnquiryDraftField, control: Pick<HTMLInputElement | HTMLTextAreaElement, "value">) {
    const value = readEnquiryControlValue(control);
    setDraft((current) => updateEnquiryDraft(current, field, value));
  }

  async function create() {
    if (!enquiryDraftHasIdentity(draft) || !claimEnquirySubmission(submissionLock)) return;
    setBusy(true); setMessage("");
    try { const value = await commercialIdentityApi.createEnquiry({ ...draft }); setDraft(emptyEnquiryDraft()); setCreating(false); await load(); setSelectedId(value.id); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Enquiry could not be created."); }
    finally { releaseEnquirySubmission(submissionLock); setBusy(false); }
  }

  async function qualify() {
    if (!selected || !projectName.trim() || (mode === "existing_client" && !clientId) || !claimEnquirySubmission(submissionLock)) return;
    setBusy(true); setMessage("");
    try {
      const result = await commercialIdentityApi.qualifyEnquiry(selected.id, {
        mode,
        clientId: mode === "existing_client" ? clientId : undefined,
        client: mode === "new_client" ? { name: selected.displayName || selected.companyName, companyName: selected.companyName, email: selected.email, telephone: selected.telephone } : undefined,
        project: { name: projectName, contextYear: projectYear, siteAddress: selected.siteAddress },
      });
      setMessage(`${result.enquiry.enquiryRef} qualified to ${result.client.clientRef} · ${result.project.name}. ${result.driveProvisioning.message}`);
      await Promise.all([load(), onCommercialIdentityChanged()]);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Enquiry qualification failed."); }
    finally { releaseEnquirySubmission(submissionLock); setBusy(false); }
  }

  async function saveNextAction() {
    if (!selected || !nextAction.trim()) return;
    setSavingNextAction(true); setMessage("Saving next action…");
    try {
      await commercialIdentityApi.updateWorkState("enquiry", selected.id, { nextAction: nextAction.trim(), dueAt: nextActionDate ? `${nextActionDate}T09:00:00.000Z` : null, waitingFor });
      await load();
      setSelectedId(selected.id);
      setMessage(`Next action saved for ${selected.enquiryRef}.`);
    } catch (error) { setMessage(`${error instanceof Error ? error.message : "The next action could not be saved."} Your Enquiry is unchanged; review the details and try again.`); }
    finally { setSavingNextAction(false); }
  }

  function submitCreate(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void create(); }

  return <section className="commercial-identity-workspace" aria-labelledby="enquiries-title">
    <header><div><h2 id="enquiries-title">Enquiries</h2><p>Capture the request, check the customer, choose the responsible person and keep the next action visible.</p></div><button type="button" className="ui-button ui-button--primary" onClick={() => setCreating(true)}>New Enquiry</button></header>
    {message ? <p className="commercial-identity-workspace__status" role="status">{message}</p> : null}
    {creating ? <form className="ui-card commercial-identity-form" aria-label="New Enquiry" onSubmit={submitCreate}>
      <h3>New Enquiry</h3><div className="commercial-identity-form__grid">
        {([['displayName','Name'],['companyName','Company'],['email','Email'],['telephone','Telephone'],['source','Source'],['leadSource','Lead source'],['projectName','Project / site name'],['siteAddress','Site address']] as const).map(([key,label]) => <label key={key}><span>{label}</span><input className="ui-input" value={draft[key]} onChange={(event) => setDraftValue(key, event.currentTarget)}/></label>)}
        <label className="commercial-identity-form__wide"><span>Notes</span><textarea className="ui-input" rows={3} value={draft.notes} onChange={(event) => setDraftValue("notes", event.currentTarget)}/></label>
      </div><footer><button type="button" className="ui-button" onClick={() => setCreating(false)}>Cancel</button><button type="submit" className="ui-button ui-button--primary" disabled={busy || !enquiryDraftHasIdentity(draft)}>{busy ? "Saving…" : "Create Enquiry"}</button></footer>
    </form> : null}
    <div className="commercial-identity-workspace__layout">
      <nav className="ui-card commercial-identity-list" aria-label="Enquiry list">{enquiries.map((item) => <button type="button" key={item.id} className={item.id === selectedId ? "is-selected" : ""} onClick={() => { setSelectedId(item.id); setProjectName(item.projectName); }}><strong>{item.enquiryRef}</strong><span>{item.companyName || item.displayName}</span><small>{item.status.replaceAll("_", " ")} · {item.projectName || "Project not reviewed"}</small></button>)}{!enquiries.length ? <p>No enquiries yet.</p> : null}</nav>
      <article className="ui-card commercial-identity-detail">{selected ? <>
        <header><div><strong>{selected.enquiryRef}</strong><h3>{selected.companyName || selected.displayName}</h3></div><span className="ui-chip">{selected.status.replaceAll("_", " ")}</span></header>
        <dl><div><dt>Contact</dt><dd>{selected.email || selected.telephone || "Not recorded"}</dd></div><div><dt>Project/site</dt><dd>{selected.projectName || selected.siteAddress || "Needs review"}</dd></div><div><dt>Source</dt><dd>{selected.leadSource || selected.source || "Not recorded"}</dd></div><div><dt>Responsible person</dt><dd>{selected.ownerName || "User"}</dd></div><div><dt>Next action</dt><dd>{selected.nextAction || "Not set"}{selected.nextActionDueAt ? ` · ${new Date(selected.nextActionDueAt).toLocaleDateString()}` : ""}</dd></div></dl>
        <section className="commercial-identity-next-action" aria-labelledby="enquiry-next-action-title"><div><h4 id="enquiry-next-action-title">Next action</h4><p>Record what should happen next and who QuoteSuite is waiting on.</p></div><div className="commercial-identity-form__grid"><label><span>Action</span><input className="ui-input" value={nextAction} onChange={(event) => setNextAction(event.currentTarget.value)} /></label><label><span>Due date</span><input className="ui-input" type="date" value={nextActionDate} onChange={(event) => setNextActionDate(event.currentTarget.value)} /></label><label><span>Waiting on</span><select className="ui-input" value={waitingFor} onChange={(event) => setWaitingFor(event.currentTarget.value as typeof waitingFor)}><option value="none">No one</option><option value="staff">Our team</option><option value="customer">Customer</option><option value="supplier">Supplier</option></select></label><label><span>Responsible person</span><input className="ui-input" value={selected.ownerName || "User"} readOnly /></label></div><button type="button" className="ui-button ui-button--primary" disabled={savingNextAction || !nextAction.trim()} onClick={() => void saveNextAction()}>{savingNextAction ? "Saving next action…" : "Save next action"}</button></section>
        {selected.status === "new" ? <section className="commercial-identity-qualify"><h4>Connect this Enquiry</h4>{likelyClientMatches.length ? <div className="commercial-identity-matches"><strong>Possible existing Clients</strong>{likelyClientMatches.map((match) => <article key={match.client.id}><div><span>{match.client.clientRef} · {clientName(match.client)}</span><small>{match.evidence.join(" · ")}</small>{match.conflict ? <small>{match.conflict} Review both records before continuing.</small> : null}</div><button type="button" className="ui-button" onClick={() => { setMode("existing_client"); setClientId(match.client.id); }}>Use this Client</button></article>)}</div> : <p>No likely existing Client was found from the recorded name, email or Project. You can still choose one below.</p>}<fieldset><legend>Client choice</legend><label><input type="radio" checked={mode === "existing_client"} onChange={() => setMode("existing_client")}/> Link an existing Client</label><label><input type="radio" checked={mode === "new_client"} onChange={() => setMode("new_client")}/> Create a new Client</label></fieldset>{mode === "existing_client" ? <label><span>Client</span><select className="ui-input" value={clientId} onChange={(event) => { const value = readEnquiryControlValue(event.currentTarget); setClientId(value); }}><option value="">Select existing Client</option>{clients.filter((client) => client.referenceNamespace !== "demo" && client.referenceNamespace !== "test").map((client) => <option key={client.id} value={client.id}>{client.clientRef} · {clientName(client)}</option>)}</select></label> : <p>A new Client record will be created when you continue. The Enquiry and its evidence will stay linked.</p>}<div className="commercial-identity-form__grid"><label><span>Project name</span><input className="ui-input" value={projectName} onChange={(event) => { const value = readEnquiryControlValue(event.currentTarget); setProjectName(value); }}/></label><label><span>Operational year</span><input className="ui-input" type="number" min="2000" max="2200" value={projectYear} onChange={(event) => { const value = readEnquiryControlValue(event.currentTarget); setProjectYear(Number(value)); }}/></label></div><button type="button" className="ui-button ui-button--primary" disabled={busy || !projectName.trim() || (mode === "existing_client" && !clientId)} onClick={() => void qualify()}>{busy ? "Connecting Enquiry…" : "Continue to Project"}</button></section> : <p>Connected to {selected.convertedClientId ? "a Client" : "Client link pending"} and {selected.convertedProjectId ? "a Project" : "Project link pending"}. The Enquiry history is retained.</p>}
        <CanonicalDocumentsPanel enquiryId={selected.id} />
      </> : <p>Select an Enquiry.</p>}</article>
    </div>
  </section>;
}

export function EnquiryWorkspace(props: WorkspaceProps) {
  return <EnquiryFeatureBoundary><EnquiryWorkspaceContent {...props} /></EnquiryFeatureBoundary>;
}
