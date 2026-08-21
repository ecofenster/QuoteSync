import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupplierQuote, SupplierQuoteAttachment, SupplierQuoteDocumentKind, SupplierQuoteRevision } from "../supplierQuoteImport/domain/supplierQuote.types";
import { clientValidateSupplierFiles } from "../supplierQuotes/supplierFileValidation";
import { supplierQuotesApi } from "../supplierQuotes/api/supplierQuotesApi";
import "../supplierQuotes/supplierQuotes.css";

type StoredDocument = { quote: SupplierQuote; revision: SupplierQuoteRevision; attachment: SupplierQuoteAttachment };
const dateKey = (value: string) => value.slice(0, 10);

export default function EstimateSupplierDocuments({ estimateId, estimateRef }: { estimateId: string; estimateRef: string }) {
  const [documents, setDocuments] = useState<StoredDocument[]>([]);
  const [supplier, setSupplier] = useState("");
  const [quotationReference, setQuotationReference] = useState("");
  const [revision, setRevision] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [documentKind, setDocumentKind] = useState<SupplierQuoteDocumentKind>("complete_quotation");
  const [files, setFiles] = useState<File[]>([]);
  const [supplierFilter, setSupplierFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const fileIssues = useMemo(() => clientValidateSupplierFiles(files), [files]);

  const refresh = useCallback(async () => {
    const quotes = await supplierQuotesApi.listQuotes(estimateId);
    const groups = await Promise.all(quotes.map(async (quote) => {
      const revisions = await supplierQuotesApi.listRevisions(estimateId, quote.id);
      const revisionDocuments = await Promise.all(revisions.map(async (item) => {
        const attachments = await supplierQuotesApi.listAttachments(estimateId, quote.id, item.id);
        return attachments.map((attachment) => ({ quote, revision: item, attachment }));
      }));
      return revisionDocuments.flat();
    }));
    setDocuments(groups.flat().sort((left, right) => right.attachment.createdAt.localeCompare(left.attachment.createdAt)));
  }, [estimateId]);

  useEffect(() => { void refresh().catch((error) => setMessage(error instanceof Error ? error.message : "Stored documents could not be loaded.")); }, [refresh]);

  const visible = documents.filter((item) => (!supplierFilter || item.quote.supplierName === supplierFilter) && (!dateFilter || dateKey(item.attachment.createdAt) === dateFilter));
  const suppliers = [...new Set(documents.map((item) => item.quote.supplierName))].sort();
  const quotationRevisionKey = (item: StoredDocument) => `${item.quote.id}|${item.revision.supplierQuotationNumber.trim().toUpperCase()}|${(item.revision.supplierRevision || "").trim().toUpperCase()}`;
  const packageCounts = new Map<string, number>();
  const latestUploadByPackage = new Map<string, string>();
  for (const item of documents) { const key=quotationRevisionKey(item); packageCounts.set(key,(packageCounts.get(key)??0)+1); if(!latestUploadByPackage.has(key)||item.attachment.createdAt>(latestUploadByPackage.get(key)??""))latestUploadByPackage.set(key,item.attachment.createdAt); }

  async function upload() {
    if (!supplier.trim() || fileIssues.length) return;
    setBusy(true); setMessage("");
    try {
      const quotes = await supplierQuotesApi.listQuotes(estimateId);
      let quote = quotes.find((item) => item.supplierName.trim().toLowerCase() === supplier.trim().toLowerCase());
      if (!quote) quote = await supplierQuotesApi.createQuote(estimateId, { supplierName: supplier.trim(), supplierCode: `DOC-${Date.now().toString(36).toUpperCase()}` });
      const revisions = await supplierQuotesApi.listRevisions(estimateId, quote.id);
      let targetRevision = revisions.find((item) => item.supplierQuotationNumber === quotationReference.trim() && (item.supplierRevision || "") === revision.trim());
      const isComplementary = documentKind === "window_schedule" || documentKind === "quotation_letter" || documentKind === "installation_pricing";
      if (!targetRevision && isComplementary && !revision.trim()) targetRevision = revisions.find((item) => item.isLatest && item.lifecycleStatus !== "archived");
      if (!targetRevision) targetRevision = await supplierQuotesApi.createRevision(estimateId, quote.id, {
        supplierQuotationNumber: quotationReference.trim(), supplierRevision: revision.trim(),
        fullQuotationReference: quotationReference.trim() || `Uploaded ${new Date().toISOString().slice(0, 10)}`, currency: currency.trim().toUpperCase(), vatStatus: "unknown",
      });
      const role = documentKind === "complete_quotation" || documentKind === "window_schedule" ? "original_quote" : "supporting_document";
      await supplierQuotesApi.uploadAttachments(estimateId, quote.id, targetRevision.id, files, role, documentKind);
      setFiles([]); setQuotationReference(""); setRevision("");
      await refresh();
      window.dispatchEvent(new CustomEvent("quotesuite:supplier-documents-changed", { detail: { estimateId } }));
      setMessage(`${files.length} supplier document${files.length === 1 ? "" : "s"} uploaded and stored against ${estimateRef}.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Supplier documents could not be uploaded."); }
    finally { setBusy(false); }
  }
  return <section className="supplier-quotes-workspace" data-testid="estimate-supplier-documents">
    <div className="supplier-quotes-workspace__header"><div><h2>Import Supplier Costs</h2><p>Upload and store supplier documents against estimate <strong>{estimateRef}</strong>. No extraction or automatic Project Costing import occurs here.</p></div></div>
    <div className="supplier-upload-panel">
      <label>Supplier<input value={supplier} onChange={(event) => setSupplier(event.target.value)} /></label>
      <label>Quotation / reference<input value={quotationReference} onChange={(event) => setQuotationReference(event.target.value)} /></label>
      <label>Revision<input value={revision} onChange={(event) => setRevision(event.target.value)} /></label>
      <label>Currency<input maxLength={3} value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} /></label>
      <label>Document type<select value={documentKind} onChange={(event)=>setDocumentKind(event.target.value as SupplierQuoteDocumentKind)}><option value="complete_quotation">Complete quotation</option><option value="window_schedule">Window schedule</option><option value="quotation_letter">Quotation letter / total</option><option value="installation_pricing">Installation / additional pricing</option><option value="supporting_document">Supporting document</option></select></label>
      <input aria-label="Supplier documents" type="file" multiple accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => setFiles(Array.from(event.target.files || []))} />
      {fileIssues.map((issue) => <div className="supplier-upload-error" key={issue}>{issue}</div>)}
      <button disabled={busy || !supplier.trim() || fileIssues.length > 0} onClick={() => void upload()}>{busy ? "Uploading…" : "Upload supplier documents"}</button>
    </div>
    {message ? <p role="status" className="supplier-upload-status">{message}</p> : null}
    <div className="supplier-import-lab-heading"><h3>Stored supplier documents</h3><div className="qs-migrated-241"><select aria-label="Filter by supplier" value={supplierFilter} onChange={(event) => setSupplierFilter(event.target.value)}><option value="">All suppliers</option>{suppliers.map((name) => <option key={name}>{name}</option>)}</select><input aria-label="Filter by upload date" type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} /></div></div>
    {!visible.length ? <p>No stored supplier documents match the current filters.</p> : <div className="supplier-review-scroll"><table><thead><tr><th>Supplier</th><th>Quotation</th><th>Source document</th><th>Type</th><th>Upload date</th><th>Quotation revision</th><th>Document status</th></tr></thead><tbody>{visible.map((item) => { const {quote,revision:itemRevision,attachment}=item,key=quotationRevisionKey(item),companions=(packageCounts.get(key)??0)>1,latestUpload=latestUploadByPackage.get(key)===attachment.createdAt; return <tr key={attachment.id}><td>{quote.supplierName}</td><td>{itemRevision.fullQuotationReference || itemRevision.supplierQuotationNumber || "—"}</td><td>{attachment.originalFileName}</td><td>{attachment.documentKind.replaceAll("_"," ")}</td><td>{new Date(attachment.createdAt).toLocaleString()}</td><td>{itemRevision.supplierRevision || "—"}</td><td>{companions?(latestUpload?"Latest document upload":"Companion document"):itemRevision.isLatest?"Current quotation revision":"Superseded quotation revision"}</td></tr>; })}</tbody></table></div>}
  </section>;
}
