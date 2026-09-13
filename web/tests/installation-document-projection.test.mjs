import test from 'node:test';
import assert from 'node:assert/strict';
import {projectInstallationDocument} from '../server/features/installationSafety/installationDocumentProjection.js';
import {calculateInstallationProgramme} from '../server/features/projectCalculatorLab/installationProgramme.js';
import {installationDocumentDefinition,renderInstallationDocumentPdf} from '../server/features/installationSafety/installationDocumentRenderer.js';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';

const revision={estimateId:'estimate-a',estimateReference:'TEST-EST-1',revision:2,clientName:'Disposable Client',projectName:'Disposable site',siteAddress:'Test site address',positions:[
  ...['window','door','sliding door','lift and slide door','bifold'].map((productClass,index)=>({id:`p${index}`,reference:`P${index}`,productClass,quantity:2,widthMm:1200,heightMm:1400,customerPrice:'PRIVATE-SELLING',supplierPrice:'PRIVATE-PURCHASE'})),
  {id:'excluded',classification:'alternative',productClass:'door',quantity:4},
]};
test('separate allowlisted client and installer projections use actual programme shape without commercial leakage',()=>{
  const profile={crewSize:4,travelMode:'stay_away',route:{snapshotId:'route-a',oneWayDurationMinutes:45,oneWayMiles:20}};
  const programme=calculateInstallationProgramme({positions:[],profile,rules:{standardUnitsPerDayByCrew:{'4':10},productiveHoursPerDay:8}});
  const scenario={id:'scenario-a',estimateId:'estimate-a',revisionNumber:3,options:{installationProfile:profile},installationProgramme:programme,selectedInstallationTeam:{name:'Disposable team',companyName:'Disposable installer'},routeSnapshots:[{id:'route-a',origin:{label:'Installer base'},destination:{label:'Test site'},durationMinutes:45,integration:'retained test route'}],margin:'PRIVATE-MARGIN'};
  const installer=projectInstallationDocument({audience:'installer',revision,scenario});
  assert.deepEqual(installer.totals,{windows:2,doors:2,slidingDoors:2,liftAndSlideDoors:2,bifolds:2,notConfirmed:0});
  assert.equal(installer.installation.costedCrewSize,programme.costedCrewSize);
  assert.equal(installer.installation.foodAllowance,Number(programme.costs.food));
  assert.equal(installer.installation.travel.oneWayMinutes,45);assert.equal(installer.installation.travel.returnMinutes,null,'Do not assume return route equals outward');
  assert.doesNotMatch(JSON.stringify(installer),/PRIVATE|purchaseCost|labour|markup/);
  const client=projectInstallationDocument({audience:'client',revision,scenario});assert.equal(client.installation,undefined);assert.doesNotMatch(JSON.stringify(client),/PRIVATE|Allowance|crew|route|costed|accommodation/);
});
test('missing calculation and route remain unknown; wrong Estimate or repeated Position fails closed',()=>{
  const pack=projectInstallationDocument({audience:'installer',revision});assert.equal(pack.installation.installationDays,null);assert.equal(pack.installation.foodAllowance,null);assert.equal(pack.installation.travel.status,'Travel time not confirmed');
  assert.throws(()=>projectInstallationDocument({audience:'installer',revision,scenario:{estimateId:'other'}}),/another Estimate/);
  assert.throws(()=>projectInstallationDocument({audience:'client',revision:{...revision,positions:[revision.positions[0],revision.positions[0]]}}),/repeated Position/);
  assert.equal(revision.positions.length,6,'Source schedule remains unchanged');
});
test('separate printable PDFs retain explicit unknowns without emitting commercial or client installer allowances',async()=>{
  for(const audience of ['client','installer']){
    const model=projectInstallationDocument({audience,revision});
    const definition=JSON.stringify(installationDocumentDefinition(model));
    assert.doesNotMatch(definition,/PRIVATE|purchaseCost|markup/);
    if(audience==='client')assert.doesNotMatch(definition,/Installer operational|Food allowance|Accommodation|Window-cill fitting|Travel time/);
    else assert.match(definition,/Travel time not confirmed/);
    const pdf=await renderInstallationDocumentPdf(model);assert.equal(pdf.subarray(0,5).toString(),'%PDF-');assert.ok(pdf.length>1000);
    const task=getDocument({data:new Uint8Array(pdf),useSystemFonts:true});const parsed=await task.promise;
    try{let rendered='';for(let page=1;page<=parsed.numPages;page++)rendered+=(await(await parsed.getPage(page)).getTextContent()).items.map(item=>item.str||'').join(' ');
      assert.match(rendered,/DRAFT/);assert.match(rendered,/TEST-EST-1/);assert.doesNotMatch(rendered,/PRIVATE|purchaseCost|markup/);
      if(audience==='client')assert.doesNotMatch(rendered,/Food allowance|Accommodation|Window-cill fitting/);else assert.match(rendered,/Travel time not confirmed/);
    }finally{await task.destroy()}
  }
});
