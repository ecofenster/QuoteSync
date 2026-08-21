import { useEffect, useState } from "react";
import { apiFetch } from "../../services/api/apiClient";
import EstimateCommercialWorkspace from "../estimateCommercial/EstimateCommercialWorkspace";
import { chooseInitialPreviewEstimate } from "./adminSupplierQuotePreview.utils";
import type { PreviewEstimate } from "./adminSupplierQuotePreview.utils";
export { chooseInitialPreviewEstimate } from "./adminSupplierQuotePreview.utils";

type PreviewClient = { id: string; name?: string; client_ref?: string };

async function loadPreviewEstimates() {
  const clients = await apiFetch("/api/clients") as PreviewClient[];
  const groups = await Promise.all(clients.map(async (client) => {
    const estimates = await apiFetch(`/api/estimates?client_id=${encodeURIComponent(client.id)}`) as PreviewEstimate[];
    return estimates.map((estimate) => ({ ...estimate, clientName: client.name || client.client_ref || "Client" }));
  }));
  return groups.flat();
}

export async function createDisposablePreviewEstimate() {
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
  const [error, setError] = useState("");

  async function refresh(preferredId = selectedId) {
    const next = await loadPreviewEstimates();
    setEstimates(next);
    setSelectedId(chooseInitialPreviewEstimate(next, preferredId));
  }

  useEffect(() => { void refresh().catch((value) => setError(value instanceof Error ? value.message : "Estimates could not be loaded.")).finally(() => setLoading(false)); }, []);

  const selected = estimates.find((estimate) => estimate.id === selectedId) ?? null;
  if(error)return <p role="alert">{error}</p>;
  if(loading)return <p role="status">Loading Project Costing…</p>;
  return selected?<EstimateCommercialWorkspace key={selected.id} estimateId={selected.id} estimateRef={selected.estimate_ref || selected.id} initialCommercialView="internal"/>:null;
}
