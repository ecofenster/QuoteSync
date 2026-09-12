import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { reconstructPdfPageLayout } from '../server/features/supplierImportLab/pdfLayout.js';
import { parsePdfSupplierFields } from '../server/features/supplierImportLab/pdfSupplierAdapters.js';
import { createSupplierImportDiagnostics } from '../server/features/supplierImportLab/supplierImportDiagnostics.js';
import { initializeSupplierCommercialSchema } from '../server/schema/supplierCommercialSchema.js';
import { createProjectCalculatorLabService } from '../server/features/projectCalculatorLab/projectCalculatorLabService.js';
import { createSupplierQuotesService } from '../server/features/supplierQuotes/supplierQuotesService.js';

const block = (text, index, pageNumber = 1) => ({ id: `b-${pageNumber}-${index}`, text, pageNumber, boundingBox: { x: index * 10, y: 700 - index * 10, width: Math.max(text.length * 5, 5), height: 10 }, readingOrder: index, sourceType: 'positioned_text_run' });
const evidence = (recognition, reconstructedLines) => ({ attachmentId: 'fixture', sessionId: 'fixture', mediaType: 'application/pdf', pages: [{ pageNumber: 1, blocks: recognition.map(block), lines: reconstructedLines.map((text, index) => block(text, index)) }] });

test('PDF layout reconstruction preserves runs and creates deterministic geometric reading order', () => {
  const content = { styles: { f1: { fontFamily: 'Fixture Sans' } }, items: [
    { str: 'Price', transform: [1, 0, 0, 10, 220, 680], width: 25, height: 10, fontName: 'f1' },
    { str: 'Position 1', transform: [1, 0, 0, 10, 40, 700], width: 48, height: 10, fontName: 'f1' },
    { str: '100.00', transform: [1, 0, 0, 10, 260, 680], width: 35, height: 10, fontName: 'f1' },
    { str: '1200 x 900', transform: [1, 0, 0, 10, 40, 680], width: 64, height: 10, fontName: 'f1' },
  ] };
  const page = reconstructPdfPageLayout(content, 1, { width: 595, height: 842 });
  assert.equal(page.runs.length, 4);
  assert.deepEqual(page.lines.map((line) => line.text), ['Position 1', '1200 x 900 Price 100.00']);
  assert.equal(page.lines.every((line) => line.boundingBox.width > 0 && line.boundingBox.height > 0), true);
  assert.equal(page.regions.length > 0, true);
});

test('supplier profiles consume one canonical evidence contract across structurally different PDF layouts', () => {
  const fixtures = [
    { recognition: ['Idealcombi', 'Quotation no.', 'Q-1', 'GBP/ Unit'], lines: ['1 2 Kitchen 1200 X 900 500,00 1.000,00'], adapter: 'idealcombi_position_table_v1', count: 1 },
    { recognition: ['Item Location No. Type Width Height Glazing', 'Price ea.', 'Price Total'], lines: ['1 Option Type A - [1] alu-clad fixed window 1200 900 Triple 0.8 £ [500.00] £ [500.00]'], adapter: 'norrsken_item_table_v2', count: 1, alternative: true },
    { recognition: ['VELFAC', 'Frame No: 4 Qty: 1'], lines: ['Frame No: 4 Qty: 1 VELFAC V200E Fixed Frame Location: W4 £725.00', '1200 x 900', 'U-Value 0.8'], adapter: 'frame_schedule_geometry_v1', count: 1 },
    { recognition: ['Westcoast Windows AB', 'Powered by CalWin'], lines: ['W-UFF (1200x900) 40 W4 Kitchen 1 no'], adapter: 'westcoast_position_schedule_v1', count: 1 },
    { recognition: ['21 Degrees', 'GB Quote Reference GB1', 'Price after discount'], lines: ['ITEM 1 - Kitchen Price after discount: £500.00', 'Supply & Deliver a complete new casement window (GBS78A Casement range) in Alu-clad', 'U-Value 0.8'], adapter: 'twenty_one_degrees_detail_v1', count: 1, incomplete: true },
  ];
  for (const fixture of fixtures) {
    const parsed = parsePdfSupplierFields(evidence(fixture.recognition, fixture.lines));
    assert.equal(parsed.adapter, fixture.adapter);
    assert.equal(parsed.rows.length, fixture.count);
    assert.equal(parsed.rows[0].sourceTrace.length > 0, true);
    assert.equal(parsed.rows[0].manufacturerEvidence.sourceVisual.originalAsset.mediaType, 'application/pdf');
    assert.equal(parsed.rows[0].manufacturerEvidence.sourceVisual.originalAsset.sourcePage, 1);
    if (fixture.alternative) {
      assert.equal(parsed.rows[0].classification, 'alternative');
      assert.notEqual(parsed.rows[0].alternativeTo, parsed.rows[0].displayReference);
    }
    if (fixture.incomplete) { assert.equal(parsed.rows[0].widthMm, null); assert.equal(parsed.rows[0].status, 'needs_review'); }
    else { assert.equal(parsed.rows[0].widthMm > 0, true); assert.equal(parsed.rows[0].heightMm > 0, true); }
  }
});

