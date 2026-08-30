import { createHash, randomUUID } from 'node:crypto';

const parsePositions=value=>{try{const parsed=JSON.parse(value||'[]');return Array.isArray(parsed)?parsed:[];}catch{return [];}};
const normalized=value=>String(value??'').trim().replace(/\s+/g,' ').toUpperCase();
const positiveInteger=(value,fallback=1)=>Number.isInteger(Number(value))&&Number(value)>0?Number(value):fallback;
const signature=position=>[normalized(position.positionRef??position.displayReference),positiveInteger(position.qty??position.quantity),Number(position.widthMm)||0,Number(position.heightMm)||0].join('|');
const stableImportedId=(estimateId,sourceKey)=>`pos_supplier_${createHash('sha256').update(`${estimateId}:${sourceKey}`).digest('hex').slice(0,32)}`;

export function normalizeCanonicalEstimatePosition(position,index=0){
  const configuredContract=position?.configuredContract??null;
  const origin=position?.origin??(configuredContract?'b92_configured':'manual');
  const classification=position?.classification??(position?.isAlternative?'alternative':'standard');
  const alternative=classification==='alternative';
  return {...position,id:String(position?.id||randomUUID()),origin,sourceSequence:Number.isInteger(position?.sourceSequence)?position.sourceSequence:index,positionRef:String(position?.positionRef??position?.displayReference??`Position ${index+1}`),roomName:String(position?.roomName??''),qty:positiveInteger(position?.qty??position?.quantity),widthMm:positiveInteger(position?.widthMm),heightMm:positiveInteger(position?.heightMm),positionType:position?.positionType==='Door'?'Door':'Window',classification,alternativeTo:alternative?(position?.alternativeTo??position?.alternativeToReference??null):null,alternativeToPositionId:alternative?(position?.alternativeToPositionId??null):null,configuredContract};
}

export function resolveCanonicalAlternativeRelationships(input){
  const positions=input.map((position,index)=>normalizeCanonicalEstimatePosition(position,index));
  const byId=new Map(positions.map(position=>[String(position.id),position]));
  const byReference=new Map(positions.map(position=>[normalized(position.positionRef),position]));
  return positions.map(position=>{
    if(position.classification!=='alternative')return {...position,alternativeTo:null,alternativeToPositionId:null};
    const explicitId=String(position.alternativeToPositionId??'').trim();
    const target=(explicitId&&explicitId!==position.id?byId.get(explicitId):null)??byReference.get(normalized(position.alternativeTo));
    if(!target||target.id===position.id)return {...position,alternativeToPositionId:explicitId||null};
    return {...position,alternativeToPositionId:target.id,alternativeTo:target.positionRef};
  });
}

export async function readCanonicalEstimatePositions(db,estimateId){
  const row=await db.get('SELECT positions_json FROM estimates WHERE id=?',estimateId);
  if(!row)return null;
  return resolveCanonicalAlternativeRelationships(parsePositions(row.positions_json));
}

export async function linkSupplierPositionToEstimate(db,{estimateId,sourcePositionId,sourceRevisionId,sourceSequence,displayReference,quantity,widthMm,heightMm,classification='standard',alternativeTo=null,supplierName=null,supplierCode=null,product=null,productSystem=null,preferredEstimatePositionId=null,replacesSourcePositionId=null}){
  const row=await db.get('SELECT positions_json FROM estimates WHERE id=?',estimateId);if(!row)throw Object.assign(new Error('Estimate not found.'),{code:'estimate_not_found'});
  const positions=resolveCanonicalAlternativeRelationships(parsePositions(row.positions_json)), evidence={sourcePositionId,sourceRevisionId,supplierName,supplierCode,linkedAt:new Date().toISOString()};
  const reviewed=await db.get("SELECT target_estimate_position_id,action FROM supplier_position_applications WHERE estimate_id=? AND supplier_quote_position_id=? AND active=1 ORDER BY applied_at DESC LIMIT 1",estimateId,sourcePositionId);
  let matched=preferredEstimatePositionId?positions.find(position=>position.id===preferredEstimatePositionId):reviewed?.target_estimate_position_id?positions.find(position=>position.id===reviewed.target_estimate_position_id):positions.find(position=>Array.isArray(position.supplierEvidenceLinks)&&position.supplierEvidenceLinks.some(link=>link.sourcePositionId===sourcePositionId));
  let matchStatus='matched';
  if(!matched&&!reviewed){
    const candidate={positionRef:displayReference,qty:quantity,widthMm,heightMm},matches=positions.filter(position=>signature(position)===signature(candidate)&&!(position.supplierEvidenceLinks||[]).some(link=>link.sourceRevisionId===sourceRevisionId));
    const sequenceMatches=matches.filter(position=>position.sourceSequence===sourceSequence);
    if(sequenceMatches.length===1)matched=sequenceMatches[0];
    else if(matches.length===1)matched=matches[0];
    else if(matches.length>1)matchStatus='review_required';
  }
  if(!matched){matched=normalizeCanonicalEstimatePosition({id:stableImportedId(estimateId,sourcePositionId),origin:'supplier_imported',sourceSequence,positionRef:displayReference,roomName:'',qty:quantity,widthMm,heightMm,positionType:'Window',fieldsX:1,fieldsY:1,insertion:'',cellInsertions:{},useEstimateDefaults:true,overrides:{},classification,alternativeTo,supplier:{code:supplierCode,name:supplierName},product,productSystem,sourceProvenance:{kind:'supplier_quote_position',sourcePositionId,sourceRevisionId},matchStatus},positions.length);positions.push(matched);}
  matched.supplierEvidenceLinks=[...(matched.supplierEvidenceLinks||[]).filter(link=>link.sourcePositionId!==sourcePositionId&&link.sourcePositionId!==replacesSourcePositionId),evidence];
  if(matched.origin==='b92_configured'||matched.configuredContract)matched.origin='b92_configured';
  const alternativeTarget=classification==='alternative'?positions.find(position=>position.id!==matched.id&&(position.id===alternativeTo||normalized(position.positionRef)===normalized(alternativeTo))):null;
  matched.classification=classification;matched.alternativeTo=classification==='alternative'?(alternativeTarget?.positionRef??alternativeTo):null;matched.alternativeToPositionId=classification==='alternative'?(alternativeTarget?.id??matched.alternativeToPositionId??null):null;
  await db.run('UPDATE estimates SET positions_json=?,updated_at=? WHERE id=?',JSON.stringify(positions),new Date().toISOString(),estimateId);
  return {position:matched,matchStatus};
}

