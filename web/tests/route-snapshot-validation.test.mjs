import test from 'node:test';
import assert from 'node:assert/strict';
import {validateRouteSnapshot} from '../server/features/projectCalculatorLab/routeSnapshotValidation.js';
import {createProjectCalculatorLabService} from '../server/features/projectCalculatorLab/projectCalculatorLabService.js';
const route=()=>({direction:'office_to_site',origin:{label:'Installer base',lat:'51.5',lng:'-0.1'},destination:{label:'Site',lat:52,lng:-1},distanceKm:'123.4',durationMinutes:90,trafficDurationMinutes:null,integration:'reviewed_test_route',manuallyOverridden:false});
test('outward and return snapshots accept real zero values and preserve input',()=>{
  for(const direction of ['office_to_site','site_to_office']){const input=route();input.direction=direction;input.distanceKm=0;input.durationMinutes=0;input.origin.lat=0;input.origin.lng=0;const before=JSON.stringify(input);validateRouteSnapshot(input);assert.equal(JSON.stringify(input),before);}
  const manual=route();manual.manuallyOverridden=true;manual.overrideReason='Reviewed route timing';validateRouteSnapshot(manual);
});
test('invalid or unresolved route data fails before database lookup or persistence',async()=>{
  let accessed=false;const db=new Proxy({},{get(){accessed=true;throw Error('Route validation must run before database access');}}),service=createProjectCalculatorLabService(db);
  for(const change of [r=>r.origin=null,r=>r.destination.label='',r=>r.origin.lat='',r=>r.origin.lat=' ',r=>r.origin.lat=91,r=>r.destination.lng=181,r=>r.durationMinutes=null,r=>r.durationMinutes=-1,r=>r.distanceKm=undefined,r=>r.distanceKm=true,r=>r.trafficDurationMinutes=NaN,r=>r.integration='',r=>r.manuallyOverridden=true]){
    const input=route();change(input);await assert.rejects(()=>service.appendRouteSnapshot('disposable',input),error=>error.code==='invalid_route');
  }
  assert.equal(accessed,false);
});
