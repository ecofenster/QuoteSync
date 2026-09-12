import { useRef, useState } from "react";
import { apiFetch, ApiRequestError } from "../../services/api/apiClient";
import { communicationsApi, type CommunicationMessageView, type CommunicationAssignmentOptions, type CommunicationAssignmentResult } from "../../services/communications/communicationsApi";
import { AssignmentDialog } from "../communications/EmailWorkspace";

export default function SupplierReplyReview({ projectId, estimateId, requestId, recipient, onClose, onOpenFiles, onImport }: {
  projectId: string; estimateId: string; requestId: string; recipient: string; onClose: () => void;
  onOpenFiles: () => void; onImport: (documentId: string) => void;
}) {
  const [query, setQuery] = useState(`from:${recipient}`);
  const [messages, setMessages] = useState<CommunicationMessageView[]>([]);
  const [nextPage, setNextPage] = useState<string | null>(null);
  const [searchedQuery, setSearchedQuery] = useState("");
  const [selected, setSelected] = useState<CommunicationMessageView | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [partial, setPartial] = useState<{ fileName?: string; folderPath?: string; webViewLink?: string | null } | null>(null);
  const [assignment, setAssignment] = useState<CommunicationAssignmentOptions | null>(null);
  const [fileResult, setFileResult] = useState<CommunicationAssignmentResult | null>(null);
  const locked = useRef(false);
  async function run(action: () => Promise<void>, progress: string) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError(""); setPartial(null); setNotice(progress);
    try { await action(); } catch (reason) {
      setNotice(""); setError(reason instanceof Error ? reason.message : "The action could not be completed. Your selection is retained; retry when ready.");
      if (reason instanceof ApiRequestError && reason.body) {
        try { const body = JSON.parse(reason.body); if (body.code === "communication_assignment_partial_success") setPartial(body.details || {}); }
        catch { /* Keep the readable original error when no structured result exists. */ }
      }
    }
    finally { locked.current = false; setBusy(false); }
  }
  const search = (page: string | null = null) => run(async () => {
    const q = page ? searchedQuery : query.trim();
    const result = await communicationsApi.list("all", q, page);
    setMessages(result.messages.filter(message => message.direction === "inbound"));
    setNextPage(result.nextPageToken); setSearchedQuery(q); setSelected(null);
    setNotice(result.messages.length ? "Review the sender, message and attachments before linking a reply. Search results are suggestions only." : "No retained messages match this search. Try another sender or subject, or refresh Email and search again.");
  }, "Finding supplier replies…");
  const select = (message: CommunicationMessageView) => run(async () => {
    const exact = await communicationsApi.read(message.providerMessageId || message.id);
    if (exact.direction !== "inbound") throw new Error("Choose an incoming supplier message.");
    setSelected(exact); setNotice("Review this exact message below. Linking an acknowledgement keeps the revised document outstanding.");
  }, "Opening the selected reply…");
  const acknowledge = () => run(async () => {
    if (!selected) return;
    const result = await apiFetch(`/api/lifecycle/projects/${encodeURIComponent(projectId)}/manufacturer-responses`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estimateId, supplierEnquiryId: requestId, communicationMessageId: selected.id }),
    }) as { nextAction: string };
    setNotice(`Reply linked for staff review. ${result.nextAction}`);
  }, "Linking the selected reply…");
  const prepareFiles = () => run(async () => {
    if (!selected) return;
    const options = await communicationsApi.assignmentOptions(selected.providerMessageId || selected.id);
    const request = options.supplierEnquiries.find(item => item.id === requestId && item.projectId === projectId && item.estimateId === estimateId);
    if (!request) throw new Error("This supplier request is unavailable for the selected message. Reopen the request and check its Project and Estimate.");
    const project = options.projects.find(item => item.id === projectId);
    setAssignment({ ...options, proposed: { ...options.proposed, projectId, estimateId, clientId: project?.client_id || null, supplierId: request.supplierId, supplierEnquiryId: requestId } });
    setFileResult(null); setNotice("");
  }, "Checking the selected message’s retained documents…");
  if (assignment) return <AssignmentDialog options={assignment} result={fileResult} saving={busy}
    feedback={partial ? { state: "partial", message: "The document was saved, but QuoteSuite could not finish linking it.", details: partial } : error ? { state: "failed", message: error } : busy ? { state: "saving", message: "Saving document…" } : null}
    onClose={() => { if (!busy) { setAssignment(null); setError(""); } }}
    onSubmit={value => void run(async () => {
      if (value.projectId !== projectId || value.estimateId !== estimateId || value.supplierEnquiryId !== requestId) throw new Error("Keep this document linked to the supplier request being reviewed. Use Email to file it against a different record.");
      const result = await communicationsApi.assignDocument(assignment.providerMessageId, value);
      setFileResult(result); setNotice(`Saved ${result.fileName} to ${result.folderPath}. Review with Manufacturer Import next.`);
    }, "Saving document…")}
    onOpenFiles={onOpenFiles}
    onImport={result => onImport(result.documentId)} />;
  return <section className="supplier-rfq__result" aria-label="Review supplier reply" aria-busy={busy}>
    <h3>Find and review a supplier reply</h3>
    <p>Check the exact email before linking it. A reply does not approve changes or update Project Costing.</p>
    <form onSubmit={event => { event.preventDefault(); void search(); }} className="supplier-rfq__fields">
      <label>Search email<input className="ui-input" value={query} disabled={busy} onChange={event => setQuery(event.currentTarget.value)} /></label>
      <button className="ui-button" disabled={busy || !query.trim()}>Find replies</button>
    </form>
    {error ? <p className="ui-status ui-status--error" role="alert">{error}</p> : null}
    {notice ? <p className="ui-status" role="status">{notice}</p> : null}
    <div className="supplier-rfq__history">{messages.map(message => <button type="button" className="ui-button" key={message.id} disabled={busy} aria-pressed={selected?.id === message.id} onClick={() => void select(message)}>
      {message.from.join(", ")} · {message.subject} · {message.sentAt ? new Date(message.sentAt).toLocaleString("en-GB") : "Date unavailable"}
    </button>)}</div>
    {nextPage ? <button className="ui-button" disabled={busy} onClick={() => void search(nextPage)}>Next page of replies</button> : null}
    {selected ? <article>
      <h4>{selected.subject}</h4><p>{selected.from.join(", ")} · {selected.sentAt ? new Date(selected.sentAt).toLocaleString("en-GB") : "Date unavailable"}</p>
      <div style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{selected.bodyText || "Plain-text content is unavailable. Review the original in Email before deciding."}</div>
      <p>{selected.attachments.filter(item => !item.inline).map(item => item.fileName).join(", ") || "No separate attachments retained."}</p>
      <div className="ui-action-row"><button className="ui-button" disabled={busy} onClick={() => void acknowledge()}>Link as acknowledgement</button>
        <button className="ui-button ui-button--primary" disabled={busy || !selected.attachments.length} onClick={() => void prepareFiles()}>Review and file selected document</button></div>
    </article> : null}
    <button className="ui-button" disabled={busy} onClick={onClose}>Back to supplier requests</button>
  </section>;
}
