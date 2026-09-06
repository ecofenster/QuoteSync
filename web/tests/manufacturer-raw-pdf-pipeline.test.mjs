import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import express from 'express';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { createSupplierQuotesRouter } from '../server/routes/supplierQuotes.js';
import { createManufacturerPositionVisualsRouter } from '../server/routes/manufacturerPositionVisuals.js';
import { initializeSupplierCommercialSchema } from '../server/schema/supplierCommercialSchema.js';

const sources = path.resolve('docs/Supplier_Quotes');

async function setup(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'qs-raw-pdf-pipeline-'));
  const db = await open({ filename: path.join(root, 'pipeline.sqlite'), driver: sqlite3.Database });
  await db.exec("PRAGMA foreign_keys=ON;CREATE TABLE clients(id TEXT PRIMARY KEY,client_ref TEXT,name TEXT,created_at TEXT,updated_at TEXT);CREATE TABLE estimates(id TEXT PRIMARY KEY,estimate_ref TEXT,client_id TEXT,status TEXT,positions_json TEXT,created_at TEXT,updated_at TEXT,deleted_at TEXT);INSERT INTO clients VALUES('client','EF-CL-RAW','Raw PDF',datetime('now'),datetime('now'));INSERT INTO estimates VALUES('estimate','EF-EST-RAW','client','draft','[]',datetime('now'),datetime('now'),NULL);");
  await initializeSupplierCommercialSchema(db);
  await db.exec("CREATE TABLE IF NOT EXISTS configurator_manufacturers(id TEXT PRIMARY KEY,name TEXT NOT NULL,code TEXT NOT NULL,notes TEXT NOT NULL DEFAULT '',is_active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);INSERT INTO configurator_manufacturers(id,name,code,is_active) VALUES('manufacturer-eko','EKO-OKNA','EKO',1),('manufacturer-internorm','Internorm','IN',1),('manufacturer-aluplast','Aluplast','ALU',1),('manufacturer-zyle','Zyle Fenster','ZF',1),('manufacturer-gutmann','Gutmann','GUT',1),('manufacturer-reynaers','Reynaers','REY',1),('manufacturer-rationel','Rationel','RAT',1),('manufacturer-velfac','VELFAC','VEL',1);");
  const now = new Date().toISOString();
  for (const [code, name] of [['EKO', 'EKO-OKNA'], ['ECOHAUS', 'EcoHaus'], ['ZF', 'Zyle Fenster'], ['ECOF', 'Ecofenster'], ['ASPECT', 'Aspect Aluminium'], ['FRAME', 'Frame Windows and Doors']]) await db.run('INSERT INTO supplier_commercial_defaults(supplier_code,supplier_name,policy_json,pricing_display_policy_json,updated_at,active) VALUES(?,?,?,?,?,1)', code, name, JSON.stringify({ pricingMethod: 'factory_price', pricingBasis: 'factory_price' }), '{}', now);

  const app = express();
  const attachmentRoot = path.join(root, 'attachments');
  app.use(express.json());
  app.use('/api/estimates', await createSupplierQuotesRouter({ dbPromise: Promise.resolve(db), attachmentRoot, exchangeRateProvider: async () => ({ rawRate: '1', provider: 'test', quotedAt: now }) }));
  app.use('/api/manufacturer-position-visuals', createManufacturerPositionVisualsRouter({ attachmentRoot }));
  app.use((error, _request, response, _next) => response.status(500).json({ code: error.code ?? 'test_error', error: error.message }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await db.close();
    await fs.rm(root, { recursive: true, force: true });
  });
  return { db, baseUrl: `http://127.0.0.1:${address.port}/api/estimates/estimate/supplier-quotes`, origin: `http://127.0.0.1:${address.port}` };
}

async function json(response) {
  const body = await response.json();
  assert.equal(response.ok, true, `${response.status}: ${JSON.stringify(body)}`);
  return body;
}

