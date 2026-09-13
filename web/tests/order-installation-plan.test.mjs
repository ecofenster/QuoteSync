import test from 'node:test';
import assert from 'node:assert/strict';
import {buildOrderInstallationPlan} from '../server/features/installationSafety/orderInstallationPlan.js';
import {calculateInstallationProgramme} from '../server/features/projectCalculatorLab/installationProgramme.js';

const fixture=()=>{
  const position={id:'accepted',reference:'A01',quantity:1,widthMm:1000,heightMm:1200};
  const source={orderId:'order',sourceReleaseId:'release',estimateId:'estimate',revision:1,positions:[position]};
  const product={id:'cost-row',estimatePositionId:position.id,displayReference:'A01',quantity:1,widthMm:1000,heightMm:1200,productClass:'window',classification:'alternative',includedInCurrentEstimate:false,sourceSnapshot:{cillRequired:true}};
  const rules={productiveHoursPerDay:8,standardUnitsPerDayByCrew:{2:4}},profile={enabled:true,selectedTeamId:'team',productivityCrewSize:2,costedCrewSize:3,projectType:'new_build',mobilisationSetOutHours:0,foodPerPersonDay:20,accommodationPerPersonNight:100,cillInstallationRate:15};
  const scenario={id:'scenario',estimateId:'estimate',revisionNumber:2,products:[product,{...product,id:'other-row',estimatePositionId:'not-accepted',displayReference:'W99',classification:'standard',includedInCurrentEstimate:true,quantity:30}],options:{installationRequired:true,installationProfile:profile},catalogueSnapshot:{rules:{installation_programme_v1:{value:rules}}},selectedInstallationTeam:{id:'team',name:'Disposable team'},customerPricing:{private:'DO-NOT-PUBLISH'}};
  scenario.installationProgramme=calculateInstallationProgramme({positions:scenario.products,rules,profile});return {source,scenario};
};
test('Order operational proposal uses accepted scope and retained rules without changing sold costing',()=>{
  const {source,scenario}=fixture(),before=JSON.stringify({source,scenario}),plan=buildOrderInstallationPlan(source,scenario,2);
  assert.equal(JSON.stringify({source,scenario}),before);assert.deepEqual(plan.proposedScenario.products.map(item=>item.estimatePositionId),['accepted']);assert.equal(plan.proposedScenario.installationProgramme.costedCrewSize,3);assert.equal(plan.proposedScenario.installationProgramme.allowances.cillApplicableQuantity,1);
  assert.equal(plan.binding.scopeChanges.included[0].id,'accepted');assert.equal(plan.binding.scopeChanges.excluded[0].id,'not-accepted');assert.equal(plan.document.positions.length,1);assert.doesNotMatch(JSON.stringify(plan.document),/DO-NOT-PUBLISH|customerPricing/);assert.equal(buildOrderInstallationPlan(source,scenario,2).proposalFingerprint,plan.proposalFingerprint);
  assert.equal(plan.proposedScenario.customerPricing,undefined,'An operational proposal is not a clone of the sold commercial snapshot');
  scenario.options.installationProfile.foodPerPersonDay=25;assert.notEqual(buildOrderInstallationPlan(source,scenario,2).proposalFingerprint,plan.proposalFingerprint);
});
test('Order proposal fails closed for missing source, ambiguous rows, changed size and disabled programme',()=>{
  for(const mutate of [({source})=>delete source.sourceReleaseId,({scenario})=>scenario.products=[],({scenario})=>scenario.products.push(scenario.products[0]),({scenario})=>scenario.products[0].widthMm=999,({scenario})=>scenario.options.installationRequired=false,({scenario})=>scenario.catalogueSnapshot={}]){const data=fixture();mutate(data);assert.throws(()=>buildOrderInstallationPlan(data.source,data.scenario,2));}
});
