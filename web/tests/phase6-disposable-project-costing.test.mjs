import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Phase 6 keeps protected clients read-only and uses a disposable Project Costing owner", async () => {
  const source = await readFile("scripts/run-phase6-e2e.mjs", "utf8");
  assert.match(source, /tempClientId = `phase6_e2e_client_/);
  assert.match(source, /createTemporaryClient/);
  assert.match(source, /createTemporaryEstimate\(client\.id\)/);
  assert.match(source, /protectedSnapshot/);
  assert.match(source, /Protected EF client data changed/);
  assert.doesNotMatch(source, /clients\.find\(\(row\) => PROTECTED_REFS/);
  assert.doesNotMatch(source, /No protected client found for temporary estimate/);
});
