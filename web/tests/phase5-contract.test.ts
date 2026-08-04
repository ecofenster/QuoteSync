import test from "node:test";
import assert from "node:assert/strict";
import { createB92DefaultConfiguratorState } from "../src/features/b92Configurator/b92ConfiguratorState";
import {
  compileB92ConfiguratorStateToConfiguredPositionContract,
  projectConfiguredPositionContractToLegacyPosition,
} from "../src/features/b92Configurator/b92ConfiguredPositionCompiler";
import {
  B92_PROOF_MANIFEST,
  getB92ProofManifestEntry,
} from "../src/features/b92Configurator/b92ProofManifest";
import {
  applyConfiguredContractFlatPatch,
  describeConfiguredPositionContract,
  describePositionForOutput,
  getConfiguredPositionContract,
  getContractAwarePositionMetrics,
  isConfiguredPositionContract,
} from "../src/features/configurator/configuredPositionContract.utils";
import { createDraft } from "../src/features/estimateWorkflow/workflowDraft";
import { estimateTotals } from "../src/domain/estimates/estimateCalculations";
import { buildEstimateHtml } from "../src/services/documents/estimateDocumentService";

function compileDefaultContract() {
  const state = createB92DefaultConfiguratorState();
  const result = compileB92ConfiguratorStateToConfiguredPositionContract(state, {
    clientId: "client-test",
    estimateId: "estimate-test",
    positionId: "position-test",
    positionRef: "W-001",
    quantity: 2,
    roomName: "Kitchen",
    itemPrice: 100,
    createdAt: "2026-07-08T00:00:00.000Z",
    updatedAt: "2026-07-08T00:00:00.000Z",
  });
  assert.equal(result.ok, true);
  return result.contract;
}

test("B92 proof manifest exposes production-safe approved proof metadata", () => {
  const entry = getB92ProofManifestEntry("b92-1-field-fixed");
  assert.ok(entry);
  assert.equal(entry.status, "approved_locked");
  assert.equal(entry.productionSafe, true);
  assert.deepEqual(entry.profileRefs, ["B92-1", "B92-2", "B92-3"]);
  assert.ok(B92_PROOF_MANIFEST.length >= 14);
});

test("B92 compiler creates a versioned configured position contract", () => {
  const contract = compileDefaultContract();
  assert.equal(contract.schemaVersion, 1);
  assert.equal(contract.source, "b92_configurator");
  assert.equal(contract.product.systemCode, "B92");
  assert.equal(contract.profileProof.proofStatus, "approved_locked");
  assert.deepEqual(contract.profileProof.profileRefs, ["B92-1", "B92-2", "B92-3"]);
  assert.equal(contract.layout.fields[0]?.operation, "fixed");
  assert.equal(contract.compatibilityProjection.insertion, "Fixed");
});

test("contract-to-legacy projection keeps existing position surfaces populated", () => {
  const contract = compileDefaultContract();
  const legacy = projectConfiguredPositionContractToLegacyPosition(contract);
  assert.equal(legacy.positionRef, "W-001");
  assert.equal(legacy.qty, 2);
  assert.equal(legacy.widthMm, 1000);
  assert.equal(legacy.heightMm, 1000);
  assert.equal(legacy.fieldsX, 1);
  assert.equal(legacy.cellInsertions["0,0"], "Fixed");
});

test("contract utilities detect, describe, and patch contract-backed positions", () => {
  const contract = compileDefaultContract();
  const position = { widthMm: 9999, heightMm: 9999, qty: 9, configuredContract: contract };
  assert.equal(isConfiguredPositionContract(contract), true);
  assert.equal(getConfiguredPositionContract(position), contract);
  assert.equal(getContractAwarePositionMetrics(position).widthMm, 1000);
  assert.match(describeConfiguredPositionContract(contract), /B92 1x1/);
  assert.match(describePositionForOutput(position, "LEGACY"), /approved/);

  const patched = applyConfiguredContractFlatPatch(contract, { widthMm: 1200, heightMm: 800, qty: 3 });
  assert.equal(patched.dimensions.widthMm, 1200);
  assert.equal(patched.dimensions.heightMm, 800);
  assert.deepEqual(patched.dimensions.colWidthsMm, [1200]);
  assert.deepEqual(patched.dimensions.rowHeightsMm, [800]);
  assert.equal(patched.estimateContext.quantity, 3);
});

