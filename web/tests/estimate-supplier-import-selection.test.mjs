import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

test("document selection captures the checkbox value before its functional update", async () => {
  const source = await readFile("src/features/estimateCommercial/EstimateSupplierCostImportControl.tsx", "utf8");
  assert.match(source, /const checked = event\.currentTarget\.checked; setSelected\(\(current\) => updateDocumentSelection\(current, attachment\.id, checked\)\)/);
  assert.doesNotMatch(source, /setSelected\([^\n]*event\.(?:currentTarget|target)\.checked/);
  assert.match(source, /if \(checked\) next\.add\(attachmentId\);\s*else next\.delete\(attachmentId\);/);
});

test("selection helper preserves multiple selections and supports deselection", async () => {
  const source = await readFile("src/features/estimateCommercial/EstimateSupplierCostImportControl.tsx", "utf8");
  assert.match(source, /const next = new Set\(current\)/);
  assert.match(source, /next\.add\(attachmentId\)/);
  assert.match(source, /next\.delete\(attachmentId\)/);
});
