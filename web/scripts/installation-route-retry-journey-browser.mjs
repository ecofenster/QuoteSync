import assert from 'node:assert/strict';
import {open} from 'sqlite';
import sqlite3 from 'sqlite3';
import {writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createInstallationWorkforceService} from '../server/features/projectCalculatorLab/installationWorkforceService.js';
import {createProjectCalculatorLabService} from '../server/features/projectCalculatorLab/projectCalculatorLabService.js';
import {INSTALLATION_CAPABILITIES} from '../server/features/projectCalculatorLab/installationProgramme.js';

// Uses only the parent's fresh disposable database and owned browser lifecycle.
export async function verifyInstallationRouteRetry({tab,click,waitFor,databasePath,output,manualReview=false,companyPolicy=false}) {
  await waitFor(()=>tab.evaluate("Boolean(document.querySelector('.costing-sheet__section--installation .costing-sheet__section-label'))"),'Working costing did not open');
  const db=await open({filename:databasePath,driver:sqlite3.Database});
  try {
    const working=await db.get('SELECT id,estimate_ref FROM estimates WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 1');
    const scenario=await db.get('SELECT id FROM project_calculator_lab_scenarios WHERE estimate_id=? ORDER BY created_at DESC LIMIT 1',working.id);
    assert.ok(scenario,'Disposable working costing is required');
    const workforce=createInstallationWorkforceService(db);
    await workforce.saveCompany({id:'disposable-route-company',name:'Disposable Route Company',postcode:'SW1A 1AA',dayRate:'350'});
    await workforce.saveTeam({id:'disposable-route-team',companyId:'disposable-route-company',name:'Disposable Route Team',normalCrewSize:3,basePostcode:'SW1A 1AA',capabilities:INSTALLATION_CAPABILITIES});
    const costing=createProjectCalculatorLabService(db);
    await costing.updateOptions(scenario.id,{installationRequired:true,siteVisitTravel:{sitePostcode:'CF10 1AA',sitePostcodeSource:'manually_corrected'}});
    await costing.updateInstallationProfile(scenario.id,{sitePostcode:'CF10 1AA',projectType:'new_build'});
    if(companyPolicy){
      await click(tab,'Admin');await waitFor(()=>tab.evaluate("Boolean([...document.querySelectorAll('.admin-nav-button')].find(item=>item.querySelector('.admin-nav-button-label')?.textContent==='Installation'))"),'Installation Administration missing');
      await tab.evaluate("[...document.querySelectorAll('.admin-nav-button')].find(item=>item.querySelector('.admin-nav-button-label')?.textContent==='Installation').click()");
      await waitFor(()=>tab.evaluate("[...document.querySelectorAll('.workforce-admin tbody tr')].some(row=>row.textContent.includes('Disposable Route Company'))"),'Installer company missing');
      const editCompany=async()=>{await tab.evaluate("[...document.querySelectorAll('.workforce-admin tbody tr')].find(row=>row.textContent.includes('Disposable Route Company')).querySelector('button').click()");await waitFor(()=>tab.evaluate("Boolean(document.querySelector('[name=travelPolicyMode]'))"),'Company policy form missing');};
      await editCompany();await tab.evaluate("[...document.querySelectorAll('.workforce-admin__modal summary')].find(item=>item.textContent==='Vehicle-mileage policy').click()");
      await tab.evaluate("(()=>{const select=document.querySelector('[name=travelPolicyMode]');select.value='per_vehicle_mile';select.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('[name=travelPolicyBasis]').value='Disposable agreed installer mileage';})()");
      await click(tab,'Save Company');await waitFor(()=>tab.evaluate("document.querySelector('.workforce-admin__modal')&&document.body.innerText.includes('agreed mileage rate')"),'Missing policy rate was not rejected');
      assert.equal(await tab.evaluate("document.querySelector('[name=travelPolicyBasis]').value"),'Disposable agreed installer mileage');
      await tab.evaluate("document.querySelector('[name=travelMileageRate]').value='0.65'");await click(tab,'Save Company');await waitFor(()=>tab.evaluate("!document.querySelector('.workforce-admin__modal')"),'Policy save did not finish');
      await editCompany();assert.equal(await tab.evaluate("document.querySelector('[name=travelMileageRate]').value"),'0.65');await click(tab,'Cancel');
      assert.equal((await costing.getScenario(scenario.id)).options.installationProfile.mileageRate,'0.55','Administration repriced the existing Estimate');
    }
    // Controlled routing responses only. All save/profile operations use the real API.
    await tab.evaluate(`(()=>{const original=window.fetch;window.__routeTestFetch=original;window.fetch=async(input,init)=>{const url=String(input);if(url.includes('/api/integrations/googleMaps/geocode')){const query=JSON.parse(init.body).query;return new Response(JSON.stringify(query==='SW1A 1AA'?{lat:51.5,lng:-0.1}:{lat:51.48,lng:-3.18}),{status:200,headers:{'Content-Type':'application/json'}});}if(url.includes('/api/integrations/googleMaps/route'))return new Response(JSON.stringify(JSON.parse(init.body).origin.lat===51.48?{distanceKm:260,durationMinutes:210}:{distanceKm:240,durationMinutes:180}),{status:200,headers:{'Content-Type':'application/json'}});return original(input,init);};})()`);
    await click(tab,'Home');await click(tab,'Estimates');
    await waitFor(()=>tab.evaluate(`Boolean(document.querySelector('button[aria-label=${JSON.stringify(`Open ${working.estimate_ref}`)}]'))`),'Working Estimate list entry missing');
    await tab.evaluate(`document.querySelector('button[aria-label=${JSON.stringify(`Open ${working.estimate_ref}`)}]').click()`);
    await waitFor(()=>tab.evaluate("Boolean(document.querySelector('.costing-sheet__section--installation .costing-sheet__section-label'))"),'Installation section missing');
    await tab.evaluate("document.querySelector('.costing-sheet__section--installation .costing-sheet__section-label').click()");
    await waitFor(()=>tab.evaluate("[...document.querySelectorAll('select[aria-label=\"Installation Team\"] option')].some(item=>item.textContent.includes('Disposable Route Team'))||[...document.querySelectorAll('select[aria-label=\"Installation Company\"] option')].some(item=>item.textContent.includes('Disposable Route Company'))"),'Disposable workforce missing');
    const select=async(label,value)=>tab.evaluate(`(()=>{const control=document.querySelector('select[aria-label=${JSON.stringify(label)}]');control.value=${JSON.stringify(value)};control.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    await select('Installation Company','disposable-route-company');await select('Installation Team','disposable-route-team');
    await waitFor(()=>tab.evaluate("[...document.querySelectorAll('button')].some(item=>item.textContent==='Refresh recommendation'&&!item.disabled)"),'Route recommendation remained busy');
    await click(tab,'Refresh recommendation');
    await waitFor(()=>tab.evaluate("document.querySelector('.costing-sheet__installation-context').textContent.includes('180 min')&&[...document.querySelectorAll('button')].some(item=>item.textContent==='Use Installation Company'&&!item.disabled)"),'Controlled route was not offered for review');
    await tab.send('Network.setBlockedURLs',{urls:['*installation-profile*']});
    await click(tab,'Use Installation Company');
    await waitFor(()=>tab.evaluate("/Failed to fetch|could not/i.test(document.querySelector('.costing-sheet__installation-context').textContent)"),'Profile failure was not visible');
    assert.equal(await tab.evaluate("document.querySelector('select[aria-label=\"Installation Team\"]').value"),'disposable-route-team','Failed profile save lost the reviewed Team');
    const saved=await db.all('SELECT * FROM project_calculator_lab_route_snapshots WHERE scenario_id=?',scenario.id);
    assert.equal(saved.length,1,'First attempt must retain exactly one route');
    assert.equal(saved[0].origin_label,'SW1A 1AA');assert.equal(saved[0].destination_label,'CF10 1AA');
    assert.equal((await costing.getScenario(scenario.id)).options.installationProfile?.selectedTeamId??null,null);
    await tab.send('Network.setBlockedURLs',{urls:[]});await click(tab,'Use Installation Company');
    await waitFor(()=>tab.evaluate("document.querySelector('.costing-sheet__installation-context [role=status]')?.textContent.includes('saved for this costing revision')"),'Retry did not show success');
    const final=await costing.getScenario(scenario.id);
    assert.equal(final.routeSnapshots.length,1);assert.equal(final.options.installationProfile.route.snapshotId,saved[0].id);assert.equal(final.options.installationProfile.selectedTeamId,'disposable-route-team');
    await tab.evaluate("document.querySelector('.installation-travel-review summary').click()");
    await click(tab,'Calculate both directions');
    await waitFor(()=>tab.evaluate("document.querySelector('.installation-travel-review select')!==null"),'Two-leg review did not open');
    assert.equal(await tab.evaluate("(()=>{const pattern=document.querySelector('.installation-travel-review select');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(pattern,'daily_travel');pattern.dispatchEvent(new Event('change',{bubbles:true}));return true})()"),true);
    if(companyPolicy)assert.equal(await tab.evaluate("document.querySelector('[aria-label=\"Vehicle-mileage basis\"]').value"),'installer_company','Configured installer policy was not proposed for review');
    await tab.send('Network.setBlockedURLs',{urls:['*installation-profile*']});await click(tab,'Apply reviewed journey');
    await waitFor(()=>tab.evaluate("document.querySelector('.installation-travel-review [role=alert]')?.textContent.includes('2 route leg(s) were retained')"),'Pair partial-success recovery was not visible');
    assert.equal((await costing.getScenario(scenario.id)).routeSnapshots.length,3,'Both new directional drafts must be saved once');
    await tab.send('Network.setBlockedURLs',{urls:[]});await click(tab,'Apply reviewed journey');
    await waitFor(()=>tab.evaluate("document.querySelector('.installation-travel-review [role=status]')?.textContent.includes('Outward and return travel saved')"),'Paired travel retry did not show success');
    const paired=await costing.getScenario(scenario.id),journey=paired.options.installationProfile.route;
    assert.equal(paired.routeSnapshots.length,3);assert.equal(journey.distanceBasis,'retained_directions_v1');assert.notEqual(journey.snapshotId,journey.returnSnapshotId);
    assert.equal(journey.oneWayDurationMinutes,180);assert.equal(journey.returnDurationMinutes,210);assert.equal(journey.returnMiles,'161.56');
    assert.equal(paired.installationProgramme.travel.chargeableMiles,((Number(journey.oneWayMiles)+Number(journey.returnMiles))*paired.installationProgramme.programmeDays).toFixed(2));
    if(companyPolicy){assert.equal(paired.installationProgramme.travel.mileageRate,'0.65');assert.equal(paired.options.installationProfile.travelPolicySnapshot.companyId,'disposable-route-company');assert.equal(paired.options.installationProfile.travelPolicySnapshot.companyVersion,2);console.log(JSON.stringify({scope:'Normal Administration invalid policy → retained form → configure/reopen → unchanged existing Estimate → explicit travel policy adoption/retry',policyRate:'0.65',companyVersion:2}));}
    if(manualReview){
      await tab.evaluate("window.__manualTravelRequests=[];window.fetch=async(input,init)=>{if(String(input).includes('/installation-profile'))window.__manualTravelRequests.push(JSON.parse(init.body));return window.__routeTestFetch(input,init)}");
      await tab.send('Network.setBlockedURLs',{urls:['*googleMaps/*']});await click(tab,'Calculate both directions');
      await waitFor(()=>tab.evaluate("document.querySelector('.installation-travel-review [role=alert]')!==null"),'Routing failure was not visible');
      await tab.evaluate("document.querySelector('.installation-travel-review__manual summary').click()");
      const fill=async(label,value)=>tab.evaluate(`(()=>{const control=document.querySelector('[aria-label=${JSON.stringify(label)}]');const proto=control.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(control,${JSON.stringify(value)});control.dispatchEvent(new Event('input',{bubbles:true}));})()`);
      await fill('Outward distance (miles)','160');await fill('Outward time (minutes)','180');await fill('Return distance (miles)','170');await fill('Manual travel source and basis','Disposable reviewed planner estimate');
      await click(tab,'Review manual journey');await waitFor(()=>tab.evaluate("document.querySelector('.installation-travel-review [role=alert]')?.textContent.includes('Return time is not confirmed')"),'Blank return time was not rejected');
      assert.equal(await tab.evaluate("document.querySelector('[aria-label=\"Outward distance (miles)\"]').value"),'160');
      await fill('Return time (minutes)','210');await click(tab,'Review manual journey');
      await waitFor(()=>tab.evaluate("document.querySelector('.installation-travel-review [role=status]')?.textContent.includes('Manual travel is ready')"),'Manual review could not reuse retained coordinates without routing');
      assert.equal(await tab.evaluate("(()=>{const pattern=document.querySelector('.installation-travel-review select');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(pattern,'stay_away');pattern.dispatchEvent(new Event('change',{bubbles:true}));return true})()"),true);
      assert.equal(await tab.evaluate("document.querySelector('.installation-travel-review select').value"),'stay_away','Reviewed pattern did not remain selected');
      await tab.send('Network.setBlockedURLs',{urls:['*googleMaps/*','*installation-profile*']});await click(tab,'Apply reviewed journey');
      await waitFor(()=>tab.evaluate("document.querySelector('.installation-travel-review [role=alert]')?.textContent.includes('2 route leg(s) were retained')"),'Manual partial-save result missing');
      await tab.send('Network.setBlockedURLs',{urls:['*googleMaps/*']});await click(tab,'Apply reviewed journey');
      await waitFor(()=>tab.evaluate("document.querySelector('.installation-travel-review [role=status]')?.textContent.includes('Outward and return travel saved')"),'Manual retry did not complete');
      const requests=await tab.evaluate('window.__manualTravelRequests');assert.equal(requests.length,2);assert.ok(requests.every(request=>request.travelMode==='stay_away'));assert.equal(requests[0].travelReviewKey,requests[1].travelReviewKey);
      const reviewed=await costing.getScenario(scenario.id);assert.equal(reviewed.routeSnapshots.length,5);assert.equal(reviewed.installationProgramme.travel.chargeableMiles,'330.00');assert.equal(reviewed.installationProgramme.travel.mode,'stay_away');
      const manualRows=reviewed.routeSnapshots.filter(row=>row.manuallyOverridden);assert.equal(manualRows.length,2);assert.ok(manualRows.every(row=>row.overrideReason==='Disposable reviewed planner estimate'));
      assert.equal(reviewed.options.installationProfile.route.calculationMethod,'reviewed_manual');assert.equal(reviewed.options.installationProfile.route.overrideReason,'Disposable reviewed planner estimate');
      assert.equal(await tab.evaluate("document.querySelector('.costing-sheet__installation-context').textContent.includes('160.0 miles')"),true,'Company overview did not show the saved manual distance');
      assert.equal(await tab.evaluate("[...document.querySelectorAll('.costing-sheet__installation-context button')].some(button=>button.textContent==='Current Company / Team'&&button.disabled)"),true,'Cached recommendation incorrectly offered to replace the approved Team');
      console.log(JSON.stringify({scope:'Blocked route provider → missing manual time rejection → retained entries → reviewed manual pair using known coordinates → failed adoption → safe retry → overnight costing',manualRoutes:2,allRetainedRoutes:5,chargeableMiles:'330.00',inventedCoordinates:false}));
      await tab.send('Network.setBlockedURLs',{urls:[]});
    }
    await tab.evaluate("document.querySelector('.installation-travel-review').scrollIntoView({block:'center'})");
    const screen=await tab.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(path.join(output,'installation-route-retry.png'),Buffer.from(screen.data,'base64'));
    console.log(JSON.stringify({scope:'Normal Installation reviewed route → real route save → blocked profile save → retained selection → retry → exact saved route adoption → paired direction review → blocked adoption → retry → directional costing',scenarioId:scenario.id,savedRouteId:saved[0].id,routeRows:3,pairedRoute:journey,routing:'controlled no-network provider responses',liveDelivery:false}));
  } finally {
    await tab.send('Network.setBlockedURLs',{urls:[]}).catch(()=>{});
    await tab.evaluate('if(window.__routeTestFetch){window.fetch=window.__routeTestFetch;delete window.__routeTestFetch;}').catch(()=>{});
    await db.close();
  }
}
