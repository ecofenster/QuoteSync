import { useState } from "react";
import { ROADMAP_ITEMS, ROADMAP_SECTIONS } from "./roadmap.data";
import { roadmapItemsForSection } from "./roadmap.selectors";
import type { RoadmapSectionId } from "./roadmap.types";
import RoadmapItemCard from "./RoadmapItemCard";
import RoadmapNavigation from "./RoadmapNavigation";
import RoadmapOverview from "./RoadmapOverview";
import "./developmentRoadmap.css";

export default function DevelopmentRoadmapWorkspace() {
  const [sectionId, setSectionId] = useState<RoadmapSectionId>("overview");
  const section = ROADMAP_SECTIONS.find((candidate) => candidate.id === sectionId) ?? ROADMAP_SECTIONS[0];
  const items = roadmapItemsForSection(ROADMAP_ITEMS, sectionId);
  return <section className="development-roadmap" aria-labelledby="development-roadmap-title">
    <header className="development-roadmap__header ui-card"><div><span className="development-roadmap__eyebrow">Administration → Development</span><h1 id="development-roadmap-title">QuoteSuite Roadmap</h1><p>Internal development and governance workspace. Statuses describe repository-backed capability, not aspiration.</p></div></header>
    <div className="development-roadmap__layout">
      <aside className="development-roadmap__sidebar ui-card"><strong>Roadmap</strong><RoadmapNavigation active={sectionId} onSelect={setSectionId} /></aside>
      <main className="development-roadmap__content">
        {sectionId === "overview" ? <RoadmapOverview /> : <><header className="development-roadmap__section-heading"><div><span className="development-roadmap__eyebrow">Phase programme</span><h2>{section.label}</h2><p>{section.description}</p></div><span>{items.length} programme item{items.length === 1 ? "" : "s"}</span></header>{items.length ? <div className="development-roadmap__items">{items.map((item) => <RoadmapItemCard key={item.id} item={item} />)}</div> : <div className="development-roadmap__empty ui-card">No roadmap items are currently registered in this section.</div>}</>}
      </main>
    </div>
  </section>;
}
