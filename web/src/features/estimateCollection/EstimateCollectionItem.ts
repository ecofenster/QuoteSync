import type { ClientId, Estimate } from "../../models/types";

export type EstimateCollectionItem = Estimate & {
  collectionClientId?: ClientId;
  clientName?: string;
  clientReference?: string;
  createdByUserId?: string;
  createdByName?: string;
  createdByRole?: Estimate["createdByRole"];
  updatedAt?: string;
};
