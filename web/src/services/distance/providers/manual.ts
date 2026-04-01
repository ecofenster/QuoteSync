import type { DistanceProvider, LatLng } from "../types";

export const manualDistanceProvider: DistanceProvider = {
  async geocodePostcode(): Promise<LatLng | null> {
    return null;
  },

  async getRouteDistance(): Promise<{ distanceKm: number; durationMinutes: number } | null> {
    return null;
  },
};
