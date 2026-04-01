import type { DistanceResult, LatLng, MapsProvider } from "./types";
import { normalisePostcode } from "./normalisePostcode";

const GEO_CACHE_KEY = "qs_geo_cache_v1";
const DIST_CACHE_KEY = "qs_dist_cache_v1";

type GeoCache = Record<string, LatLng>;
type DistanceCache = Record<string, DistanceResult>;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage failures
  }
}

export function getCachedGeocode(postcode: string): LatLng | null {
  const cache = readJson<GeoCache>(GEO_CACHE_KEY, {});
  return cache[normalisePostcode(postcode)] ?? null;
}

export function setCachedGeocode(postcode: string, value: LatLng) {
  const cache = readJson<GeoCache>(GEO_CACHE_KEY, {});
  cache[normalisePostcode(postcode)] = value;
  writeJson(GEO_CACHE_KEY, cache);
}

function distanceCacheKey(provider: MapsProvider, fromPostcode: string, toPostcode: string) {
  return [provider, normalisePostcode(fromPostcode), normalisePostcode(toPostcode)].join("|");
}

export function getCachedDistance(provider: MapsProvider, fromPostcode: string, toPostcode: string): DistanceResult | null {
  const cache = readJson<DistanceCache>(DIST_CACHE_KEY, {});
  return cache[distanceCacheKey(provider, fromPostcode, toPostcode)] ?? null;
}

export function setCachedDistance(provider: MapsProvider, fromPostcode: string, toPostcode: string, value: DistanceResult) {
  const cache = readJson<DistanceCache>(DIST_CACHE_KEY, {});
  cache[distanceCacheKey(provider, fromPostcode, toPostcode)] = value;
  writeJson(DIST_CACHE_KEY, cache);
}
