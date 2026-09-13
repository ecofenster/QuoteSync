import {useRef,useState} from 'react';
import {apiFetch} from '../../services/api/apiClient';
type Choice={id:string;orderId:string;version:number;reviewReason:string};
type Page={plans:Choice[];total:number;offset:number;limit:number};
export default function OrderInstallationPlanHistory({base,orderId,onSelect}:{base:string;orderId:string;onSelect:(plan:Choice)=>void}){
  const [page,setPage]=useState<Page|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');const running=useRef(false);
  const load=async(offset:number)=>{if(running.current)return;running.current=true;setBusy(true);setError('');try{setPage(await apiFetch(`${base}/order-plans?${new URLSearchParams({orderId,offset:String(offset)})}`) as Page);}catch(reason){setError(`${reason instanceof Error?reason.message:'Plan history could not load.'} Your previous page and selection are unchanged. Try the page again.`);}finally{running.current=false;setBusy(false)}};
  return <details className="order-installation-plan-history" onToggle={event=>{if(event.currentTarget.open&&!page&&!busy)void load(0);}}><summary>View all reviewed Order plans</summary>{busy?<p role="status">Loading plan history…</p>:null}{error?<p role="alert">{error}</p>:null}{page?<>
    {page.plans.map(plan=><p key={plan.id}>Plan {plan.version} · {plan.reviewReason} <button type="button" className="ui-button" disabled={busy} onClick={()=>onSelect(plan)}>Use plan {plan.version}</button></p>)}
    <p>Showing {page.total?page.offset+1:0}–{page.offset+page.plans.length} of {page.total}</p>
    <button type="button" className="ui-button" disabled={busy||page.offset===0} onClick={()=>void load(Math.max(0,page.offset-10))}>Newer plans</button>
    <button type="button" className="ui-button" disabled={busy||page.offset+10>=page.total} onClick={()=>void load(page.offset+10)}>Older plans</button>
  </>:<button type="button" className="ui-button" disabled={busy} onClick={()=>void load(0)}>Retry plan history</button>}</details>;
}
