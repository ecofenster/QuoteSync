import test from 'node:test';
import assert from 'node:assert/strict';
import {projectInstallationDocument} from '../server/features/installationSafety/installationDocumentProjection.js';
import {calculateInstallationProgramme} from '../server/features/projectCalculatorLab/installationProgramme.js';
import {installationDocumentDefinition,renderInstallationDocumentPdf} from '../server/features/installationSafety/installationDocumentRenderer.js';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';

const revision={estimateId:'estimate-a',estimateReference:'TEST-EST-1',revision:2,clientName:'Disposable Client',projectName:'Disposable site',siteAddress:'Test site address, CF10 1AA',positions:[
  ...['window','door','sliding door','lift and slide door','bifold'].map((productClass,index)=>({id:`p${index}`,reference:`P${index}`,productClass,quantity:2,widthMm:1200,heightMm:1400,customerPrice:'PRIVATE-SELLING',supplierPrice:'PRIVATE-PURCHASE'})),
  {id:'excluded',classification:'alternative',productClass:'door',quantity:4},
]};
test('accepted Order schedule retains accepted alternatives and historic exclusion flags in both PDFs',async()=>{
  const source={...revision,orderId:'order-a',orderReference:'TEST-ORDER',positions:[{...revision.positions[0],reference:'ACCEPTED-ALTERNATIVE',classification:'alternative',includedInCurrentEstimate:false}]};
  for(const audience of ['client','installer']){
    const projection=projectInstallationDocument({audience,revision:source});assert.equal(projection.positions.length,1);assert.equal(projection.totals.windows,2);
    const bytes=await renderInstallationDocumentPdf(projection),task=getDocument({data:new Uint8Array(bytes),useSystemFonts:true}),pdf=await task.promise;
    try{let text='';for(let page=1;page<=pdf.numPages;page++)text+=(await(await pdf.getPage(page)).getTextContent()).items.map(item=>item.str).join(' ');assert.match(text,/ACCEPTED-ALTERNATIVE/);}finally{await task.destroy();}
  }
  assert.equal(source.positions[0].classification,'alternative');assert.equal(source.positions[0].includedInCurrentEstimate,false);
});
test('separate allowlisted client and installer projections use actual programme shape without commercial leakage',()=>{
  const profile={selectedTeamId:'team-a',sitePostcode:'CF10 1AA',crewSize:4,travelMode:'stay_away',route:{snapshotId:'route-a',oneWayDurationMinutes:45,oneWayMiles:20}};
  const programme=calculateInstallationProgramme({positions:[],profile,rules:{standardUnitsPerDayByCrew:{'4':10},productiveHoursPerDay:8}});
  const scenario={id:'scenario-a',estimateId:'estimate-a',revisionNumber:3,options:{installationProfile:profile},installationProgramme:programme,selectedInstallationTeam:{id:'team-a',basePostcode:'KY4 9FA',name:'Disposable team',companyName:'Disposable installer'},routeSnapshots:[{id:'route-a',scenarioId:'scenario-a',direction:'office_to_site',origin:{label:'KY4 9FA',lat:56.1,lng:-3.3},destination:{label:'CF10 1AA',lat:51.4,lng:-3.1},distanceKm:'30',durationMinutes:45,integration:'google_routes_installation_team'}],margin:'PRIVATE-MARGIN'};
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
test('canonical source product labels populate totals without trusting imported default Window or guessing descriptions',()=>{
  const positions=[
    {id:'window',origin:'supplier_imported',product:'Window',positionType:'Window',quantity:2},
    {id:'door',origin:'supplier_imported',product:'Door',positionType:'Window',quantity:3},
    {id:'slide',origin:'supplier_imported',product:'Sliding door',positionType:'Window',quantity:1},
    {id:'unknown',origin:'supplier_imported',product:'Special assembly',positionType:'Window',description:'window door',quantity:4},
    {id:'manual',positionType:'Door',quantity:1},
    {id:'authoritative',origin:'supplier_imported',productClass:'Bifold',product:'Door',quantity:2},
  ];
  const before=structuredClone(positions);
  for(const audience of ['client','installer']){
    const result=projectInstallationDocument({audience,revision:{...revision,positions}});
    assert.deepEqual(result.totals,{windows:2,doors:3,slidingDoors:1,liftAndSlideDoors:0,bifolds:2,notConfirmed:5});
  }
  assert.deepEqual(positions,before,'Classification must not rewrite source or issued schedules');
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
