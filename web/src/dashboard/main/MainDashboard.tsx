import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { Client, ClientId, EstimateId, MenuKey } from "../../models/types";
import { apiFetch } from "../../services/api/apiClient";
import "./MainDashboard.css";

export type CrmRecordTarget = {
  kind: "followup" | "enquiry" | "client" | "project" | "estimate" | "order" | "communication" | string;
  id: string;
  clientId?: string | null;
  projectId?: string | null;
  estimateId?: string | null;
  dueAt?: string | null;
};

type WorkItem = {
  id: string; reason: string; title: string; context: string; ownerName: string; stage: string;
  waitingFor: string; nextAction: string; dueAt: string | null; lastContactAt: string | null; target: CrmRecordTarget;
};

type DashboardProjection = {
  generatedAt: string;
  user: { id: string; name: string; role: string };
  summary: { overdue: number; dueToday: number; unansweredEnquiries: number; waitingOnCustomer: number; waitingOnSupplier: number; installationsToday: number; invoicesDueToday: number; ordersNeedingAttention: number };
  attention: WorkItem[];
  today: WorkItem[];
  pipeline: Array<{ id: string; label: string; count: number }>;
  recentActivity: Array<{ id: string; title: string; detail: string; occurredAt: string; target: CrmRecordTarget | null }>;
};

type SearchResult = { kind: string; id: string; label: string; description: string; target: CrmRecordTarget };

type Props = {
  clients: Client[];
  activeUserName?: string;
  onOpenMenu?: (menu: MenuKey) => void;
  onOpenEstimate?: (clientId: ClientId, estimateId: EstimateId) => void;
  onOpenRecord?: (target: CrmRecordTarget) => void;
};

function readable(value: string) {
  return String(value || "").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string | null, includeTime = false) {
  if (!value) return "Not recorded";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString([], includeTime
    ? { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }
    : { day: "numeric", month: "short", year: parsed.getFullYear() === new Date().getFullYear() ? undefined : "numeric" });
}

function WorkItemRow({ item, onOpen }: { item: WorkItem; onOpen: (target: CrmRecordTarget) => void }) {
  return <button type="button" className="qs-work-item" onClick={() => onOpen(item.target)}>
    <span className="qs-work-item__main">
      <span className="qs-work-item__reason">{readable(item.reason)}</span>
      <strong>{item.title}</strong>
      <span>{item.context}</span>
    </span>
    <span className="qs-work-item__facts">
      <span><small>Next action</small>{item.nextAction}</span>
      <span><small>Due</small>{formatDate(item.dueAt)}</span>
      <span><small>Owner</small>{item.ownerName}</span>
      <span><small>Stage</small>{readable(item.stage)}</span>
    </span>
    <span className="qs-work-item__open">Open <span aria-hidden="true">›</span></span>
  </button>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="qs-dashboard-empty">{children}</p>;
}

