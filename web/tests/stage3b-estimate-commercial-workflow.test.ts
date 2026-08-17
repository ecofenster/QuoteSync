import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { initializeSupplierCommercialSchema } from '../server/schema/supplierCommercialSchema.js';
import { createSupplierImportLabService } from '../server/features/supplierImportLab/supplierImportLabService.js';
import { createProjectCalculatorLabService } from '../server/features/projectCalculatorLab/projectCalculatorLabService.js';
import { createSupplierQuotesService } from '../server/features/supplierQuotes/supplierQuotesService.js';
import { chooseInitialPreviewEstimate } from '../src/features/admin/adminSupplierQuotePreview.utils.js';

async function setup() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'quotesync-stage3b-'));
  const db = await open({ filename: path.join(root, 'test.sqlite'), driver: sqlite3.Database });
  await db.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE clients (id TEXT PRIMARY KEY, client_ref TEXT, name TEXT, created_at TEXT, updated_at TEXT);
    CREATE TABLE estimates (id TEXT PRIMARY KEY, estimate_ref TEXT, client_id TEXT, status TEXT, positions_json TEXT, created_at TEXT, updated_at TEXT, deleted_at TEXT);`);
  await initializeSupplierCommercialSchema(db);
  await db.run(`INSERT INTO clients (id, client_ref, name, created_at, updated_at)
    VALUES ('client-a', 'TEST-CLIENT-A', 'Test client A', datetime('now'), datetime('now'))`);
  await db.run(`INSERT INTO estimates (id, estimate_ref, client_id, status, positions_json, created_at, updated_at)
    VALUES ('est-a', 'EF-EST-TEST-A', 'client-a', 'draft', '[]', datetime('now'), datetime('now'))`);
  await db.run(`INSERT INTO estimates (id, estimate_ref, client_id, status, positions_json, created_at, updated_at)
    VALUES ('est-b', 'EF-EST-TEST-B', 'client-a', 'draft', '[]', datetime('now'), datetime('now'))`);
  return { root, db };
}

test('an estimate owns multiple quotation assets in upload order while legacy sessions remain isolated', async () => {
  const { root, db } = await setup();
  try {
    const lab = createSupplierImportLabService(db);
    const first = await lab.createSession({ estimateId: 'est-a', supplierName: 'Supplier A', currency: 'EUR' });
    const second = await lab.createSession({ estimateId: 'est-a', supplierName: 'Supplier B', currency: 'EUR' });
    const legacy = await lab.createSession({ supplierName: 'Legacy supplier', currency: 'EUR' });

    assert.equal(first.estimateId, 'est-a');
    assert.equal(second.estimateId, 'est-a');
    assert.equal(legacy.estimateId, null);

    await lab.insertAttachments(first.id, [
      {
        id: 'attachment-a1', role: 'original_quote', originalFileName: 'schedule.pdf', mediaType: 'application/pdf',
        sizeBytes: 10, sha256: 'a'.repeat(64), storageKey: 'lab/a/a1.pdf', parserEligible: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'attachment-a2', role: 'supporting_document', originalFileName: 'cover.docx',
        mediaType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', sizeBytes: 20,
        sha256: 'b'.repeat(64), storageKey: 'lab/a/a2.docx', parserEligible: true,
        createdAt: new Date().toISOString(),
      },
    ]);

    const attachments = await lab.listAttachments(first.id);
    assert.deepEqual(attachments.map((item: any) => item.uploadOrder), [1, 2]);
    assert.deepEqual(attachments.map((item: any) => item.originalFileName), ['schedule.pdf', 'cover.docx']);

    const owned = await lab.listSessions({ estimateId: 'est-a' });
    assert.deepEqual(new Set(owned.map((item: any) => item.id)), new Set([first.id, second.id]));
    assert.equal(owned.some((item: any) => item.id === legacy.id), false);
  } finally {
    await db.close();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('calculator scenarios retain estimate and extraction provenance without mutating legacy records', async () => {
  const { root, db } = await setup();
  try {
    const lab = createSupplierImportLabService(db);
    const session = await lab.createSession({ estimateId: 'est-a', supplierName: 'Supplier A', currency: 'EUR' });
    const legacy = await lab.createSession({ supplierName: 'Legacy supplier', currency: 'EUR' });

    await db.run(`INSERT INTO supplier_import_lab_attachments
      (id, session_id, role, original_file_name, media_type, size_bytes, sha256, storage_key, parser_eligible, upload_order, created_at)
      VALUES ('att-a', ?, 'original_quote', 'quote.pdf', 'application/pdf', 10, ?, 'lab/a/quote.pdf', 1, 1, datetime('now'))`,
      [session.id, 'c'.repeat(64)]);
    await db.run(`INSERT INTO supplier_import_lab_extraction_runs
      (id, session_id, attachment_id, extractor_name, extractor_version, field_parser_name, field_parser_version,
       status, started_at, completed_at, warnings_json, created_at, selected)
      VALUES ('run-a', ?, 'att-a', 'test', '1', 'test', '1', 'completed', datetime('now'), datetime('now'), '[]', datetime('now'), 1)`,
      [session.id]);
    await db.run(`INSERT INTO supplier_import_lab_extracted_rows
      (id, session_id, extraction_run_id, attachment_id, ordinal, display_reference, original_reference_text,
       supplier_reference_tokens_json, quantity, width_mm, height_mm, original_dimensions_text, unit_price_amount,
       total_price_amount, currency, source_pages_json, source_trace_json, confidence, warnings_json, status,
       original_extracted_snapshot_json, selected_for_future_use, created_at)
      VALUES ('row-a', ?, 'run-a', 'att-a', 1, 'W7, W8', 'W7, W8', '["W7","W8"]', 2, 610, 1200,
       '610 x 1200 mm', '537.12', '1074.24', 'EUR', '[1]', '[]', 1, '[]', 'extracted', '{}', 1, datetime('now'))`,
      [session.id]);

    const calculator = createProjectCalculatorLabService(db);
    const scenario = await calculator.createScenario({
      estimateId: 'est-a', origin: 'supplier_import', importLabSessionId: session.id, extractionRunId: 'run-a',
      sourceAttachmentId: 'att-a', name: 'Estimate costing', packageCode: 'supply_only', installationOpeningCount: 0,
    });

    assert.equal(scenario.estimateId, 'est-a');
    assert.equal(scenario.estimateRef, null);
    assert.equal(scenario.importLabSessionId, session.id);
    assert.equal(scenario.extractionRunId, 'run-a');
    assert.equal(scenario.products.length, 1);
    assert.equal(scenario.products[0].displayReference, 'W7, W8');
    assert.equal(scenario.products[0].quantity, 2);

    const scoped = await calculator.listScenarios('est-a');
    assert.deepEqual(scoped.map((item: any) => item.id), [scenario.id]);
    assert.equal(await calculator.listScenarios('est-b').then((items: any[]) => items.length), 0);
    await assert.rejects(
      () => calculator.createScenario({ estimateId: 'est-b', origin: 'supplier_import', importLabSessionId: session.id,
        extractionRunId: 'run-a', sourceAttachmentId: 'att-a', name: 'Wrong estimate', packageCode: 'supply_only' }),
      (error: any) => error?.code === 'source_not_found',
    );

    const legacyAfter = await lab.getSession(legacy.id);
    assert.equal(legacyAfter.estimateId, null);
  } finally {
    await db.close();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('estimate commercial preview defaults to Project Costing with canonical import and B92 entry points', async () => {
  const workspace = await fs.readFile(path.join(process.cwd(), 'src/features/estimateCommercial/EstimateCommercialWorkspace.tsx'), 'utf8');
  const documents = await fs.readFile(path.join(process.cwd(), 'src/features/estimateCommercial/EstimateSupplierDocuments.tsx'), 'utf8');
  const calculator = await fs.readFile(path.join(process.cwd(), 'src/features/projectCalculatorLab/ProjectCalculatorLabWorkspace.tsx'), 'utf8');
  const supplierRoutes = await fs.readFile(path.join(process.cwd(), 'server/routes/supplierQuotes.js'), 'utf8');
  const importControl = await fs.readFile(path.join(process.cwd(), 'src/features/estimateCommercial/EstimateSupplierCostImportControl.tsx'), 'utf8');
  const admin = await fs.readFile(path.join(process.cwd(), 'src/features/admin/AdminSupplierQuoteImportBeta.tsx'), 'utf8');
  const app = await fs.readFile(path.join(process.cwd(), 'src/App.tsx'), 'utf8');

  assert.match(workspace, /useState<CommercialTab>\("costing"\)/);
  assert.match(workspace, /Project Costing/);
  assert.match(workspace, /Import Manufacturer Quote/);
  assert.match(await fs.readFile(path.join(process.cwd(), 'src/features/projectCalculatorLab/ScenarioCostingWorksheet.tsx'), 'utf8'), /Add Position/);
  for (const removed of ['Extraction Review', 'Estimate Summary', 'How is this estimate being priced?']) assert.doesNotMatch(workspace, new RegExp(removed));
  assert.match(documents, /multiple/);
  assert.match(documents, /No extraction or automatic Project Costing import occurs here/);
  for (const heading of ['Supplier', 'Filename', 'Upload date', 'Quotation / reference', 'Revision']) assert.match(documents, new RegExp(heading));
  assert.match(documents, /Filter by supplier/);
  assert.match(documents, /Filter by upload date/);
  assert.doesNotMatch(documents, /Extract Selected Quotes|extractSelected/);
  assert.match(importControl, /Import selected manufacturer quote/);
  assert.match(importControl, /extractAndLoad/);
  assert.match(supplierRoutes, /extract-and-load/);
  assert.match(supplierRoutes, /ensureSupplierRevisionExchangeRates\(scenarioId,result\.documents\.map\(item=>item\.revisionId\)\)/);
  assert.match(calculator, /estimateId \? "estimate" : "supplier_import"/);
  assert.match(calculator, /syncEstimatePositions/);
  assert.match(calculator, /ensureEstimateCosting/);
  assert.match(calculator, /origin:"estimate",name:`\$\{estimateRef\|\|"Estimate"\} Project Costing`,packageType:"supply_only"/);
  assert.match(calculator, /!estimateId\?<div className="calculator-lab__tabs"/);
  assert.match(app, /<EstimateCommercialWorkspace/);
  assert.doesNotMatch(admin, /Supplier Quotations &amp; Project Costing \(Preview\)|Temporary development entry/);
  assert.match(admin, /<EstimateCommercialWorkspace/);
  assert.doesNotMatch(admin, />Create disposable development estimate/);
  assert.doesNotMatch(admin, /<ProjectCalculatorLabWorkspace/);
  assert.doesNotMatch(admin, /<SupplierImportLabWorkspace/);
});

test('temporary Admin access selects an existing estimate without fabricating standalone ownership', () => {
  const estimates = [
    { id: 'est-a', client_id: 'client-a', estimate_ref: 'EF-EST-A' },
    { id: 'est-b', client_id: 'client-a', estimate_ref: 'EF-EST-B' },
  ];
  assert.equal(chooseInitialPreviewEstimate(estimates), 'est-a');
  assert.equal(chooseInitialPreviewEstimate(estimates, 'est-b'), 'est-b');
  assert.equal(chooseInitialPreviewEstimate([], 'legacy-scenario'), '');
});

test('estimate documents load into the active costing once with immutable provenance and preserve manual rows', async () => {
  const { root, db } = await setup();
  try {
    const calculator = createProjectCalculatorLabService(db, { exchangeRateProvider: async () => ({ provider: 'test', quotedAt: '2026-08-06T00:00:00.000Z', rawRate: '0.875' }) });
    const scenario = await calculator.createScenario({ estimateId: 'est-a', origin: 'manual', name: 'Active costing', currency: 'EUR', packageCode: 'supply_only' });
    await calculator.addManualProduct(scenario.id, { reference: 'MANUAL-1', productClass: 'Other', widthMm: 500, heightMm: 500, quantity: 1, installationOpeningCount: 1, unitSupplyCost: '10.00', totalSupplyCost: '10.00', currency: 'EUR' });
    const extractedRow = { ordinal: 0, displayReference: 'W7, W8', originalReferenceText: 'W7, W8', supplierReferenceTokens: ['W7', 'W8'], quantity: 2, widthMm: 610, heightMm: 1200, originalDimensionsText: '610x1200mm', unitPrice: '537.12', totalPrice: '1074.24', currency: 'EUR', sourcePages: [1], sourceTrace: [{ attachmentId: 'doc-1', blockId: 'block-1' }], warnings: [], status: 'extracted', originalExtractedSnapshot: {} };
    const additional = { ordinal: 0, category: 'delivery', originalDescription: 'Delivery', normalizedLabel: null, quantity: null, unitPrice: null, totalPrice: '2200.00', currency: 'EUR', sourceTrace: [{ attachmentId: 'doc-1', blockId: 'delivery-1' }], warnings: [], originalExtractedSnapshot: {} };
    const supplier = createSupplierQuotesService(db, { attachmentRoot: root, extractDocument: async () => ({ textAvailable: true, warnings: [] }), parseFields: () => ({ rows: [extractedRow], warnings: [] }), parseSummary: () => ({ summary: { productSubtotal: '1074.24', additionalItemsSubtotal: null, deliveryTotal: '2200.00', vatTotal: null, finalSupplierTotal: '3274.24' }, additionalItems: [additional], warnings: [] }) });
    const quote = await supplier.createQuote('est-a', { supplierCode: 'TEST', supplierName: 'Test Supplier' });
    const revision = await supplier.createRevision('est-a', quote.id, { supplierQuotationNumber: 'Q-1', supplierRevision: '3', currency: 'EUR' });
    await supplier.insertAttachments('est-a', quote.id, revision.id, [{ id: 'doc-1', role: 'original_quote', originalFileName: 'quote.docx', mediaType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', sizeBytes: 10, sha256: 'd'.repeat(64), storageKey: 'estimates/est-a/doc-1', parserEligible: true, createdAt: new Date().toISOString() }]);
    const request = [{ quoteId: quote.id, revisionId: revision.id, attachmentId: 'doc-1' }];
    const first = await supplier.extractAndLoadSupplierCosts('est-a', scenario.id, request);
    const second = await supplier.extractAndLoadSupplierCosts('est-a', scenario.id, request);
    assert.equal(first.documents[0].loadedProducts, 1); assert.equal(first.documents[0].loadedCosts, 1);
    assert.equal(second.documents[0].loadedProducts, 0); assert.equal(second.documents[0].loadedCosts, 0);
    const loaded = await calculator.getScenario(scenario.id);
    assert.equal(loaded.products.length, 2); assert.equal(loaded.products.filter((row: any) => row.displayReference === 'W7, W8').length, 1);
    assert.equal(loaded.products.find((row: any) => row.displayReference === 'W7, W8').quantity, 2);
    assert.equal(loaded.products.some((row: any) => row.displayReference === 'MANUAL-1' && row.evidenceOrigin === 'manual'), true);
    const source = loaded.products.find((row: any) => row.displayReference === 'W7, W8').sourceSnapshot;
    assert.equal(source.supplierName, 'Test Supplier'); assert.equal(source.attachmentId, 'doc-1'); assert.equal(source.supplierRevision, '3'); assert.ok(source.extractionRunId);
    assert.equal(loaded.supplierCosts[0].category, 'delivery'); assert.equal(loaded.supplierCosts[0].currency, 'EUR');
  } finally { await db.close(); await fs.rm(root, { recursive: true, force: true }); }
});

test('selected estimate-owned supplier documents create queued extraction runs only on submission', async () => {
  const { root, db } = await setup();
  try {
    const service = createSupplierQuotesService(db);
    const quote = await service.createQuote('est-a', { supplierCode: 'TEST', supplierName: 'Test Supplier' });
    const revision = await service.createRevision('est-a', quote.id, { supplierQuotationNumber: 'Q-1', supplierRevision: '2', currency: 'GBP' });
    const now = new Date().toISOString();
    await service.insertAttachments('est-a', quote.id, revision.id, [
      { id: 'doc-1', role: 'original_quote', originalFileName: 'one.pdf', mediaType: 'application/pdf', sizeBytes: 10, sha256: 'd'.repeat(64), storageKey: 'estimates/est-a/doc-1', parserEligible: true, createdAt: now },
      { id: 'doc-2', role: 'original_quote', originalFileName: 'two.pdf', mediaType: 'application/pdf', sizeBytes: 10, sha256: 'e'.repeat(64), storageKey: 'estimates/est-a/doc-2', parserEligible: true, createdAt: now },
    ]);
    assert.equal((await db.get('SELECT COUNT(*) count FROM supplier_quote_import_runs')).count, 0);
    const runs = await service.createImportRuns('est-a', [
      { quoteId: quote.id, revisionId: revision.id, attachmentId: 'doc-1' },
      { quoteId: quote.id, revisionId: revision.id, attachmentId: 'doc-2' },
    ]);
    assert.equal(runs.length, 1);
    assert.equal(runs[0].status, 'queued');
    assert.deepEqual(runs[0].attachmentIds, ['doc-1', 'doc-2']);
    assert.equal((await db.get('SELECT COUNT(*) count FROM supplier_quote_import_run_attachments')).count, 2);
  } finally { await db.close(); await fs.rm(root, { recursive: true, force: true }); }
});

test('supplier quotation revisions retain history and expose one latest revision per supplier quote', async () => {
  const { root, db } = await setup();
  try {
    const service=createSupplierQuotesService(db); const quote=await service.createQuote('est-a',{supplierCode:'ZYLE',supplierName:'Zyle Fenster'});
    const first=await service.createRevision('est-a',quote.id,{supplierQuotationNumber:'343117',supplierRevision:'1',currency:'EUR'}); const second=await service.createRevision('est-a',quote.id,{supplierQuotationNumber:'343117',supplierRevision:'2',currency:'EUR'});
    const revisions=await service.listRevisions('est-a',quote.id); assert.equal(revisions.length,2); assert.equal(revisions.find((item:any)=>item.id===first.id).lifecycleStatus,'superseded'); assert.equal(revisions.find((item:any)=>item.id===first.id).supersededByRevisionId,second.id); assert.equal(revisions.find((item:any)=>item.id===first.id).isLatest,false); assert.equal(revisions.find((item:any)=>item.id===second.id).isLatest,true);
  } finally { await db.close(); await fs.rm(root,{recursive:true,force:true}); }
});

test('multi-document schedules and quotation totals form one revision run without invented prices', async () => {
  const { root, db } = await setup();
  try {
    const calculator=createProjectCalculatorLabService(db,{exchangeRateProvider:async()=>({provider:'test',quotedAt:'2026-08-08T00:00:00.000Z',rawRate:'0.86'})});
    const scenario=await calculator.createScenario({estimateId:'est-a',origin:'manual',name:'Aggregated costing',currency:'EUR',packageCode:'supply_only'});
    const row={ordinal:0,displayReference:'W7, W8',originalReferenceText:'W7, W8',supplierReferenceTokens:['W7','W8'],quantity:2,widthMm:610,heightMm:1200,unitPrice:null,totalPrice:null,currency:'EUR',sourcePages:[1],sourceTrace:[],warnings:[],status:'extracted',originalExtractedSnapshot:{}};
    const service=createSupplierQuotesService(db,{attachmentRoot:root,extractDocument:async(_path,metadata)=>({textAvailable:true,warnings:[],documentId:metadata.id}),parseFields:(document:any)=>({rows:document.documentId==='schedule'?[row]:[],warnings:[]}),parseSummary:(document:any)=>({summary:document.documentId==='letter'?{productSubtotal:null,additionalItemsSubtotal:null,deliveryTotal:null,vatTotal:null,finalSupplierTotal:'18250.00'}:null,additionalItems:document.documentId==='installation'?[{ordinal:0,category:'other',originalDescription:'Installation pricing',normalizedLabel:'Installation pricing',quantity:null,unitPrice:null,totalPrice:'1200.00',currency:'EUR',sourceTrace:[],warnings:[],originalExtractedSnapshot:{}}]:[],warnings:[]})});
    const quote=await service.createQuote('est-a',{supplierCode:'GLASS',supplierName:'Glassworx'}); const revision=await service.createRevision('est-a',quote.id,{supplierQuotationNumber:'GW-10',supplierRevision:'2',currency:'EUR'});
    await service.insertAttachments('est-a',quote.id,revision.id,[
      {id:'schedule',role:'original_quote',documentKind:'window_schedule',originalFileName:'schedule.pdf',mediaType:'application/pdf',sizeBytes:1,sha256:'a'.repeat(64),storageKey:'schedule',parserEligible:true,createdAt:new Date().toISOString()},
      {id:'letter',role:'supporting_document',documentKind:'quotation_letter',originalFileName:'letter.pdf',mediaType:'application/pdf',sizeBytes:1,sha256:'b'.repeat(64),storageKey:'letter',parserEligible:true,createdAt:new Date().toISOString()},
      {id:'installation',role:'supporting_document',documentKind:'installation_pricing',originalFileName:'installation.pdf',mediaType:'application/pdf',sizeBytes:1,sha256:'c'.repeat(64),storageKey:'installation',parserEligible:true,createdAt:new Date().toISOString()},
    ]);
    const request=['schedule','letter','installation'].map(attachmentId=>({quoteId:quote.id,revisionId:revision.id,attachmentId})); const first=await service.extractAndLoadSupplierCosts('est-a',scenario.id,request); const second=await service.extractAndLoadSupplierCosts('est-a',scenario.id,request);
    assert.equal(first.documents.length,1); assert.deepEqual(first.documents[0].attachmentIds,['schedule','letter','installation']); assert.equal(first.documents[0].loadedProducts,1); assert.equal(first.documents[0].loadedCosts,1); assert.equal(second.documents[0].loadedProducts,0); assert.equal(second.documents[0].loadedCosts,0);
    const costing=await calculator.getScenario(scenario.id); const imported=costing.products.find((item:any)=>item.displayReference==='W7, W8'); assert.equal(imported.quantity,2); assert.equal(imported.totalPrice,null); assert.equal(imported.sourceSnapshot.sourceDocuments.length,1); assert.equal(costing.supplierSummary.finalSupplierTotal,'18250.00');
    const runAttachments=await db.get('SELECT COUNT(*) count FROM supplier_quote_import_run_attachments WHERE import_run_id=?',first.documents[0].runId); assert.equal(runAttachments.count,3);
  } finally { await db.close(); await fs.rm(root,{recursive:true,force:true}); }
});
