import type { Client, Estimate } from "../models/types";

export type ResolvedClientLocation = {
  lat: number;
  lng: number;
  source: "client" | "estimate" | "cache" | "postcode" | "what3words" | "address";
  label: string;
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

function isValidUkCoordinatePair(lat: number, lng: number) {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= 49 && lat <= 61 && lng >= -8 && lng <= 2;
}

function areCoordinatesMeaningfullyDifferent(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
  tolerance = 0.1
) {
  return Math.abs(a.lat - b.lat) + Math.abs(a.lng - b.lng) > tolerance;
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

async function geocodeWithGoogle(query: string, apiKey: string) {
  const browserCoords = await geocodeWithGoogleBrowser(query).catch(() => null);
  if (browserCoords) return browserCoords;
  if (!apiKey) return null;

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&region=GB&key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    if (data?.status && data.status !== "OK" && data.status !== "ZERO_RESULTS") return null;
    const first = data?.results?.[0];
    const location = first?.geometry?.location;
    if (!location || typeof location.lat !== "number" || typeof location.lng !== "number") return null;
    return { lat: location.lat, lng: location.lng };
  } catch {
    return null;
  }
}

async function geocodeWithGoogleBrowser(query: string) {
  if (typeof window === "undefined" || !window.google?.maps?.Geocoder) return null;
  const geocoder = new window.google.maps.Geocoder();

  return new Promise<{ lat: number; lng: number } | null>((resolve, reject) => {
    geocoder.geocode({ address: query, region: "GB" }, (results, status) => {
      if (status !== "OK" || !results?.length) {
        if (status === "ZERO_RESULTS") {
          resolve(null);
          return;
        }
        reject(new Error(`Browser geocoder failed: ${status}`));
        return;
      }

      const location = results[0]?.geometry?.location;
      if (!location) {
        resolve(null);
        return;
      }

      resolve({ lat: location.lat(), lng: location.lng() });
    });
  });
}

async function convertWhat3Words(words: string, apiKey: string) {
  if (!apiKey) return null;
  try {
    const url = `https://api.what3words.com/v3/convert-to-coordinates?words=${encodeURIComponent(words)}&key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    const coords = data?.coordinates;
    if (!coords || typeof coords.lat !== "number" || typeof coords.lng !== "number") return null;
    return { lat: coords.lat, lng: coords.lng };
  } catch {
    return null;
  }
}

export async function resolveWhat3WordsCoordinates(words: string, apiKey: string) {
  return convertWhat3Words(normalizeWhat3Words(words), apiKey);
}

export async function convertCoordinatesToWhat3Words(lat: number, lng: number, apiKey: string) {
  if (!apiKey) return "";
  try {
    const coordText = `${lat},${lng}`;
    const url = `https://api.what3words.com/v3/convert-to-3wa?coordinates=${encodeURIComponent(coordText)}&key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(url);
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
  void clientFallback;

  const lat = Number(estimate.latitude);
  const lng = Number(estimate.longitude);
  const hasValidUkDirectCoordinates = isValidUkCoordinatePair(lat, lng);

  const words = normalizeWhat3Words(estimate.what3words);
  const postcode = estimate.postcode || extractPostcode(estimate.projectAddress || "");
  const addressLine = firstAddressLine(estimate.projectAddress || "");
  const hasEstimateLocationInput =
    hasValidUkDirectCoordinates || !!words || !!postcode || !!addressLine;

  if (!hasEstimateLocationInput) {
    return null;
  }

  if (postcode && opts.googleMapsApiKey) {
    const coords = await geocodeWithGoogle(`${postcode}, UK`, opts.googleMapsApiKey);
    if (coords) {
      const resolved: ResolvedClientLocation = {
        ...coords,
        source: "postcode",
        label: `Postcode: ${postcode}`,
      };
      saveCachedLocation("estimate", estimate.id, resolved);
      return resolved;
    }
  }

  if (words && opts.what3wordsApiKey) {
    const coords = await convertWhat3Words(words, opts.what3wordsApiKey);
    if (coords) {
      if (
        hasValidUkDirectCoordinates &&
        areCoordinatesMeaningfullyDifferent(coords, { lat, lng })
      ) {
        const resolved: ResolvedClientLocation = {
          ...coords,
          source: "what3words",
          label: `what3words: ${words}`,
        };
        saveCachedLocation("estimate", estimate.id, resolved);
        return resolved;
      }

      const resolved: ResolvedClientLocation = {
        ...coords,
        source: "what3words",
        label: `what3words: ${words}`,
      };
      saveCachedLocation("estimate", estimate.id, resolved);
      return resolved;
    }
  }

  if (addressLine && opts.googleMapsApiKey) {
    const coords = await geocodeWithGoogle(estimate.projectAddress || "", opts.googleMapsApiKey);
    if (coords) {
      if (
        hasValidUkDirectCoordinates &&
        areCoordinatesMeaningfullyDifferent(coords, { lat, lng })
      ) {
        const resolved: ResolvedClientLocation = {
          ...coords,
          source: "address",
          label: addressLine,
        };
        saveCachedLocation("estimate", estimate.id, resolved);
        return resolved;
      }

      const resolved: ResolvedClientLocation = {
        ...coords,
        source: "address",
        label: addressLine,
      };
      saveCachedLocation("estimate", estimate.id, resolved);
      return resolved;
    }
  }

  if (hasValidUkDirectCoordinates) {
    const resolved: ResolvedClientLocation = {
      lat,
      lng,
      source: "estimate",
      label: buildEstimateLocationLabel(estimate),
    };
    saveCachedLocation("estimate", estimate.id, resolved);
    return resolved;
  }

  const cached = loadCachedLocation("estimate", estimate.id);
  if (
    cached &&
    isValidUkCoordinatePair(cached.lat, cached.lng)
  ) {
    return {
      lat: cached.lat,
      lng: cached.lng,
      source: "cache",
      label: buildEstimateLocationLabel(estimate),
    };
  }

  return null;
}
