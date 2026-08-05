import { googleDistanceProvider } from "../../../services/distance/providers/google";
import { resolveWhat3WordsCoordinates } from "../../../services/locationService";
import type { CalculatorRouteSnapshot, RouteEndpoint } from "../domain/projectCalculatorLab.types";

export type RouteIntegrationConfig={googleMapsApiKey:string;what3wordsApiKey:string};
export type RouteDraft=Omit<CalculatorRouteSnapshot,"id"|"scenarioId">;

export async function resolveRouteEndpoint(label:string,config:RouteIntegrationConfig):Promise<RouteEndpoint|null>{
  const normalized=label.trim();
  const coords=normalized.split(",").map(Number);
  if(coords.length===2&&coords.every(Number.isFinite))return {label:normalized,lat:String(coords[0]),lng:String(coords[1])};
  if(normalized.split(".").length===3&&config.what3wordsApiKey){const found=await resolveWhat3WordsCoordinates(normalized,config.what3wordsApiKey);if(found)return {label:normalized,lat:String(found.lat),lng:String(found.lng)};}
  const found=await googleDistanceProvider.geocodePostcode(normalized,config.googleMapsApiKey);
  return found?{label:normalized,lat:String(found.lat),lng:String(found.lng)}:null;
}

export async function calculateDirectionalRoute(direction:"office_to_site"|"site_to_office",origin:RouteEndpoint,destination:RouteEndpoint,config:RouteIntegrationConfig):Promise<RouteDraft|null>{
  const route=await googleDistanceProvider.getRouteDistance({lat:Number(origin.lat),lng:Number(origin.lng)},{lat:Number(destination.lat),lng:Number(destination.lng)},config.googleMapsApiKey);
  if(!route)return null;
  return {direction,origin,destination,distanceKm:String(route.distanceKm),durationMinutes:route.durationMinutes,trafficDurationMinutes:null,calculatedAt:new Date().toISOString(),integration:"google_distance_matrix",manuallyOverridden:false,overrideReason:null};
}

export const ROUTE_INTEGRATION_CAPABILITIES=Object.freeze({googleMapDisplay:true,googleGeocoding:true,googleRoutableDistance:true,normalDuration:true,trafficAwareDuration:false,what3wordsCoordinates:true,directionalSnapshots:true});
