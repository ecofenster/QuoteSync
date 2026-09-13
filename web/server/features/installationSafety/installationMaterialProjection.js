const number=value=>value==null||value===''||!Number.isFinite(Number(value))||Number(value)<0?null:Number(value);
const text=value=>typeof value==='string'?value.trim():'';
const status=value=>['priced','available'].includes(value)?'Calculated from saved rules':['Cost required','GBP conversion required'].includes(value)?'Quantity calculated; staff review still required':text(value)||'Not confirmed';
const basis=item=>{
  if(item.quantityStrategy==='order_fixed')return 'One per order; no contingency';
  if(item.quantityStrategy==='foam_volume_box'){
    const a=item.calculationAssumptions;
    return a&&[a.jointDepthMm,a.jointWidthMm,a.foamYieldLitresPerCan,a.cansPerBox].every(value=>number(value)>0)?`${a.jointDepthMm} mm joint depth × ${a.jointWidthMm} mm joint width; ${a.foamYieldLitresPerCan} litres per can; ${a.cansPerBox} cans per box; no separate linear contingency`:'Calculation basis not confirmed';
  }
  return number(item.contingencyPercent)!==null?`Saved installation-joint perimeter plus ${item.contingencyPercent}% linear contingency; whole-unit rounding`:'Calculation basis not confirmed';
};
const membraneArea=item=>{
  const width=number(item.rollWidthMm),length=number(item.requiredLengthM);
  if(!['ME508','ME501'].includes(item.code)||!item.productId||!(width>0)||length===null)return {};
  return {rollWidthMm:width,areaSquareMetres:Number((length*width/1000).toFixed(6)),areaBasis:'Saved linear requirement including its contingency × selected membrane width; not net installed coverage or whole-roll purchased area'};
};

// Installer-safe operational projection only. Never copy catalogue or purchasing objects wholesale.
export function projectInstallationMaterials(result){
  if(!result)return {status:'Not confirmed',rows:[]};
  const rows=(result.simpleMaterials||[]).filter(item=>item.required===true).map(item=>({
    code:text(item.code),name:text(item.variantLabel||item.label)||'Not confirmed',
    quantity:number(item.purchaseUnits),unit:text(item.purchaseUnit)||'Not confirmed',
    linearMetres:number(item.requiredLengthM),baseLinearMetres:result.perimeterStatus==='available'?number(item.baseLinearMetres):null,
    areaSquareMetres:null,...membraneArea(item),rolls:number(item.rollsRequired),rollLengthMetres:number(item.rollLengthM),cans:number(item.purchasedCans),
    contingencyPercent:number(item.contingencyPercent),basis:basis(item),status:status(item.status),
  }));
  for(const [key,name] of [['brackets','Brackets'],['frameScrews','Bracket-to-frame screws'],['substrateFixings','Substrate fixings']]){
    const item=result.purchasing?.[key];if(!item)continue;
    rows.push({code:key,name,specification:text(item.productLabel)||'Not confirmed',quantity:number(item.requiredQuantity),unit:'items',packs:number(item.packsRequired),basis:'Saved per-Position fixing calculation; whole-pack rounding; no contingency',status:status(item.status)});
  }
  if(result.packers?.inScope)rows.push({code:'packers',name:'Installation packers',quantity:number(result.packers.finalRequiredQuantity),unit:'items',status:status(result.packers.status)});
  return {status:result.status==='available'?'Calculated from saved rules':'Review required',rows};
}
