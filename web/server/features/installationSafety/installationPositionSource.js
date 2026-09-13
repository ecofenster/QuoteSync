export const positivePositionValue=value=>typeof value==='number'&&Number.isFinite(value)&&value>0?value:typeof value==='string'&&/^\d+(?:\.\d+)?$/.test(value.trim())&&Number(value)>0?Number(value):null;

// Shared by installer evidence projections: identity alone cannot validate stale dimensions.
export function installationPositionSource(position,scenario){
  const matches=(scenario?.products||[]).filter(row=>row.estimatePositionId===position.id);
  if(matches.length!==1)return {row:null,reason:'One exact saved Position source is required for weight evidence.'};
  const row=matches[0];
  if(['widthMm','heightMm','quantity'].some(key=>positivePositionValue(row[key])!==positivePositionValue(position[key])||positivePositionValue(position[key])===null))return {row:null,reason:'The saved source dimensions or quantity differ from this schedule.'};
  return {row,reason:null};
}

export function installerManufacturerDetails(position,scenario){
  const {row}=installationPositionSource(position,scenario);
  if(!row?.sourceRowId)return null;
  const evidence=row.sourceSnapshot?.manufacturerEvidence;
  const text=value=>typeof value==='string'?value.trim():'';
  // Never substitute document issuer, dealer, commercial supplier or a product brand.
  return {manufacturer:text(evidence?.manufacturerName),system:text(evidence?.productSystem)};
}
