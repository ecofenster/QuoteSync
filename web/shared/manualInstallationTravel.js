const number=(value,label)=>{
  if(!['string','number'].includes(typeof value)||String(value).trim()===''||!Number.isFinite(Number(value))||Number(value)<0)throw new Error(`${label} is not confirmed. Enter a non-negative value; leave unknown travel for review rather than entering zero.`);
  return Number(value);
};
export function buildManualInstallationTravel(input){
  const point=(value,label)=>{
    if(!value||typeof value.label!=='string'||!value.label.trim()||value.lat==null||value.lng==null||String(value.lat).trim()===''||String(value.lng).trim()===''||!['string','number'].includes(typeof value.lat)||!['string','number'].includes(typeof value.lng)||!Number.isFinite(Number(value.lat))||!Number.isFinite(Number(value.lng))||Math.abs(Number(value.lat))>90||Math.abs(Number(value.lng))>180)throw new Error(`The ${label} location is not confirmed. Resolve the address or reuse its matching saved location before reviewing travel.`);
    return {label:value.label.trim(),lat:String(value.lat),lng:String(value.lng)};
  };
  const origin=point(input.origin,'installer base'),destination=point(input.destination,'site');
  const reason=typeof input.basis==='string'?input.basis.trim():'';
  if(!reason)throw new Error('Explain the source and basis of your manual travel estimate before reviewing it.');
  const common={integration:'manual',manuallyOverridden:true,overrideReason:reason,trafficDurationMinutes:null,calculatedAt:input.calculatedAt??new Date().toISOString()};
  return {out:{...common,direction:'office_to_site',origin,destination,distanceKm:String(number(input.outwardMiles,'Outward distance')/0.621371192),durationMinutes:number(input.outwardMinutes,'Outward time')},back:{...common,direction:'site_to_office',origin:destination,destination:origin,distanceKm:String(number(input.returnMiles,'Return distance')/0.621371192),durationMinutes:number(input.returnMinutes,'Return time')}};
}
