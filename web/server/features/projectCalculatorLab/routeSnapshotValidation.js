const fail=message=>{throw Object.assign(new Error(message),{code:'invalid_route'});};
const supplied=value=>value!==null&&value!==undefined&&value!=='';
const finite=value=>supplied(value)&&['string','number'].includes(typeof value)&&(typeof value!=='string'||!!value.trim())&&Number.isFinite(Number(value));

export function validateRouteSnapshot(input){
  if(!input||!['office_to_site','site_to_office'].includes(input.direction))fail('Choose the outward or return journey before saving.');
  for(const [key,label] of [['origin','departure'],['destination','destination']]){
    const endpoint=input[key];
    if(!endpoint||typeof endpoint.label!=='string'||!endpoint.label.trim())fail(`Confirm the ${label} address before saving this route.`);
    if(!finite(endpoint.lat)||Math.abs(Number(endpoint.lat))>90||!finite(endpoint.lng)||Math.abs(Number(endpoint.lng))>180)fail(`The ${label} address has no valid resolved location. Resolve it before saving this route; do not use invented coordinates.`);
  }
  if(!finite(input.distanceKm)||Number(input.distanceKm)<0)fail('Travel distance is not confirmed. Calculate the route or provide a reviewed manual distance.');
  if(!finite(input.durationMinutes)||Number(input.durationMinutes)<0)fail('Travel time is not confirmed. Calculate the route or provide a reviewed manual duration.');
  if(supplied(input.trafficDurationMinutes)&&(!finite(input.trafficDurationMinutes)||Number(input.trafficDurationMinutes)<0))fail('The traffic-adjusted travel time is invalid. Recalculate or remove that value.');
  if(typeof input.integration!=='string'||!input.integration.trim())fail('Record the route source or manual calculation basis before saving.');
  if(input.manuallyOverridden&&!(typeof input.overrideReason==='string'&&input.overrideReason.trim()))fail('Manual route overrides require a reason.');
}
