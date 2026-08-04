import test from "node:test";
import assert from "node:assert/strict";
import type { EstimateId } from "../src/models/types";
import {
  isValidDecimalString,
  normalizeCurrencyCode,
  validateMoney,
  type JsonValue,
  type Money,
} from "../src/features/commercial/domain/commercial.index";
import {
  canTransitionSupplierQuoteRevision,
  normalizeSupplierReferenceTokens,
  validateProposedPositionMatch,
  validateSourceTrace,
  validateSupplierQuote,
  validateSupplierQuoteAttachment,
  validateSupplierQuoteExtra,
  validateSupplierQuoteImportRun,
  validateSupplierQuotePosition,
  validateSupplierQuoteReviewDecision,
  validateSupplierQuoteRevision,
  validateSupplierSpecificationItem,
  type ProposedPositionMatch,
  type SupplierQuote,
  type SupplierQuoteAttachment,
  type SupplierQuoteExtra,
  type SupplierQuoteImportRun,
  type SupplierQuotePosition,
  type SupplierQuoteReviewDecision,
  type SupplierQuoteRevision,
  type SupplierSpecificationItem,
} from "../src/features/supplierQuoteImport/domain/supplierQuote.index";
import {
  validateCalculatorSnapshot,
  validatePricingScenario,
  validateProjectCalculator,
  validateProjectCostItem,
  type CalculatorSnapshot,
  type PricingScenario,
  type ProjectCalculator,
  type ProjectCostItem,
} from "../src/features/projectCalculator/domain/projectCalculator.index";

const estimateId = "estimate-zyle-343117-3" as EstimateId;
const eur = (amount: string): Money => ({ amount, currency: "EUR" });

function revision(overrides: Partial<SupplierQuoteRevision> = {}): SupplierQuoteRevision {
  return {
    id: "revision-1",
    supplierQuoteId: "quote-1",
    estimateId,
    revisionSequence: 1,
    supplierQuotationNumber: "343117-3",
    supplierRevision: "3",
    fullQuotationReference: "343117-3",
    quotationDate: "2026-08-04",
    customerReference: "ESTIMATE TEST",
    currency: "EUR",
    vatStatus: "exclusive",
    productSubtotal: eur("1074.24"),
    extrasTotal: eur("0.00"),
    deliveryTotal: null,
    vatTotal: null,
    finalSupplierTotal: eur("1074.24"),
    lifecycleStatus: "review_required",
    createdAt: "2026-08-04T10:00:00.000Z",
    supersededAt: null,
    supersededByRevisionId: null,
    ...overrides,
  };
}

function specification(overrides: Partial<SupplierSpecificationItem> = {}): SupplierSpecificationItem {
  return {
    id: "spec-1",
    supplierPositionId: "supplier-position-1",
    ordinal: 0,
    suppliedNumber: "1",
    originalText: "1. Original Zyle specification text",
    normalizedLabel: "frame",
    normalizedValue: "Europa 92",
    trace: [],
    ...overrides,
  };
}

function position(overrides: Partial<SupplierQuotePosition> = {}): SupplierQuotePosition {
  return {
    id: "supplier-position-1",
    estimateId,
    revisionId: "revision-1",
    displayReference: "W7, W8",
    supplierReferenceTokens: ["W7", "W8"],
    quantity: 2,
    product: "Window",
    productSystem: "Europa 92",
    originalSpecificationText: "1. Original Zyle specification text",
    specifications: [specification()],
    widthMm: 610,
    heightMm: 1200,
    supplierAreaSquareMetres: "0.732",
    calculatedAreaSquareMetres: "0.732",
    unitPurchasePrice: eur("537.12"),
    totalPurchasePrice: eur("1074.24"),
    supplierDrawingAttachmentId: null,
    openingDirection: null,
    viewDirection: "unknown",
    proposedWindowTypeId: null,
    proposedProofFamilyId: null,
    recognitionConfidence: null,
    recognitionReasons: [],
    sourcePages: [1],
    trace: [],
    reviewStatus: "unreviewed",
    ...overrides,
  };
}

test("all supplier aggregate records require estimate ownership", () => {
  const quote: SupplierQuote = { id: "q", estimateId, supplierCode: "ZYLE", supplierName: "Zyle Fenster", createdAt: "now", updatedAt: "now", archivedAt: null };
  assert.equal(validateSupplierQuote(quote).valid, true);
  assert.equal(validateSupplierQuote({ ...quote, estimateId: "" as EstimateId }).valid, false);
  assert.equal(validateSupplierQuoteRevision(revision({ estimateId: "" as EstimateId })).valid, false);
  assert.equal(validateSupplierQuotePosition(position({ estimateId: "" as EstimateId })).valid, false);
});

