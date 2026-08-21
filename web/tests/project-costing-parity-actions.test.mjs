import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Project Costing renders parity provenance and compact canonical position actions", async () => {
  const worksheet = await readFile("src/features/projectCalculatorLab/ScenarioCostingWorksheet.tsx", "utf8");
  assert.match(worksheet, /pricingPolicy\?\.parityPricingApplied[\s\S]*"1 to 1 Pricing"/);
  for (const action of ['title="Move Up">↑', 'title="Move Down">↓', 'title="Duplicate Position">⧉', 'title="Delete Position">×']) {
    assert.match(worksheet, new RegExp(action));
  }
  assert.doesNotMatch(worksheet, />Alternative<\/button>/);
});
