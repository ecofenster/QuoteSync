import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import EstimateSupplierCostImportControl from "../src/features/estimateCommercial/EstimateSupplierCostImportControl";
import { deriveSupplierImportReviewState, updateDocumentSelection } from "../src/features/estimateCommercial/domain/supplierImportReviewState";
import { normalizeManufacturerImportReview } from "../src/features/supplierQuotes/domain/manufacturerImportReview";

const rows = (count: number) => Array.from({ length: count }, (_, index) => ({
  rowKey: `source:${index}`,
  include: true,
  customerReference: String(index + 1),
  manufacturerName: "Internorm",
  productSystem: "HF410",
  sourceVisual: { kind: "manufacturer_document_region", role: "other_source", status: "unavailable" },
  warnings: [],
}));

const response = (overrides: Record<string, unknown> = {}) => ({
  estimateId: "estimate",
  positionCount: 16,
  metadata: {
    recognizedSupplierName: "EcoHaus",
    recognizedDealerName: "EcoHaus",
    recognizedManufacturerName: "Internorm",
    supplierResolutionStatus: "not_configured",
    dealerResolutionStatus: "not_configured",
    manufacturerResolutionStatus: "resolved",
    manufacturerId: "manufacturer-internorm",
    manufacturerName: "Internorm",
    manufacturerCode: "IN",
    quotationNumber: "20260057",
    currency: "GBP",
  },
  canonicalManufacturers: [{ manufacturerId: "manufacturer-internorm", manufacturerName: "Internorm", manufacturerCode: "IN" }],
  commercialSuppliers: [],
  canonicalSuppliers: [],
  documents: [{ quoteId: "quote", revisionId: "revision", attachmentId: "source", rows: rows(16) }],
  ...overrides,
});

test("EcoHaus review keeps canonical Internorm and sixteen positions while an unconfigured dealer blocks confirmation", () => {
  const review = normalizeManufacturerImportReview(response());
  const state = deriveSupplierImportReviewState(review, review.metadata.supplierCode ?? "", review.metadata.manufacturerId ?? "");
  assert.equal(review.metadata.recognizedManufacturerName, "Internorm");
  assert.equal(review.metadata.recognizedDealerName, "EcoHaus");
  assert.equal(review.metadata.currency, "GBP");
  assert.equal(state.rows.length, 16);
  assert.equal(state.canonicalManufacturer?.manufacturerName, "Internorm");
  assert.equal(state.commercialSupplier, null);
  assert.equal(state.confirmationBlocked, true);
});

test("legacy Review response arrays normalize at the API boundary instead of reaching render as undefined", () => {
  const review = normalizeManufacturerImportReview(response({
    canonicalManufacturers: undefined,
    commercialSuppliers: undefined,
    canonicalSuppliers: [{ supplierCode: "ECOHAUS", supplierName: "EcoHaus", pricingMethod: "factory_price" }],
  }));
  assert.deepEqual(review.canonicalManufacturers, []);
  assert.equal(review.commercialSuppliers.length, 1);
  assert.equal(review.commercialSuppliers[0].supplierName, "EcoHaus");
  assert.equal(review.commercialSuppliers[0].pricingPolicyAvailable, true);
});

test("loading, empty documents and unavailable pricing policy remain safe and fail closed", () => {
  const empty = normalizeManufacturerImportReview(response({ positionCount: 0, documents: undefined, commercialSuppliers: undefined, canonicalSuppliers: undefined }));
  assert.deepEqual(empty.documents, []);
  assert.deepEqual(empty.commercialSuppliers, []);
  assert.equal(deriveSupplierImportReviewState(empty, "", "manufacturer-internorm").confirmationBlocked, true);

  const missingPolicy = normalizeManufacturerImportReview(response({
    commercialSuppliers: [{ supplierCode: "ECOHAUS", supplierName: "EcoHaus" }],
    metadata: { ...(response().metadata as Record<string, unknown>), supplierCode: "ECOHAUS", supplierResolutionStatus: "resolved" },
  }));
  const state = deriveSupplierImportReviewState(missingPolicy, "ECOHAUS", "manufacturer-internorm");
  assert.equal(state.commercialSupplier?.pricingPolicyAvailable, false);
  assert.equal(state.confirmationBlocked, true);
});

test("direct manufacturer/supplier cases collapse naturally for EKO and Zyle", () => {
  for (const [name, code, manufacturerId] of [["EKO-OKNA", "EKO", "manufacturer-eko"], ["Zyle Fenster", "ZF", "manufacturer-zyle"]]) {
    const review = normalizeManufacturerImportReview(response({
      metadata: { ...(response().metadata as Record<string, unknown>), recognizedSupplierName: name, recognizedDealerName: name, recognizedManufacturerName: name, supplierCode: code, manufacturerId, manufacturerName: name, supplierResolutionStatus: "resolved", dealerResolutionStatus: "resolved" },
      canonicalManufacturers: [{ manufacturerId, manufacturerName: name, manufacturerCode: code }],
      commercialSuppliers: [{ supplierCode: code, supplierName: name, pricingMethod: "factory_price" }],
    }));
    const state = deriveSupplierImportReviewState(review, code, manufacturerId);
    assert.equal(state.sameSupplierAndManufacturer, true);
    assert.equal(state.confirmationBlocked, false);
  }
});

