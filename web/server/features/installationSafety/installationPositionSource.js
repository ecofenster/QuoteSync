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

export function installerOpeningDetails(position,scenario){
  const {row}=installationPositionSource(position,scenario);
  if(!row?.sourceRowId)return '';
  const evidence=row.sourceSnapshot?.manufacturerEvidence,spec=evidence?.sourceSpecification;
  const canonical=evidence?.canonicalSpecification||spec?.canonical,sashes=canonical?.sashes;
  if(!Array.isArray(sashes)||!sashes.length||sashes.length>100)return '';
  const fields=(spec?.sections||[]).flatMap(section=>Array.isArray(section.fields)?section.fields:[]);
  const references=new Set();let confirmed=0;
  const parts=[];
  for(const sash of sashes){
    const reference=typeof sash.sourceElementReference==='string'?sash.sourceElementReference.trim():'';
    if(!reference||references.has(reference))return '';
    references.add(reference);
    const value=typeof sash.fitting==='string'&&sash.fitting.trim()?sash.fitting:sash.profile==='Fix in frame'?sash.profile:null;
    const label=value===sash.fitting?'Fitting':'Profile';
    const matches=value&&Array.isArray(sash.sourceFieldIds)?fields.filter(field=>sash.sourceFieldIds.includes(field.id)&&field.label===label&&/^Sash(?: \d+)?$/.test(field.section||'')&&field.rawValue===value&&Number.isInteger(field.sourcePage)&&field.sourcePage>0):[];
    const supplied=matches.length===1?value:null;
    if(supplied)confirmed++;
    parts.push(`${reference}: ${supplied||'Not confirmed'}`);
  }
  return confirmed?parts.join('; '):'';
}
