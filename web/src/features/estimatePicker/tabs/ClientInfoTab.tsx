import type { Client } from "../../../models/types";
import { ClientDetailsReadonly } from "./shared";

export default function ClientInfoTab({
  pickerClient,
  openEditClientPanel,
}: {
  pickerClient: Client;
  openEditClientPanel: (c: Client) => void;
}) {
  return (
    <div className="ep-section-shell">
      <ClientDetailsReadonly c={pickerClient} onEdit={() => openEditClientPanel(pickerClient)} />
    </div>
  );
}
