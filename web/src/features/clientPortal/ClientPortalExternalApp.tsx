import { useEffect, useMemo, useState } from "react";
import { apiUrl, extractApiErrorMessage } from "../../services/api/apiClient";
import "./clientPortalExternal.css";

type Session = { projectId: string; clientId: string; portalContactId: string };
type SafePosition = { id: string; reference: string; description: string | null; quantity: number };
type SafeEstimate = {
  releaseId: string; estimateRef: string; revisionNo: number; issuedAt: string; immutable: boolean;
  status: "issued" | "superseded";
  document: { id: string; fileName: string };
  commercial: { supplyOnly: number | null; installation: number | null; vatGbp: number | null; totalIncVatGbp: number | null; currency: string };
  positions: SafePosition[];
};
type FactoryConfirmation = { releaseId: string; orderRef: string; revision: string; signedOff: boolean; positions: Array<{ estimatePositionId: string; positionReference: string }> };
type Portal = {
  access: { displayName: string }; client: { reference: string; displayName: string }; project: { id: string; name: string; status: string };
  features: Array<{ featureKey: string; enabled: boolean }>; estimates: SafeEstimate[];
  orders: Array<{ id: string; orderRef: string; status: string; createdAt: string }>; factoryConfirmations: FactoryConfirmation[];
  commitmentPrompt: { informational: true; issuedRevisionCount: number; suggestedPercentage: string; message: string } | null;
  documents: Array<{ id: string; fileName: string; documentType: string; downloadUrl: string | null }>;
};
type ReviewResponse = "accepted_as_shown" | "amendment_requested" | "question_comment";
type ReviewEntry = { response: ReviewResponse; comment: string };

const request = async (path: string, options: RequestInit = {}) => {
  const response = await fetch(apiUrl(path), { ...options, credentials: "include", headers: { "Content-Type": "application/json", ...(options.headers || {}) } });
  if (!response.ok) throw new Error(extractApiErrorMessage(response.status, await response.text()));
  return response.json();
};
const commandKey = () => globalThis.crypto.randomUUID();
const money = (value: number | null) => value == null ? "Not available" : new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(value);
const reviewDefaults = (estimate: SafeEstimate | null): Record<string, ReviewEntry> => Object.fromEntries((estimate?.positions || []).map((position) => [position.id, { response: "accepted_as_shown", comment: "" }]));

