import test from "node:test";
import assert from "node:assert/strict";
import { ROADMAP_IN_PROGRESS_BASELINE, ROADMAP_WORK_PACKAGE_ENTRY_IDS, ROADMAP_WORK_PACKAGES } from "../src/features/developmentRoadmap/roadmap.workPackages.ts";
import { ROADMAP_ITEMS } from "../src/features/developmentRoadmap/roadmap.data.ts";

function flatten(items: typeof ROADMAP_ITEMS): typeof ROADMAP_ITEMS {
  return items.flatMap((item) => [item, ...flatten(item.children ?? [])]);
}

test("the original 73-entry in-progress cohort is mapped exactly once", () => {
  assert.equal(ROADMAP_WORK_PACKAGE_ENTRY_IDS.length, ROADMAP_IN_PROGRESS_BASELINE.count);
  assert.equal(new Set(ROADMAP_WORK_PACKAGE_ENTRY_IDS).size, ROADMAP_IN_PROGRESS_BASELINE.count);
  const known = new Set(flatten(ROADMAP_ITEMS).map((item) => item.id));
  assert.deepEqual(ROADMAP_WORK_PACKAGE_ENTRY_IDS.filter((id) => !known.has(id)), []);
  assert.deepEqual(ROADMAP_WORK_PACKAGES.map((item) => item.sequence), [1, 2, 3, 4, 5, 6, 7, 8]);
});