test('VELFAC frame rows keep duplicated prices out of the Position reference and crop to the owned drawing with dimensions', () => {
  const header = { ...block('Frame No: 2 Qty: 1 VELFAC V200E Guided Casement Location: W01 £1,015.50 £1,015.50', 0), boundingBox: { x: 28.2, y: 477.69, width: 536.032, height: 10 } };
  const dimensions = { ...block('1109 x 1600', 1), boundingBox: { x: 54.64, y: 362.27, width: 43.18, height: 8 } };
  const document = {
    attachmentId: 'adw-source', sourceSha256: 'a'.repeat(64), mediaType: 'application/pdf',
    pages: [{
      pageNumber: 1, width: 595, height: 841.89,
      blocks: [block('ADW Quotation', 0), block('VELFAC', 1), header, dimensions],
      lines: [header, dimensions],
      imageEvidence: [{ id: 'pdf-1-image-w01', pageNumber: 1, boundingBox: { x: 46.692, y: 369.973, width: 60.126, height: 85.498 } }],
    }],
  };
  const parsed = parsePdfSupplierFields(document), position = parsed.rows[0], visual = position.manufacturerEvidence.sourceVisual;
  assert.equal(parsed.adapter, 'frame_schedule_geometry_v1');
  assert.equal(position.displayReference, 'W01');
  assert.equal(position.unitPrice, '1015.50');
  assert.equal(position.totalPrice, '1015.50');
  assert.equal(visual.role, 'position_drawing');
  assert.equal(visual.mappingMethod, 'frame-schedule-position-drawing-v1');
  assert.equal(visual.mappingReviewStatus, 'mapped_automatic');
  assert.deepEqual(visual.originalAsset.sourceObjectIds, ['pdf-1-image-w01']);
  assert.ok(visual.boundingRegion.width < 100, 'The crop must exclude the adjacent specification and price columns.');
  assert.ok(visual.boundingRegion.height > 100, 'The crop must retain the drawing dimension annotations.');
});

test('Norrsken summary items resolve to their own detail-card drawing regions', () => {
  const summaryLines = ['5 Type D - 2 alu-clad tilt and turn window 2300 1000 Triple 0.84 £ 1,380.87 £ 2,761.74'];
  const detailLines = ['Item 5 – Type D -', 'Type: P34A tilt and turn inward opening window Width: 2300 Height: 1000', 'U-Values: Glass 0.5 Window: 0.84'];
  const document = {
    attachmentId: 'norrsken-source', sourceSha256: 'a'.repeat(64), mediaType: 'application/pdf',
    pages: [
      { pageNumber: 1, width: 595, height: 842, blocks: ['Item Location No. Type Width Height Glazing', 'Price ea.', 'Price Total'].map((text, index) => block(text, index, 1)), lines: summaryLines.map((text, index) => block(text, index, 1)) },
      { pageNumber: 5, width: 595, height: 842, blocks: detailLines.map((text, index) => ({ ...block(text, index, 5), boundingBox: { x: 57, y: index ? 740 - index * 15 : 771, width: 180, height: 11 } })), lines: detailLines.map((text, index) => ({ ...block(text, index, 5), boundingBox: { x: 57, y: index ? 740 - index * 15 : 771, width: 180, height: 11 } })) },
    ],
  };
  const parsed = parsePdfSupplierFields(document);
  const visual = parsed.rows[0].manufacturerEvidence.sourceVisual;
  assert.equal(parsed.rows[0].displayReference, 'Type D');
  assert.equal(visual.sourcePage, 5);
  assert.equal(visual.mappingMethod, 'norrsken_item_detail_drawing_v1');
  assert.equal(visual.mappingReviewStatus, 'mapped_automatic');
  assert.equal(visual.geometryEvidence.supplierItemNumber, '5');
  assert.ok(visual.boundingRegion.height >= 200, 'A shallow summary-row crop is not a position drawing.');
});

