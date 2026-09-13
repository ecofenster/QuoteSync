import assert from 'node:assert/strict';
import {writeFile,mkdir,readdir} from 'node:fs/promises';
import path from 'node:path';
import sqlite3 from 'sqlite3';
import {open} from 'sqlite';
import {createProjectCalculatorLabService} from '../server/features/projectCalculatorLab/projectCalculatorLabService.js';

// Only called with the fresh, owned journey database, before its test release.
export async function seedUrgentCosting(db,estimateId){
  const service=createProjectCalculatorLabService(db);
  let scenario=await service.createScenario({estimateId,origin:'estimate',name:'TEST urgent costing',packageCode:'supply_only'});
  scenario=await service.updateOptions(scenario.id,{installationRequired:true});
  scenario=await service.updateImportCustoms(scenario.id,{included:true,baseImportCost:'250',contingencyPercent:'0',defaultImports:1,dutyPercent:'0'});
  const tp=scenario.catalogueSnapshot.catalogue.find(item=>item.category==='illbruck_tp600'&&item.active!==false);
  assert.ok(tp,'Disposable application catalogue must supply TP600');
  scenario=await service.updateInstallationMaterials(scenario.id,{materialSelections:{TP600:{required:true,productId:tp.id}}});
  const saved=await db.get('SELECT options_json FROM project_calculator_lab_options WHERE scenario_id=?',scenario.id),options=JSON.parse(saved.options_json);
  options.siteVisitTravel={...options.siteVisitTravel,officePostcode:'KY4 9FA',sitePostcode:'MK43 0LW',sitePostcodeSource:'manually_corrected',calculatedOneWayMiles:null,calculatedDurationMinutes:null,reviewedOneWayMiles:null,reviewedTravelHours:null};
  await db.run('UPDATE project_calculator_lab_options SET options_json=? WHERE scenario_id=?',JSON.stringify(options),scenario.id);
  const snapshot=await db.get('SELECT id,rules_json FROM project_calculator_lab_catalogue_snapshots WHERE scenario_id=? ORDER BY scenario_revision DESC,rowid DESC LIMIT 1',scenario.id),rules=JSON.parse(snapshot.rules_json);
  rules.installation_materials_v1.version=-100;
  await db.run('UPDATE project_calculator_lab_catalogue_snapshots SET rules_json=? WHERE id=?',JSON.stringify(rules),snapshot.id);
  await db.run("UPDATE estimates SET status='Draft' WHERE id=?",estimateId);
  return scenario.id;
}

