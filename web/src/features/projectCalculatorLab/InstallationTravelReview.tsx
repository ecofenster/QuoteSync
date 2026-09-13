import {useRef,useState} from 'react';
import type {CalculatorScenario} from './domain/projectCalculatorLab.types';
import {projectCalculatorLabApi} from './api/projectCalculatorLabApi';
import {calculateDirectionalRoute,resolveRouteEndpoint,type RouteDraft} from './integrations/routeIntegration';

export default function InstallationTravelReview({scenario}:{scenario:CalculatorScenario}){
  const profile=scenario.options?.installationProfile??{},team=scenario.selectedInstallationTeam;
  const base=String(team?.basePostcode??''),site=String(profile.sitePostcode??'');
  const [draft,setDraft]=useState<{out:RouteDraft;back:RouteDraft;context:string;key:string}|null>(null);
  const [mode,setMode]=useState(profile.travelMode==='daily_travel'?'daily_travel':profile.travelMode==='stay_away'?'stay_away':'');
  const [busy,setBusy]=useState(false),[status,setStatus]=useState(''),[failed,setFailed]=useState(false);
  const saving=useRef(false),context=JSON.stringify([scenario.id,scenario.revisionNumber,team?.id,base,site]);
  const saved=profile.route as Record<string,unknown>|undefined;
  const config={googleMapsApiKey:'server-managed',what3wordsApiKey:'server-managed'};
  async function prepare(){
    if(saving.current)return;saving.current=true;setBusy(true);setFailed(false);setStatus('Calculating outward and return travel…');
    try{
      if(!team?.id||!base||!site)throw new Error('Travel time not confirmed. Save an installer Team with a base postcode and confirm the site first.');
      const origin=await resolveRouteEndpoint(base,config),destination=await resolveRouteEndpoint(site,config);
      if(!origin||!destination)throw new Error('Travel time not confirmed. Check the installer base and site addresses, then retry.');
      const out=await calculateDirectionalRoute('installer_to_site',origin,destination,config),back=await calculateDirectionalRoute('site_to_installer',destination,origin,config);
      if(!out||!back)throw new Error('Travel time not confirmed for both directions. Your saved journey is unchanged; retry when routing is available.');
      setDraft({out,back,context,key:crypto.randomUUID()});setStatus('Both directions are ready for review. Choose the journey pattern, then apply them to this costing. Nothing has been applied yet.');
    }catch(error){setFailed(true);setStatus(error instanceof Error?error.message:'Travel could not be calculated. Your saved journey is unchanged.');}
    finally{saving.current=false;setBusy(false);}
  }
  async function apply(){
    if(saving.current||!draft)return;saving.current=true;setBusy(true);setFailed(false);setStatus('Saving reviewed travel…');
    let retained=0;
    try{
      if(context!==draft.context)throw new Error('The costing, installer or site changed. Calculate both directions again before applying travel.');
      if(!mode)throw new Error('Choose daily return travel or an overnight stay.');
      const out=await projectCalculatorLabApi.addRouteSnapshot(scenario.id,draft.out as unknown as Record<string,unknown>);retained++;
      const back=await projectCalculatorLabApi.addRouteSnapshot(scenario.id,draft.back as unknown as Record<string,unknown>);retained++;
      const updated=await projectCalculatorLabApi.updateInstallationProfile(scenario.id,{travelReviewKey:draft.key,expectedRevisionNumber:scenario.revisionNumber,mileageRate:scenario.installationProgramme?.travel.mileageRate,vehicleCount:scenario.installationProgramme?.travel.vehicleCount,travelMode:mode,route:{...saved,snapshotId:out.savedRouteSnapshotId,returnSnapshotId:back.savedRouteSnapshotId,distanceBasis:'retained_directions_v1'}});
      window.dispatchEvent(new CustomEvent('quotesuite:costing-updated',{detail:updated}));setDraft(null);setStatus('Outward and return travel saved for this costing revision. Next: review the Installation total and installer pack.');
    }catch(error){setFailed(true);setStatus(`${error instanceof Error?error.message:'Travel could not be applied.'} ${retained?`${retained} route leg(s) were retained. `:''}Your review choices are retained; retry reuses saved route evidence.`);}
    finally{saving.current=false;setBusy(false);}
  }
  if(!team?.id)return null;
  return <details className="ui-card installation-travel-review"><summary>Installer journey · review outward and return travel</summary>
    <p>From {base||'Base not confirmed'} to {site||'Site not confirmed'}. These are postcode route estimates, not confirmed arrival times.</p>
    {saved?.returnSnapshotId?<p>Saved outward: {String(saved.oneWayDurationMinutes??'Not confirmed')} min. Return: {String(saved.returnDurationMinutes??'Not confirmed')} min.</p>:<p>Return travel time not confirmed. Existing costing retains its previous return-distance assumption until you apply a reviewed journey.</p>}
    <button type="button" className="ui-button" disabled={busy||!base||!site} onClick={()=>void prepare()}>Calculate both directions</button>
    {draft?<><div className="costing-sheet__facts"><span>Outward <b>{draft.out.durationMinutes} min · {(Number(draft.out.distanceKm)*0.621371192).toFixed(2)} miles</b></span><span>Return <b>{draft.back.durationMinutes} min · {(Number(draft.back.distanceKm)*0.621371192).toFixed(2)} miles</b></span></div>
      <label>Planned journey<select className="ui-input" value={mode} disabled={busy} onChange={event=>setMode(event.target.value)}><option value="">Choose journey pattern</option><option value="daily_travel">Return to base each working day</option><option value="stay_away">Travel to site and return around an overnight stay</option></select></label>
      <p>Uses this Estimate’s saved mileage rate of £{scenario.installationProgramme?.travel.mileageRate??'Not confirmed'} per mile and {scenario.installationProgramme?.travel.vehicleCount??'Not confirmed'} vehicle(s). Review installer-specific terms before applying. Daily travel counts both directions per programme day; an overnight stay counts one outward and one return journey.</p>
      <button type="button" className="ui-button ui-button--primary" disabled={busy||!mode} onClick={()=>void apply()}>{busy?'Saving…':'Apply reviewed journey'}</button></>:null}
    {status?<p role={failed?'alert':'status'}>{status}</p>:null}
  </details>;
}
