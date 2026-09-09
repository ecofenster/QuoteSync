import { useEffect, useState } from "react";
import { clientPortalSecurityApi, type PortalAccessSummary } from "./clientPortalSecurityApi";

export default function ClientPortalAccessSummary({clientId}:{clientId:string}){
  const [summary,setSummary]=useState<PortalAccessSummary|null>(null),[error,setError]=useState("");
  useEffect(()=>{let active=true;clientPortalSecurityApi.clientSummary(clientId).then((value)=>{if(active){setSummary(value);setError("")}}).catch((reason)=>{if(active)setError(reason instanceof Error?reason.message:"Portal access status could not be loaded.")});return()=>{active=false}},[clientId]);
  return <section className="client-portal-access ui-card" aria-label="Client Portal access status">
    <header><div><span className="ui-eyebrow">Client Portal security</span><h3>Access and customer activity</h3></div><span className="ui-status ui-status--warning">External access blocked</span></header>
    {error?<p className="ui-status ui-status--error" role="alert">{error}</p>:summary?<>
      <div className="client-portal-access__metrics">
        <article><span>Authorised contacts</span><strong>{summary.contacts.filter((item)=>item.status==="active").length}</strong><small>Scoped grants only</small></article>
        <article><span>Open invitations</span><strong>{summary.invitations.filter((item)=>item.status==="pending").length}</strong><small>Hashed, expiring, single use</small></article>
        <article><span>Released Estimates</span><strong>{summary.releases.length}</strong><small>Immutable revisions</small></article>
        <article><span>Customer responses</span><strong>{summary.reviews.length+summary.decisions.length}</strong><small>Audited command evidence</small></article>
      </div>
      {summary.contacts.length?<div className="client-portal-access__contacts">{summary.contacts.map((contact)=><article key={contact.id}><div><strong>{contact.displayName}</strong><small>{contact.email}</small></div><span>{contact.activeProjectGrants} Project grant{contact.activeProjectGrants===1?"":"s"}</span><small>{contact.lastActivityAt?`Last activity ${new Date(contact.lastActivityAt).toLocaleString("en-GB")}`:"No portal activity"}</small></article>)}</div>:<p className="ui-empty-state">No portal contacts or invitations have been created for this Client.</p>}
    </>:<p className="ui-empty-state">Loading portal access status…</p>}
    <small>Invitation secrets and session credentials are never shown here. Production identity-provider approval is still required.</small>
  </section>;
}
