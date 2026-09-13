import test from 'node:test';
import assert from 'node:assert/strict';
import {projectInstallationDocument} from '../server/features/installationSafety/installationDocumentProjection.js';
const fixture=()=>{const position={id:'p',quantity:1,widthMm:1000,heightMm:1200},row={...position,estimatePositionId:'p',sourceRowId:'source',sourceSnapshot:{supplierName:'Private dealer',manufacturerEvidence:{manufacturerName:'Actual manufacturer',productSystem:'Supplied system',purchasePrice:900,internalNotes:'PRIVATE'}}};return {revision:{estimateId:'estimate',revision:1,positions:[position]},scenario:{estimateId:'estimate',products:[row]}};};
test('installer uses exact retained manufacturer role without adding supplier evidence to client projection',()=>{
  const data=fixture(),before=JSON.stringify(data),installer=projectInstallationDocument({...data,audience:'installer'}),client=projectInstallationDocument({...data,audience:'client'});
  assert.equal(installer.positions[0].manufacturer,'Actual manufacturer');assert.equal(installer.positions[0].system,'Supplied system');
  assert.equal(client.positions[0].manufacturer,'');assert.equal(client.positions[0].system,'');
  assert.doesNotMatch(JSON.stringify(installer),/Private dealer|PRIVATE|purchasePrice/);assert.equal(JSON.stringify(data),before);
});
test('missing, duplicate, stale and wrong-source matches cannot supply manufacturer details',()=>{
  for(const change of [d=>d.scenario.products.push(structuredClone(d.scenario.products[0])),d=>d.scenario.products[0].widthMm=900,d=>d.scenario.products[0].estimatePositionId='other',d=>delete d.scenario.products[0].sourceRowId,d=>delete d.scenario.products[0].sourceSnapshot.manufacturerEvidence]){
    const data=fixture();change(data);assert.equal(projectInstallationDocument({...data,audience:'installer'}).positions[0].manufacturer,'');
  }
  const data=fixture();data.revision.positions[0].manufacturerName='Retained revision manufacturer';data.revision.positions[0].productSystem='Retained revision system';
  const output=projectInstallationDocument({...data,audience:'installer'});assert.equal(output.positions[0].manufacturer,'Retained revision manufacturer');assert.equal(output.positions[0].system,'Retained revision system');
});
