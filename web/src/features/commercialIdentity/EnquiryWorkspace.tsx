import { Component, useEffect, useMemo, useRef, useState, type ErrorInfo, type FormEvent, type ReactNode } from "react";
import type { Client } from "../../models/types";
import { communicationsApi } from "../../services/communications/communicationsApi";
import { commercialIdentityApi, type EnquiryAttachmentStorageOutcome, type EnquiryRecord, type EnquirySource } from "../../services/commercialIdentity/commercialIdentityApi";
import CanonicalDocumentsPanel from "../documents/CanonicalDocumentsPanel";
import { claimEnquirySubmission, emptyEnquiryDraft, enquiryDraftHasIdentity, readEnquiryControlValue, releaseEnquirySubmission, updateEnquiryDraft, type EnquiryDraft, type EnquiryDraftField } from "./enquiryFormState";
import "./commercialIdentity.css";

const clientName = (client: Client) => client.type === "Business" ? client.businessName || client.clientName : client.clientName;
type WorkspaceProps = { clients: Client[]; onCommercialIdentityChanged: () => Promise<unknown> | void; onOpenProject?: (clientId: string, projectId: string) => void };
type Outcome = { kind: "success" | "warning" | "error"; title: string; message: string; clientId?: string; projectId?: string; retryFiling?: boolean };

const readableBytes = (value: number) => value >= 1024 * 1024 ? `${(value / (1024 * 1024)).toFixed(1)} MB` : value >= 1024 ? `${Math.round(value / 1024)} KB` : `${value} bytes`;

function storageSummary(storage: EnquiryAttachmentStorageOutcome) {
  if (storage.status === "no_reviewed_attachments") return "No email attachments were selected for filing.";
  if (storage.status === "pending_folder_provisioning") return "The Client and Project were saved. Attachment filing is waiting for connected storage and can be retried safely.";
  const storedNames = storage.files.filter((file) => ["stored", "reused"].includes(file.status)).map((file) => file.fileName);
  const failedNames = storage.files.filter((file) => file.status === "failed").map((file) => file.fileName);
  const saved = storedNames.length ? `${storedNames.length} file${storedNames.length === 1 ? "" : "s"} saved or reused: ${storedNames.join(", ")}.` : "No files were saved.";
  const failed = failedNames.length ? ` ${failedNames.length} file${failedNames.length === 1 ? "" : "s"} still need attention: ${failedNames.join(", ")}.` : "";
  return `${saved}${storage.folderPath ? ` Destination: ${storage.folderPath}.` : ""}${failed}`;
}

class EnquiryFeatureBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("Enquiry workspace could not render", { message: error.message, componentStack: info.componentStack }); }
  render() {
    if (this.state.failed) return <section className="ui-card commercial-identity-workspace commercial-identity-workspace--failed" role="alert"><h2>Enquiries are temporarily unavailable</h2><p>The Enquiry workspace was contained; other QuoteSuite areas remain available.</p><button type="button" className="ui-button" onClick={() => this.setState({ failed: false })}>Try Enquiries again</button></section>;
    return this.props.children;
  }
}

