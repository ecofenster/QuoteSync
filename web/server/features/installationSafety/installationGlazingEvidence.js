import {estimateInstallationGlassWeight} from './installationGlassWeight.js';

// Bounded supplier notation already retained by source extraction. Do not interpret laminate shorthand or total IGU thickness.
export function uniformGlassPaneThicknesses(value){
  if(typeof value!=='string')return null;
  const [token,...suffix]=value.trim().split(/\s+/),parts=token.split('/');
  if(!/^(?:\[Ug=[\d.,]+\]\s*)?(?:Rw=[\d.,]+dB\s*)?(?:\(\d+mm\)\s*)?(?:\d{4})?$/i.test(suffix.join(' ')))return null;
  if(parts.length<3||parts.length>7||parts.length%2===0)return null;
  const panes=[];
  for(let i=0;i<parts.length;i++){
    const match=parts[i].match(i%2?/^(\d+(?:\.\d+)?)(?:Ar|Kr)?$/i:/^(\d+(?:\.\d+)?)(?:th)?$/i);
    if(!match||Number(match[1])<=0)return null;
    // Decimal laminate designations such as 44.2 are not decimal pane thicknesses.
    if(i%2===0){if(match[1].includes('.'))return null;panes.push(Number(match[1]));}
  }
  return panes;
}
export function sourceBackedGlassFallback(position,row){
  const evidence=row.sourceSnapshot?.manufacturerEvidence,spec=evidence?.sourceSpecification,canonical=evidence?.canonicalSpecification||spec?.canonical,glazing=canonical?.glazing;
  const fields=(spec?.sections||[]).flatMap(section=>Array.isArray(section.fields)?section.fields:[]).filter(field=>field.id===glazing?.sourceFieldId);
  const field=fields.length===1?fields[0]:null,panes=uniformGlassPaneThicknesses(glazing?.value);
  if(!row.sourceRowId||!field||field.label!=='Glazing'||field.rawValue!==glazing?.value||!Number.isInteger(field.sourcePage)||field.sourcePage<1||!panes)return null;
  for(const unit of canonical.glazingUnits||[]){const other=uniformGlassPaneThicknesses(unit.glassBuildUp);if(!other||JSON.stringify(other)!==JSON.stringify(panes))return null;}
  const rawShape=row.sourceSnapshot?.shape??row.sourceSnapshot?.productShape??row.sourceSnapshot?.canonicalPosition?.shape;
  const shape=rawShape==null||['rect','rectangle','rectangular','standard'].includes(String(rawShape).toLowerCase())?'rect':'unsupported';
  const result=estimateInstallationGlassWeight({widthMm:Number(position.widthMm),heightMm:Number(position.heightMm),shape,panes:panes.map(thicknessMm=>({kind:'float',thicknessMm}))});
  if(result.status!=='estimated_glass_only')return null;
  return {...result,unitKg:null,reason:result.warning,source:{sourceRowId:row.sourceRowId,sourceRevisionId:row.sourceRevisionId||null,sourceFieldId:field.id,page:field.sourcePage,label:field.label},sourceBuildUp:glazing.value};
}