test("grouped references remain one position and never determine quantity", () => {
  assert.equal(validateSupplierQuotePosition(position()).valid, true);
  assert.equal(validateSupplierQuotePosition(position({ displayReference: "W14, W15", supplierReferenceTokens: ["W14", "W15"] })).valid, true);
  assert.equal(validateSupplierQuotePosition(position({ supplierReferenceTokens: ["W7"], quantity: 3 })).valid, true);
  assert.equal(validateSupplierQuotePosition(position({ supplierReferenceTokens: ["W7", "W8", "W9"], quantity: 2 })).valid, true);
  assert.equal(validateSupplierQuotePosition(position({ supplierReferenceTokens: [], quantity: 2 })).valid, true);
  assert.equal(validateSupplierQuotePosition(position({ quantity: 0 })).valid, false);
  assert.equal(validateSupplierQuotePosition(position({ quantity: 1.5 })).valid, false);
  assert.equal(validateSupplierQuotePosition(position({ displayReference: " " })).valid, false);
  assert.equal(validateSupplierQuotePosition(position({ totalPurchasePrice: { amount: "1074.24", currency: "GBP" } })).valid, false);
  assert.deepEqual(normalizeSupplierReferenceTokens([" W7 ", "W8"]), ["W7", "W8"]);
  assert.equal(Array.isArray(position()), false);
});

test("specification ordering is ordinal-based and original text is preserved", () => {
  const first = specification({ ordinal: 0, suppliedNumber: "A", originalText: "  exact supplier spacing  ", normalizedValue: "normalized" });
  const second = specification({ id: "spec-2", ordinal: 1, suppliedNumber: "A" });
  assert.equal(validateSupplierSpecificationItem(first).valid, true);
  assert.equal(validateSupplierSpecificationItem(second).valid, true);
  assert.equal(first.originalText, "  exact supplier spacing  ");
  assert.equal(first.suppliedNumber, second.suppliedNumber);
  assert.deepEqual([second, first].sort((a, b) => a.ordinal - b.ordinal).map((item) => item.id), ["spec-1", "spec-2"]);
});

test("money uses plain decimal strings and normalized currency", () => {
  for (const value of ["0", "0.00", "537.12", "-12.50"]) assert.equal(isValidDecimalString(value), true);
  for (const value of ["1e3", "NaN", "Infinity", "+1", ".5", "01.2", " 1.00 "]) assert.equal(isValidDecimalString(value), false);
  assert.equal(normalizeCurrencyCode(" eur "), "EUR");
  assert.equal(validateMoney(eur("537.12"), { required: true }).valid, true);
  assert.equal(validateMoney(eur("-1.00")).valid, false);
  assert.equal(validateMoney(eur("-1.00"), { allowNegative: true }).valid, true);
  assert.equal(validateMoney({ amount: "1e3", currency: "EUR" }).valid, false);
  assert.equal(validateMoney({ amount: "1.00", currency: "eur" }).valid, false);
  assert.equal(validateSupplierQuoteRevision(revision({ productSubtotal: { amount: "1.00", currency: "GBP" } })).valid, false);
});

test("discount extras permit negative totals but ordinary extras do not", () => {
  const extra: SupplierQuoteExtra = { id: "extra-1", estimateId, revisionId: "revision-1", category: "discount", label: "Credit", originalText: "Discount -10 EUR", quantity: null, unitPrice: null, totalPrice: eur("-10.00"), trace: [] };
  assert.equal(validateSupplierQuoteExtra(extra).valid, true);
  assert.equal(validateSupplierQuoteExtra({ ...extra, category: "surcharge" }).valid, false);
});

test("revision ordering is independent of supplier revision and supersession is explicit", () => {
  assert.equal(validateSupplierQuoteRevision(revision({ revisionSequence: 4, supplierRevision: "B-final" })).valid, true);
  assert.equal(validateSupplierQuoteRevision(revision({ lifecycleStatus: "superseded" })).valid, false);
  const historical = revision({ lifecycleStatus: "superseded", supersededAt: "2026-08-05T00:00:00Z", supersededByRevisionId: "revision-2" });
  assert.equal(validateSupplierQuoteRevision(historical).valid, true);
  assert.equal(canTransitionSupplierQuoteRevision("approved", "superseded"), true);
  assert.equal(canTransitionSupplierQuoteRevision("superseded", "approved"), false);
  assert.equal(Object.isFrozen(Object.freeze(historical)), true);
});