async function uploadAndAnalyse(baseUrl, filename) {
  const source = await fs.readFile(path.join(sources, filename));
  const mediaType = filename.toLowerCase().endsWith('.docx') ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/pdf';
  const identity = filename.replace(/[^a-z0-9]/gi, '-').slice(0, 30);
  const quote = await json(await fetch(baseUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ supplierCode: `AUTO-${identity}`, supplierName: 'Automatic identification pending' }) }));
  const revision = await json(await fetch(`${baseUrl}/${quote.id}/revisions`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ supplierQuotationNumber: '', supplierRevision: '', fullQuotationReference: `Analysis pending · ${filename}`, currency: 'XXX', vatStatus: 'unknown' }) }));
  const form = new FormData();
  form.append('files', new Blob([source], { type: mediaType }), filename);
  form.append('role', 'original_quote');
  form.append('documentKind', 'complete_quotation');
  const uploaded = await json(await fetch(`${baseUrl}/${quote.id}/revisions/${revision.id}/attachments`, { method: 'POST', body: form }));
  assert.equal(uploaded.attachments.length, 1);
  const attachment = uploaded.attachments[0];
  const retrieved = Buffer.from(await (await fetch(`${baseUrl}/${quote.id}/revisions/${revision.id}/attachments/${attachment.id}/download`)).arrayBuffer());
  assert.equal(createHash('sha256').update(retrieved).digest('hex'), createHash('sha256').update(source).digest('hex'));
  const documents = [{ quoteId: quote.id, revisionId: revision.id, attachmentId: attachment.id }];
  const review = await json(await fetch(`${baseUrl}/prepare-review`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ documents }) }));
  return { review, quote, revision, attachment };
}

