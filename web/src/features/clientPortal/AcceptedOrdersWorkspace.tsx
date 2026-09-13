import {useEffect,useRef,useState,type ReactNode} from 'react';
import {apiFetch} from '../../services/api/apiClient';
import {OrderJourneyPanel} from './ClientPortalStaffWorkspace';

type Page={items:Array<{id:string;reference:string;clientName:string;clientReference:string;projectName:string;revision:number;status:string}>;total:number;offset:number;limit:number};
type Delivery={deliveryMode:string;customerConfigured:boolean;factoryConfigured:boolean};
export default function AcceptedOrdersWorkspace({legacy}:{legacy:ReactNode}){
  const [mode,setMode]=useState('accepted'),[search,setSearch]=useState(''),[page,setPage]=useState<Page|null>(null),[selected,setSelected]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[delivery,setDelivery]=useState<Delivery|null>(null);
  const sequence=useRef(0);
  const load=async(offset=0)=>{const current=++sequence.current;setBusy(true);setError('');try{const value=await apiFetch(`/api/lifecycle/orders?${new URLSearchParams({search,offset:String(offset)})}`) as Page;if(current===sequence.current)setPage(value);}catch(reason){if(current===sequence.current)setError(`${reason instanceof Error?reason.message:'Orders could not load.'} Previous results are unchanged. Retry to continue.`);}finally{if(current===sequence.current)setBusy(false)}};
  useEffect(()=>{const timer=setTimeout(()=>void load(),200);return()=>{clearTimeout(timer);++sequence.current;};},[search]);
  useEffect(()=>{void apiFetch('/api/lifecycle/test-delivery').then(value=>setDelivery(value as Delivery)).catch(()=>setDelivery(null));},[]);
  return <section className="accepted-orders-workspace">
    <div className="ui-action-row" role="group" aria-label="Order views"><button className={`ui-button ${mode==='accepted'?'ui-button--selected':''}`} aria-pressed={mode==='accepted'} onClick={()=>setMode('accepted')}>Accepted Orders</button><button className={`ui-button ${mode==='legacy'?'ui-button--selected':''}`} aria-pressed={mode==='legacy'} onClick={()=>setMode('legacy')}>Estimates marked as Order</button></div>
    {mode==='legacy'?legacy:selected?<><button className="ui-button" onClick={()=>setSelected('')}>Back to accepted Orders</button><OrderJourneyPanel key={selected} orderId={selected} reloadPortal={()=>load(page?.offset||0)} delivery={delivery}/></>:<div className="ui-card">
      <h2>Accepted Orders</h2><p>Orders created from customer acceptance. Open an Order to review its next step and prepare documents.</p>
      <label>Find an Order<input className="ui-input" value={search} onChange={event=>setSearch(event.currentTarget.value)} placeholder="Order reference, Client or Project"/></label>
      {busy?<p role="status">Loading Orders…</p>:null}{error?<p role="alert">{error} <button className="ui-button" disabled={busy} onClick={()=>void load(page?.offset||0)}>Retry</button></p>:null}
      {page?.items.map(item=><article className="ui-card" key={item.id}><h3>{item.reference}</h3><p>{item.clientName} · {item.clientReference} · {item.projectName}</p><p>Accepted Estimate revision {item.revision} · {item.status.replaceAll('_',' ')}</p><button className="ui-button ui-button--primary" onClick={()=>setSelected(item.id)}>Open Order journey</button></article>)}
      {page&&!page.total?<p>No accepted Orders match this search. Estimates marked as Order remain available in the other view.</p>:null}
      {page?<><p>Showing {page.items.length?page.offset+1:0}–{page.offset+page.items.length} of {page.total}</p><div className="ui-action-row"><button className="ui-button" disabled={busy||page.offset===0} onClick={()=>void load(Math.max(0,page.offset-page.limit))}>Previous</button><button className="ui-button" disabled={busy||page.offset+page.limit>=page.total} onClick={()=>void load(page.offset+page.limit)}>Next</button></div></>:null}
    </div>}
  </section>;
}
