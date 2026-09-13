import test from 'node:test';
import assert from 'node:assert/strict';
import {buildManualInstallationTravel} from '../shared/manualInstallationTravel.js';
import {validateRouteSnapshot} from '../server/features/projectCalculatorLab/routeSnapshotValidation.js';
const input=()=>({origin:{label:'Base',lat:51,lng:-1},destination:{label:'Site',lat:52,lng:-2},outwardMiles:'120',outwardMinutes:'150',returnMiles:'125',returnMinutes:'170',basis:'Reviewed planner estimate, weekday route',calculatedAt:'2026-09-13T10:00:00Z'});
test('manual review retains separate values and basis through the server eligibility contract',()=>{
  const source=input(),before=JSON.stringify(source),pair=buildManualInstallationTravel(source);validateRouteSnapshot(pair.out);validateRouteSnapshot(pair.back);
  assert.equal(pair.out.durationMinutes,150);assert.equal(pair.back.durationMinutes,170);assert.equal(pair.back.overrideReason,source.basis);assert.deepEqual(pair.back.origin,pair.out.destination);assert.equal(pair.out.manuallyOverridden,true);assert.equal(JSON.stringify(source),before);
});
test('unknown values and unsupported locations are rejected, never replaced with zero',()=>{
  for(const key of ['outwardMiles','outwardMinutes','returnMiles','returnMinutes'])for(const value of ['',null,undefined,-1,'invalid',true])assert.throws(()=>buildManualInstallationTravel({...input(),[key]:value}));
  assert.throws(()=>buildManualInstallationTravel({...input(),basis:' '}));
  for(const value of ['',null,true,'invalid',100])assert.throws(()=>buildManualInstallationTravel({...input(),origin:{label:'Base',lat:value,lng:0}}));
  assert.equal(buildManualInstallationTravel({...input(),outwardMiles:0,outwardMinutes:0}).out.durationMinutes,0);
});