test('raw multipart PDFs and the established Zyle source survive storage, retrieval, parsing, identity separation and API projection', async (t) => {
  const { db, baseUrl, origin } = await setup(t);

  const johnSource = await fs.readFile(path.join(sources, 'John_Wingfield/web-26-1133450.pdf'));
  const johnCorpusCopy = await fs.readFile(path.join(sources, 'Eko_Example/web-26-1133450.pdf'));
  assert.equal(johnSource.length, 239162);
  assert.equal(createHash('sha256').update(johnSource).digest('hex'), 'd1f34d3fd36ef40e4fb1b3ccbddc96b96837fdfd86f598af9c2b189f674f1899');
  assert.equal(createHash('sha256').update(johnCorpusCopy).digest('hex'), createHash('sha256').update(johnSource).digest('hex'));

  const eko = (await uploadAndAnalyse(baseUrl, 'Eko_Example/Kosztorys - OF_25_2263569.pdf')).review;
  assert.deepEqual({ adapter: eko.documents[0].adapter, manufacturer: eko.metadata.recognizedManufacturerName, dealer: eko.metadata.recognizedDealerName, manufacturerId: eko.metadata.manufacturerId, supplierCode: eko.metadata.supplierCode, reference: eko.metadata.quotationNumber, date: eko.metadata.quotationDate, currency: eko.metadata.currency, positions: eko.positionCount, subtotal: eko.metadata.supplierQuotedSubtotal, total: eko.metadata.supplierQuotedTotal, relationship: eko.metadata.supplierManufacturerRelationship.relationship }, { adapter: 'eko_okna_winpro_v1', manufacturer: 'EKO-OKNA', dealer: 'EKO-OKNA', manufacturerId: 'manufacturer-eko', supplierCode: 'EKO', reference: 'OF/25/2263569', date: '2025-11-18', currency: 'GBP', positions: 12, subtotal: '5989.85', total: '5989.85', relationship: 'direct_manufacturer_supplier' });

  const john = (await uploadAndAnalyse(baseUrl, 'John_Wingfield/web-26-1133450.pdf')).review;
  assert.deepEqual({ adapter: john.documents[0].adapter, manufacturer: john.metadata.recognizedManufacturerName, dealer: john.metadata.recognizedDealerName, commercialSupplier: john.metadata.recognizedCommercialSupplierName, commercialSupplierCode: john.metadata.commercialSupplierCode, commercialSupplierAuthority: john.metadata.commercialSupplierProposalAuthority, manufacturerId: john.metadata.manufacturerId, reference: john.metadata.quotationNumber, date: john.metadata.quotationDate, currency: john.metadata.currency, positions: john.positionCount, subtotal: john.metadata.supplierQuotedSubtotal, total: john.metadata.supplierQuotedTotal, relationship: john.metadata.supplierManufacturerRelationship.relationship }, { adapter: 'eko_okna_web_itemised_v1', manufacturer: 'EKO-OKNA', dealer: 'Ecofenster', commercialSupplier: 'EKO-OKNA', commercialSupplierCode: 'EKO', commercialSupplierAuthority: 'eko_web_document_family_direct_supply', manufacturerId: 'manufacturer-eko', reference: 'WEB/26/1133450', date: '2026-09-03', currency: 'EUR', positions: 5, subtotal: '7885.45', total: '7885.45', relationship: 'direct_manufacturer_supplier' });
  assert.equal(john.metadata.commercialSupplierProposalSource, 'document_family');
  assert.deepEqual(john.documents[0].rows.map((row) => [row.customerReference, row.widthMm, row.heightMm, row.totalPrice]), [['001', 2360, 1180, '1561.35'], ['002', 2410, 2270, '2299.82'], ['003', 2410, 2270, '2299.82'], ['004', 985, 2115, '1185.90'], ['005', 1225, 1230, '538.56']]);
  assert.deepEqual(john.documents[0].rows.map((row) => [row.manufacturerName, row.productSystem, row.sourceVisual.status, row.sourceVisual.role, row.sourceVisual.sourcePage, row.sourceVisual.mappingMethod]), [1, 3, 4, 5, 6].map((page) => ['EKO-OKNA', 'Reynaers MASTER LINE 8, system with thermal break', 'available', 'inside', page, 'eko-web-inside-position-region-v1']));
  assert.equal(new Set(john.documents[0].rows.map((row) => row.sourceVisual.url)).size, 5);
  for (const row of john.documents[0].rows) {
    const preview = await fetch(`${origin}${row.sourceVisual.url}`);
    assert.equal(preview.ok, true, `${row.customerReference} preview was not retrievable`);
    assert.equal(preview.headers.get('content-type'), 'image/png');
    assert.ok((await preview.arrayBuffer()).byteLength > 10_000, `${row.customerReference} preview is empty`);
  }

  const johnCorpusReview = (await uploadAndAnalyse(baseUrl, 'Eko_Example/web-26-1133450.pdf')).review;
  assert.deepEqual({ adapter: johnCorpusReview.documents[0].adapter, manufacturer: johnCorpusReview.metadata.recognizedManufacturerName, dealer: johnCorpusReview.metadata.recognizedDealerName, positions: johnCorpusReview.positionCount, previews: johnCorpusReview.documents[0].rows.filter((row) => row.sourceVisual.status === 'available').length, subtotal: johnCorpusReview.metadata.supplierQuotedSubtotal, total: johnCorpusReview.metadata.supplierQuotedTotal }, { adapter: 'eko_okna_web_itemised_v1', manufacturer: 'EKO-OKNA', dealer: 'Ecofenster', positions: 5, previews: 5, subtotal: '7885.45', total: '7885.45' });

  const gutmann = (await uploadAndAnalyse(baseUrl, 'Eko_Example/web-25-1064272 - Gutmann Mira - 7th August 2025.pdf')).review;
  assert.deepEqual({ adapter: gutmann.documents[0].adapter, manufacturer: gutmann.metadata.recognizedManufacturerName, dealer: gutmann.metadata.recognizedDealerName, manufacturerId: gutmann.metadata.manufacturerId, supplierCode: gutmann.metadata.supplierCode, positions: gutmann.positionCount, subtotal: gutmann.metadata.supplierQuotedSubtotal, total: gutmann.metadata.supplierQuotedTotal, relationship: gutmann.metadata.supplierManufacturerRelationship.relationship }, { adapter: 'gutmann_web_v1', manufacturer: 'Gutmann', dealer: 'Ecofenster', manufacturerId: 'manufacturer-gutmann', supplierCode: 'ECOF', positions: 25, subtotal: '51973.42', total: '51973.42', relationship: 'dealer_supplies_manufacturer_products' });

  const internorm = (await uploadAndAnalyse(baseUrl, 'Competitor_Quotes_-_ Nick_Corlett_Examples/Internorm-Ecohaus.pdf')).review;
  assert.deepEqual({ manufacturer: internorm.metadata.recognizedManufacturerName, dealer: internorm.metadata.recognizedDealerName, commercialSupplier: internorm.metadata.recognizedCommercialSupplierName, commercialSupplierCode: internorm.metadata.commercialSupplierCode, manufacturerId: internorm.metadata.manufacturerId, positions: internorm.positionCount, relationship: internorm.metadata.supplierManufacturerRelationship.relationship }, { manufacturer: 'Internorm', dealer: 'EcoHaus', commercialSupplier: 'EcoHaus', commercialSupplierCode: 'ECOHAUS', manufacturerId: 'manufacturer-internorm', positions: 16, relationship: 'dealer_supplies_manufacturer_products' });
  assert.equal(internorm.metadata.commercialSupplierProposalSource, 'document_family');

  const internormAspect = (await uploadAndAnalyse(baseUrl, 'Competitor_Quotes_-_ Nick_Corlett_Examples/Internorm-Aspect.pdf')).review;
  assert.deepEqual({ manufacturer: internormAspect.metadata.recognizedManufacturerName, dealer: internormAspect.metadata.recognizedDealerName, dealerStatus: internormAspect.metadata.dealerResolutionStatus, manufacturerId: internormAspect.metadata.manufacturerId, supplierCode: internormAspect.metadata.supplierCode, positions: internormAspect.positionCount, relationship: internormAspect.metadata.supplierManufacturerRelationship.relationship }, { manufacturer: 'Internorm', dealer: 'Aspect Aluminium', dealerStatus: 'resolved', manufacturerId: 'manufacturer-internorm', supplierCode: 'ASPECT', positions: 35, relationship: 'dealer_supplies_manufacturer_products' });
  assert.deepEqual([internormAspect.metadata.recognizedCommercialSupplierName, internormAspect.metadata.commercialSupplierCode, internormAspect.metadata.commercialSupplierProposalSource], ['Aspect Aluminium', 'ASPECT', 'document_family']);

  const rationelAspect = (await uploadAndAnalyse(baseUrl, 'Competitor_Quotes_-_ Nick_Corlett_Examples/Rationel-Aspect.pdf')).review;
  assert.deepEqual({ manufacturer: rationelAspect.metadata.recognizedManufacturerName, dealer: rationelAspect.metadata.recognizedDealerName, manufacturerId: rationelAspect.metadata.manufacturerId, supplierCode: rationelAspect.metadata.supplierCode, reference: rationelAspect.metadata.quotationNumber, date: rationelAspect.metadata.quotationDate, positions: rationelAspect.positionCount, relationship: rationelAspect.metadata.supplierManufacturerRelationship.relationship, system: rationelAspect.documents[0].rows[0].productSystem }, { manufacturer: 'Rationel', dealer: 'Aspect Aluminium', manufacturerId: 'manufacturer-rationel', supplierCode: 'ASPECT', reference: 'Q000242', date: '2024-12-12', positions: 36, relationship: 'dealer_supplies_manufacturer_products', system: 'Rationel Auraplus' });

  const velfacFrame = (await uploadAndAnalyse(baseUrl, 'Competitor_Quotes_-_ Nick_Corlett_Examples/Velfac-Frame.pdf')).review;
  assert.deepEqual({ manufacturer: velfacFrame.metadata.recognizedManufacturerName, dealer: velfacFrame.metadata.recognizedDealerName, manufacturerId: velfacFrame.metadata.manufacturerId, supplierCode: velfacFrame.metadata.supplierCode, reference: velfacFrame.metadata.quotationNumber, date: velfacFrame.metadata.quotationDate, positions: velfacFrame.positionCount, relationship: velfacFrame.metadata.supplierManufacturerRelationship.relationship, system: velfacFrame.documents[0].rows[0].productSystem }, { manufacturer: 'VELFAC', dealer: 'Frame Windows and Doors', manufacturerId: 'manufacturer-velfac', supplierCode: 'FRAME', reference: 'Q000226', date: '2024-12-02', positions: 39, relationship: 'dealer_supplies_manufacturer_products', system: 'VELFAC V200E' });

  const zyle = (await uploadAndAnalyse(baseUrl, '343117-3_EF-EST-2026-004 - Luke.docx')).review;
  assert.deepEqual({ manufacturer: zyle.metadata.recognizedManufacturerName, dealer: zyle.metadata.recognizedDealerName, dealerStatus: zyle.metadata.dealerResolutionStatus, manufacturerStatus: zyle.metadata.manufacturerResolutionStatus, manufacturerId: zyle.metadata.manufacturerId, supplierCode: zyle.metadata.supplierCode, positions: zyle.positionCount }, { manufacturer: null, dealer: null, dealerStatus: 'not_supplied', manufacturerStatus: 'not_recognized', manufacturerId: null, supplierCode: null, positions: 21 });

  await db.run('INSERT INTO supplier_commercial_defaults(supplier_code,supplier_name,policy_json,pricing_display_policy_json,updated_at,active) VALUES(?,?,?,?,?,1)', 'ALU', 'Aluplast', JSON.stringify({ pricingMethod: 'factory_price', pricingBasis: 'factory_price' }), '{}', new Date().toISOString());
  const manufacturerOnly = (await uploadAndAnalyse(baseUrl, 'EkoOkna - Import Test.pdf')).review;
  assert.deepEqual({ adapter: manufacturerOnly.documents[0].adapter, manufacturer: manufacturerOnly.metadata.recognizedManufacturerName, dealer: manufacturerOnly.metadata.recognizedDealerName, dealerStatus: manufacturerOnly.metadata.dealerResolutionStatus, commercialSupplier: manufacturerOnly.metadata.recognizedCommercialSupplierName, commercialSupplierCode: manufacturerOnly.metadata.commercialSupplierCode, commercialSupplierSource: manufacturerOnly.metadata.commercialSupplierProposalSource, manufacturerId: manufacturerOnly.metadata.manufacturerId, reference: manufacturerOnly.metadata.quotationNumber, date: manufacturerOnly.metadata.quotationDate, currency: manufacturerOnly.metadata.currency, positions: manufacturerOnly.positionCount, subtotal: manufacturerOnly.metadata.supplierQuotedSubtotal, total: manufacturerOnly.metadata.supplierQuotedTotal }, { adapter: 'quotesuite_raster_manufacturer_schedule_v1', manufacturer: 'Aluplast', dealer: null, dealerStatus: 'not_supplied', commercialSupplier: 'Aluplast', commercialSupplierCode: 'ALU', commercialSupplierSource: 'configured_relationship', manufacturerId: 'manufacturer-aluplast', reference: 'EF-EST-2026-045', date: '2026-08-28', currency: 'GBP', positions: 12, subtotal: '8434.78', total: '10121.74' });
  assert.equal(manufacturerOnly.documents[0].rows.every((row) => row.quantity === 1 && row.widthMm > 0 && row.heightMm > 0 && row.totalPrice && row.currency === 'GBP'), true);
  assert.equal(manufacturerOnly.documents[0].commercialEvidence.productSupplyReconciliation.blocking, true);
  assert.equal(manufacturerOnly.documents[0].commercialEvidence.productSupplyReconciliation.variance, '-49.00');

  assert.equal((await db.get('SELECT COUNT(*) count FROM supplier_quote_positions')).count, 0);
  assert.equal((await db.get('SELECT COUNT(*) count FROM project_calculator_estimate_product_rows')).count, 0);
  assert.equal((await db.get('SELECT COUNT(*) count FROM supplier_quote_import_operations')).count, 0);
});
