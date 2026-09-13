import {useEffect,useState} from 'react';
import {apiFetch} from '../../services/api/apiClient';

type Plan={id:string;orderId:string;version:number;estimateRevision:number;scenarioRevision:number;reviewReason:string;reviewedAt:string;scopeChanges:{included:Array<{reference:string}>;excluded:Array<{reference:string}>};reviewRequired:string[];document:{reference:string;siteAddress:string;positions:Array<{id:string;reference:string;quantity:number|null;widthMm:number|null;heightMm:number|null}>;installation:{teamName:string;costedCrewSize:number|null;installationDays:number|null}}};

export default function SavedOrderInstallationPlan({base,orderId,planId}:{base:string;orderId:string;planId:string}){
  const [open,setOpen]=useState(false),[attempt,setAttempt]=useState(0),[plan,setPlan]=useState<Plan|null>(null),[error,setError]=useState('');
  useEffect(()=>{
    if(!open)return;
    let active=true;setPlan(null);setError('');
    void apiFetch(`${base}/order-plans/${encodeURIComponent(planId)}?${new URLSearchParams({orderId})}`).then(value=>{
      if(!active)return;const result=value as Plan;
      if(result.id!==planId||result.orderId!==orderId)throw new Error('This saved plan does not match the selected Order. Reopen the correct Order.');
      setPlan(result);
    }).catch(reason=>{if(active)setError(reason instanceof Error?reason.message:'The saved review could not load.');});
    return()=>{active=false;};
  },[base,orderId,planId,open,attempt]);
  return <details className="saved-order-installation-plan" onToggle={event=>setOpen(event.currentTarget.open)}><summary>View saved plan details</summary>{open?<>
    {error?<div role="alert"><p>{error} The saved plan is unchanged.</p><button type="button" className="ui-button" onClick={()=>setAttempt(value=>value+1)}>Retry saved plan details</button></div>:!plan?<p role="status">Loading saved plan details…</p>:<>
      <p>Plan {plan.version} · {plan.document.reference} · accepted Estimate revision {plan.estimateRevision}</p>
      <p>Reviewed {new Date(plan.reviewedAt).toLocaleString()} · {plan.reviewReason}</p>
      <p>Site: {plan.document.siteAddress||'Not confirmed'}</p>
      <p>Team: {plan.document.installation.teamName||'Not confirmed'} · Costed crew: {plan.document.installation.costedCrewSize??'Not confirmed'} · Installation days: {plan.document.installation.installationDays??'Not confirmed'}</p>
      <p>This is the saved review, not a fresh site assessment. Missing information still requires confirmation. Sold costing is unchanged.</p>
      <details><summary>View Positions and scope changes</summary>{plan.document.positions.map(item=><p key={item.id}>{item.reference} · Quantity {item.quantity??'Not confirmed'} · {item.widthMm??'Not confirmed'} × {item.heightMm??'Not confirmed'} mm</p>)}<p>Added to this operational scope: {plan.scopeChanges.included.map(item=>item.reference).join(', ')||'None'}</p><p>Left out of this operational scope: {plan.scopeChanges.excluded.map(item=>item.reference).join(', ')||'None'}</p></details>
      <p>Outstanding information</p>{plan.reviewRequired.length?plan.reviewRequired.map((item,index)=><p key={index}>{item}</p>):<p>No additional warnings were recorded in this plan. This does not confirm unrecorded site details.</p>}
      <p>Next: prepare the draft PDF from this saved plan, then review the document. Nothing has been sent.</p>
    </>}
  </>:null}</details>;
}
