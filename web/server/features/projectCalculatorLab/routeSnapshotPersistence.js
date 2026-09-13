import {createHash,randomUUID} from 'node:crypto';
import {validateRouteSnapshot} from './routeSnapshotValidation.js';
const fail=message=>{throw Object.assign(new Error(message),{code:'invalid_route'});};
const payload=input=>({direction:input.direction,origin:{label:input.origin.label.trim(),lat:Number(input.origin.lat),lng:Number(input.origin.lng)},destination:{label:input.destination.label.trim(),lat:Number(input.destination.lat),lng:Number(input.destination.lng)},distanceKm:Number(input.distanceKm),durationMinutes:Number(input.durationMinutes),trafficDurationMinutes:input.trafficDurationMinutes==null?null:Number(input.trafficDurationMinutes),integration:input.integration.trim(),manuallyOverridden:!!input.manuallyOverridden,overrideReason:input.manuallyOverridden?input.overrideReason.trim():null});

export async function persistRouteSnapshot(db,scenarioId,input){
  validateRouteSnapshot(input);
  if(input.requestKey!==undefined&&(typeof input.requestKey!=='string'||!input.requestKey.trim()||input.requestKey.length>200))fail('The route save identity is invalid. Review the route and try again.');
  const id=input.requestKey?`route_${createHash('sha256').update(JSON.stringify([scenarioId,input.requestKey])).digest('hex')}`:randomUUID(),now=new Date().toISOString(),value=payload(input);
  const result=await db.run('INSERT INTO project_calculator_lab_route_snapshots(id,scenario_id,direction,origin_label,destination_label,origin_lat,origin_lng,destination_lat,destination_lng,distance_km,duration_minutes,traffic_duration_minutes,calculated_at,integration,manually_overridden,override_reason,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING',id,scenarioId,value.direction,value.origin.label,value.destination.label,String(value.origin.lat),String(value.origin.lng),String(value.destination.lat),String(value.destination.lng),String(value.distanceKm),value.durationMinutes,value.trafficDurationMinutes,input.calculatedAt||now,value.integration,value.manuallyOverridden?1:0,value.overrideReason,now);
  const row=await db.get('SELECT * FROM project_calculator_lab_route_snapshots WHERE id=? AND scenario_id=?',id,scenarioId);
  if(!row)fail('The route save could not be confirmed. Keep your choices and retry.');
  const retained=payload({direction:row.direction,origin:{label:row.origin_label,lat:row.origin_lat,lng:row.origin_lng},destination:{label:row.destination_label,lat:row.destination_lat,lng:row.destination_lng},distanceKm:row.distance_km,durationMinutes:row.duration_minutes,trafficDurationMinutes:row.traffic_duration_minutes,integration:row.integration,manuallyOverridden:!!row.manually_overridden,overrideReason:row.override_reason});
  if(JSON.stringify(retained)!==JSON.stringify(value)||(input.calculatedAt&&row.calculated_at!==input.calculatedAt))fail('This save identity already belongs to a different route. The saved route was preserved. Review the changed journey before starting a new save.');
  return {id,reused:result.changes===0};
}
