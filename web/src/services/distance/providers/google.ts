import type { DistanceProvider, LatLng } from "../types";

export const googleDistanceProvider: DistanceProvider = {
  async geocodePostcode(postcode: string, apiKey?: string): Promise<LatLng | null> {
    if (!apiKey) return null;

    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("address", postcode);
    url.searchParams.set("key", apiKey);

    const res = await fetch(url.toString());
    if (!res.ok) return null;

    const data = await res.json();
    const loc = data?.results?.[0]?.geometry?.location;
    if (!loc || typeof loc.lat !== "number" || typeof loc.lng !== "number") return null;

    return { lat: loc.lat, lng: loc.lng };
  },

  async getRouteDistance(from: LatLng, to: LatLng, apiKey?: string): Promise<{ distanceKm: number; durationMinutes: number } | null> {
    if (!apiKey) return null;

    const url = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
    url.searchParams.set("origins", `${from.lat},${from.lng}`);
    url.searchParams.set("destinations", `${to.lat},${to.lng}`);
    url.searchParams.set("key", apiKey);
    url.searchParams.set("units", "metric");

    const res = await fetch(url.toString());
    if (!res.ok) return null;

    const data = await res.json();
    const el = data?.rows?.[0]?.elements?.[0];
    if (!el || el.status !== "OK") return null;

    const distanceMeters = el.distance?.value;
    const durationSeconds = el.duration?.value;
    if (typeof distanceMeters !== "number" || typeof durationSeconds !== "number") return null;

    return {
      distanceKm: distanceMeters / 1000,
      durationMinutes: Math.round(durationSeconds / 60),
    };
  },
};