function EnquiryWorkspaceContent({ clients, onCommercialIdentityChanged, onOpenProject }: WorkspaceProps) {
  const [enquiries, setEnquiries] = useState<EnquiryRecord[]>([]), [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EnquiryDraft>(emptyEnquiryDraft), [creating, setCreating] = useState(false), [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"existing_client" | "new_client">("existing_client"), [clientId, setClientId] = useState("");
  const [projectName, setProjectName] = useState(""), [projectYear, setProjectYear] = useState(new Date().getFullYear()), [message, setMessage] = useState("");
  const [nextAction, setNextAction] = useState(""), [nextActionDate, setNextActionDate] = useState(""), [waitingFor, setWaitingFor] = useState<"none" | "staff" | "customer" | "supplier">("none"), [savingNextAction, setSavingNextAction] = useState(false);
  const [source, setSource] = useState<EnquirySource | null>(null), [sourceLoading, setSourceLoading] = useState(false), [sourceError, setSourceError] = useState("");
  const [outcome, setOutcome] = useState<Outcome | null>(null), [retryingFiles, setRetryingFiles] = useState(false);
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
    setProjectName(selected?.projectName || "");
    setClientId("");
    setMode("existing_client");
  }, [selected?.id, selected?.projectName]);
  useEffect(() => {
    setNextAction(selected?.nextAction || "");
    setNextActionDate(String(selected?.nextActionDueAt || "").slice(0, 10));
    setWaitingFor(selected?.waitingFor || "none");
  }, [selected?.id, selected?.nextAction, selected?.nextActionDueAt, selected?.waitingFor]);
  useEffect(() => {
    let active = true;
    setSource(null); setSourceError(""); setOutcome(null);
    if (!selected?.id) return () => { active = false; };
    setSourceLoading(true);
    void commercialIdentityApi.enquirySource(selected.id).then((value) => { if (active) setSource(value); }).catch((error) => {
      if (active) setSourceError(`${error instanceof Error ? error.message : "The Enquiry source could not be loaded."} The Enquiry itself is still available; try again after checking Email.`);
    }).finally(() => { if (active) setSourceLoading(false); });
    return () => { active = false; };
  }, [selected?.id]);

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
    setBusy(true); setMessage("Connecting Enquiry and preparing its files…"); setOutcome(null);
    try {
      const result = await commercialIdentityApi.qualifyEnquiry(selected.id, {
        mode,
        clientId: mode === "existing_client" ? clientId : undefined,
        client: mode === "new_client" ? { name: selected.displayName || selected.companyName, companyName: selected.companyName, email: selected.email, telephone: selected.telephone } : undefined,
        project: { name: projectName, contextYear: projectYear, siteAddress: selected.siteAddress },
      });
      const partial = ["partial_failure", "failed", "pending_folder_provisioning"].includes(result.attachmentStorage.status);
      setMessage("");
      setOutcome({
        kind: partial ? "warning" : "success",
        title: partial ? "Client and Project connected; some file work remains" : "Enquiry connected",
        message: `${result.enquiry.enquiryRef} is linked to ${result.client.clientRef} · ${result.project.name}. ${result.driveProvisioning.message} ${storageSummary(result.attachmentStorage)} Next: review the retained files, then prepare the Estimate.`,
        clientId: result.client.id,
        projectId: result.project.id,
        retryFiling: partial,
      });
      await Promise.all([load(), onCommercialIdentityChanged()]);
      setSource(await commercialIdentityApi.enquirySource(selected.id));
    } catch (error) {
      setMessage("");
      setOutcome({ kind: "error", title: "Enquiry was not connected", message: `${error instanceof Error ? error.message : "Enquiry qualification failed."} Your choices are still here. Review them and try again safely.` });
    }
    finally { releaseEnquirySubmission(submissionLock); setBusy(false); }
  }

  async function retryFileStorage() {
    if (!selected || retryingFiles) return;
    setRetryingFiles(true); setMessage("Checking the destination and filing the retained attachments…");
    try {
      const result = await commercialIdentityApi.fileEnquiryAttachments(selected.id);
      const partial = ["partial_failure", "failed", "pending_folder_provisioning"].includes(result.attachmentStorage.status);
      setMessage("");
      setOutcome({ kind: partial ? "warning" : "success", title: partial ? "Some file work still remains" : "Enquiry files are ready", message: `${storageSummary(result.attachmentStorage)} ${partial ? "Completed files were preserved; reconnect storage or review the failed file, then retry safely." : "Next: review the filed evidence, then prepare the Estimate."}`, clientId: result.enquiry.convertedClientId || undefined, projectId: result.enquiry.convertedProjectId || undefined, retryFiling: partial });
      setSource(await commercialIdentityApi.enquirySource(selected.id));
      await load();
    } catch (error) {
      setMessage("");
      setOutcome({ kind: "error", title: "Files were not confirmed", message: `${error instanceof Error ? error.message : "The reviewed attachments could not be filed."} Existing Client, Project and saved files were preserved. Check the provider connection and retry safely.`, retryFiling: true });
    } finally { setRetryingFiles(false); }
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
    {outcome ? <section className={`commercial-identity-outcome commercial-identity-outcome--${outcome.kind}`} role={outcome.kind === "error" ? "alert" : "status"}><div><strong>{outcome.title}</strong><p>{outcome.message}</p></div><div className="commercial-identity-outcome__actions">{outcome.clientId && outcome.projectId && onOpenProject ? <button type="button" className="ui-button" onClick={() => onOpenProject(outcome.clientId!, outcome.projectId!)}>Open Client / Project</button> : null}<button type="button" className="ui-button" onClick={() => document.getElementById("enquiry-files")?.scrollIntoView({ behavior: "smooth", block: "start" })}>Review files</button>{outcome.retryFiling ? <button type="button" className="ui-button ui-button--primary" disabled={retryingFiles} onClick={() => void retryFileStorage()}>{retryingFiles ? "Filing attachments…" : "Retry filing"}</button> : null}</div></section> : null}
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
        <section className="commercial-identity-source" aria-labelledby="enquiry-source-title"><div><h4 id="enquiry-source-title">Enquiry context</h4><p>Review the retained request and files before deciding how to connect it.</p></div>{sourceLoading ? <p role="status">Loading the originating evidence…</p> : sourceError ? <div className="commercial-identity-source__notice" role="alert"><p>{sourceError}</p><button type="button" className="ui-button" onClick={() => { setSourceError(""); setSourceLoading(true); void commercialIdentityApi.enquirySource(selected.id).then(setSource).catch((error) => setSourceError(error instanceof Error ? error.message : "The source could not be loaded.")).finally(() => setSourceLoading(false)); }}>Try source again</button></div> : source ? <>{source.message ? <p className="commercial-identity-source__notice">{source.message}</p> : null}{source.original ? <><div className="commercial-identity-source__message"><div><span>From</span><strong>{source.original.sender}</strong></div><div><span>Subject</span><strong>{source.original.subject}</strong></div><div><span>Received</span><strong>{new Date(source.original.receivedAt).toLocaleString()}</strong></div></div>{source.overview ? <div className="commercial-identity-source__overview"><strong>{source.overview.label}</strong><p>{source.overview.text}</p><small>This retained intake overview is separate from the original email below.</small></div> : <p>No separate overview was retained. Use the original email below.</p>}<details className="commercial-identity-source__original"><summary>View original email</summary>{source.original.bodyText ? <div className="commercial-identity-source__body">{source.original.bodyText}</div> : <p>The exact message relationship is retained, but no readable body text is available.</p>}</details><div className="commercial-identity-source__attachments"><h5>Supplied attachments</h5>{source.attachments.filter((item) => !item.inline).length ? source.attachments.filter((item) => !item.inline).map((attachment) => <article key={attachment.id}><div><strong>{attachment.fileName}</strong><small>{attachment.classification === "image_attachment" ? "Image attachment" : "Document attachment"} · {attachment.mediaType} · {readableBytes(attachment.sizeBytes)}</small><small>{attachment.selectedForFiling ? attachment.storageStatus === "stored" ? `Filed${attachment.folderPath ? ` to ${attachment.folderPath}` : ""}` : attachment.storageStatus === "failed" ? "Selected for filing · last attempt needs attention" : "Selected for filing when this Enquiry is connected" : "Retained with the email · not selected for filing"}</small></div><div>{attachment.providerAvailable && source.original?.providerMessageId && attachment.providerAttachmentId ? <><a className="ui-button" href={communicationsApi.attachmentUrl(source.original.providerMessageId, attachment.providerAttachmentId, attachment)} target="_blank" rel="noreferrer">{attachment.mediaType.startsWith("image/") || attachment.mediaType === "application/pdf" ? "Preview" : "Open"}</a><a className="ui-button" href={communicationsApi.attachmentUrl(source.original.providerMessageId, attachment.providerAttachmentId, attachment, true)}>Download</a></> : attachment.webViewLink ? <a className="ui-button" href={attachment.webViewLink} target="_blank" rel="noreferrer">Open filed copy</a> : <small>File content is unavailable until Email is reconnected.</small>}</div></article>) : <p>No genuine supplied attachments were retained for this Enquiry.</p>}{source.attachments.some((item) => item.inline) ? <details><summary>View inline signature resources ({source.attachments.filter((item) => item.inline).length})</summary><ul>{source.attachments.filter((item) => item.inline).map((item) => <li key={item.id}>{item.fileName} · not treated as a supplied document</li>)}</ul></details> : null}<p>Selected files are saved to the Project’s Drawings (Client) folder. A retry reuses the same retained attachment; QuoteSuite does not silently overwrite a same-name file.</p></div></> : <p>{source.message || "This Enquiry has no originating email. Continue using the details recorded above."}</p>}</> : null}</section>
        <section className="commercial-identity-next-action" aria-labelledby="enquiry-next-action-title"><div><h4 id="enquiry-next-action-title">Next action</h4><p>Record what should happen next and who QuoteSuite is waiting on.</p></div><div className="commercial-identity-form__grid"><label><span>Action</span><input className="ui-input" value={nextAction} onChange={(event) => setNextAction(event.currentTarget.value)} /></label><label><span>Due date</span><input className="ui-input" type="date" value={nextActionDate} onChange={(event) => setNextActionDate(event.currentTarget.value)} /></label><label><span>Waiting on</span><select className="ui-input" value={waitingFor} onChange={(event) => setWaitingFor(event.currentTarget.value as typeof waitingFor)}><option value="none">No one</option><option value="staff">Our team</option><option value="customer">Customer</option><option value="supplier">Supplier</option></select></label><label><span>Responsible person</span><input className="ui-input" value={selected.ownerName || "User"} readOnly /></label></div><button type="button" className="ui-button ui-button--primary" disabled={savingNextAction || !nextAction.trim()} onClick={() => void saveNextAction()}>{savingNextAction ? "Saving next action…" : "Save next action"}</button></section>
        {selected.status === "new" ? <section className="commercial-identity-qualify"><h4>Connect this Enquiry</h4>{likelyClientMatches.length ? <div className="commercial-identity-matches"><strong>Possible existing Clients</strong>{likelyClientMatches.map((match) => <article key={match.client.id}><div><span>{match.client.clientRef} · {clientName(match.client)}</span><small>{match.evidence.join(" · ")}</small>{match.conflict ? <small>{match.conflict} Review both records before continuing.</small> : null}</div><button type="button" className="ui-button" onClick={() => { setMode("existing_client"); setClientId(match.client.id); }}>Use this Client</button></article>)}</div> : <p>No likely existing Client was found from the recorded name, email or Project. You can still choose one below.</p>}<fieldset><legend>Client choice</legend><label><input type="radio" checked={mode === "existing_client"} onChange={() => setMode("existing_client")}/> Link an existing Client</label><label><input type="radio" checked={mode === "new_client"} onChange={() => setMode("new_client")}/> Create a new Client</label></fieldset>{mode === "existing_client" ? <label><span>Client</span><select className="ui-input" value={clientId} onChange={(event) => { const value = readEnquiryControlValue(event.currentTarget); setClientId(value); }}><option value="">Select existing Client</option>{clients.filter((client) => client.referenceNamespace !== "demo" && client.referenceNamespace !== "test").map((client) => <option key={client.id} value={client.id}>{client.clientRef} · {clientName(client)}</option>)}</select></label> : <p>A new Client record will be created when you continue. The Enquiry and its evidence will stay linked.</p>}<div className="commercial-identity-form__grid"><label><span>Project name</span><input className="ui-input" value={projectName} onChange={(event) => { const value = readEnquiryControlValue(event.currentTarget); setProjectName(value); }}/></label><label><span>Operational year</span><input className="ui-input" type="number" min="2000" max="2200" value={projectYear} onChange={(event) => { const value = readEnquiryControlValue(event.currentTarget); setProjectYear(Number(value)); }}/></label></div><button type="button" className="ui-button ui-button--primary" disabled={busy || !projectName.trim() || (mode === "existing_client" && !clientId)} onClick={() => void qualify()}>{busy ? "Connecting Enquiry…" : "Continue to Project"}</button></section> : <p>Connected to {selected.convertedClientId ? "a Client" : "Client link pending"} and {selected.convertedProjectId ? "a Project" : "Project link pending"}. The Enquiry history is retained.</p>}
        <div id="enquiry-files"><CanonicalDocumentsPanel enquiryId={selected.id} /></div>
      </> : <p>Select an Enquiry.</p>}</article>
    </div>
  </section>;
}

export function EnquiryWorkspace(props: WorkspaceProps) {
  return <EnquiryFeatureBoundary><EnquiryWorkspaceContent {...props} /></EnquiryFeatureBoundary>;
}
