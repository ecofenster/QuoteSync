export type InstallationTravelPolicy={schemaVersion:1;mode:'per_vehicle_mile'|'included_mileage';mileageRate:string|null;basis:string};
export function normalizeInstallationTravelPolicy(value:unknown):InstallationTravelPolicy|null;
