import type { Client } from "../../../models/types";
import { ClientDetailsReadonly } from "./shared";
import { ClientProjectsPanel } from "../../commercialIdentity/ClientProjectsPanel";
import "../../commercialIdentity/commercialIdentity.css";

export default function ClientInfoTab({
  pickerClient,
  openEditClientPanel,
}: {
  pickerClient: Client;
  openEditClientPanel: (c: Client) => void;
}) {
  const latestEstimate = pickerClient.estimates[0] ?? null;
  const orders = pickerClient.estimates.filter((estimate) => estimate.outcome === "Order").length;
  const rejected = pickerClient.estimates.filter((estimate) => estimate.outcome === "Lost").length;
  return (
    <div className="ep-section-shell">
      <ClientDetailsReadonly c={pickerClient} onEdit={() => openEditClientPanel(pickerClient)} />
      <section className="client-info-overview ui-card" aria-label="Client workspace overview">
        <header><div><h3>Client workspace</h3><p>Canonical Client, Project, Estimate, Order, document and communication summaries. Compare Quotes and Portal Preview use these same records.</p></div><span className="ui-status ui-status--muted">{orders ? "Order in progress" : latestEstimate ? "Estimate active" : "Enquiry / project"}</span></header>
        <div className="client-info-overview__grid"><article><span>Latest Estimate</span><strong>{latestEstimate?.estimateRef ?? "Not created"}</strong><small>{latestEstimate ? `Revision ${latestEstimate.revisionNo}` : "Create from the active Project"}</small></article><article><span>Estimate history</span><strong>{pickerClient.estimates.length}</strong><small>All canonical revisions and outcomes</small></article><article><span>Orders</span><strong>{orders}</strong><small>Accepted Estimate outcomes</small></article><article><span>Rejected</span><strong>{rejected}</strong><small>Preserved loss history</small></article></div>
      </section>
      <ClientProjectsPanel clientId={String(pickerClient.id)} />
    </div>
  );
}
