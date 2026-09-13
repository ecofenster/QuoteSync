import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateInstallationProgramme} from '../server/features/projectCalculatorLab/installationProgramme.js';
const calculate=route=>calculateInstallationProgramme({positions:[],profile:{route,selectedTeamId:'team'},rules:{}});
test('missing route evidence cannot masquerade as a confirmed zero-time journey',()=>{
  for(const route of [null,{}, {snapshotId:'route',oneWayMiles:10},{snapshotId:'route',oneWayMiles:10,oneWayDurationMinutes:-1},{oneWayMiles:10,oneWayDurationMinutes:30,manuallyOverridden:true}]){
    const result=calculate(route);assert.equal(result.travelEvidence.outwardStatus,'not_confirmed');assert.equal(result.travelEvidence.oneWayDurationMinutes,null);assert.ok(result.reviewRequired.some(item=>item.includes('Travel costing is incomplete')));assert.equal(result.status,'review_required');
  }
});
test('retained or explained manual route exposes outward evidence without inventing return confirmation or repricing',()=>{
  for(const route of [{snapshotId:'route',oneWayMiles:10,oneWayDurationMinutes:30},{manuallyOverridden:true,overrideReason:'Reviewed route estimate',oneWayMiles:10,oneWayDurationMinutes:30},{snapshotId:'same-site',oneWayMiles:0,oneWayDurationMinutes:0}]){
    const before=JSON.stringify(route),result=calculate(route);assert.equal(result.travelEvidence.outwardStatus,'retained_route');assert.equal(result.travelEvidence.oneWayDurationMinutes,route.oneWayDurationMinutes);assert.equal(result.travelEvidence.returnDurationMinutes,null);assert.equal(result.travelEvidence.returnStatus,'not_confirmed');assert.equal(result.travel.oneWayMiles,route.oneWayMiles.toFixed(2));assert.equal(JSON.stringify(route),before);
  }
});

test('explicit directional adoption charges each leg once per reviewed journey pattern and leaves legacy costing unchanged',()=>{
  const route={snapshotId:'out',returnSnapshotId:'back',oneWayMiles:10,oneWayDurationMinutes:30,returnMiles:15,returnDurationMinutes:50};
  const profile={selectedTeamId:'team',deliveryOffloadSetOutDays:2,vehicleCount:2,mileageRate:'0.50',route};
  const run=(travelMode,reviewed)=>calculateInstallationProgramme({positions:[],profile:{...profile,travelMode,route:{...route,...(reviewed?{distanceBasis:'retained_directions_v1'}:{})}},rules:{}});
  const daily=run('daily_travel',true),overnight=run('stay_away',true),legacy=run('daily_travel',false);
  assert.equal(daily.travel.chargeableMiles,'50.00');assert.equal(daily.travel.baseMileageCost,'50.00');assert.equal(daily.travelEvidence.returnDurationMinutes,50);assert.equal(daily.travel.finalReturnBy,'17:50');
  assert.equal(overnight.travel.chargeableMiles,'25.00');assert.equal(overnight.travel.baseMileageCost,'25.00');assert.equal(overnight.allowances.nights,1);
  assert.equal(legacy.travel.chargeableMiles,'40.00');assert.equal(legacy.travel.finalReturnBy,'17:30');assert.equal(legacy.travelEvidence.returnDurationMinutes,null);
});
