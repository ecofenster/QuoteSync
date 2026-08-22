import assert from "node:assert/strict";
import test from "node:test";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { createVatTreatmentService } from "../server/features/projectCalculatorLab/vatTreatmentService.js";

test("VAT treatment is Estimate-scenario owned and preserves explicit provenance", async (t) => {
  const db = await open({ filename: ":memory:", driver: sqlite3.Database });
  t.after(() => db.close());
  await db.exec("CREATE TABLE project_calculator_lab_scenarios(id TEXT PRIMARY KEY); CREATE TABLE project_calculator_lab_options(scenario_id TEXT PRIMARY KEY, project_type TEXT, options_json TEXT, updated_at TEXT);");
  await db.run("INSERT INTO project_calculator_lab_scenarios VALUES(?)", "scenario-a");
  await db.run("INSERT INTO project_calculator_lab_options VALUES(?,?,?,?)", "scenario-a", "new_build", JSON.stringify({ installation: { required: true } }), "before");
  const service = createVatTreatmentService(db);
  assert.equal(await service.update("scenario-a", { code: "reduced_rate", percentage: "5", source: "manual_override", manuallyOverridden: true }), true);
  const saved = JSON.parse((await db.get("SELECT options_json FROM project_calculator_lab_options WHERE scenario_id=?", "scenario-a")).options_json);
  assert.deepEqual(saved.installation, { required: true });
  assert.equal(saved.vatTreatment.code, "reduced_rate");
  assert.equal(saved.vatTreatment.percentage, "5");
  assert.equal(saved.vatTreatment.source, "manual_override");
  assert.equal(saved.vatTreatment.manuallyOverridden, true);
  assert.equal(saved.vatTreatment.projectTypeAtSelection, "new_build");
  assert.match(saved.vatTreatment.capturedAt, /^\d{4}-/);
  await assert.rejects(() => service.update("scenario-a", { code: "reduced_rate", percentage: "20" }), /VAT Treatment/);
});
