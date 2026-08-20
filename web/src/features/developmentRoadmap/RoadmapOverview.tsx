import { DEVELOPMENT_ORDER, PLATFORM_READINESS, ROADMAP_CHECKPOINT_SHA, ROADMAP_CHRONOLOGY, ROADMAP_ITEMS } from "./roadmap.data";
import { roadmapStatusCounts } from "./roadmap.selectors";
import RoadmapStatusBadge from "./RoadmapStatusBadge";

export default function RoadmapOverview() {
  const counts = roadmapStatusCounts(ROADMAP_ITEMS);
  return <div className="development-roadmap__overview">
    <section className="development-roadmap__headline ui-card">
      <div><span className="development-roadmap__eyebrow">Current checkpoint</span><code>{ROADMAP_CHECKPOINT_SHA}</code></div>
      <div><span className="development-roadmap__eyebrow">Current development focus</span><strong>First live Ecofenster customer quotation, with Configurator continuing in parallel</strong></div>
      <div><span className="development-roadmap__eyebrow">Next major business milestone</span><strong>Review and harden the minimal quotation lifecycle for controlled internal use</strong></div>
    </section>
    <section className="development-roadmap__metrics" aria-label="Roadmap status counts">
      {(["complete", "in_progress", "not_started", "legacy"] as const).map((status) => <div className="ui-card" key={status}><RoadmapStatusBadge status={status} /><strong>{counts[status]}</strong><small>roadmap items</small></div>)}
    </section>
    <section className="development-roadmap__panel ui-card"><h3>Active blockers and high-risk debt</h3><ul>
      <li>App.tsx decomposition and shared domain/API contracts.</li><li>Authentication, authorization/RBAC and API versioning.</li><li>Canonical Quotation and Order ownership.</li><li>Configurator product breadth and neutral proof authority.</li><li>Offline conflict/version and client-neutral document APIs.</li>
    </ul></section>
    <section className="development-roadmap__panel ui-card"><h3>Platform readiness</h3><div className="development-roadmap__readiness">
      {PLATFORM_READINESS.map((row) => <article key={row.platform}><header><strong>{row.platform}</strong><RoadmapStatusBadge status={row.status} /></header><p>{row.summary}</p><small><b>Blockers:</b> {row.blockers.join("; ")}</small><small><b>Next:</b> {row.nextPrerequisite}</small></article>)}
    </div></section>
    <section className="development-roadmap__panel ui-card"><h3>Development history</h3><ol className="development-roadmap__chronology">{ROADMAP_CHRONOLOGY.map((entry) => <li key={entry.sequence}><span>{entry.date ? `${entry.date} · ` : ""}{entry.title}</span>{entry.objective ? <small>{entry.objective}</small> : null}{entry.validation ? <small>Validation: {entry.validation}</small> : null}{entry.resultingStatus ? <RoadmapStatusBadge status={entry.resultingStatus} /> : null}{entry.checkpointSha ? <code>{entry.checkpointSha}</code> : null}</li>)}</ol></section>
    <section className="development-roadmap__panel ui-card"><h3>Recommended planning sequence</h3><p>This is a planning sequence, not an automatic execution queue. Configurator development remains a major parallel programme.</p><ol className="development-roadmap__order">{DEVELOPMENT_ORDER.map((entry) => <li key={entry}>{entry}</li>)}</ol></section>
  </div>;
}
