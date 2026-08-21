import { apiUrl } from "../../services/api/apiClient";

export function resolveManufacturerVisualAssetUrl(value: string | null | undefined) {
  const url = String(value ?? "").trim();
  return url.startsWith("/api/") ? apiUrl(url) : url;
}
