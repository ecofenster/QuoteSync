import test from 'node:test';
import assert from 'node:assert/strict';
import {validateInstallationDocumentCalculation,reviewInstallationCalculationScope} from '../server/features/installationSafety/installationDocumentPreparation.js';

test('read-only scope review explains missing, repeated, changed and extra Positions without exposing prices',()=>{
  const source={estimateId:'e',orderId:'o',revision:1,positions:['missing','repeated','changed','matches'].map(id=>({id,reference:id,quantity:1,widthMm:1000,heightMm:1200}))};
  const product=id=>({estimatePositionId:id,displayReference:id,quantity:1,widthMm:1000,heightMm:1200,price:'PRIVATE'});
  const scenario={estimateId:'e',revisionNumber:2,products:[product('repeated'),product('repeated'),{...product('changed'),widthMm:900},product('matches'),product('extra')]};
  const before=JSON.stringify({source,scenario}),review=reviewInstallationCalculationScope(source,scenario,2);
  assert.equal(review.ready,false);assert.deepEqual(review.rows.map(item=>item.status),['missing','repeated','different','matches']);assert.deepEqual(review.rows[2].differences,[{field:'widthMm',scheduled:1000,calculated:900}]);assert.equal(review.extra[0].reference,'extra');assert.doesNotMatch(JSON.stringify(review),/PRIVATE|price/);assert.match(review.nextAction,/Do not change the sold Estimate/);assert.equal(JSON.stringify({source,scenario}),before);
  assert.throws(()=>reviewInstallationCalculationScope(source,{...scenario,estimateId:'other'},2),/missing or has changed/);
});

test('installation documents bind the selected costing revision by canonical Position coverage and saved rules',()=>{
  const revision={estimateId:'estimate-a',positions:[{id:'position-a',reference:'W01',quantity:2,widthMm:1200,heightMm:1400}]};
  const scenario={id:'scenario-a',estimateId:'estimate-a',revisionNumber:4,products:[{id:'replaceable-costing-row',estimatePositionId:'position-a',quantity:2,widthMm:1200,heightMm:1400}],catalogueSnapshot:{rules:{installation_programme_v1:{value:{productiveHoursPerDay:8}}}},options:{installationProfile:{costedCrewSize:3}}};
  const check=validateInstallationDocumentCalculation(revision,scenario,4);assert.deepEqual(check.positionIds,['position-a']);assert.equal(check.scenarioRevision,4);
  for(const change of [{estimateId:'other'},{revisionNumber:5},{catalogueSnapshot:null},{products:[]},{products:[{...scenario.products[0],estimatePositionId:null}]},{products:[scenario.products[0],scenario.products[0]]}])assert.throws(()=>validateInstallationDocumentCalculation(revision,{...scenario,...change},4),{code:'installation_document_calculation_review'});
  for(const key of ['quantity','widthMm','heightMm'])for(const value of [null,0,999])assert.throws(()=>validateInstallationDocumentCalculation(revision,{...scenario,products:[{...scenario.products[0],[key]:value}]},4),/differs/);
  assert.notEqual(validateInstallationDocumentCalculation(revision,{...scenario,options:{installationProfile:{costedCrewSize:4}}},4).fingerprint,check.fingerprint);
  assert.equal(validateInstallationDocumentCalculation(revision,{...scenario,products:[...scenario.products,{estimatePositionId:'extra-alternative',classification:'alternative'}]},4).positionIds.length,1);
});

test('accepted Order flags cannot hide Positions from the calculation coverage guard',()=>{
  const position={id:'accepted-alternative',reference:'A01',quantity:1,widthMm:900,heightMm:1200,classification:'alternative',includedInCurrentEstimate:false};
  const revision={estimateId:'estimate-a',orderId:'order-a',positions:[position]};
  const scenario={id:'scenario-a',estimateId:'estimate-a',revisionNumber:1,products:[],catalogueSnapshot:{rules:{installation_programme_v1:{value:{productiveHoursPerDay:8}}}}};
  assert.throws(()=>validateInstallationDocumentCalculation(revision,scenario,1),/different set/);
  const product={estimatePositionId:position.id,quantity:1,widthMm:900,heightMm:1200};
  assert.deepEqual(validateInstallationDocumentCalculation(revision,{...scenario,products:[product]},1).positionIds,[position.id]);
  assert.throws(()=>validateInstallationDocumentCalculation(revision,{...scenario,products:[{...product,classification:'alternative'}]},1),/different set/,'An unreviewed excluded costing row must not be treated as the accepted programme');
  assert.equal(position.includedInCurrentEstimate,false,'Historical source evidence is not rewritten');
});
