const invalid=message=>{throw Object.assign(new Error(message),{code:'invalid_installation_workforce'});};
export function normalizeInstallationTravelPolicy(value){
  if(value==null)return null;
  if(typeof value!=='object'||Array.isArray(value)||!['per_vehicle_mile','included_mileage'].includes(value.mode))invalid('Choose a supported vehicle-mileage policy or leave it unconfigured.');
  const basis=typeof value.basis==='string'?value.basis.trim():'';
  if(!basis||basis.length>2000)invalid('Explain the agreed vehicle-mileage basis in up to 2,000 characters.');
  let mileageRate=null;
  if(value.mode==='per_vehicle_mile'){
    if(!['string','number'].includes(typeof value.mileageRate)||!/^\d+(?:\.\d{1,2})?$/.test(String(value.mileageRate))||!Number.isFinite(Number(value.mileageRate)))invalid('Enter the agreed mileage rate per vehicle in pounds per mile. Unknown rates must remain unconfigured.');
    mileageRate=Number(value.mileageRate).toFixed(2);
  }
  return {schemaVersion:1,mode:value.mode,mileageRate,basis};
}