test("attachment validation preserves ownership, hashes, and derived provenance", () => {
  const attachment: SupplierQuoteAttachment = { id: "attachment-1", estimateId, revisionId: "revision-1", role: "original_quote", originalFileName: "343117-3.pdf", mediaType: "application/pdf", sizeBytes: 100, sha256: "a".repeat(64), storageKey: "supplier-quotes/attachment-1", parserEligible: true, createdAt: "now", derivedFromAttachmentId: null, artifactType: null, extractorVersion: null };
  assert.equal(validateSupplierQuoteAttachment(attachment).valid, true);
  assert.equal(validateSupplierQuoteAttachment({ ...attachment, sha256: "ABC" }).valid, false);
  assert.equal(validateSupplierQuoteAttachment({ ...attachment, storageKey: "C:\\quotes\\file.pdf" }).valid, false);
  assert.equal(validateSupplierQuoteAttachment({ ...attachment, role: "derived_artifact", artifactType: "extracted_text" }).valid, false);
  assert.equal(validateSupplierQuoteAttachment({ ...attachment, role: "derived_artifact", artifactType: "extracted_text", derivedFromAttachmentId: "attachment-source", extractorVersion: "extract-1" }).valid, true);
});

test("source traces validate pages, ranges, and normalized boxes", () => {
  assert.equal(validateSourceTrace({ attachmentId: "a", pageNumber: 0, characterRange: { start: 1, end: 5 }, boundingBox: { x: 0.1, y: 0.1, width: 0.5, height: 0.5, coordinateSpace: "normalized" } }).valid, true);
  assert.equal(validateSourceTrace({ attachmentId: "a", pageNumber: -1 }).valid, false);
  assert.equal(validateSourceTrace({ attachmentId: "a", characterRange: { start: 5, end: 1 } }).valid, false);
  assert.equal(validateSourceTrace({ attachmentId: "a", boundingBox: { x: 0.8, y: 0, width: 0.3, height: 1, coordinateSpace: "normalized" } }).valid, false);
});

test("import runs retain independent versions and terminal-state invariants", () => {
  const run: SupplierQuoteImportRun = { id: "run-1", estimateId, revisionId: "revision-1", attachmentIds: ["attachment-1"], extractorName: "pdf", extractorVersion: "extract-1", adapterCode: "zyle", adapterVersion: "zyle-2", recognitionVersion: "recognition-3", startedAt: "start", completedAt: "end", status: "completed", warnings: [], errorCode: null, errorMessage: null, rawResultAttachmentId: "raw-1" };
  assert.equal(validateSupplierQuoteImportRun(run).valid, true);
  assert.notEqual(run.extractorVersion, run.adapterVersion);
  assert.notEqual(run.adapterVersion, run.recognitionVersion);
  assert.equal(validateSupplierQuoteImportRun({ ...run, attachmentIds: [] }).valid, false);
  assert.equal(validateSupplierQuoteImportRun({ ...run, completedAt: null }).valid, false);
  assert.equal(validateSupplierQuoteImportRun({ ...run, status: "failed", errorCode: null, errorMessage: null }).valid, false);
  assert.equal(validateSupplierQuoteImportRun({ ...run, status: "failed", errorCode: "PARSE", errorMessage: null }).valid, true);
});

test("recognition proposals are bounded, rankable evidence and may be unsupported", () => {
  const proposal: ProposedPositionMatch = { proposalKey: "p1", estimateId, supplierPositionId: "supplier-position-1", proposedWindowTypeId: "type-1", proposedProofFamilyId: "proof-1", score: 80, confidence: 0.8, reasons: ["field count"], normalizedEvidence: { fields: 2 }, recognitionVersion: "recognition-1", createdAt: "now", supportedByProductionManifest: false, blockingIssues: ["No production proof"] };
  assert.equal(validateProposedPositionMatch(proposal).valid, true);
  assert.equal(validateProposedPositionMatch({ ...proposal, confidence: 1.1 }).valid, false);
  const proposals = [proposal, { ...proposal, proposalKey: "p2", confidence: 0.6 }];
  assert.equal(proposals.length, 2);
  assert.equal(proposals[0]?.supportedByProductionManifest, false);
  assert.deepEqual(proposals[0]?.blockingIssues, ["No production proof"]);
});

