import {validateRouteSnapshot} from '../projectCalculatorLab/routeSnapshotValidation.js';
const text=value=>typeof value==='string'?value.trim():'';
const normalized=value=>text(value).toUpperCase().replace(/\s+/g,'');
const postcodes=value=>[...text(value).toUpperCase().matchAll(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/g)].map(match=>normalized(match[0]));
const valid=route=>{try{validateRouteSnapshot(route);return true}catch{return false}};
const samePoint=(a,b)=>normalized(a?.label)===normalized(b?.label)&&Number(a?.lat)===Number(b?.lat)&&Number(a?.lng)===Number(b?.lng);

export function projectInstallerTravel(scenario,revision){
  const profile=scenario?.options?.installationProfile||{},team=scenario?.selectedInstallationTeam;
  const pattern=['daily_travel','stay_away'].includes(profile.travelMode)?profile.travelMode:null;
  const unknown=reason=>({status:'Travel time not confirmed',departure:'',destination:'',oneWayMinutes:null,returnMinutes:null,pattern,basis:reason,capturedAt:null});
  const base=text(team?.basePostcode),site=text(profile.sitePostcode),siteCodes=postcodes(revision?.siteAddress);
  if(!team?.id||team.id!==profile.selectedTeamId||!base||!site||siteCodes.length!==1||siteCodes[0]!==normalized(site))return unknown('Review the saved installer team base and this revision’s site address before confirming travel.');
  const snapshots=scenario?.routeSnapshots||[],outward=snapshots.filter(item=>item.id===profile.route?.snapshotId);
  if(outward.length!==1)return unknown('Select one retained installer-to-site route.');
  const route=outward[0];
  if(route.scenarioId!==scenario.id||route.direction!=='office_to_site'||!valid(route)||normalized(route.origin.label)!==normalized(base)||normalized(route.destination.label)!==normalized(site)||(!route.manuallyOverridden&&route.integration!=='google_routes_installation_team'))return unknown('The selected route does not match the saved installer base and site. Review the route before using it.');
  const returns=snapshots.filter(item=>item.id===profile.route?.returnSnapshotId);
  const back=returns.length===1?returns[0]:null;
  const returnValid=back&&back.id!==route.id&&back.scenarioId===scenario.id&&back.direction==='site_to_office'&&valid(back)&&samePoint(back.origin,route.destination)&&samePoint(back.destination,route.origin)&&(back.manuallyOverridden||back.integration==='google_routes_installation_team');
  const basis=route.manuallyOverridden?text(route.overrideReason):'Retained installer-base postcode route estimate';
  return {status:returnValid?'Retained outward and return route estimates':'Return travel time not confirmed',departure:route.origin.label,destination:route.destination.label,oneWayMinutes:Number(route.durationMinutes),returnMinutes:returnValid?Number(back.durationMinutes):null,pattern,basis:`${basis}. ${returnValid?(back.manuallyOverridden?`Return: ${back.overrideReason}`:'Return uses its separate retained route.'):'Review and retain the return journey; outward travel time has not been reused.'}`,capturedAt:route.calculatedAt||null};
}
