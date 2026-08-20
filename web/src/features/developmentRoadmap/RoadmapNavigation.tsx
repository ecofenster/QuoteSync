import { ROADMAP_SECTIONS } from "./roadmap.data";
import type { RoadmapSectionId } from "./roadmap.types";

export default function RoadmapNavigation({ active, onSelect }: { active: RoadmapSectionId; onSelect: (id: RoadmapSectionId) => void }) {
  return <nav className="development-roadmap__nav" aria-label="QuoteSuite Roadmap sections">
    {ROADMAP_SECTIONS.map((section) => <button key={section.id} type="button" className="development-roadmap__nav-button" data-active={active === section.id} aria-current={active === section.id ? "page" : undefined} onClick={() => onSelect(section.id)}>
      <span>{section.label}</span><small>{section.description}</small>
    </button>)}
  </nav>;
}
