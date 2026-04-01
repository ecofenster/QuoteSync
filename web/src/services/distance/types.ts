export type MapsProvider = "google" | "azure" | "manual" | "none";

export type LatLng = {
  lat: number;
  lng: number;
};

export type DistanceResult = {
  installerId: string;
  installerPostcode: string;
  sitePostcode: string;
  provider: MapsProvider;
  distanceKm: number | null;
  durationMinutes: number | null;
  status: "ok" | "approximate" | "failed";
  reason?: string;
};

export type DistanceProvider = {
  geocodePostcode(postcode: string, apiKey?: string): Promise<LatLng | null>;
  getRouteDistance(from: LatLng, to: LatLng, apiKey?: string): Promise<{ distanceKm: number; durationMinutes: number } | null>;
};
