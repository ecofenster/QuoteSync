import { useEffect, useMemo, useState } from "react";
import type { SupplierQuote, SupplierQuoteAttachment, SupplierQuoteRevision } from "../supplierQuoteImport/domain/supplierQuote.types";
import { clientValidateSupplierFiles } from "../supplierQuotes/SupplierQuotesWorkspace";
import { supplierQuotesApi } from "../supplierQuotes/api/supplierQuotesApi";
import "../supplierQuotes/supplierQuotes.css";

type StoredDocument = { quote: SupplierQuote; revision: SupplierQuoteRevision; attachment: SupplierQuoteAttachment };
const dateKey = (value: string) => value.slice(0, 10);

export default function EstimateSupplierDocuments({ estimateId, estimateRef }: { estimateId: string; estimateRef: string }) {
  const [documents, setDocuments] = useState<StoredDocument[]>([]);
  const [supplier, setSupplier] = useState("");
  const [quotationReference, setQuotationReference] = useState("");
  const [revision, setRevision] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [supplierFilter, setSupplierFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const fileIssues = useMemo(() => clientValidateSupplierFiles(files), [files]);

  async function refresh() {
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
  }

  useEffect(() => { void refresh().catch((error) => setMessage(error instanceof Error ? error.message : "Stored documents could not be loaded.")); }, [estimateId]);

  const visible = documents.filter((item) => (!supplierFilter || item.quote.supplierName === supplierFilter) && (!dateFilter || dateKey(item.attachment.createdAt) === dateFilter));
  const suppliers = [...new Set(documents.map((item) => item.quote.supplierName))].sort();

  async function upload() {
    if (!supplier.trim() || fileIssues.length) return;
    setBusy(true); setMessage("");
    try {
      const quotes = await supplierQuotesApi.listQuotes(estimateId);
      let quote = quotes.find((item) => item.supplierName.trim().toLowerCase() === supplier.trim().toLowerCase());
      if (!quote) quote = await supplierQuotesApi.createQuote(estimateId, { supplierName: supplier.trim(), supplierCode: `DOC-${Date.now().toString(36).toUpperCase()}` });
      const createdRevision = await supplierQuotesApi.createRevision(estimateId, quote.id, {
        supplierQuotationNumber: quotationReference.trim(), supplierRevision: revision.trim(),
        fullQuotationReference: quotationReference.trim() || `Uploaded ${new Date().toISOString().slice(0, 10)}`, currency: "GBP", vatStatus: "unknown",
      });
      await supplierQuotesApi.uploadAttachments(estimateId, quote.id, createdRevision.id, files, "original_quote");
      setFiles([]); setQuotationReference(""); setRevision("");
      await refresh();
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
      <input aria-label="Supplier documents" type="file" multiple accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => setFiles(Array.from(event.target.files || []))} />
      {fileIssues.map((issue) => <div className="supplier-upload-error" key={issue}>{issue}</div>)}
      <button disabled={busy || !supplier.trim() || fileIssues.length > 0} onClick={() => void upload()}>{busy ? "Uploading…" : "Upload supplier documents"}</button>
    </div>
    {message ? <p role="status" className="supplier-upload-status">{message}</p> : null}
    <div className="supplier-import-lab-heading"><h3>Stored supplier documents</h3><div className="qs-migrated-241"><select aria-label="Filter by supplier" value={supplierFilter} onChange={(event) => setSupplierFilter(event.target.value)}><option value="">All suppliers</option>{suppliers.map((name) => <option key={name}>{name}</option>)}</select><input aria-label="Filter by upload date" type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} /></div></div>
    {!visible.length ? <p>No stored supplier documents match the current filters.</p> : <div className="supplier-review-scroll"><table><thead><tr><th>Supplier</th><th>Filename</th><th>Upload date</th><th>Quotation / reference</th><th>Revision</th></tr></thead><tbody>{visible.map(({ quote, revision: itemRevision, attachment }) => <tr key={attachment.id}><td>{quote.supplierName}</td><td>{attachment.originalFileName}</td><td>{new Date(attachment.createdAt).toLocaleString()}</td><td>{itemRevision.fullQuotationReference || itemRevision.supplierQuotationNumber || "—"}</td><td>{itemRevision.supplierRevision || "—"}</td></tr>)}</tbody></table></div>}
  </section>;
}
