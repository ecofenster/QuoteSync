import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { initializeSupplierCommercialSchema } from '../server/schema/supplierCommercialSchema.js';
import { createProjectCalculatorLabService } from '../server/features/projectCalculatorLab/projectCalculatorLabService.js';
import { addConfiguredEstimatePosition, linkSupplierPositionToEstimate, readCanonicalEstimatePositions, saveConfiguredEstimatePosition } from '../server/features/estimatePositions/canonicalEstimatePositions.js';

async function fixture(t,positions){
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'quotesuite-position-bridge-')),db=await open({filename:path.join(root,'test.sqlite'),driver:sqlite3.Database});
  t.after(async()=>{await db.close();await fs.rm(root,{recursive:true,force:true});});
  await db.exec(`PRAGMA foreign_keys=ON;CREATE TABLE clients(id TEXT PRIMARY KEY,client_ref TEXT,name TEXT,created_at TEXT,updated_at TEXT);CREATE TABLE estimates(id TEXT PRIMARY KEY,estimate_ref TEXT,client_id TEXT,status TEXT,positions_json TEXT,updated_at TEXT,deleted_at TEXT);INSERT INTO clients VALUES('client','C-1','Client',datetime('now'),datetime('now'));`);
  await db.run(`INSERT INTO estimates VALUES('estimate','E-1','client','Draft',?,datetime('now'),NULL)`,JSON.stringify(positions));
  await initializeSupplierCommercialSchema(db);
  return {db,service:createProjectCalculatorLabService(db,{exchangeRateProvider:async()=>({provider:'test',quotedAt:new Date().toISOString(),rawRate:'1'})})};
}

const b92=(id,ref,sequence=0)=>({id,positionRef:ref,qty:1,roomName:'',widthMm:1000,heightMm:1200,fieldsX:1,fieldsY:1,insertion:'Fixed',cellInsertions:{'0,0':'Fixed'},positionType:'Window',useEstimateDefaults:true,overrides:{},sourceSequence:sequence,configuredContract:{contractVersion:'1',positionId:id}});

test('B92 Estimate positions enter Project Costing as stable unpriced canonical rows',async t=>{
  const {db,service}=await fixture(t,[b92('b92-1','W1')]);
  const scenario=await service.createScenario({estimateId:'estimate',origin:'estimate',name:'Estimate costing',packageType:'supply_only'});
  assert.equal(scenario.origin,'estimate');assert.equal(scenario.products.length,1);assert.equal(scenario.products[0].estimatePositionId,'b92-1');assert.equal(scenario.products[0].evidenceOrigin,'estimate');assert.equal(scenario.products[0].totalPrice,null);assert.equal(scenario.products[0].sourceSnapshot.configuredContract.positionId,'b92-1');
  await service.syncEstimatePositions(scenario.id);await service.syncEstimatePositions(scenario.id);
  assert.equal((await service.getScenario(scenario.id)).products.length,1);
  assert.equal((await db.get('SELECT COUNT(*) count FROM project_calculator_estimate_position_rows WHERE scenario_id=?',scenario.id)).count,1);
});

test('supplier evidence conservatively enriches the same Estimate position and revisions are idempotent',async t=>{
  const {db}=await fixture(t,[b92('b92-1','W1')]);
  const input={estimateId:'estimate',sourcePositionId:'supplier-r1-w1',sourceRevisionId:'r1',sourceSequence:0,displayReference:'W1',quantity:1,widthMm:1000,heightMm:1200,supplierName:'EKO',supplierCode:'EKO'};
  const first=await linkSupplierPositionToEstimate(db,input),rerun=await linkSupplierPositionToEstimate(db,input),revision=await linkSupplierPositionToEstimate(db,{...input,sourcePositionId:'supplier-r2-w1',sourceRevisionId:'r2'});
  assert.equal(first.position.id,'b92-1');assert.equal(rerun.position.id,'b92-1');assert.equal(revision.position.id,'b92-1');
  const positions=await readCanonicalEstimatePositions(db,'estimate');assert.equal(positions.length,1);assert.equal(positions[0].origin,'b92_configured');assert.equal(positions[0].supplierEvidenceLinks.length,2);assert.ok(positions[0].configuredContract);
});

