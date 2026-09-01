import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = (path) => readFile(path, "utf8");

test("normal Project Costing has one canonical Products position workspace", async () => {
  const [workspace, bridge, worksheet, app, importer] = await Promise.all([
    source("src/features/estimateCommercial/EstimateCommercialWorkspace.tsx"),
    source("src/features/estimateCommercial/EstimatePositionBridge.tsx"),
    source("src/features/projectCalculatorLab/ScenarioCostingWorksheet.tsx"),
    source("src/App.tsx"),
    source("src/features/estimateCommercial/EstimateSupplierCostImportControl.tsx"),
  ]);
  assert.doesNotMatch(workspace, /Supplier Quotations & Project Costing \(Preview\)|Temporary development entry|disposable development estimate/i);
  assert.doesNotMatch(bridge, /<h3>Estimate Positions<\/h3>/);
  assert.doesNotMatch(app, /Add Position Disabled|<H3>Positions<\/H3>/);
  assert.match(worksheet, /title="Products \/ Supply Only"/);
  assert.match(worksheet, /No positions yet\./);
  assert.match(worksheet, /Import Manufacturer Quote/);
  assert.match(worksheet, /Add Position/);
  assert.match(importer, /Extract & Review Manufacturer Quote/);
});

test("Products rows configure the stable Estimate Position and preserve explicit B92 ownership", async () => {
  const [worksheet, bridge] = await Promise.all([
    source("src/features/projectCalculatorLab/ScenarioCostingWorksheet.tsx"),
    source("src/features/estimateCommercial/EstimatePositionBridge.tsx"),
  ]);
  assert.match(worksheet, /row\.estimatePositionId/);
  assert.match(worksheet, /Edit Configuration/);
  assert.match(worksheet, />Specification<\/button>/);
  assert.match(bridge, /positionId:draft\.id/);
  assert.match(bridge, /configuredContract:compiled\.contract/);
  assert.match(bridge, /B92ConfiguratorShell/);
  assert.match(bridge, /reviewRequired\.length/);
  assert.match(bridge, /Link to Existing Position/);
  assert.match(bridge, /Create New Position/);
});