export async function saveConfiguredEstimatePosition(db,{estimateId,positionId,configuredContract,projection}){
  const row=await db.get('SELECT positions_json FROM estimates WHERE id=?',estimateId);if(!row)return null;const positions=resolveCanonicalAlternativeRelationships(parsePositions(row.positions_json)),index=positions.findIndex(position=>position.id===positionId);if(index<0)return null;
  const current=positions[index];positions[index]={...current,...projection,id:current.id,sourceSequence:current.sourceSequence,classification:current.classification,alternativeTo:current.alternativeTo,alternativeToPositionId:current.alternativeToPositionId,supplier:current.supplier,sourceProvenance:current.sourceProvenance,supplierEvidenceLinks:current.supplierEvidenceLinks,configuredContract,origin:current.origin==='supplier_imported'?'supplier_imported':current.origin??'b92_configured',configurationState:current.supplierEvidenceLinks?.length?'imported_configured':'configured',matchStatus:current.matchStatus};
  await db.run('UPDATE estimates SET positions_json=?,updated_at=? WHERE id=?',JSON.stringify(positions),new Date().toISOString(),estimateId);return positions[index];
}

export async function addConfiguredEstimatePosition(db,{estimateId,position}){const row=await db.get('SELECT positions_json FROM estimates WHERE id=?',estimateId);if(!row)return null;const positions=resolveCanonicalAlternativeRelationships(parsePositions(row.positions_json)),normalized=normalizeCanonicalEstimatePosition({...position,sourceSequence:positions.length,origin:'b92_configured',configurationState:'configured'},positions.length);if(positions.some(item=>item.id===normalized.id))return positions.find(item=>item.id===normalized.id);positions.push(normalized);const resolved=resolveCanonicalAlternativeRelationships(positions);await db.run('UPDATE estimates SET positions_json=?,updated_at=? WHERE id=?',JSON.stringify(resolved),new Date().toISOString(),estimateId);return resolved.find(item=>item.id===normalized.id);}

export async function syncEstimatePositionProjections(db,scenarioId){
  const scenario=await db.get('SELECT estimate_id FROM project_calculator_lab_scenarios WHERE id=?',scenarioId);if(!scenario?.estimate_id)return 0;
  const positions=await readCanonicalEstimatePositions(db,scenario.estimate_id);if(!positions)return 0;
  const priced=new Set((await db.all('SELECT estimate_position_id FROM project_calculator_estimate_product_rows WHERE scenario_id=? AND estimate_position_id IS NOT NULL',scenarioId)).map(row=>row.estimate_position_id));
  const now=new Date().toISOString(),ids=new Set();let changed=0;
  for(const position of positions){ids.add(position.id);if(priced.has(position.id)){await db.run('DELETE FROM project_calculator_estimate_position_rows WHERE scenario_id=? AND estimate_position_id=?',scenarioId,position.id);continue;}
    const result=await db.run(`INSERT INTO project_calculator_estimate_position_rows(id,scenario_id,estimate_position_id,source_sequence,source_snapshot_json,display_reference,product_class,quantity,width_mm,height_mm,classification,included_in_current_estimate,alternative_to_reference,alternative_to_estimate_position_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(scenario_id,estimate_position_id) DO UPDATE SET source_sequence=excluded.source_sequence,source_snapshot_json=excluded.source_snapshot_json,display_reference=excluded.display_reference,product_class=excluded.product_class,quantity=excluded.quantity,width_mm=excluded.width_mm,height_mm=excluded.height_mm,classification=excluded.classification,alternative_to_reference=excluded.alternative_to_reference,alternative_to_estimate_position_id=excluded.alternative_to_estimate_position_id,updated_at=excluded.updated_at`,randomUUID(),scenarioId,position.id,position.sourceSequence,JSON.stringify(position),position.positionRef,position.positionType==='Door'?'Single door':'Window',position.qty,position.widthMm,position.heightMm,position.classification,position.classification==='alternative'||position.classification==='excluded'?0:1,position.alternativeTo,position.alternativeToPositionId,now,now);changed+=result.changes;
  }
  for(const row of await db.all('SELECT estimate_position_id FROM project_calculator_estimate_position_rows WHERE scenario_id=?',scenarioId))if(!ids.has(row.estimate_position_id))changed+=(await db.run('DELETE FROM project_calculator_estimate_position_rows WHERE scenario_id=? AND estimate_position_id=?',scenarioId,row.estimate_position_id)).changes;
  return changed;
}