test('grouped and alternative supplier positions retain quantity, order, identity and review ambiguity',async t=>{
  const {db}=await fixture(t,[b92('same-a','GF-W-W9',0),b92('same-b','GF-W-W9',1)]);
  const ambiguous=await linkSupplierPositionToEstimate(db,{estimateId:'estimate',sourcePositionId:'ambiguous',sourceRevisionId:'r1',sourceSequence:9,displayReference:'GF-W-W9',quantity:1,widthMm:1000,heightMm:1200});
  assert.equal(ambiguous.matchStatus,'review_required');assert.notEqual(ambiguous.position.id,'same-a');assert.notEqual(ambiguous.position.id,'same-b');
  const grouped=await linkSupplierPositionToEstimate(db,{estimateId:'estimate',sourcePositionId:'grouped',sourceRevisionId:'r1',sourceSequence:10,displayReference:'W7/W8',quantity:2,widthMm:610,heightMm:1200});
  const alternative=await linkSupplierPositionToEstimate(db,{estimateId:'estimate',sourcePositionId:'alt',sourceRevisionId:'r1',sourceSequence:11,displayReference:'W0.04ALT',quantity:1,widthMm:900,heightMm:1000,classification:'alternative',alternativeTo:'W0.04'});
  const positions=await readCanonicalEstimatePositions(db,'estimate');assert.equal(grouped.position.qty,2);assert.equal(alternative.position.classification,'alternative');assert.equal(alternative.position.alternativeTo,'W0.04');assert.deepEqual(positions.slice(-2).map(item=>item.sourceSequence),[10,11]);
});

test('supplier-first B92 enrichment preserves identity, evidence, price provenance, quantity and exclusion',async t=>{
  const {db,service}=await fixture(t,[]),linked=await linkSupplierPositionToEstimate(db,{estimateId:'estimate',sourcePositionId:'supplier-alt',sourceRevisionId:'r1',sourceSequence:4,displayReference:'W7/W8',quantity:2,widthMm:610,heightMm:1200,classification:'alternative',alternativeTo:'W7'});
  const before=JSON.parse(JSON.stringify(linked.position)),contract={schemaVersion:1,source:'b92_configurator',identity:{positionId:before.id,positionRef:before.positionRef,estimateId:'estimate',clientId:'client'},estimateContext:{quantity:2,roomName:'',positionType:'Window',useEstimateDefaults:true},dimensions:{widthMm:610,heightMm:1200},compatibilityProjection:{widthMm:610,heightMm:1200,fieldsX:1,fieldsY:1,insertion:'Fixed',cellInsertions:{},colWidthsMm:[610],rowHeightsMm:[1200]}};
  const saved=await saveConfiguredEstimatePosition(db,{estimateId:'estimate',positionId:before.id,configuredContract:contract,projection:{widthMm:610,heightMm:1200,qty:2}});
  assert.equal(saved.id,before.id);assert.equal(saved.qty,2);assert.equal(saved.classification,'alternative');assert.equal(saved.alternativeTo,'W7');assert.deepEqual(saved.supplierEvidenceLinks,before.supplierEvidenceLinks);assert.deepEqual(saved.sourceProvenance,before.sourceProvenance);assert.equal(saved.configurationState,'imported_configured');
  const scenario=await service.createScenario({estimateId:'estimate',origin:'estimate',name:'Enriched',packageType:'supply_only'});assert.equal(scenario.products.length,1);assert.equal(scenario.products[0].estimatePositionId,before.id);assert.equal(scenario.products[0].includedInCurrentEstimate,false);
});

test('Add Position save is idempotent and cancel is write-free',async t=>{const {db}=await fixture(t,[]),position=b92('new-b92','W-001');await addConfiguredEstimatePosition(db,{estimateId:'estimate',position});await addConfiguredEstimatePosition(db,{estimateId:'estimate',position});assert.equal((await readCanonicalEstimatePositions(db,'estimate')).length,1);const before=(await db.get("SELECT positions_json FROM estimates WHERE id='estimate'")).positions_json;assert.equal((await db.get("SELECT positions_json FROM estimates WHERE id='estimate'")).positions_json,before);});

test('continuation UI exposes approved actions, return context, cancel, and explicit match decisions',async()=>{const source=await fs.readFile('src/features/estimateCommercial/EstimatePositionBridge.tsx','utf8'),workspace=await fs.readFile('src/features/estimateCommercial/EstimateCommercialWorkspace.tsx','utf8');for(const label of ['Add Position','Configure Position','Edit Configuration','Cancel','Review Required','Link to Existing Position','Create New Position'])assert.match(source+workspace,new RegExp(label));assert.match(source,/positionId:draft\.id/);assert.match(source,/onChanged/);assert.doesNotMatch(workspace,/Create Estimate \/ B92/);});
