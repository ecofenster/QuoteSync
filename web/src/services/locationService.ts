import type { Client, Estimate } from "../models/types";
import { apiFetch } from "./api/apiClient";

export type ResolvedClientLocation = {
  lat: number;
  lng: number;
  source: "client" | "estimate" | "cache" | "postcode" | "what3words" | "address";
  label: string;
  resolvedAt?: string;
  inputKey?: string;
  isClientAddressFallback?: boolean;
};

type EstimateLocationLike = Pick<Estimate, "id" | "postcode" | "what3words" | "projectAddress"> & {
  latitude?: number | null;
  longitude?: number | null;
};

function cacheKey(scope: "client" | "estimate", id: string) {
  return `quotesync.${scope}Location.v1.${id}`;
}

export function extractPostcode(text: string) {
  const match = (text || "").match(/[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}/i);
  return match ? match[0].toUpperCase().replace(/\s+/, " ") : "";
}

function normalizeWhat3Words(words?: string) {
  if (!words) return "";
  return words.trim().replace(/^\/*/, "").replace(/\/+$/, "").replace(/\//g, ".");
}

function firstAddressLine(text: string) {
  return (text || "").split(/\r?\n/).map((s) => s.trim()).filter(Boolean)[0] || "";
}

function usableLocationText(value: unknown) {
  return String(value ?? "").trim();
}

function isValidUkCoordinatePair(lat: number, lng: number) {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= 49 && lat <= 61 && lng >= -8 && lng <= 2;
}

function loadCachedLocation(scope: "client" | "estimate", id: string): ResolvedClientLocation | null {
  try {
    const raw = localStorage.getItem(cacheKey(scope, id));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.lat !== "number" || typeof parsed.lng !== "number") return null;
    return parsed as ResolvedClientLocation;
  } catch {
    return null;
  }
}

function saveCachedLocation(scope: "client" | "estimate", id: string, location: ResolvedClientLocation) {
  try {
    localStorage.setItem(cacheKey(scope, id), JSON.stringify(location));
  } catch {
    // ignore cache failures
  }
}

async function geocodeWithGoogle(query: string, _apiKey: string) {
  try {
    const data = await apiFetch("/api/integrations/googleMaps/geocode", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query }) });
    if (typeof data?.lat !== "number" || typeof data?.lng !== "number") return null;
    return { lat: data.lat, lng: data.lng };
  } catch {
    return null;
  }
}

async function convertWhat3Words(words: string, _apiKey: string) {
  try {
    const response = await fetch("/api/integrations/what3words/coordinates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ words }) });
    if (!response.ok) return null;
    const data = await response.json();
    if (typeof data?.lat !== "number" || typeof data?.lng !== "number") return null;
    return { lat: data.lat, lng: data.lng };
  } catch {
    return null;
  }
}

export async function resolveWhat3WordsCoordinates(words: string, apiKey: string) {
  return convertWhat3Words(normalizeWhat3Words(words), apiKey);
}

export async function convertCoordinatesToWhat3Words(lat: number, lng: number, _apiKey: string) {
  try {
    const response = await fetch("/api/integrations/what3words/address", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lat, lng }) });
    if (response.status === 402) return "__W3W_PAID_REQUIRED__";
    if (!response.ok) return "";
    const data = await response.json();
    return normalizeWhat3Words(typeof data?.words === "string" ? data.words : "");
  } catch {
    return "";
  }
}

export function buildClientLocationLabel(client: Pick<Client, "postcode" | "what3words" | "projectAddress">) {
  const words = normalizeWhat3Words(client.what3words);
  if (words) return `what3words: ${words}`;
  const postcode = client.postcode || extractPostcode(client.projectAddress || "");
  if (postcode) return `Postcode: ${postcode}`;
  const line1 = firstAddressLine(client.projectAddress || "");
  return line1 ? `Address: ${line1}` : "Address unavailable";
}

export function buildEstimateLocationLabel(estimate: Pick<EstimateLocationLike, "postcode" | "what3words" | "projectAddress">) {
  const words = normalizeWhat3Words(estimate.what3words);
  if (words) return `what3words: ${words}`;
  const postcode = estimate.postcode || extractPostcode(estimate.projectAddress || "");
  if (postcode) return `Postcode: ${postcode}`;
  const line1 = firstAddressLine(estimate.projectAddress || "");
  return line1 ? `Address: ${line1}` : "Address unavailable";
}

export async function resolveClientLocation(
  client: Client,
  opts: { googleMapsApiKey: string; what3wordsApiKey?: string }
): Promise<ResolvedClientLocation | null> {
  const lat = Number(client.latitude);
  const lng = Number(client.longitude);

  if (isValidUkCoordinatePair(lat, lng)) {
    return {
      lat,
      lng,
      source: "client",
      label: buildClientLocationLabel(client),
    };
  }

  const cached = loadCachedLocation("client", client.id);
  if (cached) return { ...cached, source: "cache" };

  const words = normalizeWhat3Words(client.what3words);
  if (words && opts.what3wordsApiKey) {
    const coords = await convertWhat3Words(words, opts.what3wordsApiKey);
    if (coords) {
      const resolved: ResolvedClientLocation = {
        ...coords,
        source: "what3words",
        label: `what3words: ${words}`,
      };
      saveCachedLocation("client", client.id, resolved);
      return resolved;
    }
  }

  const postcode = client.postcode || extractPostcode(client.projectAddress || "");
  if (postcode && opts.googleMapsApiKey) {
    const coords = await geocodeWithGoogle(`${postcode}, UK`, opts.googleMapsApiKey);
    if (coords) {
      const resolved: ResolvedClientLocation = {
        ...coords,
        source: "postcode",
        label: `Postcode: ${postcode}`,
      };
      saveCachedLocation("client", client.id, resolved);
      return resolved;
    }
  }

  if (client.projectAddress && opts.googleMapsApiKey) {
    const coords = await geocodeWithGoogle(client.projectAddress, opts.googleMapsApiKey);
    if (coords) {
      const resolved: ResolvedClientLocation = {
        ...coords,
        source: "address",
        label: firstAddressLine(client.projectAddress),
      };
      saveCachedLocation("client", client.id, resolved);
      return resolved;
    }
  }

  return null;
}

export async function resolveEstimateLocation(
  estimate: EstimateLocationLike,
  clientFallback: Client,
  opts: { googleMapsApiKey: string; what3wordsApiKey?: string }
): Promise<ResolvedClientLocation | null> {
  const lat = Number(estimate.latitude);
  const lng = Number(estimate.longitude);
  const hasValidUkDirectCoordinates = isValidUkCoordinatePair(lat, lng);

  const words = normalizeWhat3Words(estimate.what3words);
  const estimateAddress = usableLocationText(estimate.projectAddress);
  const postcode = usableLocationText(estimate.postcode) || extractPostcode(estimateAddress);
  const addressLine = firstAddressLine(estimateAddress);
  const cached = loadCachedLocation("estimate", estimate.id);
  const clientProjectAddress = usableLocationText(clientFallback.projectAddress);
  const clientCustomerAddress = usableLocationText(clientFallback.customerAddress);
  const clientProjectPostcode = usableLocationText(clientFallback.projectAddressStructured?.postcode) || extractPostcode(clientProjectAddress);
  const clientCustomerPostcode = usableLocationText(clientFallback.customerAddressStructured?.postcode) || extractPostcode(clientCustomerAddress);
  const clientPostcode = clientProjectPostcode || clientCustomerPostcode || usableLocationText(clientFallback.postcode);
  const clientLat = Number(clientFallback.latitude);
  const clientLng = Number(clientFallback.longitude);
  const inputKey = JSON.stringify([
    hasValidUkDirectCoordinates ? lat : null,
    hasValidUkDirectCoordinates ? lng : null,
    postcode,
    estimateAddress,
    isValidUkCoordinatePair(clientLat, clientLng) ? clientLat : null,
    isValidUkCoordinatePair(clientLat, clientLng) ? clientLng : null,
    clientPostcode,
    clientProjectAddress,
    clientCustomerAddress,
    words,
    normalizeWhat3Words(clientFallback.what3words),
  ]);

  // Reuse only a resolution made from the same normalized inputs. Failed
  // resolutions are never cached, so an unresolved project remains retryable.
  if (cached && cached.inputKey === inputKey && isValidUkCoordinatePair(cached.lat, cached.lng)) return cached;

  // Project/site postal data is authoritative. Client postal data is the
  // fallback; what3words is used only when neither has a resolvable address.
  if (hasValidUkDirectCoordinates) {
    const resolved: ResolvedClientLocation = {
      lat,
      lng,
      source: "estimate",
      label: buildEstimateLocationLabel(estimate),
      resolvedAt: new Date().toISOString(),
      inputKey,
    };
    saveCachedLocation("estimate", estimate.id, resolved);
    return resolved;
  }
  if (postcode && opts.googleMapsApiKey) {
    const coords = await geocodeWithGoogle(`${postcode}, UK`, opts.googleMapsApiKey);
    if (coords) {
      const resolved: ResolvedClientLocation = {
        ...coords,
        source: "postcode",
        label: `Postcode: ${postcode}`,
        resolvedAt: new Date().toISOString(),
        inputKey,
      };
      saveCachedLocation("estimate", estimate.id, resolved);
      return resolved;
    }
  }

  if (addressLine && opts.googleMapsApiKey) {
    const coords = await geocodeWithGoogle(estimateAddress, opts.googleMapsApiKey);
    if (coords) {
      const resolved: ResolvedClientLocation = {
        ...coords,
        source: "address",
        label: addressLine,
        resolvedAt: new Date().toISOString(),
        inputKey,
      };
      saveCachedLocation("estimate", estimate.id, resolved);
      return resolved;
    }
  }

  if (isValidUkCoordinatePair(clientLat, clientLng)) {
    const resolved: ResolvedClientLocation = {
      lat: clientLat,
      lng: clientLng,
      source: "client",
      label: `Client address fallback: ${buildClientLocationLabel(clientFallback)}`,
      resolvedAt: new Date().toISOString(),
      inputKey,
      isClientAddressFallback: true,
    };
    saveCachedLocation("estimate", estimate.id, resolved);
    return resolved;
  }

  if (clientPostcode && opts.googleMapsApiKey) {
    const coords = await geocodeWithGoogle(`${clientPostcode}, UK`, opts.googleMapsApiKey);
    if (coords) {
      const resolved: ResolvedClientLocation = {
        ...coords,
        source: "client",
        label: `Client address fallback: ${clientPostcode}`,
        resolvedAt: new Date().toISOString(),
        inputKey,
        isClientAddressFallback: true,
      };
      saveCachedLocation("estimate", estimate.id, resolved);
      return resolved;
    }
  }

  const clientAddress = clientProjectAddress || clientCustomerAddress;
  const clientAddressLine = firstAddressLine(clientAddress);
  if (clientAddressLine && opts.googleMapsApiKey) {
    const coords = await geocodeWithGoogle(clientAddress, opts.googleMapsApiKey);
    if (coords) {
      const resolved: ResolvedClientLocation = {
        ...coords,
        source: "client",
        label: `Client address fallback: ${clientAddressLine}`,
        resolvedAt: new Date().toISOString(),
        inputKey,
        isClientAddressFallback: true,
      };
      saveCachedLocation("estimate", estimate.id, resolved);
      return resolved;
    }
  }

  const fallbackWords = words || normalizeWhat3Words(clientFallback.what3words);
  if (fallbackWords && opts.what3wordsApiKey) {
    const coords = await convertWhat3Words(fallbackWords, opts.what3wordsApiKey);
    if (coords) {
      const resolved: ResolvedClientLocation = {
        ...coords,
        source: "what3words",
        label: `what3words: ${fallbackWords}`,
        resolvedAt: new Date().toISOString(),
        inputKey,
      };
      saveCachedLocation("estimate", estimate.id, resolved);
      return resolved;
    }
  }

  return null;
}
