import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import sqlite3 from "sqlite3";
import { open, type Database } from "sqlite";
import { initializeSupplierCommercialSchema, supplierCommercialTableNames } from "../server/schema/supplierCommercialSchema.js";
import { calculateFileSha256, ensureManagedParent, generateManagedStorageKey, isManagedPath, resolveManagedPath, verifyFileIntegrity } from "../server/features/supplierQuotes/managedAttachmentStorage.js";
import { createSupplierQuoteRepository, type SupplierPositionApplication } from "../src/features/supplierQuoteImport/persistence/supplierQuoteRepository";
import { createProjectCalculatorRepository } from "../src/features/projectCalculator/persistence/projectCalculatorRepository";
import type { SupplierQuote, SupplierQuoteAttachment, SupplierQuoteExtra, SupplierQuoteImportRun, SupplierQuotePosition, SupplierQuoteReviewDecision, SupplierQuoteRevision } from "../src/features/supplierQuoteImport/domain/supplierQuote.types";
import type { CalculatorSnapshot, PricingScenario, ProjectCostItem } from "../src/features/projectCalculator/domain/projectCalculator.types";

const now = "2026-08-04T12:00:00.000Z";
async function database(t: test.TestContext): Promise<Database> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "quotesync-stage1c-"));
  const db = await open({ filename: path.join(directory, "test.db"), driver: sqlite3.Database });
  t.after(async () => { await db.close(); await rm(directory, { recursive: true, force: true }); });
  await db.exec("PRAGMA foreign_keys=ON; CREATE TABLE clients (id TEXT PRIMARY KEY, client_ref TEXT, name TEXT); CREATE TABLE estimates (id TEXT PRIMARY KEY, client_id TEXT NOT NULL, positions_json TEXT NOT NULL DEFAULT '[]', FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE CASCADE);");
  await db.run("INSERT INTO clients(id,client_ref,name) VALUES ('client-a','EF-CL-001','A'),('client-b','EF-CL-002','B')");
  await db.run("INSERT INTO estimates(id,client_id,positions_json) VALUES ('estimate-a','client-a','[{\"id\":\"position-existing\"}]'),('estimate-b','client-b','[]')");
  await initializeSupplierCommercialSchema(db);
  return db;
}
const quote = (id: string, estimateId = "estimate-a", supplierName = "Zyle Fenster"): SupplierQuote => ({ id, estimateId, supplierCode: supplierName === "Zyle Fenster" ? "ZYLE" : "SECOND", supplierName, createdAt: now, updatedAt: now, archivedAt: null });
const revision = (id: string, quoteId: string, sequence: number, currency = "EUR", status: SupplierQuoteRevision["lifecycleStatus"] = "uploaded"): SupplierQuoteRevision => ({ id, supplierQuoteId: quoteId, estimateId: "estimate-a", revisionSequence: sequence, supplierQuotationNumber: "343117", supplierRevision: String(sequence + 1), fullQuotationReference: `343117-${sequence + 1}`, quotationDate: "2026-08-04", customerReference: "internal-ref", currency, vatStatus: "exclusive", productSubtotal: { amount: "1074.24", currency }, extrasTotal: { amount: "0.00", currency }, deliveryTotal: { amount: "100.00", currency }, vatTotal: { amount: "0.00", currency }, finalSupplierTotal: { amount: "1174.24", currency }, lifecycleStatus: status, createdAt: now, supersededAt: null, supersededByRevisionId: null });
const attachment = (id: string, revisionId: string, role: SupplierQuoteAttachment["role"] = "original_quote", source: string | null = null): SupplierQuoteAttachment => ({ id, estimateId: "estimate-a", revisionId, role, originalFileName: role === "derived_artifact" ? "page.txt" : "quote.docx", mediaType: role === "derived_artifact" ? "text/plain" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document", sizeBytes: 4, sha256: "a".repeat(64), storageKey: `estimates/estimate-a/supplier-quotes/${revisionId}/${id}`, parserEligible: role !== "derived_artifact", createdAt: now, derivedFromAttachmentId: source, artifactType: role === "derived_artifact" ? "extracted_text" : null, extractorVersion: role === "derived_artifact" ? "extractor-1" : null });
const position = (id: string, revisionId: string, displayReference: string, tokens: string[], quantity: number): SupplierQuotePosition => ({ id, estimateId: "estimate-a", revisionId, displayReference, supplierReferenceTokens: tokens, quantity, product: "Europa 92", productSystem: "B92", originalSpecificationText: "1. Original specification", specifications: [{ id: `${id}-spec-1`, supplierPositionId: id, ordinal: 0, suppliedNumber: "1", originalText: "1. Original specification", normalizedLabel: "system", normalizedValue: "B92", trace: [] }, { id: `${id}-spec-2`, supplierPositionId: id, ordinal: 1, suppliedNumber: "1", originalText: "1. Duplicate supplied number", normalizedLabel: null, normalizedValue: null, trace: [] }], widthMm: 610, heightMm: 1200, supplierAreaSquareMetres: "0.732", calculatedAreaSquareMetres: "0.732", unitPurchasePrice: { amount: "537.12", currency: "EUR" }, totalPurchasePrice: { amount: "1074.24", currency: "EUR" }, supplierDrawingAttachmentId: null, openingDirection: "right", viewDirection: "inside", proposedWindowTypeId: null, proposedProofFamilyId: null, recognitionConfidence: null, recognitionReasons: [], sourcePages: [1], trace: [], reviewStatus: "unreviewed" });

test("fresh and repeated initialization preserve legacy estimate/client data and positions_json", async (t) => {
  const db = await database(t); await initializeSupplierCommercialSchema(db);
  const names = (await db.all<{ name: string }[]>("SELECT name FROM sqlite_master WHERE type='table'")).map((row) => row.name);
  for (const name of supplierCommercialTableNames) assert.ok(names.includes(name));
  assert.equal((await db.get<{ positions_json: string }>("SELECT positions_json FROM estimates WHERE id='estimate-a'"))?.positions_json, '[{"id":"position-existing"}]');
  assert.equal((await db.get<{ client_ref: string }>("SELECT client_ref FROM clients WHERE id='client-a'"))?.client_ref, "EF-CL-001");
  assert.equal((await db.get<{ foreign_keys: number }>("PRAGMA foreign_keys"))?.foreign_keys, 1);
});

test("multi-supplier, same-supplier duplicates, revisions, currencies, scope and immutability", async (t) => {
  const db = await database(t); const repository = createSupplierQuoteRepository(db);
  await repository.createQuote(quote("quote-zyle-1")); await repository.createQuote(quote("quote-zyle-2")); await repository.createQuote(quote("quote-gbp", "estimate-a", "Second Supplier"));
  assert.equal((await repository.listQuotes("estimate-a")).length, 3); assert.equal(await repository.getQuote("estimate-b", "quote-zyle-1"), null);
  await repository.createRevision(revision("revision-eur-1", "quote-zyle-1", 0)); await repository.createRevision(revision("revision-eur-2", "quote-zyle-1", 1)); await repository.createRevision(revision("revision-gbp", "quote-gbp", 0, "GBP"));
  assert.deepEqual((await repository.listRevisions("estimate-a", "quote-zyle-1")).map((item) => item.supplierRevision), ["1", "2"]);
  assert.equal((await repository.getRevision("estimate-a", "quote-gbp", "revision-gbp"))?.productSubtotal?.amount, "1074.24");
  assert.equal((await db.get<{ type: string }>("SELECT type FROM pragma_table_info('supplier_quote_revisions') WHERE name='product_subtotal_amount'"))?.type, "TEXT");
  await assert.rejects(repository.createRevision(revision("duplicate-sequence", "quote-zyle-1", 1)));
  assert.equal("updateRevision" in repository, false);
  assert.equal((await repository.getRevision("estimate-a", "quote-zyle-1", "revision-eur-1"))?.supplierQuotationNumber, "343117");
  assert.equal(await repository.getRevision("estimate-b", "quote-zyle-1", "revision-eur-1"), null);
  await assert.rejects(repository.createRevision({ ...revision("cross-estimate", "quote-zyle-1", 3), estimateId: "estimate-b" }));
});

test("revision supersession is explicit and leaves both immutable evidence rows retrievable", async (t) => {
  const db = await database(t); const repository = createSupplierQuoteRepository(db);
  await repository.createQuote(quote("quote"));
  await repository.createRevision(revision("previous", "quote", 0, "EUR", "approved"));
  await repository.createRevision(revision("next", "quote", 1));
  await repository.supersedeRevision("estimate-a", "previous", "next", now);
  const rows = await repository.listRevisions("estimate-a", "quote");
  assert.equal(rows[0].lifecycleStatus, "superseded"); assert.equal(rows[0].supersededByRevisionId, "next");
  assert.equal(rows[0].supplierQuotationNumber, "343117"); assert.equal(rows[1].lifecycleStatus, "uploaded");
});

test("managed attachment keys, traversal rejection, hashes and derived provenance", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "quotesync-storage-")); t.after(() => rm(root, { recursive: true, force: true }));
  const key = generateManagedStorageKey({ estimateId: "estimate-a", revisionId: "revision-1", attachmentId: "attachment-1" });
  const filename = await ensureManagedParent(key, root); await writeFile(filename, "Zyle");
  assert.equal(isManagedPath(filename, root), true); assert.equal((await calculateFileSha256(filename)).length, 64);
  const integrity = await verifyFileIntegrity(filename, { sizeBytes: 4, sha256: await calculateFileSha256(filename) }); assert.equal(integrity.valid, true);
  assert.throws(() => resolveManagedPath("../escape", root)); assert.throws(() => resolveManagedPath("C:\\escape", root));
  const db = await database(t); const repository = createSupplierQuoteRepository(db); await repository.createQuote(quote("quote")); await repository.createRevision(revision("revision", "quote", 0));
  await repository.createAttachment(attachment("original", "revision")); await repository.createAttachment(attachment("derived", "revision", "derived_artifact", "original"));
  const rows = await repository.listAttachments("estimate-a", "revision"); assert.deepEqual(rows.map((row) => row.role), ["original_quote", "derived_artifact"]); assert.equal(rows[1].derivedFromAttachmentId, "original");
});