test("estimate totals use contract dimensions and quantity before legacy flat fields", () => {
  const contract = compileDefaultContract();
  const totals = estimateTotals({
    positions: [
      {
        widthMm: 5000,
        heightMm: 5000,
        qty: 9,
        configuredContract: contract,
      },
    ],
  });
  assert.equal(totals.totalSquareMetres, 2);
  assert.equal(totals.totalLinearMetres, 8);
  assert.equal(totals.totalQty, 2);
});

test("legacy flat positions remain compatible through the contract adapter boundary", () => {
  const position = { widthMm: 1200, heightMm: 800, qty: 3, itemPrice: 250 };
  const metrics = getContractAwarePositionMetrics(position);
  assert.equal(getConfiguredPositionContract(position), null);
  assert.deepEqual(metrics, {
    widthMm: 1200,
    heightMm: 800,
    qty: 3,
    itemPrice: 250,
  });
  assert.equal(describePositionForOutput(position, "Legacy fixed position"), "Legacy fixed position");
});

test("legacy windowConfiguration hydrates only as disabled workflow compatibility state", () => {
  const draft = createDraft({
    estimateId: "estimate-test",
    clientId: "client-test",
    positionId: "position-test",
    position: {
      positionRef: "W-002",
      qty: 1,
      roomName: "Utility",
      widthMm: 1400,
      heightMm: 900,
      fieldsX: 2,
      fieldsY: 1,
      insertion: "Fixed",
      windowConfiguration: {
        activeSectionId: "fields",
        layout: { rows: 1, columns: 2, presetKey: "1x2" },
        fields: [
          { key: "0,0", row: 0, col: 0, type: "fixed" },
          { key: "1,0", row: 0, col: 1, type: "tiltAndTurnRight" },
        ],
      },
    },
  });

  assert.equal(draft.configuration.activeSectionId, "fields");
  assert.equal(draft.configuration.layout.rows, 1);
  assert.equal(draft.configuration.layout.columns, 2);
  assert.equal(draft.configuration.fields[1]?.type, "tiltAndTurnRight");
});

test("quote/document output uses contract-first position description", () => {
  const contract = compileDefaultContract();
  const html = buildEstimateHtml({
    pickerClient: { clientName: "Client", clientRef: "CL-001" },
    e: {
      estimateRef: "EST-001",
      positions: [
        {
          id: "position-test",
          positionRef: "W-001",
          roomName: "Kitchen",
          qty: 2,
          itemPrice: 100,
          configuredContract: contract,
        },
      ],
    },
    itemPriceByPositionId: {},
    formatMeasure: (value) => String(value),
    formatMoney: (value) => `GBP ${value}`,
    positionDescription: () => "LEGACY DESCRIPTION",
  });
  assert.match(html, /B92 1x1/);
  assert.doesNotMatch(html, /LEGACY DESCRIPTION/);
});

test("unsupported B92 combinations fail safely", () => {
  const state = createB92DefaultConfiguratorState();
  const unsupported = {
    ...state,
    structure: {
      ...state.structure,
      fields: state.structure.fields.map((field) => ({ ...field, operation: "fixed-sash" as const })),
    },
  };
  const result = compileB92ConfiguratorStateToConfiguredPositionContract(unsupported, {
    clientId: "client-test",
    estimateId: "estimate-test",
    positionId: "position-test",
    positionRef: "W-001",
    quantity: 1,
    roomName: "",
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /Unsupported B92/);
});
