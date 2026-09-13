const number=value=>value==null||value===''||!Number.isFinite(Number(value))||Number(value)<0?null:Number(value);
const text=value=>typeof value==='string'?value.trim():'';
const status=value=>['priced','available'].includes(value)?'Calculated from saved rules':['Cost required','GBP conversion required'].includes(value)?'Quantity calculated; staff review still required':text(value)||'Not confirmed';

// Installer-safe operational projection only. Never copy catalogue or purchasing objects wholesale.
export function projectInstallationMaterials(result){
  if(!result)return {status:'Not confirmed',rows:[]};
  const rows=(result.simpleMaterials||[]).filter(item=>item.required===true).map(item=>({
    code:text(item.code),name:text(item.variantLabel||item.label)||'Not confirmed',
    quantity:number(item.purchaseUnits),unit:text(item.purchaseUnit)||'Not confirmed',
    linearMetres:number(item.requiredLengthM),baseLinearMetres:result.perimeterStatus==='available'?number(item.baseLinearMetres):null,
    areaSquareMetres:null,rolls:number(item.rollsRequired),rollLengthMetres:number(item.rollLengthM),cans:number(item.purchasedCans),
    contingencyPercent:number(item.contingencyPercent),status:status(item.status),
  }));
  for(const [key,name] of [['brackets','Brackets'],['frameScrews','Bracket-to-frame screws'],['substrateFixings','Substrate fixings']]){
    const item=result.purchasing?.[key];if(!item)continue;
    rows.push({code:key,name,quantity:number(item.requiredQuantity),unit:'items',packs:number(item.packsRequired),status:status(item.status)});
  }
  if(result.packers?.inScope)rows.push({code:'packers',name:'Installation packers',quantity:number(result.packers.finalRequiredQuantity),unit:'items',status:status(result.packers.status)});
  return {status:result.status==='available'?'Calculated from saved rules':'Review required',rows};
}
