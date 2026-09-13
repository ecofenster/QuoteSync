type Point={label:string;lat:string|number;lng:string|number};
type Route={direction:'office_to_site'|'site_to_office';origin:Point;destination:Point;distanceKm:string;durationMinutes:number;integration:string;manuallyOverridden:boolean;overrideReason:string;trafficDurationMinutes:null;calculatedAt:string};
export function buildManualInstallationTravel(input:{origin:Point;destination:Point;outwardMiles:string|number;outwardMinutes:string|number;returnMiles:string|number;returnMinutes:string|number;basis:string;calculatedAt?:string}):{out:Route;back:Route};
