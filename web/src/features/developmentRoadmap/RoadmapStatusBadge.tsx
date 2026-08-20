import type { RoadmapStatus } from "./roadmap.types";

const STATUS: Record<RoadmapStatus, { icon: string; label: string }> = {
  complete: { icon: "✓", label: "Complete" },
  in_progress: { icon: "●", label: "In progress" },
  not_started: { icon: "✕", label: "Not started" },
  legacy: { icon: "—", label: "Legacy / deferred" },
};

export default function RoadmapStatusBadge({ status }: { status: RoadmapStatus }) {
  const presentation = STATUS[status];
  return <span className="development-roadmap__status" data-status={status} aria-label={presentation.label}><span aria-hidden="true">{presentation.icon}</span>{presentation.label}</span>;
}
