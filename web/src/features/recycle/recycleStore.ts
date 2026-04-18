import type {
  DeletedClientRecord,
  DeletedClientsById,
  DeletedEstimateRecord,
  DeletedEstimatesByClientId,
} from "./recycleTypes";
import { QS_DELETED_CLIENTS_KEY, QS_DELETED_ESTIMATES_KEY } from "./recycleTypes";

export function loadDeletedEstimatesBin(): DeletedEstimatesByClientId {
  try {
    const raw = localStorage.getItem(QS_DELETED_ESTIMATES_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== "object") return {};

    return parsed as DeletedEstimatesByClientId;
  } catch {
    return {};
  }
}

export function saveDeletedEstimatesBin(data: DeletedEstimatesByClientId) {
  try {
    localStorage.setItem(QS_DELETED_ESTIMATES_KEY, JSON.stringify(data));
  } catch {
    // ignore storage failures
  }
}

export function purgeDeletedEstimatesOlderThan(
  data: DeletedEstimatesByClientId,
  days: number = 30
): DeletedEstimatesByClientId {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const cleaned: DeletedEstimatesByClientId = {};

  for (const [clientId, list] of Object.entries(data)) {
    if (!Array.isArray(list)) continue;

    const kept = list.filter((item) => {
      const deletedAtMs = Date.parse(item?.deletedAt ?? "");
      return item && item.estimate && Number.isFinite(deletedAtMs) && deletedAtMs >= cutoff;
    });

    if (kept.length) {
      cleaned[clientId] = kept;
    }
  }

  return cleaned;
}

export function addDeletedEstimate(
  data: DeletedEstimatesByClientId,
  clientId: string,
  record: DeletedEstimateRecord
): DeletedEstimatesByClientId {
  return {
    ...data,
    [clientId]: [...(data[clientId] ?? []), record],
  };
}

export function removeDeletedEstimate(
  data: DeletedEstimatesByClientId,
  clientId: string,
  estimateId: string
): DeletedEstimatesByClientId {
  const current = data[clientId] ?? [];
  const nextItems = current.filter((item) => item.estimate.id !== estimateId);
  const next = { ...data };

  if (nextItems.length) next[clientId] = nextItems;
  else delete next[clientId];

  return next;
}

export function loadDeletedClientsBin(): DeletedClientsById {
  try {
    const raw = localStorage.getItem(QS_DELETED_CLIENTS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== "object") return {};

    return parsed as DeletedClientsById;
  } catch {
    return {};
  }
}

export function saveDeletedClientsBin(data: DeletedClientsById) {
  try {
    localStorage.setItem(QS_DELETED_CLIENTS_KEY, JSON.stringify(data));
  } catch {
    // ignore storage failures
  }
}

export function purgeDeletedClientsOlderThan(
  data: DeletedClientsById,
  days: number = 30
): DeletedClientsById {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const cleaned: DeletedClientsById = {};

  for (const [clientId, record] of Object.entries(data)) {
    const deletedAtMs = Date.parse(record?.deletedAt ?? "");
    if (!record?.client || !Number.isFinite(deletedAtMs) || deletedAtMs < cutoff) continue;
    cleaned[clientId] = record;
  }

  return cleaned;
}

export function addDeletedClient(
  data: DeletedClientsById,
  clientId: string,
  record: DeletedClientRecord
): DeletedClientsById {
  return {
    ...data,
    [clientId]: record,
  };
}

export function removeDeletedClient(data: DeletedClientsById, clientId: string): DeletedClientsById {
  const next = { ...data };
  delete next[clientId];
  return next;
}
