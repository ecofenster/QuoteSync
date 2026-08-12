import { useEffect, useState } from "react";
import { apiFetch } from "../../services/api/apiClient";
import EstimateCommercialWorkspace from "../estimateCommercial/EstimateCommercialWorkspace";

type PreviewClient = { id: string; name?: string; client_ref?: string };
export type PreviewEstimate = { id: string; client_id: string; estimate_ref: string; status?: string };

export function chooseInitialPreviewEstimate(estimates: PreviewEstimate[], currentId = "") {
  return estimates.some((estimate) => estimate.id === currentId) ? currentId : estimates[0]?.id ?? "";
}

async function loadPreviewEstimates() {
  const clients = await apiFetch("/api/clients") as PreviewClient[];
  const groups = await Promise.all(clients.map(async (client) => {
    const estimates = await apiFetch(`/api/estimates?client_id=${encodeURIComponent(client.id)}`) as PreviewEstimate[];
    return estimates.map((estimate) => ({ ...estimate, clientName: client.name || client.client_ref || "Client" }));
  }));
  return groups.flat();
}

async function createDisposablePreviewEstimate() {
  const suffix = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const clientId = `dev-commercial-preview-client-${suffix}`;
  await apiFetch("/api/clients", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: clientId, name: "QuoteSuite Commercial Preview (Disposable)", client_ref: `DEV-PREVIEW-${suffix}`, client_type: "Development" }),
  });
  return apiFetch("/api/estimates", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: `dev-commercial-preview-estimate-${suffix}`, client_id: clientId, status: "Development Preview", outcome: "Development Preview", positions_json: [], defaults_json: {}, order_meta_json: {} }),
  }) as Promise<PreviewEstimate>;
}

export default function AdminSupplierQuoteImportBeta() {
  const [estimates, setEstimates] = useState<(PreviewEstimate & { clientName?: string })[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function refresh(preferredId = selectedId) {
    const next = await loadPreviewEstimates();
    setEstimates(next);
    setSelectedId(chooseInitialPreviewEstimate(next, preferredId));
  }

  useEffect(() => { void refresh().catch((value) => setError(value instanceof Error ? value.message : "Estimates could not be loaded.")).finally(() => setLoading(false)); }, []);

  const selected = estimates.find((estimate) => estimate.id === selectedId) ?? null;
  return <div className="admin-page-stack">
    <section className="admin-card admin-card--content ui-card">
      <div className="admin-page-title">Supplier Quotations &amp; Project Costing (Preview)</div>
      <p className="admin-body-copy">Temporary development entry into the estimate-owned commercial workflow until the main Estimate workflow is implemented. All quotation, extraction and costing records created here remain owned by the selected estimate.</p>
      {error ? <p role="alert">{error}</p> : null}
      <div className="admin-control-row">
        <label className="admin-field">Estimate
          <select className="ui-input" value={selectedId} disabled={loading || creating} onChange={(event) => setSelectedId(event.target.value)}>
            <option value="">{loading ? "Loading estimates…" : "Select an estimate"}</option>
            {estimates.map((estimate) => <option key={estimate.id} value={estimate.id}>{estimate.estimate_ref || estimate.id} — {estimate.clientName}</option>)}
          </select>
        </label>
        <button className="ui-button" disabled={creating} onClick={() => { setCreating(true); setError(""); void createDisposablePreviewEstimate().then(async (created) => { await refresh(created.id); }).catch((value) => setError(value instanceof Error ? value.message : "Disposable estimate could not be created.")).finally(() => setCreating(false)); }}>{creating ? "Creating…" : "Create disposable development estimate"}</button>
      </div>
      {!loading && !estimates.length ? <p>No existing estimates are available. Create an explicitly labelled disposable development estimate to use this preview.</p> : null}
    </section>
    {selected ? <EstimateCommercialWorkspace key={selected.id} estimateId={selected.id} estimateRef={selected.estimate_ref || selected.id} /> : null}
  </div>;
}
