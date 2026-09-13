import test from 'node:test';
import assert from 'node:assert/strict';
import {bindInstallationRoutePair} from '../server/features/projectCalculatorLab/installationRoutePair.js';
const fixture=()=>{
  const outward={id:'out',scenarioId:'scenario',direction:'office_to_site',origin:{label:'SW1A 1AA',lat:51.5,lng:-0.1},destination:{label:'CF10 1AA',lat:51.48,lng:-3.18},distanceKm:240,durationMinutes:180,integration:'google_routes_installation_team',calculatedAt:'2026-09-13T08:00:00Z'};
  return {scenarioId:'scenario',profile:{selectedTeamId:'team',selectedInstallationCompanyId:'company',sitePostcode:'CF10 1AA',route:{snapshotId:'out',returnSnapshotId:'back',oneWayMiles:999,oneWayDurationMinutes:999,returnMiles:999,returnDurationMinutes:999}},team:{id:'team',companyId:'company',basePostcode:'SW1A 1AA',active:true},snapshots:[outward,{...outward,id:'back',direction:'site_to_office',origin:outward.destination,destination:outward.origin,distanceKm:260,durationMinutes:210}]};
};
test('adoption derives each direction from exact retained evidence rather than browser metrics',()=>{
  const input=fixture(),before=JSON.stringify(input),result=bindInstallationRoutePair(input);
  assert.equal(result.oneWayMiles,'149.13');assert.equal(result.returnMiles,'161.56');assert.equal(result.oneWayDurationMinutes,180);assert.equal(result.returnDurationMinutes,210);assert.equal(JSON.stringify(input),before);
});
test('wrong owner, base, site, company, direction, provenance and unresolved evidence fail closed',()=>{
  for(const mutate of [v=>{v.snapshots[1].scenarioId='other';},v=>{v.team.basePostcode='KY4 9FA';},v=>{v.profile.sitePostcode='KY4 9FA';},v=>{v.team.companyId='other';},v=>{v.team.active=false;},v=>{v.snapshots[1].direction='office_to_site';},v=>{v.snapshots[1].integration='google_routes';},v=>{v.snapshots[1].origin={...v.snapshots[1].origin,lat:0};},v=>{v.snapshots[1].durationMinutes=null;},v=>{v.snapshots.push({...v.snapshots[1]});}]){
    const input=fixture();mutate(input);assert.throws(()=>bindInstallationRoutePair(input));
  }
});
test('explained manual directions are retained, including genuine zero-time routes',()=>{
  const input=fixture();Object.assign(input.snapshots[1],{integration:'manual',manuallyOverridden:true,overrideReason:'Reviewed return route estimate',distanceKm:0,durationMinutes:0});
  assert.equal(bindInstallationRoutePair(input).returnDurationMinutes,0);
  input.snapshots[1].overrideReason='';assert.throws(()=>bindInstallationRoutePair(input));
});
