import type { Client, EstimateOutcome } from "../../../models/types";
import type { EstimateCollectionItem } from "../EstimateCollectionItem";

type GlobalEstimateRow = {
  client: Client;
  estimate: EstimateCollectionItem;
  outcome: EstimateOutcome;
  installerId?: string;
};

export default function mapGlobalEstimateToCollectionItem(row: GlobalEstimateRow): EstimateCollectionItem {
  return {
    ...row.estimate,
    collectionClientId: row.client.id,
    clientName: row.client.type === "Business" ? (row.client.businessName || row.client.clientName) : row.client.clientName,
    clientReference: row.client.clientRef,
  };
}
