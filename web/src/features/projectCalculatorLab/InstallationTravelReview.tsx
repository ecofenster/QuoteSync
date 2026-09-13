import {useRef,useState} from 'react';
import type {CalculatorScenario} from './domain/projectCalculatorLab.types';
import {projectCalculatorLabApi} from './api/projectCalculatorLabApi';
import {calculateDirectionalRoute,resolveRouteEndpoint,type RouteDraft} from './integrations/routeIntegration';
import {buildManualInstallationTravel} from '../../../shared/manualInstallationTravel.js';

export default function InstallationTravelReview({scenario}:{scenario:CalculatorScenario}){
  const profile=scenario.options?.installationProfile??{},team=scenario.selectedInstallationTeam;
  const base=String(team?.basePostcode??''),site=String(profile.sitePostcode??'');
  const [draft,setDraft]=useState<{out:RouteDraft;back:RouteDraft;context:string;key:string}|null>(null);
  const [mode,setMode]=useState(profile.travelMode==='daily_travel'?'daily_travel':profile.travelMode==='stay_away'?'stay_away':'');
  const [busy,setBusy]=useState(false),[status,setStatus]=useState(''),[failed,setFailed]=useState(false);
  const [manual,setManual]=useState({outwardMiles:'',outwardMinutes:'',returnMiles:'',returnMinutes:'',basis:''});
  const saving=useRef(false),context=JSON.stringify([scenario.id,scenario.revisionNumber,team?.id,base,site]);
  const saved=profile.route as Record<string,unknown>|undefined;
  const config={googleMapsApiKey:'server-managed',what3wordsApiKey:'server-managed'};
  async function prepareManual(){
    if(saving.current)return;saving.current=true;setBusy(true);setFailed(false);setStatus('Checking the manual journey and its locations…');
    try{
      if(!base||!site)throw new Error('Travel time not confirmed. Confirm the saved installer base and site first.');
      const normalized=(value:string)=>value.trim().replace(/\s+/g,'').toUpperCase();
      const retained=scenario.routeSnapshots.filter(route=>route.scenarioId===scenario.id&&route.direction==='office_to_site'&&normalized(route.origin.label)===normalized(base)&&normalized(route.destination.label)===normalized(site));
      const pairs=new Map(retained.map(route=>[JSON.stringify([Number(route.origin.lat),Number(route.origin.lng),Number(route.destination.lat),Number(route.destination.lng)]),route]));
      // Reuse coordinates only when retained evidence agrees on one exact pair.
      const known=pairs.size===1?[...pairs.values()][0]:null;
      const origin=known?.origin??await resolveRouteEndpoint(base,config),destination=known?.destination??await resolveRouteEndpoint(site,config);
      if(!origin||!destination)throw new Error('The locations could not be confirmed. Your entries are retained; check the addresses and retry. No coordinates will be invented.');
      const pair=buildManualInstallationTravel({...manual,origin,destination});
      setDraft({out:pair.out as RouteDraft,back:pair.back as RouteDraft,context,key:crypto.randomUUID()});setStatus('Manual travel is ready for review, not yet applied. Check both directions and the journey pattern, then apply.');
    }catch(error){setFailed(true);setStatus(`${error instanceof Error?error.message:'Manual travel could not be reviewed.'} Your entries and saved journey are unchanged.`);}
    finally{saving.current=false;setBusy(false);}
  }
  async function prepare(){
    if(saving.current)return;saving.current=true;setBusy(true);setFailed(false);setStatus('Calculating outward and return travel…');
    try{
      if(!team?.id||!base||!site)throw new Error('Travel time not confirmed. Save an installer Team with a base postcode and confirm the site first.');
      const origin=await resolveRouteEndpoint(base,config),destination=await resolveRouteEndpoint(site,config);
      if(!origin||!destination)throw new Error('Travel time not confirmed. Check the installer base and site addresses, then retry.');
      const out=await calculateDirectionalRoute('installer_to_site',origin,destination,config),back=await calculateDirectionalRoute('site_to_installer',destination,origin,config);
      if(!out||!back)throw new Error('Travel time not confirmed for both directions. Your saved journey is unchanged; retry when routing is available.');
      setDraft({out,back,context,key:crypto.randomUUID()});setStatus('Both directions are ready for review. Choose the journey pattern, then apply them to this costing. Nothing has been applied yet.');
    }catch(error){setFailed(true);setStatus(`${error instanceof Error?error.message:'Travel could not be calculated.'} Your saved journey is unchanged. Retry or enter a reviewed manual estimate below.`);}
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
    {saved?.manuallyOverridden===true?<p>Saved manual estimate · {String(saved.overrideReason??'Basis not confirmed')}. Outward {String(saved.oneWayMiles??'Not confirmed')} miles; return {String(saved.returnMiles??'Not confirmed')} miles.</p>:null}
    <button type="button" className="ui-button" disabled={busy||!base||!site} onClick={()=>void prepare()}>Calculate both directions</button>
    <details className="installation-travel-review__manual"><summary>Enter a reviewed manual estimate</summary><p>Use your own evidenced route estimate when calculated travel is unavailable or needs correction. Unknown values must remain unconfirmed.</p>
      <div className="calculator-lab__installation-groups">{([['outwardMiles','Outward distance (miles)'],['outwardMinutes','Outward time (minutes)'],['returnMiles','Return distance (miles)'],['returnMinutes','Return time (minutes)']] as const).map(([key,label])=><label key={key}>{label}<input className="ui-input" aria-label={label} type="number" min="0" step="any" value={manual[key]} disabled={busy} onChange={event=>{setManual({...manual,[key]:event.target.value});setDraft(null);}}/></label>)}</div>
      <label>Source and basis<textarea className="ui-input" aria-label="Manual travel source and basis" value={manual.basis} disabled={busy} onChange={event=>{setManual({...manual,basis:event.target.value});setDraft(null);}}/></label>
      <button type="button" className="ui-button" disabled={busy||!base||!site} onClick={()=>void prepareManual()}>Review manual journey</button>
    </details>
    {draft?<><div className="costing-sheet__facts"><span>Outward <b>{draft.out.durationMinutes} min · {(Number(draft.out.distanceKm)*0.621371192).toFixed(2)} miles</b></span><span>Return <b>{draft.back.durationMinutes} min · {(Number(draft.back.distanceKm)*0.621371192).toFixed(2)} miles</b></span></div>
      {draft.out.manuallyOverridden?<p>Manual estimate · {draft.out.overrideReason}</p>:null}
      <label>Planned journey<select className="ui-input" value={mode} disabled={busy} onChange={event=>setMode(event.target.value)}><option value="">Choose journey pattern</option><option value="daily_travel">Return to base each working day</option><option value="stay_away">Travel to site and return around an overnight stay</option></select></label>
      <p>Uses this Estimate’s saved mileage rate of £{scenario.installationProgramme?.travel.mileageRate??'Not confirmed'} per mile and {scenario.installationProgramme?.travel.vehicleCount??'Not confirmed'} vehicle(s). Review installer-specific terms before applying. Daily travel counts both directions per programme day; an overnight stay counts one outward and one return journey.</p>
      <button type="button" className="ui-button ui-button--primary" disabled={busy||!mode} onClick={()=>void apply()}>{busy?'Saving…':'Apply reviewed journey'}</button></>:null}
    {status?<p role={failed?'alert':'status'}>{status}</p>:null}
  </details>;
}