test('import diagnostics distinguish extraction, persistence and Products / Supply projection failures', () => {
  assert.equal(createSupplierImportDiagnostics({ textAvailable: false }).status, 'ocr_required');
  assert.equal(createSupplierImportDiagnostics({ textAvailable: true, parsedPositions: 0 }).status, 'no_positions_recognised');
  assert.equal(createSupplierImportDiagnostics({ textAvailable: true, parsedPositions: 2, validCanonicalPositions: 0 }).status, 'position_mapping_incomplete');
  assert.equal(createSupplierImportDiagnostics({ textAvailable: true, parsedPositions: 2, validCanonicalPositions: 2, persistedPositions: 1 }).status, 'persistence_incomplete');
  assert.equal(createSupplierImportDiagnostics({ textAvailable: true, parsedPositions: 2, validCanonicalPositions: 2, persistedPositions: 2, productsSupplyRows: 0 }).status, 'products_projection_incomplete');
  assert.equal(createSupplierImportDiagnostics({ textAvailable: true, parsedPositions: 3, validCanonicalPositions: 2, persistedPositions: 2, productsSupplyRows: 2, projectCostingRows: 2 }).status, 'extracted_with_position_review');
  assert.equal(createSupplierImportDiagnostics({ textAvailable: true, parsedPositions: 2, validCanonicalPositions: 2, persistedPositions: 2, productsSupplyRows: 2, projectCostingRows: 2 }).status, 'quotation_extracted_successfully');
});

