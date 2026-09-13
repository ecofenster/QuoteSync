import {calculatePaneWeights} from '../../../shared/glassWeightArithmetic.js';
const positive=value=>typeof value==='number'&&Number.isFinite(value)&&value>0;
const nonnegative=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
const unknown=reason=>({status:'not_confirmed',glassKg:null,label:'Weight not confirmed',reason,handlingConfirmationRequired:true});
const thicknesses=panes=>Array.isArray(panes)&&panes.length>0&&panes.length<=4?panes.map(pane=>pane?.kind==='laminated'?pane.effectiveMm:['float','toughened'].includes(pane?.kind)?pane.thicknessMm:null):[];

// This consumes reviewed numeric evidence; parsing quotation strings or guessing pane build-ups is not its role.
export function estimateInstallationGlassWeight({widthMm,heightMm,panes,fields,shape='rect'}={}){
  if(shape!=='rect')return unknown('Review the actual glazing geometry for this non-rectangular opening.');
  if(!positive(widthMm)||!positive(heightMm))return unknown('Scheduled width and height are required.');
  const parts=fields===undefined?[{xMm:0,yMm:0,widthMm,heightMm,panes}]:fields;
  if(!Array.isArray(parts)||!parts.length||parts.length>100)return unknown('Complete glazing field evidence is required.');
  const accepted=[];
  for(const part of parts){
    if(!part||!positive(part.widthMm)||!positive(part.heightMm)||!nonnegative(part.xMm)||!nonnegative(part.yMm)||part.xMm+part.widthMm>widthMm||part.yMm+part.heightMm>heightMm)return unknown('A glazing field is outside the scheduled envelope or has missing dimensions.');
    if(accepted.some(item=>part.xMm<item.xMm+item.widthMm&&part.xMm+part.widthMm>item.xMm&&part.yMm<item.yMm+item.heightMm&&part.yMm+part.heightMm>item.yMm))return unknown('Glazing fields overlap. Review the field boundaries before estimating weight.');
    const layers=thicknesses(part.panes);if(!layers.length||layers.some(value=>!positive(value)))return unknown('Known thickness is required for every glass pane; gaps and unknown panes cannot become glass thickness.');
    accepted.push({...part,areaM2:part.widthMm*part.heightMm/1_000_000,thicknessesMm:layers});
  }
  const fieldWeights=accepted.map(part=>({areaM2:part.areaM2,thicknessesMm:part.thicknessesMm,glassKg:calculatePaneWeights(part.areaM2,part.thicknessesMm).total}));
  const glassKg=fieldWeights.reduce((sum,item)=>sum+item.glassKg,0);if(!Number.isFinite(glassKg))return unknown('The supplied dimensions cannot produce a finite weight estimate.');
  return {status:'estimated_glass_only',glassKg,label:'Estimated glass weight using approximate dimensions',basis:fields===undefined?'Scheduled unit dimensions used as an approximate glazing envelope':'Non-overlapping supplied field dimensions within the scheduled envelope',fieldWeights,handlingConfirmationRequired:true,warning:'Not complete unit weight. Frame, sash, hardware and other components may be absent. Confirm handling and lifting requirements before use.'};
}