test("import versions, ordered attachments and terminal-state validation round-trip", async (t) => {
  const db = await database(t); const repository = createSupplierQuoteRepository(db); await repository.createQuote(quote("quote")); await repository.createRevision(revision("revision", "quote", 0));
  await repository.createAttachment(attachment("a1", "revision")); await repository.createAttachment({ ...attachment("a2", "revision"), storageKey: "estimates/estimate-a/supplier-quotes/revision/a2" });
  const run: SupplierQuoteImportRun = { id: "run", estimateId: "estimate-a", revisionId: "revision", attachmentIds: ["a2", "a1"], extractorName: "generic", extractorVersion: "extractor-1", adapterCode: "zyle", adapterVersion: "adapter-2", recognitionVersion: "recognition-3", startedAt: now, completedAt: null, status: "running", warnings: [], errorCode: null, errorMessage: null, rawResultAttachmentId: null };
  await repository.createImportRun(run, ["primary", "supporting"]); await repository.completeImportRun("estimate-a", "run", "completed_with_warnings", now, ["first", "second"], null, null);
  const stored = await db.get<Record<string, unknown>>("SELECT * FROM supplier_quote_import_runs WHERE id='run'"); assert.equal(stored?.extractor_version, "extractor-1"); assert.equal(stored?.adapter_version, "adapter-2"); assert.equal(stored?.recognition_version, "recognition-3"); assert.equal(stored?.warnings_json, '["first","second"]');
  assert.deepEqual((await db.all<{ attachment_id: string }[]>("SELECT attachment_id FROM supplier_quote_import_run_attachments WHERE import_run_id='run' ORDER BY ordinal")).map((row) => row.attachment_id), ["a2", "a1"]);
  await assert.rejects(repository.createImportRun({ ...run, id: "bad", attachmentIds: [] }));
});

