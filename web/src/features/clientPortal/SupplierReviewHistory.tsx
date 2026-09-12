import { useState } from "react";
import { apiFetch } from "../../services/api/apiClient";

export type SavedSupplierCheck = {
  estimate_position_id: string | null; field_key: string; requested_change: string;
  before_value: string | null; expected_value: string | null; after_value: string | null;
  before_source_reference: string | null; after_source_reference: string | null;
  resolution_note: string | null; status: string; change_kind: "requested" | "unrelated_material_change";
  resolved_by?: string | null; resolved_at?: string | null; source_identity?: string | null;
};
type HistoryPage = { total: number; offset: number; items: Array<{ id: string; recordedAt: string; recordedBy: string; sourceLabel?:string; checks: SavedSupplierCheck[] }> };

export default function SupplierReviewHistory({ requestId, supplierId }: { requestId: string; supplierId?:string }) {
  const [page, setPage] = useState<HistoryPage | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function load(offset = 0) {
    setBusy(true); setError("");
    const route=supplierId?`supplier-reviews/${encodeURIComponent(supplierId)}/history`:'review-history';
    try { setPage(await apiFetch(`/api/lifecycle/supplier-revisions/${encodeURIComponent(requestId)}/${route}?offset=${offset}`) as HistoryPage); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Review history could not be opened. Try again."); }
    finally { setBusy(false); }
  }
  return <details onToggle={event => { if (event.currentTarget.open && !page && !busy) void load(); }}>
    <summary>View details · {supplierId?'supplier review versions':'earlier review history'}</summary>
    <p>Earlier checks are retained as evidence. They do not approve the current supplier document.</p>
    {busy ? <p role="status">Loading review history…</p> : null}
    {error ? <p role="alert">{error} <button className="ui-button" disabled={busy} onClick={() => void load(page?.offset || 0)}>Retry history</button></p> : null}
    {page ? <>
      <p>{page.total ? `Showing ${page.offset + 1}–${page.offset + page.items.length} of ${page.total} saved review snapshots` : "No earlier review snapshots. The latest saved checks appear in the review form."}</p>
      {page.items.map(item => <details key={item.id}>
        <summary>{supplierId?'Supplier review saved':'Saved before review'} on {new Date(item.recordedAt).toLocaleString("en-GB")}</summary>
        {item.sourceLabel?<p>{item.sourceLabel}</p>:null}
        {item.checks.map((check, index) => <article key={index} className="portal-operation-detail__check">
          <p>{check.field_key} · {check.status.replaceAll("_", " ")}</p>
          <p>Before: {check.before_value || "Not recorded"} · Requested: {check.expected_value || "Not recorded"} · After: {check.after_value || "Not recorded"}</p>
          <p>Before source: {check.before_source_reference || "Not recorded"} · Returned source: {check.after_source_reference || "Not recorded"}</p>
          {check.resolution_note ? <p>{check.resolution_note}</p> : null}
          <p>Reviewed by {check.resolved_by || "Not recorded"}{check.resolved_at ? ` · ${new Date(check.resolved_at).toLocaleString("en-GB")}` : ""}</p>
        </article>)}
      </details>)}
      <div className="ui-action-row">
        {page.offset > 0 ? <button className="ui-button" disabled={busy} onClick={() => void load(Math.max(0, page.offset - 10))}>Newer reviews</button> : null}
        {page.offset + page.items.length < page.total ? <button className="ui-button" disabled={busy} onClick={() => void load(page.offset + 10)}>Older reviews</button> : null}
        <button className="ui-button ui-button--ghost" disabled={busy} onClick={() => void load()}>Refresh history</button>
      </div>
    </> : null}
  </details>;
}
