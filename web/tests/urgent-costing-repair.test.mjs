import test from 'node:test';
import assert from 'node:assert/strict';
import sqlite3 from 'sqlite3';
import {open} from 'sqlite';
import {costingEditability} from '../server/features/projectCalculatorLab/costingEditability.js';
import {normalizeSiteVisitCosting,validateSiteVisitReview,calculateSiteVisitCosting} from '../server/features/projectCalculatorLab/siteVisitCosting.js';
import {initializeSupplierCommercialSchema} from '../server/schema/supplierCommercialSchema.js';
import {createProjectCalculatorLabService} from '../server/features/projectCalculatorLab/projectCalculatorLabService.js';

test('canonical issued release wins over a misleading Draft status without mutation',async()=>{
  const db=await open({filename:':memory:',driver:sqlite3.Database});
  try{
    await db.exec("CREATE TABLE estimates(id TEXT PRIMARY KEY,revision_no INTEGER,status TEXT);CREATE TABLE estimate_revision_releases(id TEXT,estimate_id TEXT,estimate_revision INTEGER,released_at TEXT);INSERT INTO estimates VALUES('test',0,'Draft');INSERT INTO estimate_revision_releases VALUES('release','test',0,'2026-09-08T18:57:23Z')");
    const state=await costingEditability(db,'test');assert.equal(state.editable,false);assert.equal(state.releaseId,'release');assert.match(state.reason,/editable Estimate revision/);assert.equal((await db.get('SELECT status FROM estimates')).status,'Draft');
    assert.deepEqual(await costingEditability(db,null),{editable:true});
  }finally{await db.close()}
});

test('reviewed manual route requires both values and basis; missing remains missing',()=>{
  const empty=normalizeSiteVisitCosting(null);validateSiteVisitReview(empty);assert.equal(empty.calculatedDurationMinutes,null);
  for(const value of [{reviewedOneWayMiles:'100'},{reviewedOneWayMiles:'100',reviewedTravelHours:'2'},{reviewedOneWayMiles:'-1',reviewedTravelHours:'2',manualRouteBasis:'review'},{reviewedOneWayMiles:'NaN',reviewedTravelHours:'2',manualRouteBasis:'review'}])assert.throws(()=>validateSiteVisitReview(value),{code:'invalid_options'});
  const valid=normalizeSiteVisitCosting({...empty,reviewedOneWayMiles:'100',reviewedTravelHours:'2',manualRouteBasis:'Reviewed disposable route',returnJourney:true});
  validateSiteVisitReview(valid);const result=calculateSiteVisitCosting(valid);assert.equal(result.input.manualRouteBasis,'Reviewed disposable route');assert.equal(result.chargeableMiles,'200.00');assert.equal(result.totalDrivingHours,'4.00');
});

test('material inclusion toggles historical snapshots without catalogue adoption or loss',async()=>{
  const db=await open({filename:':memory:',driver:sqlite3.Database});
  try{
    await db.exec('CREATE TABLE estimates(id TEXT PRIMARY KEY);CREATE TABLE clients(id TEXT PRIMARY KEY);');await initializeSupplierCommercialSchema(db);
    const service=createProjectCalculatorLabService(db);let scenario=await service.createScenario({origin:'manual',name:'TEST historical inclusion',currency:'GBP',packageCode:'supply_only'});
    scenario=await service.addManualProduct(scenario.id,{reference:'TEST W1',productClass:'Window',widthMm:1000,heightMm:1200,quantity:1,installationOpeningCount:1,unitSupplyCost:'1000',totalSupplyCost:'1000'});
    const product=scenario.catalogueSnapshot.catalogue.find(item=>item.category==='illbruck_tp600'&&item.active!==false);
    scenario=await service.updateInstallationMaterials(scenario.id,{materialSelections:{TP600:{required:true,productId:product.id}}});
    const snapshot=await db.get('SELECT id,rules_json FROM project_calculator_lab_catalogue_snapshots WHERE scenario_id=? ORDER BY scenario_revision DESC,rowid DESC LIMIT 1',scenario.id),rules=JSON.parse(snapshot.rules_json);rules.installation_materials_v1.version=-100;await db.run('UPDATE project_calculator_lab_catalogue_snapshots SET rules_json=? WHERE id=?',JSON.stringify(rules),snapshot.id);
    const before=(await service.getScenario(scenario.id)).options.installationMaterials;
    for(const enabled of [false,true]){
      scenario=await service.updateInstallationMaterials(scenario.id,{enabled});
      assert.deepEqual(scenario.options.installationMaterials,{...before,enabled});assert.equal(Boolean(scenario.installationMaterials),enabled);assert.equal(scenario.installationCatalogueState.isCurrent,false);
      assert.equal((await service.getScenario(scenario.id)).options.installationMaterials.enabled,enabled);
    }
    const optionsBefore=await db.get('SELECT options_json FROM project_calculator_lab_options WHERE scenario_id=?',scenario.id);
    await assert.rejects(service.updateOptions(scenario.id,{siteVisitTravel:{reviewedOneWayMiles:'100',reviewedTravelHours:'2'}}),{code:'invalid_options'});
    assert.deepEqual(await db.get('SELECT options_json FROM project_calculator_lab_options WHERE scenario_id=?',scenario.id),optionsBefore);
  }finally{await db.close()}
});