test('a filed canonical supplier document opens one idempotent extraction review without changing Project Costing', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'qs-filed-review-'));
  const db = await open({ filename: path.join(root, 'test.sqlite'), driver: sqlite3.Database });
  t.after(async () => { await db.close(); await fs.rm(root, { recursive: true, force: true }); });
  await db.exec("PRAGMA foreign_keys=ON;CREATE TABLE clients(id TEXT PRIMARY KEY,client_ref TEXT,name TEXT,created_at TEXT,updated_at TEXT);CREATE TABLE estimates(id TEXT PRIMARY KEY,estimate_ref TEXT,client_id TEXT,status TEXT,positions_json TEXT,created_at TEXT,updated_at TEXT,deleted_at TEXT);INSERT INTO clients VALUES('client','EF-CL-928','Disposable Client',datetime('now'),datetime('now'));INSERT INTO estimates VALUES('estimate','EF-EST-2026-957','client','draft','[]',datetime('now'),datetime('now'),NULL);");
  await initializeSupplierCommercialSchema(db);
  const calculator = createProjectCalculatorLabService(db, { exchangeRateProvider: async () => ({ provider: 'fixture', quotedAt: new Date().toISOString(), rawRate: '1' }) });
  await calculator.saveSupplierCommercialDefault({ supplierCode: 'ZYLE', supplierName: 'Zyle Fenster', policy: { pricingMethod: 'parity_1_to_1', pricingBasis: 'parity_1_to_1', paidInQuotedCurrency: true, settlementCurrency: 'GBP' }, pricingDisplayPolicy: {} });
  const sourceRow = { ordinal: 0, displayReference: 'W1', originalReferenceText: 'W1', supplierReferenceTokens: ['W1'], quantity: 1, widthMm: 1200, heightMm: 900, unitPrice: '500.00', totalPrice: '500.00', currency: 'GBP', classification: 'standard', includedInSupplierTotal: true, alternativeTo: null, classificationEvidence: null, sourcePages: [1], sourceTrace: [{ pageNumber: 1, boundingBox: { x: 1, y: 1, width: 2, height: 2 } }], confidence: '0.96', warnings: [], status: 'extracted', manufacturerEvidence: { product: 'Window', productSystem: 'EcoTherm', sourceVisual: { status: 'unavailable' } } };
  const supplier = createSupplierQuotesService(db, { attachmentRoot: root, extractDocument: async () => ({ textAvailable: true, warnings: [], pages: [{ blocks: [block('Zyle Fenster quotation Q-957', 0)] }] }), parseFields: () => ({ adapter: 'fixture', recognizedSupplier: { code: 'ZYLE', name: 'Zyle Fenster' }, quotation: { fullQuotationReference: 'Q-957', quotationDate: '2026-09-11', currency: 'GBP' }, rows: [sourceRow], warnings: [] }), parseSummary: () => ({ summary: { productSubtotal: '500.00', additionalItemsSubtotal: null, deliveryTotal: null, vatTotal: null, finalSupplierTotal: '500.00', comparisonTotals: [] }, additionalItems: [], warnings: [] }) });
  const input = { canonicalDocumentId: 'canonical-document', estimateId: 'estimate', supplierCode: 'ZYLE', fileName: 'Zyle quotation.pdf', mediaType: 'application/pdf', bytes: Buffer.from('%PDF-1.4\nfixture') };
  const first = await supplier.stageCanonicalDocumentForReview(input);
  const repeated = await supplier.stageCanonicalDocumentForReview(input);
  assert.equal(first.duplicate, false);
  assert.equal(repeated.duplicate, true);
  assert.equal(repeated.documents[0].attachmentId, first.documents[0].attachmentId);
  assert.equal((await db.get("SELECT COUNT(*) count FROM supplier_quote_attachments WHERE source_canonical_document_id='canonical-document'")).count, 1);
  assert.equal((await db.get('SELECT COUNT(*) count FROM project_calculator_estimate_product_rows')).count, 0);
  assert.equal(first.review.documents.length, 1);
  await assert.rejects(()=>supplier.stageCanonicalDocumentForReview({...input,bytes:Buffer.from('%PDF-1.4\nrevised provider content')}),error=>error.status===409&&error.code==='canonical_document_content_changed');
  await assert.rejects(()=>supplier.stageCanonicalDocumentForReview({...input,bytes:Buffer.alloc(0)}),error=>error.code==='empty_file');
  await calculator.saveSupplierCommercialDefault({supplierCode:'OTHER',supplierName:'Other supplier',policy:{pricingMethod:'parity_1_to_1'},pricingDisplayPolicy:{}});
  await assert.rejects(()=>supplier.stageCanonicalDocumentForReview({...input,supplierCode:'OTHER'}),error=>error.code==='canonical_document_supplier_conflict');
  assert.equal((await db.get('SELECT COUNT(*) count FROM supplier_quote_attachments')).count,1);
  assert.deepEqual(await fs.readFile(path.join(root,(await db.get('SELECT storage_key FROM supplier_quote_attachments WHERE id=?',first.documents[0].attachmentId)).storage_key)),input.bytes);
  await db.run("UPDATE supplier_quote_attachments SET source_canonical_document_id=NULL WHERE id=?",first.documents[0].attachmentId);
  const priorUploadMatch=await supplier.stageCanonicalDocumentForReview({...input,canonicalDocumentId:'canonical-document-from-email'});
  assert.equal(priorUploadMatch.duplicate,true);assert.equal(priorUploadMatch.matchedBy,'content_sha256');assert.equal(priorUploadMatch.documents[0].attachmentId,first.documents[0].attachmentId);
  assert.equal((await db.get("SELECT COUNT(*) count FROM supplier_quotes")).count,1);assert.equal((await db.get("SELECT source_canonical_document_id FROM supplier_quote_attachments WHERE id=?",first.documents[0].attachmentId)).source_canonical_document_id,'canonical-document-from-email');
});

