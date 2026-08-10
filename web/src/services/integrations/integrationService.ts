import { apiFetch } from "../api/apiClient";

export type IntegrationProvider = "googleMaps" | "what3words";
export type IntegrationStatus = {
  provider: IntegrationProvider;
  category: "location_mapping";
  capabilities: string[];
  enabled: boolean;
  configured: boolean;
  source: "quotesync" | "environment" | "none";
  maskedKey: string | null;
  lastTestedAt: string | null;
  lastTestSuccessful: boolean | null;
};

export const getIntegrationStatuses = () => apiFetch("/api/integrations") as Promise<IntegrationStatus[]>;
export const saveIntegration = (provider: IntegrationProvider, body: { enabled: boolean; apiKey?: string }) =>
  apiFetch(`/api/integrations/${provider}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }) as Promise<IntegrationStatus>;
export const clearIntegrationKey = (provider: IntegrationProvider) =>
  apiFetch(`/api/integrations/${provider}/key`, { method: "DELETE" }) as Promise<IntegrationStatus>;
export const testIntegration = (provider: IntegrationProvider) =>
  apiFetch(`/api/integrations/${provider}/test`, { method: "POST" }) as Promise<{ successful: boolean; message: string; testedAt: string }>;