test("grouped rows never expand; specifications, extras, proposals, reviews and applications preserve evidence", async (t) => {
  const db = await database(t); const repository = createSupplierQuoteRepository(db); await repository.createQuote(quote("quote")); await repository.createRevision(revision("revision", "quote", 0));
  for (const item of [position("w7w8", "revision", "W7, W8", ["W7", "W8"], 2), position("w14w15", "revision", "W14, W15", ["W14", "W15"], 2), position("single", "revision", "W20", ["W20"], 3), position("mismatch", "revision", "W21-W23", ["W21", "W22", "W23"], 2)]) await repository.persistParsedRevision("estimate-a", "revision", [item], []);
  const rows = await repository.listPositions("estimate-a", "revision"); assert.equal(rows.length, 4); assert.equal(rows[0].quantity, 2); assert.deepEqual(rows[0].supplierReferenceTokens, ["W7", "W8"]);
  const specs = await db.all<Record<string, unknown>[]>("SELECT * FROM supplier_specification_items WHERE supplier_position_id='w7w8' ORDER BY ordinal"); assert.equal(specs.length, 2); assert.equal(specs[0].original_text, "1. Original specification"); assert.equal(specs[1].supplied_number, "1");
  const extra: SupplierQuoteExtra = { id: "discount", estimateId: "estimate-a", revisionId: "revision", category: "discount", label: "Credit", originalText: "Credit", quantity: null, unitPrice: null, totalPrice: { amount: "-10.00", currency: "EUR" }, trace: [] }; await repository.createExtra(extra, true);
  assert.equal((await db.get<{ total_price_amount: string }>("SELECT total_price_amount FROM supplier_quote_extras WHERE id='discount'"))?.total_price_amount, "-10.00");
  await repository.createAttachment(attachment("a1", "revision")); const run: SupplierQuoteImportRun = { id: "run", estimateId: "estimate-a", revisionId: "revision", attachmentIds: ["a1"], extractorName: "generic", extractorVersion: "1", adapterCode: "zyle", adapterVersion: "1", recognitionVersion: "1", startedAt: now, completedAt: now, status: "completed", warnings: [], errorCode: null, errorMessage: null, rawResultAttachmentId: null }; await repository.createImportRun(run);
  await repository.createProposal({ proposalKey: "proposal-a", estimateId: "estimate-a", supplierPositionId: "w7w8", proposedWindowTypeId: "b92", proposedProofFamilyId: "proof", score: 90, confidence: 0.9, reasons: ["geometry"], normalizedEvidence: { fields: 2 }, recognitionVersion: "1", createdAt: now, supportedByProductionManifest: false, blockingIssues: ["human review"] }, 0);
  await repository.createProposal({ proposalKey: "proposal-b", estimateId: "estimate-a", supplierPositionId: "w7w8", proposedWindowTypeId: null, proposedProofFamilyId: null, score: 50, confidence: 0.5, reasons: [], normalizedEvidence: {}, recognitionVersion: "1", createdAt: now, supportedByProductionManifest: true, blockingIssues: [] }, 1);
  assert.equal((await db.get<{ count: number }>("SELECT COUNT(*) count FROM supplier_position_match_proposals WHERE supplier_position_id='w7w8'"))?.count, 2);
  const decision = (id: string): SupplierQuoteReviewDecision => ({ id, estimateId: "estimate-a", supplierPositionId: "w7w8", importRunId: "run", reviewVersion: "review-1", decision: "deferred", selectedProposalKey: null, proposedConfigurationSnapshot: { source: "evidence-only" }, approvedConfigurationSnapshot: null, resultingPositionId: null, resultingContractSchemaVersion: null, reviewerId: "user", reviewedAt: now, note: null });
  await repository.appendReviewDecision(decision("review-1")); await repository.appendReviewDecision(decision("review-2")); assert.equal((await db.get<{ count: number }>("SELECT COUNT(*) count FROM supplier_quote_review_decisions"))?.count, 2);
  const application = (id: string, action: SupplierPositionApplication["action"]): SupplierPositionApplication => ({ id, estimateId: "estimate-a", supplierQuoteId: "quote", supplierQuoteRevisionId: "revision", supplierQuotePositionId: "w7w8", action, targetEstimatePositionId: null, appliedAt: now, appliedBy: "user", active: true, supersededByApplicationId: null, note: "evidence choice", createdAt: now });
  await repository.appendApplication(application("app-1", "comparison_only")); await repository.appendApplication(application("app-2", "include_as_new_position"));
  const apps = await db.all<{ id: string; active: number; superseded_by_application_id: string | null }[]>("SELECT id,active,superseded_by_application_id FROM supplier_position_applications ORDER BY rowid"); assert.deepEqual(apps, [{ id: "app-1", active: 0, superseded_by_application_id: "app-2" }, { id: "app-2", active: 1, superseded_by_application_id: null }]);
  assert.equal((await db.get<{ positions_json: string }>("SELECT positions_json FROM estimates WHERE id='estimate-a'"))?.positions_json, '[{"id":"position-existing"}]');
});