export default function MainDashboard({ activeUserName = "User", onOpenMenu, onOpenEstimate, onOpenRecord }: Props) {
  const [projection, setProjection] = useState<DashboardProjection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    apiFetch("/api/crm/dashboard")
      .then((value) => { if (!cancelled) setProjection(value as DashboardProjection); })
      .catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : "Today’s work could not be loaded."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [reload]);

  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 2) { setSearchResults([]); setSearching(false); return; }
    let cancelled = false;
    setSearching(true);
    const timer = window.setTimeout(() => {
      apiFetch(`/api/crm/search?q=${encodeURIComponent(normalized)}&limit=12`)
        .then((value) => { if (!cancelled) setSearchResults(((value as { results?: SearchResult[] })?.results || [])); })
        .catch(() => { if (!cancelled) setSearchResults([]); })
        .finally(() => { if (!cancelled) setSearching(false); });
    }, 220);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [query]);

  const openTarget = useCallback((target: CrmRecordTarget) => {
    if (onOpenRecord) { onOpenRecord(target); return; }
    const estimateId = target.estimateId || (target.kind === "estimate" ? target.id : null);
    if (estimateId && target.clientId && onOpenEstimate) { onOpenEstimate(target.clientId as ClientId, estimateId as EstimateId); return; }
    const menu: Partial<Record<string, MenuKey>> = { followup: "follow_ups", enquiry: "enquiries", client: "client_database", project: "client_database", estimate: "estimates", order: "orders", communication: "email" };
    onOpenMenu?.(menu[target.kind] || "dashboard");
  }, [onOpenEstimate, onOpenMenu, onOpenRecord]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  }, []);
  const startEnquiry = () => {
    onOpenMenu?.("enquiries");
    window.setTimeout(() => window.dispatchEvent(new CustomEvent("quotesuite:new-enquiry")), 0);
  };

  return <main className="qs-dashboard" aria-labelledby="dashboard-title">
    <header className="qs-dashboard-hero">
      <div><p className="qs-dashboard-eyebrow">Operations</p><h1 id="dashboard-title">{greeting}, {projection?.user.name || activeUserName}</h1><p>Start with the work that needs attention, then set the next action before moving on.</p></div>
      <button type="button" className="ui-button ui-button--primary" onClick={startEnquiry}>New Enquiry</button>
    </header>

    <section className="qs-dashboard-search-panel" aria-label="Search customer work">
      <label><span>Find a customer or piece of work</span><input className="ui-input" value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder="Name, reference, Project, Estimate or Order" /></label>
      {query.trim().length >= 2 ? <div className="qs-dashboard-search-results" role="listbox" aria-label="Search results">
        {searching ? <Empty>Searching…</Empty> : searchResults.length ? searchResults.map((result) => <button type="button" key={`${result.kind}:${result.id}`} onClick={() => openTarget(result.target)}><span className="ui-chip">{readable(result.kind)}</span><strong>{result.label}</strong><span>{result.description}</span><span aria-hidden="true">›</span></button>) : <Empty>No matching active records.</Empty>}
      </div> : null}
    </section>

    {loading ? <section className="qs-dashboard-state" role="status">Loading today’s work…</section> : null}
    {error ? <section className="qs-dashboard-state qs-dashboard-state--error" role="alert"><span>{error} Your records have not been changed.</span><button type="button" className="ui-button" onClick={() => setReload((value) => value + 1)}>Try again</button></section> : null}

    {projection ? <>
      <section className="qs-dashboard-summary" aria-label="Work summary">
        <button type="button" onClick={() => onOpenMenu?.("follow_ups")}><strong>{projection.summary.overdue}</strong><span>Overdue</span></button>
        <button type="button" onClick={() => onOpenMenu?.("follow_ups")}><strong>{projection.summary.dueToday}</strong><span>Due today</span></button>
        <button type="button" onClick={() => onOpenMenu?.("enquiries")}><strong>{projection.summary.unansweredEnquiries}</strong><span>Unanswered Enquiries</span></button>
        <button type="button" onClick={() => onOpenMenu?.("client_database")}><strong>{projection.summary.waitingOnCustomer}</strong><span>Waiting on customer</span></button>
        <button type="button" onClick={() => onOpenMenu?.("client_database")}><strong>{projection.summary.waitingOnSupplier}</strong><span>Waiting on supplier</span></button>
        <button type="button" onClick={() => onOpenMenu?.("installation")}><strong>{projection.summary.installationsToday}</strong><span>Installations today</span></button>
        <button type="button" onClick={() => onOpenMenu?.("orders")}><strong>{projection.summary.invoicesDueToday}</strong><span>Invoices due today</span></button>
        <button type="button" onClick={() => onOpenMenu?.("orders")}><strong>{projection.summary.ordersNeedingAttention}</strong><span>Orders need dates</span></button>
      </section>

      <div className="qs-dashboard-columns">
        <section className="qs-dashboard-panel qs-dashboard-panel--attention">
          <header><div><p className="qs-dashboard-eyebrow">Act first</p><h2>Needs attention</h2></div><span>{projection.attention.length} open</span></header>
          <div className="qs-dashboard-work-list">{projection.attention.length ? projection.attention.map((item) => <WorkItemRow key={item.id} item={item} onOpen={openTarget} />) : <Empty>Nothing overdue or unanswered. Review today’s work next.</Empty>}</div>
        </section>

        <aside className="qs-dashboard-side">
          <section className="qs-dashboard-panel"><header><div><p className="qs-dashboard-eyebrow">Today</p><h2>Next actions</h2></div></header><div className="qs-dashboard-today">{projection.today.length ? projection.today.map((item) => <button type="button" key={item.id} onClick={() => openTarget(item.target)}><span>{formatDate(item.dueAt, true)}</span><strong>{item.title}</strong><small>{item.nextAction}</small></button>) : <Empty>No dated next actions today.</Empty>}</div></section>
          <section className="qs-dashboard-panel"><header><div><p className="qs-dashboard-eyebrow">Sales</p><h2>Pipeline</h2></div></header><div className="qs-dashboard-pipeline">{projection.pipeline.map((stage) => <button type="button" key={stage.id} onClick={() => onOpenMenu?.(stage.id === "new_enquiry" ? "enquiries" : stage.id === "won" ? "orders" : "estimates")}><span>{stage.label}</span><strong>{stage.count}</strong></button>)}</div></section>
          <details className="qs-dashboard-panel qs-dashboard-activity"><summary>View recent activity</summary><div>{projection.recentActivity.length ? projection.recentActivity.map((activity) => <button type="button" key={activity.id} disabled={!activity.target} onClick={() => activity.target && openTarget(activity.target)}><strong>{activity.title}</strong><span>{activity.detail} · {formatDate(activity.occurredAt, true)}</span></button>) : <Empty>No recent canonical activity.</Empty>}</div></details>
        </aside>
      </div>
    </> : null}
  </main>;
}