test('canonical supplier evidence persists into Products / Supply and Project Costing idempotently', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'qs-multiformat-'));
  const db = await open({ filename: path.join(root, 'test.sqlite'), driver: sqlite3.Database });
  t.after(async () => { await db.close(); await fs.rm(root, { recursive: true, force: true }); });
  await db.exec("PRAGMA foreign_keys=ON;CREATE TABLE clients(id TEXT PRIMARY KEY,client_ref TEXT,name TEXT,created_at TEXT,updated_at TEXT);CREATE TABLE estimates(id TEXT PRIMARY KEY,estimate_ref TEXT,client_id TEXT,status TEXT,positions_json TEXT,created_at TEXT,updated_at TEXT,deleted_at TEXT);INSERT INTO clients VALUES('client','EF-CL-001','Client',datetime('now'),datetime('now'));INSERT INTO estimates VALUES('estimate','EF-EST-2026-001','client','draft','[]',datetime('now'),datetime('now'),NULL);");
  await initializeSupplierCommercialSchema(db);
  const calculator = createProjectCalculatorLabService(db, { exchangeRateProvider: async () => ({ provider: 'fixture', quotedAt: new Date().toISOString(), rawRate: '1' }) });
  await calculator.saveSupplierCommercialDefault({ supplierCode: 'FIXTURE', supplierName: 'Fixture Supplier', policy: { pricingMethod: 'parity_1_to_1', pricingBasis: 'parity_1_to_1', paidInQuotedCurrency: true, settlementCurrency: 'GBP' }, pricingDisplayPolicy: {} });
  const scenario = await calculator.createScenario({ estimateId: 'estimate', origin: 'manual', name: 'Products / Supply', currency: 'GBP', packageCode: 'supply_only' });
  let system = 'System A';
  const sourceRow = () => ({ ordinal: 0, displayReference: 'W1', originalReferenceText: 'W1', supplierReferenceTokens: ['W1'], quantity: 1, widthMm: 1200, heightMm: 900, unitPrice: '500.00', totalPrice: '500.00', currency: 'GBP', classification: 'standard', includedInSupplierTotal: true, alternativeTo: null, classificationEvidence: null, sourcePages: [1], sourceTrace: [{ pageNumber: 1, boundingBox: { x: 1, y: 1, width: 2, height: 2 } }], confidence: '0.96', warnings: [], status: 'extracted', manufacturerEvidence: { product: 'Window', productSystem: system, areaSquareMetres: '1.08', customerSafeSpecification: [{ label: 'system', value: system }], sourceVisual: { status: 'unavailable' } }, originalExtractedSnapshot: { manufacturerEvidence: { product: 'Window', productSystem: system, areaSquareMetres: '1.08', customerSafeSpecification: [{ label: 'system', value: system }] } } });
  const supplier = createSupplierQuotesService(db, { attachmentRoot: root, extractDocument: async () => ({ textAvailable: true, warnings: [], pages: [{ blocks: [block('fixture', 0)] }] }), parseFields: () => ({ rows: [sourceRow()], warnings: [] }), parseSummary: () => ({ summary: { productSubtotal: '500.00', additionalItemsSubtotal: null, deliveryTotal: null, vatTotal: null, finalSupplierTotal: '500.00', comparisonTotals: [] }, additionalItems: [], warnings: [] }) });
  const quote = await supplier.createQuote('estimate', { supplierCode: 'FIXTURE', supplierName: 'Fixture Supplier' });
  const revision = await supplier.createRevision('estimate', quote.id, { supplierQuotationNumber: 'Q-1', currency: 'GBP' });
  await supplier.insertAttachments('estimate', quote.id, revision.id, [{ id: 'source', role: 'original_quote', documentKind: 'complete_quotation', originalFileName: 'fixture.pdf', mediaType: 'application/pdf', sizeBytes: 1, sha256: 'a'.repeat(64), storageKey: 'fixture.pdf', parserEligible: true, createdAt: new Date().toISOString() }]);
  const selected = [{ quoteId: quote.id, revisionId: revision.id, attachmentId: 'source' }];
  const first = await supplier.extractAndLoadSupplierCosts('estimate', scenario.id, selected, { commercialSupplierCode: 'FIXTURE' });
  assert.equal(first.documents[0].diagnostics.counts.productsSupplyRows, 1);
  assert.equal((await calculator.getScenario(scenario.id)).products[0].productClass, 'System A');
  assert.deepEqual(await db.get('SELECT product,product_system,original_specification_text FROM supplier_quote_positions'), { product: 'Window', product_system: 'System A', original_specification_text: 'system: System A\nproduct: Window' });
  system = 'System B';
  const repeated = await supplier.extractAndLoadSupplierCosts('estimate', scenario.id, selected, { commercialSupplierCode: 'FIXTURE' });
  assert.equal(repeated.documents[0].loadedProducts, 0);
  assert.equal((await calculator.getScenario(scenario.id)).products[0].productClass, 'System B');
  assert.equal((await db.get('SELECT product_system FROM supplier_quote_positions')).product_system, 'System B');
});
