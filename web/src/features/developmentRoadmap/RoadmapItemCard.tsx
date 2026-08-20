import RoadmapStatusBadge from "./RoadmapStatusBadge";
import type { RoadmapItem } from "./roadmap.types";

const Detail = ({ label, values }: { label: string; values?: string[] }) => values?.length ? <div><dt>{label}</dt><dd><ul>{values.map((value) => <li key={value}>{value}</li>)}</ul></dd></div> : null;

export default function RoadmapItemCard({ item, depth = 0 }: { item: RoadmapItem; depth?: number }) {
  return <article className="development-roadmap__item" data-depth={depth}>
    <details open={depth === 0 && item.status === "in_progress"}>
      <summary>
        <span className="development-roadmap__item-heading"><span>{item.title}</span><small>Phase {item.phase} · {item.platform.join(", ")}</small></span>
        <RoadmapStatusBadge status={item.status} />
      </summary>
      <div className="development-roadmap__item-body">
        <p>{item.summary}</p>
        <dl className="development-roadmap__details">
          <Detail label="Evidence" values={item.evidence} />
          <Detail label="Canonical modules" values={item.canonicalModules} />
          <Detail label="Dependencies" values={item.dependencies} />
          <Detail label="Blockers" values={item.blockers} />
          {item.nextAction ? <div><dt>Next action</dt><dd>{item.nextAction}</dd></div> : null}
          <Detail label="Technical debt" values={item.technicalDebt} />
          <Detail label="Notes" values={item.notes} />
          {item.validationStatus ? <div><dt>Validation</dt><dd>{item.validationStatus}</dd></div> : null}
          {item.checkpointSha ? <div><dt>Checkpoint</dt><dd><code>{item.checkpointSha}</code></dd></div> : null}
          {item.deferredReason ? <div><dt>Deferred reason</dt><dd>{item.deferredReason}</dd></div> : null}
        </dl>
        {item.children?.length ? <div className="development-roadmap__children">{item.children.map((child) => <RoadmapItemCard key={child.id} item={child} depth={depth + 1} />)}</div> : null}
      </div>
    </details>
  </article>;
}
