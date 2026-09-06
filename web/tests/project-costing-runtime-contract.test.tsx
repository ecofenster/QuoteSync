import React from "react";
import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import ScenarioCostingWorksheet from "../src/features/projectCalculatorLab/ScenarioCostingWorksheet";
import { normalizeCalculatorScenario } from "../src/features/projectCalculatorLab/domain/normalizeCalculatorScenario";
import type { CalculatorScenario } from "../src/features/projectCalculatorLab/domain/projectCalculatorLab.types";
import { projectCostingSimpleScenario } from "./fixtures/ProjectCostingSimpleAcceptance";

const clone = () => structuredClone(projectCostingSimpleScenario) as CalculatorScenario;
const handlers = {
  onNew: async () => {},
  onSaveMarkups: async () => {},
  onUpdateProduct: async () => {},
  onUpdateSupplierCost: async () => {},
  onUpdateManualCost: async () => {},
  onRefreshRate: async () => {},
};
const render = (scenario: CalculatorScenario) =>
  renderToStaticMarkup(<ScenarioCostingWorksheet scenario={scenario} {...handlers} />);

test("current Project Costing state retains populated Installation Materials arrays", () => {
  const normalized = normalizeCalculatorScenario(clone());
  assert.equal(normalized.installationMaterials?.simpleMaterials.length, 7);
  assert.doesNotThrow(() => render(normalized));
});

test("the exact legacy response without simpleMaterials is normalized before React", () => {
  const legacy = clone() as CalculatorScenario & { installationMaterials: Record<string, unknown> };
  delete legacy.installationMaterials.simpleMaterials;
  const normalized = normalizeCalculatorScenario(legacy as CalculatorScenario);
  assert.deepEqual(normalized.installationMaterials?.simpleMaterials, []);
  assert.doesNotThrow(() => normalized.installationMaterials?.simpleMaterials.filter((item) => item.required));
  assert.doesNotThrow(() => render(normalized));
});

test("partial legacy Installation Materials results gain neutral structure without invented costs", () => {
  const legacy = clone();
  legacy.installationMaterials = { purchaseCost: undefined } as unknown as CalculatorScenario["installationMaterials"];
  const normalized = normalizeCalculatorScenario(legacy);
  assert.deepEqual(normalized.installationMaterials?.simpleMaterials, []);
  assert.deepEqual(normalized.installationMaterials?.positionCalculations, []);
  assert.deepEqual(normalized.installationMaterials?.reviewRequiredMaterials, []);
  assert.equal(normalized.installationMaterials?.purchaseCost, null);
  assert.equal(normalized.installationMaterials?.priceStatus, "review_required");
  assert.equal(normalized.installationMaterials?.purchasing.brackets.purchaseCost, null);
  assert.equal(normalized.installationMaterials?.packers.purchaseCost, null);
  assert.equal(normalized.installationMaterials?.totals.brackets, null);
  assert.equal(normalized.installationMaterials?.totalPerimeterM, null);
  assert.doesNotThrow(() => render(normalized));
});

test("empty, absent and null Installation Materials states remain readable", () => {
  const empty = clone();
  empty.installationMaterials = { ...empty.installationMaterials!, simpleMaterials: [] };
  assert.deepEqual(normalizeCalculatorScenario(empty).installationMaterials?.simpleMaterials, []);
  assert.doesNotThrow(() => render(normalizeCalculatorScenario(empty)));

  for (const value of [undefined, null]) {
    const legacy = clone();
    legacy.installationMaterials = value;
    const normalized = normalizeCalculatorScenario(legacy);
    assert.equal(normalized.installationMaterials, null);
    assert.doesNotThrow(() => render(normalized));
  }
});