export async function verifyUrgentCosting({tab,click,input,waitFor,databasePath,output,fixture,appUrl,apiUrl,inspectPdf}){
  const db=await open({filename:databasePath,driver:sqlite3.Database});
  const requests=[];
  const request=async(url,body,method='GET')=>{const response=await fetch(`${apiUrl}/api/admin/project-calculator-lab${url}`,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)}),value=await response.json();requests.push({method,url,body,status:response.status,...(!response.ok?{response:value}:{})});return {status:response.status,value};};
  try{
    const sourceId=fixture.urgentCostingScenarioId;
    const before=await db.get('SELECT options_json FROM project_calculator_lab_options WHERE scenario_id=?',sourceId);
    let guardException;
    try{await db.run('UPDATE project_calculator_lab_options SET options_json=options_json WHERE scenario_id=?',sourceId);assert.fail('Released costing write unexpectedly allowed');}catch(error){assert.match(error.message,/Issued Estimate revision costing is immutable/);guardException={code:error.code,message:error.message};}
    for(const [endpoint,body] of [['/options',{installationRequired:false}],['/import-customs',{included:false}],['/installation-materials',{enabled:false}],['/installation-materials/use-current-catalogue',{}]]){
      const response=await request(`/scenarios/${sourceId}${endpoint}`,body,endpoint.endsWith('use-current-catalogue')?'POST':'PATCH');assert.equal(response.status,409);assert.equal(response.value.code,'estimate_revision_immutable');assert.match(response.value.error,/editable Estimate revision/);
    }
    await tab.send('Page.navigate',{url:`${appUrl}/#/estimate/${fixture.clientId}/${fixture.estimateId}`});
    await waitFor(()=>tab.evaluate("document.body.innerText.includes('Issued release') && Boolean(document.querySelector('.costing-sheet'))"),'Issued costing did not load read-only');
    assert.equal(await tab.evaluate("document.querySelector('.costing-sheet__edit-boundary').disabled"),true);
    assert.equal(await tab.evaluate("[...document.querySelectorAll('.costing-sheet__section-label')].every(button=>button.getAttribute('aria-expanded')==='true')"),true,'Issued sections must remain readable without enabling edits');
    await writeFile(path.join(output,'urgent-issued-readonly.png'),Buffer.from((await tab.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data,'base64'));
    // Accept only this test page's explicit create-successor confirmation.
    await tab.evaluate('window.confirm=()=>true');
    await click(tab,'Create editable Estimate revision');
    await waitFor(()=>tab.evaluate(`!location.hash.endsWith(${JSON.stringify(fixture.estimateId)}) && Boolean(document.querySelector('.costing-sheet__edit-boundary:not(:disabled)'))`),'Editable Estimate successor did not open');
    const lineage=await db.get('SELECT successor_estimate_id FROM estimate_revision_lineage WHERE source_release_id=?',fixture.release.id);
    assert.ok(lineage);const workingId=lineage.successor_estimate_id;
    const workingScenario=await db.get('SELECT id FROM project_calculator_lab_scenarios WHERE estimate_id=?',workingId);
    const sid=workingScenario.id;
    const repeated=await request(`/scenarios/${sourceId}/working-estimate`,{},'POST');assert.equal(repeated.value.estimateId,workingId);
    assert.equal((await db.get('SELECT COUNT(*) n FROM estimate_revision_lineage WHERE source_release_id=?',fixture.release.id)).n,1);
    const reload=async()=>{const origin=await tab.evaluate('performance.timeOrigin');await tab.send('Page.reload',{ignoreCache:true});await waitFor(()=>tab.evaluate(`performance.timeOrigin!==${origin} && document.readyState==='complete' && Boolean(document.querySelector('.costing-sheet__edit-boundary:not(:disabled)'))`),'Working costing reload failed');};
    const expand=async(section='siteVisit')=>{await tab.evaluate(`(()=>{const button=document.querySelector('.costing-sheet__section--${section} .costing-sheet__section-label');if(button&&button.getAttribute('aria-expanded')==='false')button.click()})()`);await waitFor(()=>tab.evaluate(`document.querySelector('.costing-sheet__section--${section} .costing-sheet__section-label')?.getAttribute('aria-expanded')==='true'`),'Costing section did not open');await tab.evaluate("document.querySelectorAll('details').forEach(item=>item.open=true)");};
    const sellingTotal=()=>tab.evaluate("Number(document.querySelector('.project-costing__headline-metrics span:nth-child(2) b').textContent.replace(/[^0-9.]/g,''))");
    const states=[];
    for(const [label,read] of [
      ['Include Import Customs allowance',s=>s.importCustoms.included],
      ['Installation Materials required',s=>s.options.installationMaterials.enabled],
      ['Installation required',s=>s.options.installationRequired]
    ]){
      const saved=(await request(`/scenarios/${sid}`)).value;
      const beforeTotal=await sellingTotal();
      for(const expected of [false,true]){
        const section=label==='Include Import Customs allowance'?'duties':label==='Installation Materials required'?'materials':'installation';
        await expand(section);
        await waitFor(()=>tab.evaluate(`Boolean(document.querySelector('[aria-label=${JSON.stringify(label)}]'))`),`${label} not reachable`);
        await tab.evaluate(`document.querySelector('[aria-label=${JSON.stringify(label)}]').click()`);
        await waitFor(async()=>read((await request(`/scenarios/${sid}`)).value)===expected,`${label} did not persist ${expected}`);
        await reload();await expand(section);
        await waitFor(()=>tab.evaluate(`document.querySelector('[aria-label=${JSON.stringify(label)}]')?.checked===${expected}`),`${label}: refreshed state did not match ${expected}`);
        const persisted=(await request(`/scenarios/${sid}`)).value;
        if(label==='Installation Materials required'){
          assert.deepEqual(persisted.options.installationMaterials.materialSelections,saved.options.installationMaterials.materialSelections);
          assert.deepEqual(persisted.options.installationMaterials.calculationSnapshot,saved.options.installationMaterials.calculationSnapshot);
          assert.equal(Boolean(persisted.installationMaterials),expected);
          assert.equal(persisted.installationCatalogueState.isCurrent,false);
        }
        if(label==='Installation required')assert.equal(Boolean(persisted.installationProgramme),expected);
        if(label==='Include Import Customs allowance')assert.equal(persisted.importCustoms.baseImportCost,saved.importCustoms.baseImportCost);
        const total=await sellingTotal();assert.ok(expected?total===beforeTotal:total<beforeTotal,`${label} did not change/restore the selling total`);
        assert.equal(await tab.evaluate("document.querySelector('.costing-sheet__purchase-total b').textContent===document.querySelector('.project-costing__headline-metrics span:first-child b').textContent"),true,'Summary and header project costs must agree');
        states.push({label,included:expected,reloaded:true,sellingTotal:total,originalSellingTotal:beforeTotal});
      }
    }
    console.log(JSON.stringify({toggleVerification:states}));
    await expand();
    assert.match(await tab.evaluate('document.body.innerText'),/Travel time not confirmed/);
    const setLabel=async(label,value)=>{const index=await tab.evaluate(`[...document.querySelectorAll('.site-visit-panel label')].findIndex(item=>item.textContent.startsWith(${JSON.stringify(label)}))`);assert.ok(index>=0);await input(tab,`.site-visit-panel label:nth-child(${index+1}) input`,value);};
    await setLabel('Reviewed one-way distance','100');await setLabel('Reviewed one-way travel time','2');
    await click(tab,'Save Site Visit Cost');
    await waitFor(()=>tab.evaluate("document.body.innerText.includes('explain their basis before saving')"),'Missing manual basis was not explained');
    await input(tab,'input[placeholder="Source, date and reason for the reviewed override"]','DISPOSABLE TEST ONLY: reviewed planning estimate, not a provider route');
    await click(tab,'Save Site Visit Cost');
    await waitFor(()=>tab.evaluate("document.body.innerText.includes('Site Visit / Travel costing saved')"),'Manual route did not save');
    await reload();await expand();
    const travel=(await request(`/scenarios/${sid}`)).value.siteVisitTravel;
    assert.equal(travel.input.reviewedOneWayMiles,'100');assert.equal(travel.input.reviewedTravelHours,'2');assert.match(travel.input.manualRouteBasis,/DISPOSABLE TEST/);assert.equal(travel.chargeableMiles,'200.00');assert.equal(travel.totalDrivingHours,'4.00');
    assert.equal((await db.get('SELECT options_json FROM project_calculator_lab_options WHERE scenario_id=?',sourceId)).options_json,before.options_json);
    await writeFile(path.join(output,'urgent-working-costing.png'),Buffer.from((await tab.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data,'base64'));
    await click(tab,'Review Customer Quotation');
    await waitFor(()=>tab.evaluate("Boolean(document.querySelector('.customer-quotation__terms-notice'))"),'Customer PDF preview did not open');
    await waitFor(()=>tab.evaluate("Boolean(document.querySelector('.customer-quotation__terms-notice'))"),'Customer terms review did not load');
    await click(tab,'Review terms');await waitFor(()=>tab.evaluate("Boolean(document.querySelector('.customer-quotation__terms-editor'))"),'Terms editor did not open');await click(tab,'Confirm for this Estimate');
    await waitFor(()=>tab.evaluate("document.body.innerText.includes('Customer terms reviewed')"),'Disposable terms confirmation failed');
    const downloadRoot=path.join(output,`urgent-downloads-${fixture.suffix}`);await mkdir(downloadRoot,{recursive:true});await tab.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloadRoot});
    await click(tab,'Download PDF');await waitFor(()=>tab.evaluate("document.body.innerText.includes('PDF downloaded')"),'Customer PDF download failed');
    const downloaded=await waitFor(async()=>{const files=await readdir(downloadRoot);return files.find(file=>file.endsWith('.pdf'))},'Downloaded PDF did not reach owned storage');
    const working=await db.get('SELECT estimate_ref FROM estimates WHERE id=?',workingId);
    const pdf=await inspectPdf(path.join(downloadRoot,downloaded),[working.estimate_ref]);
    await click(tab,'Send to Client');await waitFor(()=>tab.evaluate("document.body.innerText.includes('Email ready to review')"),'Reviewed send composer did not open');
    assert.equal(await tab.evaluate("Boolean(document.querySelector('.customer-quotation__email-fields input[type=email]'))"),true);
    const prepared=await db.get('SELECT status,commercial_snapshot_json,document_id FROM issued_quotations WHERE estimate_id=?',workingId);assert.ok(prepared);assert.notEqual(prepared.status,'issued');
    const report={sourceEstimateId:fixture.estimateId,workingId,sourceScenarioId:sourceId,workingScenarioId:sid,guardException,requests,states,manualTravel:travel,issuedOptionsUnchanged:true,previewOpened:true,downloadedPdf:pdf,reviewedComposerOpened:true,preparedCommercialSnapshot:JSON.parse(prepared.commercial_snapshot_json),sentEmails:0};
    await writeFile(path.join(output,'urgent-costing-report.json'),JSON.stringify(report,null,2));
    console.log(JSON.stringify(report));
  }finally{await db.close()}
}
