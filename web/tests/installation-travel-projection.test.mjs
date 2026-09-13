import test from 'node:test';
import assert from 'node:assert/strict';
import {projectInstallerTravel} from '../server/features/installationSafety/installationTravelProjection.js';
import {projectInstallationDocument} from '../server/features/installationSafety/installationDocumentProjection.js';
import {renderInstallationDocumentPdf} from '../server/features/installationSafety/installationDocumentRenderer.js';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
const fixture=()=>{
  const base={label:'KY4 9FA',lat:56.1,lng:-3.3},site={label:'CF10 1AA',lat:51.4,lng:-3.1};
  const common={scenarioId:'s',distanceKm:'500',integration:'google_routes_installation_team',manuallyOverridden:false};
  return {revision:{siteAddress:'Disposable project, CF10 1AA'},scenario:{id:'s',selectedInstallationTeam:{id:'team',basePostcode:'KY4 9FA'},options:{installationProfile:{selectedTeamId:'team',sitePostcode:'CF10 1AA',travelMode:'stay_away',route:{snapshotId:'out',returnSnapshotId:'back'}}},routeSnapshots:[{...common,id:'out',direction:'office_to_site',origin:base,destination:site,durationMinutes:300},{...common,id:'back',direction:'site_to_office',origin:site,destination:base,durationMinutes:340}]}};
};
test('separate retained directions use the exact team/site and never assume equal durations',()=>{
  const data=fixture(),before=JSON.stringify(data),result=projectInstallerTravel(data.scenario,data.revision);
  assert.equal(result.oneWayMinutes,300);assert.equal(result.returnMinutes,340);assert.equal(result.pattern,'stay_away');assert.equal(result.departure,'KY4 9FA');assert.equal(JSON.stringify(data),before);
});
test('wrong base, revision, owner or ambiguous identity cannot supply installer travel',()=>{
  for(const change of [d=>d.scenario.selectedInstallationTeam.basePostcode='EH1 1AA',d=>d.revision.siteAddress='Other project EH1 1AA',d=>d.scenario.routeSnapshots[0].scenarioId='other',d=>d.scenario.routeSnapshots[0].integration='google_routes',d=>d.scenario.routeSnapshots.push(structuredClone(d.scenario.routeSnapshots[0]))]){const d=fixture();change(d);assert.equal(projectInstallerTravel(d.scenario,d.revision).oneWayMinutes,null);}
});
test('unrelated or missing return stays unknown; explained manual return and daily pattern remain explicit',()=>{
  const d=fixture();d.scenario.routeSnapshots[1].origin={label:'Other',lat:0,lng:0};assert.equal(projectInstallerTravel(d.scenario,d.revision).returnMinutes,null);
  const manual=fixture();manual.scenario.routeSnapshots[1].manuallyOverridden=true;assert.equal(projectInstallerTravel(manual.scenario,manual.revision).returnMinutes,null);
  manual.scenario.routeSnapshots[1].overrideReason='Reviewed return timing';manual.scenario.options.installationProfile.travelMode='daily_travel';const result=projectInstallerTravel(manual.scenario,manual.revision);assert.equal(result.returnMinutes,340);assert.equal(result.pattern,'daily_travel');assert.match(result.basis,/Reviewed return timing/);
});
test('installer PDF prints separate directional durations and an explicit overnight pattern',async()=>{
  const d=fixture();d.scenario.estimateId='e';d.revision={...d.revision,estimateId:'e',revision:1,positions:[{id:'p',reference:'P1',quantity:1,widthMm:1000,heightMm:1200}]};
  const document=projectInstallationDocument({...d,audience:'installer'}),task=getDocument({data:new Uint8Array(await renderInstallationDocumentPdf(document)),useSystemFonts:true});
  try{const pdf=await task.promise;let text='';for(let i=1;i<=pdf.numPages;i++)text+=(await(await pdf.getPage(i)).getTextContent()).items.map(item=>item.str).join(' ');assert.match(text,/300 minutes/);assert.match(text,/340 minutes/);assert.match(text,/Outward and return around an overnight stay/);assert.match(text,/KY4 9FA/);assert.match(text,/CF10 1AA/);}finally{await task.destroy();}
});
