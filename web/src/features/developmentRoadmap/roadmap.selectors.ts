import type { RoadmapItem, RoadmapSectionId, RoadmapStatus } from "./roadmap.types";

export function flattenRoadmapItems(items: RoadmapItem[]): RoadmapItem[] {
  return items.flatMap((item) => [item, ...flattenRoadmapItems(item.children ?? [])]);
}

export function roadmapItemsForSection(items: RoadmapItem[], section: RoadmapSectionId) {
  return items.filter((item) => item.category === section).sort((a, b) => a.sequence - b.sequence || a.title.localeCompare(b.title));
}

export function roadmapStatusCounts(items: RoadmapItem[]): Record<RoadmapStatus, number> {
  return flattenRoadmapItems(items).reduce<Record<RoadmapStatus, number>>((counts, item) => {
    counts[item.status] += 1;
    return counts;
  }, { complete: 0, in_progress: 0, not_started: 0, legacy: 0 });
}

export function validateRoadmapData(items: RoadmapItem[]) {
  const flattened = flattenRoadmapItems(items);
  const ids = new Set<string>();
  const issues: string[] = [];
  for (const item of flattened) {
    if (!item.id.trim() || ids.has(item.id)) issues.push(`Roadmap id must be present and unique: ${item.id || "(blank)"}`);
    ids.add(item.id);
    if (!item.title.trim() || !item.summary.trim()) issues.push(`Roadmap item ${item.id} requires title and summary.`);
    if (!Number.isFinite(item.phase) || !Number.isFinite(item.sequence)) issues.push(`Roadmap item ${item.id} requires numeric phase and sequence.`);
    if (!item.platform.length) issues.push(`Roadmap item ${item.id} requires at least one platform.`);
    if (item.parentId && !flattened.some((candidate) => candidate.id === item.parentId)) issues.push(`Roadmap item ${item.id} has unknown parent ${item.parentId}.`);
  }
  return issues;
}
