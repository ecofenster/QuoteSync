import { useEffect, useState } from "react";
import type { SupplierQuote, SupplierQuoteAttachment, SupplierQuoteRevision } from "../supplierQuoteImport/domain/supplierQuote.types";
import { supplierQuotesApi } from "../supplierQuotes/api/supplierQuotesApi";

type StoredDocument = { quote: SupplierQuote; revision: SupplierQuoteRevision; attachment: SupplierQuoteAttachment };
const documentRoleLabel = (attachment: SupplierQuoteAttachment) => attachment.documentKind === "window_schedule" ? "Schedule" : attachment.documentKind === "quotation_letter" ? "Commercial / covering quotation" : attachment.documentKind === "installation_pricing" ? "Installation / additional pricing" : attachment.documentKind.replaceAll("_", " ");

export default function EstimateSupplierCostImportControl({ estimateId, scenarioId, onLoaded }: { estimateId: string; scenarioId: string; onLoaded: () => Promise<void> | void }) {
  const [documents, setDocuments] = useState<StoredDocument[]>([]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const grouped=documents.reduce<Map<string,{quote:SupplierQuote;revisions:Map<string,{revision:SupplierQuoteRevision;attachments:SupplierQuoteAttachment[]}>}>>((map,item)=>{if(!map.has(item.quote.id))map.set(item.quote.id,{quote:item.quote,revisions:new Map()});const revisions=map.get(item.quote.id)!.revisions;if(!revisions.has(item.revision.id))revisions.set(item.revision.id,{revision:item.revision,attachments:[]});revisions.get(item.revision.id)!.attachments.push(item.attachment);return map;},new Map());
  useEffect(() => { let current = true; void supplierQuotesApi.listStoredDocuments(estimateId).then((items) => { if (current) setDocuments(items); }).catch((error) => { if (current) setMessage(error instanceof Error ? error.message : "Supplier documents could not be loaded."); }); return () => { current = false; }; }, [estimateId]);
  async function submit() {
    const chosen = documents.filter((item) => selected.has(item.attachment.id)); if (!chosen.length || busy) return;
    setBusy(true); setMessage("Extracting selected supplier documents…");
    try {
      const result = await supplierQuotesApi.extractAndLoad(estimateId, scenarioId, chosen.map((item) => ({ quoteId: item.quote.id, revisionId: item.revision.id, attachmentId: item.attachment.id })));
      await onLoaded();
      setDocuments(await supplierQuotesApi.listStoredDocuments(estimateId));
      const loaded = result.documents.reduce((sum, item) => sum + item.loadedProducts + item.loadedCosts, 0);
      const duplicates = result.documents.reduce((sum, item) => sum + item.duplicateProducts + item.duplicateCosts, 0); const invalid=result.documents.reduce((sum,item)=>sum+item.invalidProducts+item.invalidCosts,0);
      setMessage(`${loaded} new supplier cost line${loaded === 1 ? "" : "s"} loaded. ${duplicates} duplicate row${duplicates === 1 ? "" : "s"} skipped. ${invalid} invalid row${invalid === 1 ? "" : "s"} skipped.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Supplier costs could not be extracted and loaded."); }
    finally { setBusy(false); }
  }
  return <section className="ui-card calculator-lab__supplier-import" aria-labelledby="supplier-cost-import-heading">
    <div><h3 id="supplier-cost-import-heading">Supplier costs</h3><p>Select uploaded estimate documents, then extract their commercial rows into this costing. Existing manual lines are retained.</p></div>
    {!documents.length ? <p>No supplier documents are stored for this estimate. Use <strong>Import Supplier Costs</strong> to upload them.</p> : <div className="calculator-lab__supplier-documents">{[...grouped.values()].map(({quote,revisions})=><section key={quote.id}><h4>{quote.supplierName}</h4>{[...revisions.values()].map(({revision,attachments})=><div key={revision.id}><strong>{revision.fullQuotationReference || "No quotation reference"}{revision.supplierRevision?` · revision ${revision.supplierRevision}`:""}</strong>{attachments.map((attachment)=>{const packageDocument=attachment.documentKind!=="complete_quotation"&&attachment.documentKind!=="supporting_document";return <label key={attachment.id}><input type="checkbox" checked={selected.has(attachment.id)} onChange={(event) => setSelected((current) => { const next = new Set(current); if (event.target.checked) next.add(attachment.id); else next.delete(attachment.id); return next; })} /><span><strong>{attachment.originalFileName}</strong><small>{revision.currency} · {documentRoleLabel(attachment)} · {packageDocument?"Package document":revision.isLatest?"Latest revision":"Superseded revision"} · uploaded {new Date(attachment.createdAt).toLocaleDateString()}</small></span></label>})}</div>)}</section>)}</div>}
    <button className="ui-button ui-button--primary" disabled={busy || selected.size === 0} onClick={() => void submit()}>{busy ? "Extracting & loading…" : "Extract & Load Supplier Costs"}</button>
    {message ? <p role="status">{message}</p> : null}
  </section>;
}