test("calculator ownership, conversion provenance, scenarios, immutable snapshots and cascades", async (t) => {
  const db = await database(t); const supplier = createSupplierQuoteRepository(db); const calculator = createProjectCalculatorRepository(db);
  await supplier.createQuote(quote("quote")); await supplier.createRevision(revision("revision", "quote", 0)); await supplier.createPosition({ ...position("w7w8", "revision", "W7, W8", ["W7", "W8"], 2), specifications: [] });
  const scenario: PricingScenario = { id: "scenario", calculatorId: "calculator", estimateId: "estimate-a", name: "Base", status: "active", markupPercent: "20", targetMarginPercent: "16.67", netCost: { amount: "900.00", currency: "GBP" }, contingency: { amount: "50.00", currency: "GBP" }, grossProfit: { amount: "224.24", currency: "GBP" }, marginPercent: "18.90", vatStatus: "exclusive", vatRatePercent: "20", vatAmount: { amount: "234.85", currency: "GBP" }, sellingPriceExVat: { amount: "1174.24", currency: "GBP" }, sellingPriceIncVat: { amount: "1409.09", currency: "GBP" }, createdAt: now, updatedAt: now };
  await calculator.createCalculatorWithScenario({ id: "calculator", estimateId: "estimate-a", baseCurrency: "GBP", activeScenarioId: "scenario", createdAt: now, updatedAt: now, archivedAt: null }, scenario);
  const cost: ProjectCostItem & { exchangeRate: string; exchangeRateDate: string; exchangeRateSource: string; convertedTotalAmount: string; convertedCurrency: string } = { id: "cost", calculatorId: "calculator", estimateId: "estimate-a", category: "supplier_purchase", label: "Zyle W7, W8", quantity: "2", unitCost: { amount: "537.12", currency: "EUR" }, totalCost: { amount: "1074.24", currency: "EUR" }, source: "supplier_import", included: true, supplierQuoteRevisionId: "revision", supplierPositionId: "w7w8", manuallyOverridden: false, sourceValueSnapshot: { amount: "1074.24", currency: "EUR", revisionId: "revision" }, exchangeRate: "0.84", exchangeRateDate: "2026-08-04", exchangeRateSource: "manual", convertedTotalAmount: "902.36", convertedCurrency: "GBP", createdAt: now, updatedAt: now };
  await calculator.createCostItem(cost); assert.deepEqual(await db.get("SELECT total_cost_amount,total_cost_currency,converted_total_amount,converted_currency,exchange_rate FROM project_cost_items WHERE id='cost'"), { total_cost_amount: "1074.24", total_cost_currency: "EUR", converted_total_amount: "902.36", converted_currency: "GBP", exchange_rate: "0.84" });
  await supplier.createRevision(revision("newer-revision", "quote", 1)); assert.equal((await db.get<{ supplier_quote_revision_id: string; total_cost_amount: string }>("SELECT supplier_quote_revision_id,total_cost_amount FROM project_cost_items WHERE id='cost'"))?.supplier_quote_revision_id, "revision");
  await calculator.createScenario({ ...scenario, id: "scenario-alternative", name: "Alternative", status: "draft" }); assert.equal((await db.get<{ count: number }>("SELECT COUNT(*) count FROM pricing_scenarios"))?.count, 2);
  const snapshot: CalculatorSnapshot = { id: "snapshot-1", calculatorId: "calculator", estimateId: "estimate-a", scenarioId: "scenario", snapshotVersion: "1", calculationInputs: { cost: "902.36" }, calculationOutputs: { sale: "1174.24" }, createdAt: now, createdBy: "user" }; await calculator.appendSnapshot(snapshot); await calculator.appendSnapshot({ ...snapshot, id: "snapshot-2", snapshotVersion: "2" });
  assert.equal((await db.get<{ count: number }>("SELECT COUNT(*) count FROM calculator_snapshots"))?.count, 2);
  await db.run("DELETE FROM estimates WHERE id='estimate-a'"); assert.equal((await db.get<{ count: number }>("SELECT COUNT(*) count FROM supplier_quotes"))?.count, 0); assert.equal((await db.get<{ count: number }>("SELECT COUNT(*) count FROM project_calculators"))?.count, 0); assert.equal((await db.get<{ count: number }>("SELECT COUNT(*) count FROM estimates WHERE id='estimate-b'"))?.count, 1);
});

