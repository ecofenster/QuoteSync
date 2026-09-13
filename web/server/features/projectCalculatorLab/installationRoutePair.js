import {validateRouteSnapshot} from './routeSnapshotValidation.js';
const normalized=value=>typeof value==='string'?value.trim().toUpperCase().replace(/\s+/g,''):'';
const fail=message=>{throw Object.assign(new Error(message),{code:'invalid_options'});};
const samePoint=(a,b)=>normalized(a?.label)===normalized(b?.label)&&Number(a?.lat)===Number(b?.lat)&&Number(a?.lng)===Number(b?.lng);

// Reviewed pair adoption derives all times/distances from retained server evidence.
// It never trusts browser-supplied metrics or takes another scenario's route.
export function bindInstallationRoutePair({scenarioId,profile,team,snapshots}) {
  const selection=profile.route;
  if(selection?.distanceBasis==='retained_directions_v1'&&!['daily_travel','stay_away'].includes(profile.travelMode))fail('Choose daily return travel or one outward and return journey around an overnight stay before applying directional travel costing.');
  if(!team?.id||team.id!==profile.selectedTeamId||team.active===false||!normalized(team.basePostcode)||!normalized(profile.sitePostcode))fail('Confirm an active installer Team, its base and the site before saving travel.');
  if(profile.selectedInstallationCompanyId&&profile.selectedInstallationCompanyId!==team.companyId)fail('The selected Team does not belong to this Installation Company. Review the Company and Team together.');
  const pick=(id,direction)=>{
    const rows=snapshots.filter(row=>row.id===id&&row.scenarioId===scenarioId);
    if(rows.length!==1)fail('Select one retained route for each direction from this costing. Your existing travel is unchanged.');
    const route=rows[0];
    try{validateRouteSnapshot(route);}catch{fail('A saved route has incomplete location or travel evidence. Recalculate it or supply a reviewed manual route.');}
    if(route.direction!==direction||(!route.manuallyOverridden&&route.integration!=='google_routes_installation_team'))fail('Use installer-to-site and site-to-installer routes, not general office travel.');
    return route;
  };
  const outward=pick(selection?.snapshotId,'office_to_site'),back=pick(selection?.returnSnapshotId,'site_to_office');
  if(outward.id===back.id||normalized(outward.origin.label)!==normalized(team.basePostcode)||normalized(outward.destination.label)!==normalized(profile.sitePostcode)||!samePoint(back.origin,outward.destination)||!samePoint(back.destination,outward.origin))fail('These routes do not form a return journey between the selected installer base and site. Review both directions; existing travel is unchanged.');
  return {...selection,snapshotId:outward.id,returnSnapshotId:back.id,
    oneWayMiles:(Number(outward.distanceKm)*0.621371192).toFixed(2),oneWayDurationMinutes:Number(outward.durationMinutes),
    returnMiles:(Number(back.distanceKm)*0.621371192).toFixed(2),returnDurationMinutes:Number(back.durationMinutes),
    distanceUnit:'miles',sitePostcode:profile.sitePostcode,installerBasePostcode:team.basePostcode,
    calculationSource:outward.integration,returnCalculationSource:back.integration,
    calculationMethod:outward.manuallyOverridden?'reviewed_manual':'google_routes',
    manuallyOverridden:outward.manuallyOverridden===true,overrideReason:outward.overrideReason??null,
    returnManuallyOverridden:back.manuallyOverridden===true,returnOverrideReason:back.overrideReason??null,
    capturedAt:outward.calculatedAt,returnCapturedAt:back.calculatedAt};
}
