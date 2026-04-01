import type { Installer } from "../../models/types";
import type { DistanceProvider, DistanceResult, MapsProvider } from "./types";
import { normalisePostcode } from "./normalisePostcode";
import { getCachedDistance, getCachedGeocode, setCachedDistance, setCachedGeocode } from "./cache";
import { googleDistanceProvider } from "./providers/google";
import { azureDistanceProvider } from "./providers/azure";
import { manualDistanceProvider } from "./providers/manual";

function getProvider(provider: MapsProvider): DistanceProvider {
  if (provider === "google") return googleDistanceProvider;
  if (provider === "azure") return azureDistanceProvider;
  return manualDistanceProvider;
}

export async function rankInstallersByDistance(args: {
  sitePostcode: string;
  installers: Installer[];
  provider: MapsProvider;
  apiKey?: string;
}): Promise<DistanceResult[]> {
  const sitePostcode = normalisePostcode(args.sitePostcode);
  if (!sitePostcode) return [];

  const providerImpl = getProvider(args.provider);
  const siteGeo = getCachedGeocode(sitePostcode) ?? await providerImpl.geocodePostcode(sitePostcode, args.apiKey);

  if (siteGeo) {
    setCachedGeocode(sitePostcode, siteGeo);
  }

  const results: DistanceResult[] = [];

  for (const installer of args.installers) {
    const installerPostcode = normalisePostcode(installer.postcode);
    if (!installerPostcode) {
      results.push({
        installerId: installer.id,
        installerPostcode: "",
        sitePostcode,
        provider: args.provider,
        distanceKm: null,
        durationMinutes: null,
        status: "failed",
        reason: "Installer postcode missing",
      });
      continue;
    }

    const cached = getCachedDistance(args.provider, sitePostcode, installerPostcode);
    if (cached) {
      results.push(cached);
      continue;
    }

    const installerGeo = getCachedGeocode(installerPostcode) ?? await providerImpl.geocodePostcode(installerPostcode, args.apiKey);
    if (installerGeo) {
      setCachedGeocode(installerPostcode, installerGeo);
    }

    if (!siteGeo || !installerGeo) {
      results.push({
        installerId: installer.id,
        installerPostcode,
        sitePostcode,
        provider: args.provider,
        distanceKm: null,
        durationMinutes: null,
        status: "failed",
        reason: "Unable to geocode postcode",
      });
      continue;
    }

    const route = await providerImpl.getRouteDistance(siteGeo, installerGeo, args.apiKey);
    const result: DistanceResult = route
      ? {
          installerId: installer.id,
          installerPostcode,
          sitePostcode,
          provider: args.provider,
          distanceKm: route.distanceKm,
          durationMinutes: route.durationMinutes,
          status: "ok",
        }
      : {
          installerId: installer.id,
          installerPostcode,
          sitePostcode,
          provider: args.provider,
          distanceKm: null,
          durationMinutes: null,
          status: "failed",
          reason: "Unable to calculate route",
        };

    setCachedDistance(args.provider, sitePostcode, installerPostcode, result);
    results.push(result);
  }

  return results.sort((a, b) => {
    const aTime = a.durationMinutes ?? Number.MAX_SAFE_INTEGER;
    const bTime = b.durationMinutes ?? Number.MAX_SAFE_INTEGER;
    if (aTime !== bTime) return aTime - bTime;

    const aDist = a.distanceKm ?? Number.MAX_SAFE_INTEGER;
    const bDist = b.distanceKm ?? Number.MAX_SAFE_INTEGER;
    return aDist - bDist;
  });
}