test("deleting one supplier quote cascades only that quote's evidence", async (t) => {
  const db = await database(t); const repository = createSupplierQuoteRepository(db);
  await repository.createQuote(quote("quote-a")); await repository.createQuote(quote("quote-b"));
  await repository.createRevision(revision("revision-a", "quote-a", 0)); await repository.createRevision(revision("revision-b", "quote-b", 0));
  await repository.createPosition({ ...position("position-a", "revision-a", "W7, W8", ["W7", "W8"], 2), specifications: [] });
  await db.run("DELETE FROM supplier_quotes WHERE id='quote-a' AND estimate_id='estimate-a'");
  assert.equal((await db.get<{ count: number }>("SELECT COUNT(*) count FROM supplier_quote_revisions WHERE id='revision-a'"))?.count, 0);
  assert.equal((await db.get<{ count: number }>("SELECT COUNT(*) count FROM supplier_quote_revisions WHERE id='revision-b'"))?.count, 1);
});

test("document metadata, attachment order and position commercial source order round-trip", async (t) => {
  const db = await database(t); const repository = createSupplierQuoteRepository(db);
  await repository.createQuote(quote("quote"));
  await repository.createRevision({ ...revision("revision", "quote", 0), supplierCustomer: "Eco Fenster", projectReference: "The Aviary" });
  const schedule = { ...attachment("schedule", "revision"), documentKind: "window_schedule" as const, uploadedBy: "user", uploadOrder: 0 };
  const covering = { ...attachment("covering", "revision"), documentKind: "quotation_letter" as const, uploadedBy: "user", uploadOrder: 1 };
  await repository.createAttachment(covering); await repository.createAttachment(schedule);
  const base = { ...position("base", "revision", "W0.04", ["W0.04"], 1), sourceSequence: 3, classification: "standard" as const, includedInSupplierTotal: true, alternativeToReference: null, classificationEvidence: null };
  const alternative = { ...position("alternative", "revision", "W0.04ALT", ["W0.04ALT"], 1), sourceSequence: 4, classification: "alternative" as const, includedInSupplierTotal: false, alternativeToReference: "W0.04", classificationEvidence: "Alternative position (not included in total sum of the offer)" };
  const next = { ...position("next", "revision", "W0.05", ["W0.05"], 1), sourceSequence: 5, classification: "standard" as const, includedInSupplierTotal: true, alternativeToReference: null, classificationEvidence: null };
  await repository.persistParsedRevision("estimate-a", "revision", [next, alternative, base], []);
  const reloadedRevision = await repository.getRevision("estimate-a", "quote", "revision");
  assert.equal(reloadedRevision?.supplierCustomer, "Eco Fenster"); assert.equal(reloadedRevision?.projectReference, "The Aviary");
  assert.deepEqual((await repository.listAttachments("estimate-a", "revision")).map((item) => [item.id, item.uploadOrder, item.documentKind]), [["schedule", 0, "window_schedule"], ["covering", 1, "quotation_letter"]]);
  const rows = await repository.listPositions("estimate-a", "revision");
  assert.deepEqual(rows.map((row) => row.display_reference), ["W0.04", "W0.04ALT", "W0.05"]);
  assert.deepEqual(rows.map((row) => row.sourceSequence), [3, 4, 5]);
  assert.equal(rows[1].classification, "alternative"); assert.equal(rows[1].includedInSupplierTotal, false); assert.equal(rows[1].alternativeToReference, "W0.04"); assert.match(String(rows[1].classificationEvidence), /not included/i);
});
