import type { DistanceProvider, LatLng } from "../types";

export const azureDistanceProvider: DistanceProvider = {
  async geocodePostcode(postcode: string, apiKey?: string): Promise<LatLng | null> {
    if (!apiKey) return null;

    const url = new URL("https://atlas.microsoft.com/search/address/json");
    url.searchParams.set("api-version", "1.0");
    url.searchParams.set("subscription-key", apiKey);
    url.searchParams.set("query", postcode);

    const res = await fetch(url.toString());
    if (!res.ok) return null;

    const data = await res.json();
    const pos = data?.results?.[0]?.position;
    if (!pos || typeof pos.lat !== "number" || typeof pos.lon !== "number") return null;

    return { lat: pos.lat, lng: pos.lon };
  },

  async getRouteDistance(from: LatLng, to: LatLng, apiKey?: string): Promise<{ distanceKm: number; durationMinutes: number } | null> {
    if (!apiKey) return null;

    const url = new URL("https://atlas.microsoft.com/route/directions/json");
    url.searchParams.set("api-version", "1.0");
    url.searchParams.set("subscription-key", apiKey);
    url.searchParams.set("query", `${from.lat},${from.lng}:${to.lat},${to.lng}`);

    const res = await fetch(url.toString());
    if (!res.ok) return null;

    const data = await res.json();
    const summary = data?.routes?.[0]?.summary;
    if (!summary) return null;

    const distanceMeters = summary.lengthInMeters;
    const travelSeconds = summary.travelTimeInSeconds;
    if (typeof distanceMeters !== "number" || typeof travelSeconds !== "number") return null;

    return {
      distanceKm: distanceMeters / 1000,
      durationMinutes: Math.round(travelSeconds / 60),
    };
  },
};
