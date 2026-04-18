import type { Client, Estimate } from "../../models/types";

export type DeletedEstimateRecord = {
  estimate: Estimate;
  deletedAt: string;
};

export type DeletedClientRecord = {
  client: Client;
  deletedAt: string;
  deletedEstimates?: DeletedEstimateRecord[];
};

export type DeletedEstimatesByClientId = Record<string, DeletedEstimateRecord[]>;
export type DeletedClientsById = Record<string, DeletedClientRecord>;

export const QS_DELETED_ESTIMATES_KEY = "quotesync.deletedEstimatesBin.v1";
export const QS_DELETED_CLIENTS_KEY = "quotesync.deletedClientsBin.v1";
