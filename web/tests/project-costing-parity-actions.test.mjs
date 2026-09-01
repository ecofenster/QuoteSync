import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Project Costing renders parity provenance and compact canonical position actions", async () => {
  const [worksheet, presentation] = await Promise.all([
    readFile("src/features/projectCalculatorLab/ScenarioCostingWorksheet.tsx", "utf8"),
    readFile("src/features/projectCalculatorLab/domain/projectCostingPresentation.ts", "utf8"),
  ]);
  assert.match(worksheet, /productCommercialSourceLabel\(row\)/);
  assert.match(presentation, /manufacturerNameForProduct/);
  assert.match(presentation, /quotationSuffix[\s\S]*quote \$\{quotation\.trim\(\)\}/);
  assert.match(presentation, /supplied by \$\{supplier\}\$\{quotationSuffix\}/);
  for (const action of ['title="Move Up">↑', 'title="Move Down">↓', 'title="Duplicate Position">⧉', 'title="Delete Position">×']) {
    assert.match(worksheet, new RegExp(action));
  }
  assert.doesNotMatch(worksheet, />Alternative<\/button>/);
});