test("review decisions preserve review/import identity and cannot create rejected results", () => {
  const decision: SupplierQuoteReviewDecision = { id: "decision-1", estimateId, supplierPositionId: "supplier-position-1", importRunId: "run-1", reviewVersion: "review-1", decision: "accepted", selectedProposalKey: "p1", proposedConfigurationSnapshot: { fields: 2 }, approvedConfigurationSnapshot: { fields: 2 }, resultingPositionId: "position-1", resultingContractSchemaVersion: 1, reviewerId: "reviewer", reviewedAt: "now", note: null };
  assert.equal(validateSupplierQuoteReviewDecision(decision).valid, true);
  assert.equal(validateSupplierQuoteReviewDecision({ ...decision, decision: "corrected" }).valid, true);
  assert.equal(validateSupplierQuoteReviewDecision({ ...decision, decision: "rejected" }).valid, false);
  assert.equal(validateSupplierQuoteReviewDecision({ ...decision, decision: "deferred" }).valid, false);
  assert.equal(validateSupplierQuoteReviewDecision({ ...decision, importRunId: "" }).valid, false);
  assert.equal(validateSupplierQuoteReviewDecision({ ...decision, reviewVersion: "" }).valid, false);
});

function calculator(): ProjectCalculator {
  return { id: "calculator-1", estimateId, baseCurrency: "GBP", activeScenarioId: "scenario-1", createdAt: "now", updatedAt: "now" };
}

function costItem(): ProjectCostItem {
  return { id: "cost-1", calculatorId: "calculator-1", estimateId, category: "supplier_purchase", label: "W7, W8", quantity: "2", unitCost: eur("537.12"), totalCost: eur("1074.24"), source: "supplier_import", included: true, supplierQuoteRevisionId: "revision-1", supplierPositionId: "supplier-position-1", manuallyOverridden: false, sourceValueSnapshot: { amount: "1074.24", currency: "EUR" }, createdAt: "now", updatedAt: "now" };
}

function scenario(): PricingScenario {
  return { id: "scenario-1", calculatorId: "calculator-1", estimateId, name: "Base", status: "active", markupPercent: "25", targetMarginPercent: null, netCost: eur("1074.24"), contingency: eur("0.00"), grossProfit: eur("268.56"), marginPercent: "20", vatStatus: "exclusive", vatRatePercent: "20", vatAmount: eur("268.56"), sellingPriceExVat: eur("1342.80"), sellingPriceIncVat: eur("1611.36"), createdAt: "now", updatedAt: "now" };
}

test("calculator aggregate and children require estimate ownership and source traceability", () => {
  assert.equal(validateProjectCalculator(calculator()).valid, true);
  assert.equal(validateProjectCalculator({ ...calculator(), estimateId: "" as EstimateId }).valid, false);
  assert.equal(validateProjectCostItem(costItem()).valid, true);
  assert.equal(validateProjectCostItem({ ...costItem(), estimateId: "" as EstimateId }).valid, false);
  assert.equal(validateProjectCostItem({ ...costItem(), supplierQuoteRevisionId: null }).valid, false);
  assert.equal(costItem().supplierPositionId, "supplier-position-1");
  assert.equal(costItem().manuallyOverridden, false);
  assert.deepEqual(costItem().sourceValueSnapshot, { amount: "1074.24", currency: "EUR" });
  assert.equal(validatePricingScenario(scenario()).valid, true);
  assert.equal(validatePricingScenario({ ...scenario(), estimateId: "" as EstimateId }).valid, false);
});

test("calculator snapshots are separately owned immutable JSON contracts", () => {
  const snapshot: CalculatorSnapshot = { id: "snapshot-1", calculatorId: "calculator-1", estimateId, scenarioId: "scenario-1", snapshotVersion: "snapshot-1", calculationInputs: { costs: ["1074.24"] }, calculationOutputs: { sellingPrice: "1611.36" }, createdAt: "now", createdBy: "user-1" };
  assert.equal(validateCalculatorSnapshot(snapshot).valid, true);
  assert.equal(validateCalculatorSnapshot({ ...snapshot, estimateId: "" as EstimateId }).valid, false);
  assert.equal(Object.isFrozen(Object.freeze(snapshot)), true);
});

test("representative Zyle evidence survives JSON serialization", () => {
  const source: JsonValue = { quotation: "343117-3", position: position() as unknown as JsonValue, revision: revision() as unknown as JsonValue };
  const roundTrip = JSON.parse(JSON.stringify(source)) as { quotation: string; position: SupplierQuotePosition; revision: SupplierQuoteRevision };
  assert.equal(roundTrip.quotation, "343117-3");
  assert.equal(roundTrip.position.displayReference, "W7, W8");
  assert.deepEqual(roundTrip.position.supplierReferenceTokens, ["W7", "W8"]);
  assert.equal(roundTrip.position.quantity, 2);
  assert.equal(roundTrip.position.unitPurchasePrice?.amount, "537.12");
  assert.equal(roundTrip.position.totalPurchasePrice?.amount, "1074.24");
  assert.equal(roundTrip.revision.currency, "EUR");
});
