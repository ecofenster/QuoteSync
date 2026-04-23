import { apiFetch } from "../../services/api/apiClient";
import type {
  ConfiguratorCatalogBootstrap,
  ConfiguratorCatalogEntityKey,
} from "./configuratorCatalog.types";

export const CONFIGURATOR_CATALOG_API_PATH = "/api/configurator-catalog";

export async function getConfiguratorCatalogBootstrap(): Promise<ConfiguratorCatalogBootstrap> {
  return (await apiFetch(CONFIGURATOR_CATALOG_API_PATH)) as ConfiguratorCatalogBootstrap;
}

export async function getConfiguratorCatalogEntity<T>(entity: ConfiguratorCatalogEntityKey): Promise<T[]> {
  return (await apiFetch(`${CONFIGURATOR_CATALOG_API_PATH}/${entity}`)) as T[];
}

export async function createConfiguratorCatalogRecord<T>(
  entity: ConfiguratorCatalogEntityKey,
  payload: Record<string, unknown>
): Promise<T> {
  return (await apiFetch(`${CONFIGURATOR_CATALOG_API_PATH}/${entity}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })) as T;
}

export async function updateConfiguratorCatalogRecord<T>(
  entity: ConfiguratorCatalogEntityKey,
  id: string,
  payload: Record<string, unknown>
): Promise<T> {
  return (await apiFetch(`${CONFIGURATOR_CATALOG_API_PATH}/${entity}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })) as T;
}

export async function deleteConfiguratorCatalogRecord(entity: ConfiguratorCatalogEntityKey, id: string) {
  return apiFetch(`${CONFIGURATOR_CATALOG_API_PATH}/${entity}/${id}`, { method: "DELETE" });
}
