import {sourceBackedGlassFallback} from './installationGlazingEvidence.js';
const positive=value=>typeof value==='number'&&Number.isFinite(value)&&value>0?value:typeof value==='string'&&/^\d+(?:\.\d+)?$/.test(value.trim())&&Number(value)>0?Number(value):null;
const unknown=reason=>({status:'not_confirmed',unitKg:null,label:'Weight not confirmed',reason,handlingConfirmationRequired:true});

// Resolve only exact saved Position ownership. A neighbouring row or quotation total is not a unit weight.
export function projectInstallationPositionWeight(position,scenario){
  const matches=(scenario?.products||[]).filter(row=>row.estimatePositionId===position.id);
  if(matches.length!==1)return unknown('One exact saved Position source is required for weight evidence.');
  const row=matches[0];
  if(['widthMm','heightMm','quantity'].some(key=>positive(row[key])!==positive(position[key])||positive(position[key])===null))return unknown('The saved source dimensions or quantity differ from this schedule.');
  const evidence=row.sourceSnapshot?.manufacturerEvidence,spec=evidence?.sourceSpecification,canonical=evidence?.canonicalSpecification||spec?.canonical,weight=canonical?.weightKg;
  const kg=positive(weight?.value??evidence?.weightKg);
  if(kg===null)return sourceBackedGlassFallback(position,row)||unknown('Manufacturer unit weight and complete source-backed glazing evidence are not available. Review pane thicknesses and any mixed field build-ups.');
  const fields=(spec?.sections||[]).flatMap(section=>Array.isArray(section.fields)?section.fields:[]).filter(field=>field.id===weight?.sourceFieldId);
  const field=fields.length===1?fields[0]:null;
  if(!field||field.label!=='Unit weight'||positive(field.normalizedValue)!==kg||!Number.isInteger(field.sourcePage)||field.sourcePage<1||!row.sourceRowId)return {...unknown('The manufacturer weight has no unambiguous retained per-unit source. Review the quotation before using it.'),status:'manufacturer_basis_unconfirmed',statedKg:kg};
  return {status:'manufacturer_stated_unit',unitKg:kg,label:'Manufacturer-stated unit weight',source:{sourceRowId:row.sourceRowId,sourceRevisionId:row.sourceRevisionId||null,sourceFieldId:field.id,page:field.sourcePage,label:field.label},handlingConfirmationRequired:true,reason:'Manufacturer evidence is not a verified lifting plan. Confirm handling requirements before attending.'};
}