export default function ClientPortalExternalApp() {
  const invitationToken = useMemo(() => new URLSearchParams(location.hash.split("?")[1] || "").get("token") || "", []);
  const [email, setEmail] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [csrf, setCsrf] = useState("");
  const [portal, setPortal] = useState<Portal | null>(null);
  const [selected, setSelected] = useState<SafeEstimate | null>(null);
  const [mode, setMode] = useState<"dashboard" | "review" | "decline" | "accept">("dashboard");
  const [generalComment, setGeneralComment] = useState("");
  const [generalResponse, setGeneralResponse] = useState<"comment_only" | "amendment_requested">("comment_only");
  const [reviewEntries, setReviewEntries] = useState<Record<string, ReviewEntry>>({});
  const [acceptedPositions, setAcceptedPositions] = useState<Record<string, boolean>>({});
  const [overallAccepted, setOverallAccepted] = useState(false);
  const [confirmationPositions, setConfirmationPositions] = useState<Record<string, boolean>>({});
  const [overallConfirmation, setOverallConfirmation] = useState(false);
  const [declineReason, setDeclineReason] = useState("cost");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const enabled = (name: string) => portal?.features.some((item) => item.featureKey === name && item.enabled) ?? false;

  function adoptProjection(projection: Portal) {
    const estimate = projection.estimates.find((item)=>item.status==="issued") || null;
    setPortal(projection); setSelected(estimate); setReviewEntries(reviewDefaults(estimate));
    setAcceptedPositions({}); setOverallAccepted(false); setConfirmationPositions({}); setOverallConfirmation(false); setGeneralResponse("comment_only"); setGeneralComment("");
  }

  useEffect(() => {
    let active=true;
    request("/api/client-portal/external/session").then(async(value)=>{
      if(!active)return;const csrfToken=sessionStorage.getItem("qs_portal_csrf")||"",preferred=sessionStorage.getItem("qs_portal_project"),project=value.session.projects.find((item:{id:string})=>item.id===preferred)||value.session.projects[0];if(!project)return;const restored={projectId:project.id,clientId:value.session.clientId,portalContactId:value.session.portalContactId};setSession(restored);setCsrf(csrfToken);adoptProjection(await request(`/api/client-portal/external/projects/${encodeURIComponent(project.id)}`));
    }).catch(()=>{});
    return()=>{active=false};
  }, []); // Existing HttpOnly customer session recovery; invitation remains the first-access boundary.

  async function signIn() {
    setBusy(true); setMessage("");
    try {
      const accepted = await request("/api/client-portal/external/invitations/accept", { method: "POST", body: JSON.stringify({ token: invitationToken, identityAssertion: { email } }) });
      setSession(accepted.session); setCsrf(accepted.csrfToken); sessionStorage.setItem("qs_portal_csrf",accepted.csrfToken); sessionStorage.setItem("qs_portal_project",accepted.session.projectId);
      adoptProjection(await request(`/api/client-portal/external/projects/${encodeURIComponent(accepted.session.projectId)}`));
    } catch (error) { setMessage(error instanceof Error ? error.message : "Portal access failed."); }
    finally { setBusy(false); }
  }

  async function command(path: string, body: unknown) {
    if (!session || !csrf) return;
    const submittedMode=mode;
    setBusy(true); setMessage("");
    try {
      const result = await request(path, { method: "POST", headers: { "X-Portal-CSRF": csrf, "Idempotency-Key": commandKey() }, body: JSON.stringify(body) });
      adoptProjection(await request(`/api/client-portal/external/projects/${encodeURIComponent(session.projectId)}`));
      const reference=result.orderRef||result.commandId||result.acceptanceId||result.signoffId||result.decisionId||"available";
      setMessage(path.includes("factory-confirmations")?`Final confirmation approved. Reference ${reference}. Next: the project team records any signed document and continues delivery planning.`:submittedMode==="accept"?`Estimate accepted. Order ${result.orderRef||reference} was created and is waiting for staff approval. No factory order was sent.`:submittedMode==="decline"?`Estimate rejected. Reference ${reference}. No Order was created; the project team can review your reason and next step.`:`Response recorded. Reference ${reference}. Next: the project team reviews your comments or requested changes.`);
      setMode("dashboard");
    } catch (error) { setMessage(error instanceof Error ? error.message : "The request could not be recorded."); }
    finally { setBusy(false); }
  }

  if (!session || !portal) return <main className="portal-external"><section className="portal-external__login ui-card"><span className="ui-eyebrow">QuoteSuite Client Portal · controlled test access</span><h1>Open your Project</h1><p>This development adapter uses a real invitation, Project grant, HttpOnly session and server-side customer projection. It cannot run in production.</p>{!invitationToken ? <div className="ui-status ui-status--error">A valid invitation link is required.</div> : null}<label>Email used for the test invitation<input className="ui-input" type="email" value={email} onChange={(event) => setEmail(event.currentTarget.value)} /></label>{message ? <div className="ui-status ui-status--error" role="alert">{message}</div> : null}<button className="ui-button ui-button--primary" disabled={busy || !email || !invitationToken} onClick={() => void signIn()}>{busy ? "Checking access…" : "Continue securely"}</button></section></main>;

  const estimate = selected;
  const reviewReady = Boolean(estimate?.positions.length) && estimate!.positions.every((position) => { const entry = reviewEntries[position.id]; return entry && (entry.response === "accepted_as_shown" || entry.comment.trim().length > 0); });
  const acceptanceReady = Boolean(estimate?.positions.length) && overallAccepted && estimate!.positions.every((position) => acceptedPositions[position.id]);

  return <main className="portal-external">
    <header className="portal-external__header"><div><span className="ui-eyebrow">Client Portal · test journey</span><h1>{portal.project.name}</h1><p>{portal.client.reference} · {portal.client.displayName}</p></div><span className="ui-status ui-status--warning">Test records and delivery allowlist only</span></header>
    {message ? <div className="ui-status" role="status">{message}</div> : null}
    <nav className="portal-external__nav"><button className="ui-button ui-button--primary">Dashboard</button><button className="ui-button ui-button--ghost">Estimates</button><button className="ui-button ui-button--ghost">Orders</button><button className="ui-button ui-button--ghost">Documents</button></nav>
    {portal.commitmentPrompt ? <aside className="portal-external__commitment ui-card"><span className="ui-eyebrow">Estimating commitment · information only</span><strong>{portal.commitmentPrompt.suggestedPercentage}% suggested commitment</strong><p>{portal.commitmentPrompt.message}</p><small>No charge, contract or acceptance gate has been applied.</small></aside> : null}
    {estimate ? <section className="portal-external__estimate ui-card"><div><span className="ui-eyebrow">Latest issued Estimate</span><h2>{estimate.estimateRef} · Revision {estimate.revisionNo}</h2><p>Immutable offer issued {new Date(estimate.issuedAt).toLocaleDateString("en-GB")}</p></div><div className="portal-external__totals">{[["Supply Only", estimate.commercial.supplyOnly], ["Installation", estimate.commercial.installation], ["VAT", estimate.commercial.vatGbp], ["Total", estimate.commercial.totalIncVatGbp]].map(([label, value]) => <article className="ui-card" key={String(label)}><span>{label}</span><strong>{money(value as number | null)}</strong></article>)}</div><div className="ui-action-row"><a className="ui-button ui-button--ghost" href={apiUrl(`/api/client-portal/external/projects/${session.projectId}/documents/${estimate.document.id}/content`)} target="_blank" rel="noreferrer">View issued Estimate</a>{enabled("review_estimate") ? <button className="ui-button ui-button--primary" onClick={() => setMode("review")}>Review Estimate</button> : null}{enabled("accept_estimate") && !portal.orders.length ? <button className="ui-button ui-button--ghost" onClick={() => setMode("accept")}>Accept Estimate</button> : null}{enabled("decline_estimate") && !portal.orders.length ? <button className="ui-button ui-button--danger" onClick={() => setMode("decline")}>Reject</button> : null}</div></section> : <div className="ui-empty-state">No current customer Estimate is available. Contact the project team if you were expecting a revised offer.</div>}
    {portal.documents.filter((document) => document.documentType !== "issued_estimate").length ? <section className="portal-external__command ui-card"><span className="ui-eyebrow">Released documents</span><h2>Project documents</h2>{portal.documents.filter((document) => document.documentType !== "issued_estimate").map((document) => <div className="ui-action-row" key={document.id}><span>{document.fileName}</span>{document.downloadUrl ? <a className="ui-button ui-button--ghost" href={apiUrl(document.downloadUrl)} target="_blank" rel="noreferrer">Open</a> : <span className="ui-status ui-status--muted">Provider evidence retained</span>}</div>)}</section> : null}
    {portal.orders.map((order) => <section className="portal-external__command ui-card" key={order.id}><span className="ui-eyebrow">Order</span><h2>{order.orderRef}</h2><p>{order.status.replaceAll("_", " ")}</p></section>)}
    {portal.factoryConfirmations.filter((item) => !item.signedOff).map((item) => { const ready = overallConfirmation && item.positions.every((position) => confirmationPositions[position.estimatePositionId]); return <section className="portal-external__command ui-card" key={item.releaseId}><span className="ui-eyebrow">Final confirmation</span><h2>{item.orderRef} · Revision {item.revision}</h2><p>Review the released factory confirmation and approve each Position only when it is correct.</p><div className="portal-external__positions">{item.positions.map((position) => <label className="portal-external__position-check" key={position.estimatePositionId}><input type="checkbox" checked={Boolean(confirmationPositions[position.estimatePositionId])} onChange={(event) => { const checked = event.currentTarget.checked; setConfirmationPositions((current) => ({ ...current, [position.estimatePositionId]: checked })); }} /><span><strong>{position.positionReference || "Position"}</strong><small>I approve this Position in the released factory confirmation.</small></span></label>)}</div><label className="portal-external__overall-check"><input type="checkbox" checked={overallConfirmation} onChange={(event) => setOverallConfirmation(event.currentTarget.checked)} />I approve the overall released factory confirmation.</label><button className="ui-button ui-button--primary" disabled={busy || !ready} onClick={() => void command(`/api/client-portal/external/projects/${session.projectId}/factory-confirmations/${item.releaseId}/sign-off`, { overallApproved: true, positions: item.positions.map((position) => ({ estimatePositionId: position.estimatePositionId, approved: Boolean(confirmationPositions[position.estimatePositionId]) })) })}>{busy?"Recording approval…":"Submit final confirmation approval"}</button></section>; })}
    {estimate && mode === "review" ? <section className="portal-external__command ui-card"><h2>Review Estimate</h2><p>Review every Position. Questions and requested changes are recorded against this exact issued revision; the issued Estimate is never edited.</p><div className="portal-external__positions">{estimate.positions.map((position) => { const entry = reviewEntries[position.id] || { response: "accepted_as_shown", comment: "" }; return <fieldset key={position.id}><legend>{position.reference || "Position"} · Qty {position.quantity}</legend><p>{position.description || "Issued specification"}</p><label>Response<select className="ui-select" value={entry.response} onChange={(event) => { const response=event.currentTarget.value as ReviewResponse; setReviewEntries((current) => ({ ...current, [position.id]: { ...entry, response } })); }}><option value="accepted_as_shown">Accepted as shown</option><option value="amendment_requested">Request a change</option><option value="question_comment">Ask a question / comment</option></select></label>{entry.response !== "accepted_as_shown" ? <label>Comment<textarea className="ui-textarea" rows={2} value={entry.comment} onChange={(event) => { const comment = event.currentTarget.value; setReviewEntries((current) => ({ ...current, [position.id]: { ...entry, comment } })); }} /></label> : null}</fieldset>; })}</div><label>General response<select className="ui-select" value={generalResponse} onChange={(event) => setGeneralResponse(event.currentTarget.value as "comment_only" | "amendment_requested")}><option value="comment_only">General comment / question</option><option value="amendment_requested">Request a general change</option></select></label><label>General comments<textarea className="ui-textarea" rows={4} value={generalComment} onChange={(event) => setGeneralComment(event.currentTarget.value)} /></label><button className="ui-button ui-button--primary" disabled={busy || !reviewReady || (generalResponse === "amendment_requested" && !generalComment.trim())} onClick={() => void command(`/api/client-portal/external/projects/${session.projectId}/estimates/${estimate.releaseId}/review`, { generalComment, generalResponse, positions: estimate.positions.map((position) => ({ estimatePositionId: position.id, positionReference: position.reference, ...reviewEntries[position.id] })) })}>{busy?"Recording response…":"Submit reviewed responses"}</button></section> : null}
    {estimate && mode === "decline" ? <section className="portal-external__command ui-card"><h2>Reject Estimate</h2><label>Reason<select className="ui-select" value={declineReason} onChange={(event) => setDeclineReason(event.currentTarget.value)}><option value="cost">Cost</option><option value="confidence">Confidence</option><option value="chose_another_supplier">Chose Another Supplier</option><option value="other">Other</option></select></label><button className="ui-button ui-button--danger" disabled={busy} onClick={() => void command(`/api/client-portal/external/projects/${session.projectId}/estimates/${estimate.releaseId}/decline`, { reason: declineReason })}>{busy?"Recording rejection…":"Confirm rejection"}</button></section> : null}
    {estimate && mode === "accept" ? <section className="portal-external__command ui-card"><h2>Accept Estimate</h2><p>Explicitly confirm each Position's item/reference, configuration, dimensions and specification. Acceptance creates an Order awaiting staff approval; it does not send a factory order.</p><div className="portal-external__positions">{estimate.positions.map((position) => <label className="portal-external__position-check" key={position.id}><input type="checkbox" checked={Boolean(acceptedPositions[position.id])} onChange={(event) => { const checked = event.currentTarget.checked; setAcceptedPositions((current) => ({ ...current, [position.id]: checked })); }} /><span><strong>{position.reference || "Position"}</strong><small>{position.description || "Issued specification"} · Qty {position.quantity}</small><small>I have reviewed its reference, configuration, dimensions and specification.</small></span></label>)}</div><label className="portal-external__overall-check"><input type="checkbox" checked={overallAccepted} onChange={(event) => setOverallAccepted(event.currentTarget.checked)} />I accept the complete issued Estimate.</label><button className="ui-button ui-button--primary" disabled={busy || !acceptanceReady} onClick={() => void command(`/api/client-portal/external/projects/${session.projectId}/estimates/${estimate.releaseId}/accept`, { overallAccepted: true, positions: estimate.positions.map((position) => ({ estimatePositionId: position.id, positionReference: position.reference, accepted: Boolean(acceptedPositions[position.id]), confirmations: { item_reference: true, configuration: true, dimensions: true, specification: true } })) })}>{busy?"Creating Order…":"Submit Estimate acceptance"}</button></section> : null}
  </main>;
}
