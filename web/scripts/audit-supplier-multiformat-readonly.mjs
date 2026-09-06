import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { initializeSupplierCommercialSchema } from '../server/schema/supplierCommercialSchema.js';
import { createProjectCalculatorLabService } from '../server/features/projectCalculatorLab/projectCalculatorLabService.js';
import { createSupplierQuotesService } from '../server/features/supplierQuotes/supplierQuotesService.js';

const sourceRoot = path.resolve('docs/Supplier_Quotes');
const documents = [
  ['Zyle DOCX', '343117-3_EF-EST-2026-004 - Luke.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'EUR'],
  ['Zyle DOCX Aviary', '343718 The Aviary alu-clad offer.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'EUR'],
  ['EKO-OKNA', 'Kosztorys - OF_25_2263569.pdf', 'application/pdf', 'GBP'],
  ['Gutmann', 'web-25-1064272 - Gutmann Mira - 7th August 2025.pdf', 'application/pdf', 'GBP'],
  ['Internorm', '25 - 116 - Owain Parry - Schedule - 10.7.2025.pdf', 'application/pdf', 'GBP'],
  ['Idealcombi', 'Competitor_Quotes_-_ Nick_Corlett_Examples/Idealcombi.pdf', 'application/pdf', 'GBP'],
  ['Norrsken', 'Competitor_Quotes_-_ Nick_Corlett_Examples/Norrsken.pdf', 'application/pdf', 'GBP'],
  ['Rationel', 'Competitor_Quotes_-_ Nick_Corlett_Examples/Rationel-Aspect.pdf', 'application/pdf', 'GBP'],
  ['VELFAC', 'Competitor_Quotes_-_ Nick_Corlett_Examples/Velfac-Frame.pdf', 'application/pdf', 'GBP'],
  ['Westcoast', 'Competitor_Quotes_-_ Nick_Corlett_Examples/Westcoast1.pdf', 'application/pdf', 'GBP'],
  ['21 Degrees', 'Competitor_Quotes_-_ Nick_Corlett_Examples/21degrees.pdf', 'application/pdf', 'GBP'],
  ['Raster-only sample', 'test.pdf', 'application/pdf', 'GBP'],
];
const expected = new Map([
  ['Zyle DOCX', { parsed: 21, ready: 21 }],
  ['Zyle DOCX Aviary', { parsed: 24, ready: 24 }],
  ['EKO-OKNA', { parsed: 12, ready: 12 }],
  ['Gutmann', { parsed: 25, ready: 25 }],
  ['Internorm', { parsed: 27, ready: 27 }],
  ['Idealcombi', { parsed: 40, ready: 40 }],
  ['Norrsken', { parsed: 18, ready: 18 }],
  ['Rationel', { parsed: 36, ready: 36 }],
  ['VELFAC', { parsed: 39, ready: 39 }],
  ['Westcoast', { parsed: 32, ready: 29 }],
  ['21 Degrees', { parsed: 30, ready: 0 }],
  ['Raster-only sample', { error: 'ocr_required' }],
]);

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'qs-import-matrix-'));
const fixtureRoot = path.join(root, 'sources');
const db = await open({ filename: path.join(root, 'audit.sqlite'), driver: sqlite3.Database });
try {
  await db.exec("PRAGMA foreign_keys=ON;CREATE TABLE clients(id TEXT PRIMARY KEY,client_ref TEXT,name TEXT,created_at TEXT,updated_at TEXT);CREATE TABLE estimates(id TEXT PRIMARY KEY,estimate_ref TEXT,client_id TEXT,status TEXT,positions_json TEXT,created_at TEXT,updated_at TEXT,deleted_at TEXT);INSERT INTO clients VALUES('client','EF-CL-AUDIT','Audit',datetime('now'),datetime('now'));INSERT INTO estimates VALUES('estimate','EF-EST-AUDIT','client','draft','[]',datetime('now'),datetime('now'),NULL);");
  await initializeSupplierCommercialSchema(db);
  const calculator = createProjectCalculatorLabService(db, { exchangeRateProvider: async () => ({ provider: 'audit', quotedAt: new Date().toISOString(), rawRate: '1' }) });
  const scenario = await calculator.createScenario({ estimateId: 'estimate', origin: 'manual', name: 'Read-only source audit', currency: 'GBP', packageCode: 'supply_only' });
  const service = createSupplierQuotesService(db, { attachmentRoot: fixtureRoot });
  const failures = [];
  for (const [index, [supplier, storageKey, mediaType, currency]] of documents.entries()) {
    try {
      await fs.access(path.join(sourceRoot, storageKey));
      const fixturePath = path.join(fixtureRoot, storageKey);
      await fs.mkdir(path.dirname(fixturePath), { recursive: true });
      await fs.copyFile(path.join(sourceRoot, storageKey), fixturePath);
      const supplierCode = `AUDIT-${index}`;
      await calculator.saveSupplierCommercialDefault({ supplierCode, supplierName: supplier, policy: { pricingMethod: 'parity_1_to_1', pricingBasis: 'parity_1_to_1', paidInQuotedCurrency: true, settlementCurrency: currency }, pricingDisplayPolicy: {} });
      const quote = await service.createQuote('estimate', { supplierCode, supplierName: supplier });
      const revision = await service.createRevision('estimate', quote.id, { supplierQuotationNumber: `AUDIT-${index}`, currency });
      const attachmentId = `audit-${index}`;
      await service.insertAttachments('estimate', quote.id, revision.id, [{ id: attachmentId, role: 'original_quote', documentKind: 'complete_quotation', originalFileName: path.basename(storageKey), mediaType, sizeBytes: 1, sha256: String(index + 1).repeat(64).slice(0, 64), storageKey, parserEligible: true, createdAt: new Date().toISOString() }]);
      const selection = [{ quoteId: quote.id, revisionId: revision.id, attachmentId }];
      const review = await service.prepareImportReview('estimate', selection);
      const contract = expected.get(supplier);
      assert.equal(review.positionCount, contract.parsed);
      assert.equal(review.documents[0].diagnostics.counts.validCanonicalPositions, contract.ready);
      const selectedRowKeys = review.documents[0].rows.filter((row) => row.include).map((row) => row.rowKey);
      const result = selectedRowKeys.length ? await service.extractAndLoadSupplierCosts('estimate', scenario.id, selection, { selectedRowKeys, supplierCode, metadata: { quotationNumber: review.metadata.quotationNumber || `AUDIT-${index}`, revision: review.metadata.revision || '', currency: review.metadata.currency } }) : null;
      const persisted = Number((await db.get('SELECT COUNT(*) count FROM supplier_quote_positions WHERE revision_id=?', revision.id)).count);
      const costing = Number((await db.get('SELECT COUNT(*) count FROM project_calculator_estimate_product_rows WHERE scenario_id=? AND source_revision_id=?', scenario.id, revision.id)).count);
      const reviewDocument = review.documents[0];
      const rows = reviewDocument.rows;
      const document = result?.documents[0];
      assert.equal(persisted, contract.ready);
      assert.equal(costing, contract.ready);
      if (result) assert.equal(result.operationStatus, contract.ready === contract.parsed ? 'confirmed' : 'review_required');
      console.log(JSON.stringify({
        supplier,
        sourcePositions: review.positionCount,
        rawBlocks: reviewDocument.diagnostics.counts.rawBlocks,
        candidatePositionBlocks: reviewDocument.diagnostics.counts.candidatePositionBlocks,
        parsedPositions: reviewDocument.diagnostics.counts.parsedPositions,
        validCanonicalPositions: reviewDocument.diagnostics.counts.validCanonicalPositions,
        persistedPositions: persisted,
        productsSupplyRows: costing,
        projectCostingRows: costing,
        includedRows: document?.diagnostics.counts.includedRows || 0,
        alternativeRows: document?.diagnostics.counts.alternativeRows || 0,
        invalidRows: document?.invalidProducts ?? contract.parsed - contract.ready,
        dimensions: rows.filter((row) => row.widthMm && row.heightMm).length,
        quantities: rows.filter((row) => Number.isInteger(row.quantity) && row.quantity > 0).length,
        prices: rows.filter((row) => row.unitPrice != null || row.totalPrice != null).length,
        productOrSystem: rows.filter((row) => row.product || row.productSystem).length,
        ug: rows.filter((row) => row.manufacturerQuotedUg != null).length,
        uw: rows.filter((row) => row.manufacturerQuotedUw != null).length,
        visualProvenance: rows.filter((row) => row.sourceVisual?.originalAsset).length,
        browserPreview: rows.filter((row) => row.sourceVisual?.status === 'available').length,
        diagnosticStatus: document?.diagnostics.status || reviewDocument.diagnostics.status,
        operationStatus: result?.operationStatus || 'review_required',
      }));
    } catch (error) {
      const contract = expected.get(supplier);
      if (contract?.error === error.code) console.log(JSON.stringify({ supplier, expectedError: error.message, code: error.code }));
      else { failures.push({ supplier, error }); console.log(JSON.stringify({ supplier, error: error.message, code: error.code || null })); }
    }
  }
  if (failures.length) throw new AggregateError(failures.map((item) => item.error), `${failures.length} supplier matrix entries failed their quantitative contract.`);
} finally {
  await db.close();
  await fs.rm(root, { recursive: true, force: true });
}