test("selection helper preserves existing choices and supports deselection", () => {
  const selected = updateDocumentSelection(new Set(["one"]), "two", true);
  assert.deepEqual([...selected], ["one", "two"]);
  assert.deepEqual([...updateDocumentSelection(selected, "one", false)], ["two"]);
});

test("component module is Fast Refresh compatible and contains supplier failures", async () => {
  const source = await readFile("src/features/estimateCommercial/EstimateSupplierCostImportControl.tsx", "utf8");
  assert.match(source, /import \{ deriveSupplierImportReviewState, updateDocumentSelection \} from "\.\/domain\/supplierImportReviewState"/);
  assert.doesNotMatch(source, /export function updateDocumentSelection/);
  assert.match(source, /class SupplierImportFeatureBoundary extends Component/);
  assert.match(source, /Supplier Import is temporarily unavailable/);
  const markup = renderToStaticMarkup(<EstimateSupplierCostImportControl estimateId="estimate" scenarioId="scenario" onLoaded={() => undefined}/>);
  assert.match(markup, /No supplier documents are stored for this estimate yet/);
});

test("ScenarioCostingWorksheet has a stable import boundary for commercial provenance", async () => {
  const [worksheet, presentation] = await Promise.all([
    readFile("src/features/projectCalculatorLab/ScenarioCostingWorksheet.tsx", "utf8"),
    readFile("src/features/projectCalculatorLab/domain/projectCostingPresentation.ts", "utf8"),
  ]);
  assert.match(worksheet, /productCommercialSourceLabel/);
  assert.match(presentation, /export function productCommercialSourceLabel/);
  assert.doesNotMatch(presentation, /ScenarioCostingWorksheet/);
});

test("supplier commercial evidence is classified separately from the default Project Costing import", async () => {
  const commercialEvidence = {
    version: "supplier-quotation-commercial-classification-v1",
    currency: "GBP",
    categories: {
      productsSupply: { amount: "84404.55", automaticImport: true },
      extras: { amount: "2245.47", automaticImport: true },
      transport: { amount: "3145.71", automaticImport: true },
      installation: { amount: "10939.15", automaticImport: false },
      survey: { amount: "967.71", automaticImport: false },
      discount: { percentage: "20", amount: "16880.91", quotedNetProductAmount: "67523.64", automaticImport: false },
    },
    defaultImportedCost: "89795.73",
    supplierQuotedTotal: "84821.69",
    productSupplyReconciliation: { version: "product-supply-reconciliation-v1", status: "reconciled_exact", blocking: false, expectedSubtotal: "84404.55", extractedSubtotal: "84404.55", variance: "0.00", tolerance: "0.01", contributors: [], excludedItems: [], reviewReasons: [] },
  };
  const review = normalizeManufacturerImportReview(response({
    documents: [{ quoteId: "quote", revisionId: "revision", attachmentId: "source", rows: rows(16), commercialEvidence }],
  }));
  const normalizedEvidence = review.documents[0]?.commercialEvidence;
  assert.equal(normalizedEvidence?.defaultImportedCost, "89795.73");
  assert.equal(normalizedEvidence?.supplierQuotedTotal, "84821.69");
  assert.equal(normalizedEvidence?.categories.installation.automaticImport, false);
  assert.equal(normalizedEvidence?.categories.installation.decision, "evidence_only");
  assert.equal(normalizedEvidence?.categories.survey.decision, "review_required");
  assert.equal(normalizedEvidence?.categories.discount?.decision, "available_not_applied");
  assert.equal(normalizedEvidence?.productSupplyReconciliation.status, "reconciled_exact");
  assert.equal(normalizedEvidence?.productSupplyReconciliation.variance, "0.00");

  const [reviewSource, commercialReviewSource, worksheetSource] = await Promise.all([
    readFile("src/features/estimateCommercial/EstimateSupplierCostImportControl.tsx", "utf8"),
    readFile("src/features/projectCalculatorLab/SupplierCommercialReview.tsx", "utf8"),
    readFile("src/features/projectCalculatorLab/ScenarioCostingWorksheet.tsx", "utf8"),
  ]);
  assert.match(reviewSource, /Default Project Costing import/);
  assert.match(reviewSource, /Product-price reconciliation/);
  assert.match(reviewSource, /Product price reconciliation required/);
  assert.match(reviewSource, /Product reconciliation evidence/);
  assert.match(reviewSource, /Excluded from Products \/ Supply/);
  assert.match(reviewSource, /Evidence only · not imported/);
  assert.match(reviewSource, /Not applied automatically/);
  assert.match(reviewSource, /Reconciled independently from imported Project Costing/);
  assert.match(commercialReviewSource, /Apply supplier discount/);
  assert.match(commercialReviewSource, /source list prices remain unchanged/);
  assert.match(worksheetSource, /Include supplier installation cost/);
  assert.match(worksheetSource, /does not overwrite the Estimate-owned installation programme/);
});
