import assert from 'node:assert/strict';
import test from 'node:test';
import os from 'node:os';
import path from 'node:path';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { initializeSupplierCommercialSchema } from '../server/schema/supplierCommercialSchema.js';
import { purgeClientOwnedGraph } from '../server/features/estimatePositions/estimatePurgeService.js';

test('disposable purge removes the owned import/costing graph and managed evidence only', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'qs-estimate-purge-'));
  const attachments = path.join(root, 'attachments');
  const db = await open({ filename: path.join(root, 'test.db'), driver: sqlite3.Database });
  t.after(async () => { await db.close(); await rm(root, { recursive: true, force: true }); });
  await db.exec('PRAGMA foreign_keys=ON; CREATE TABLE clients(id TEXT PRIMARY KEY); CREATE TABLE estimates(id TEXT PRIMARY KEY,client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE);');
  await initializeSupplierCommercialSchema(db);

  await db.run('INSERT INTO clients(id) VALUES(?),(?)', 'dispose-client', 'keep-client');
  await db.run('INSERT INTO estimates(id,client_id) VALUES(?,?),(?,?)', 'dispose-estimate', 'dispose-client', 'keep-estimate', 'keep-client');
  const now = '2026-08-20T10:00:00.000Z';
  for (const [prefix, estimate] of [['dispose', 'dispose-estimate'], ['keep', 'keep-estimate']]) {
    const session = `${prefix}-session`, labAttachment = `${prefix}-lab-attachment`, run = `${prefix}-run`;
    await db.run('INSERT INTO supplier_import_lab_sessions(id,estimate_id,supplier_name,currency,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?)', session, estimate, 'Test Supplier', 'GBP', 'extracted', now, now);
    await db.run('INSERT INTO supplier_import_lab_attachments(id,session_id,role,original_file_name,media_type,size_bytes,sha256,storage_key,parser_eligible,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)', labAttachment, session, 'original_quote', `${prefix}.docx`, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 4, 'a'.repeat(64), `supplier-import-lab/${prefix}.docx`, 1, now);
    await db.run('INSERT INTO supplier_import_lab_extraction_runs(id,session_id,attachment_id,extractor_name,extractor_version,field_parser_name,field_parser_version,status,started_at,completed_at,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)', run, session, labAttachment, 'test', '1', 'test', '1', 'completed', now, now, now);
    const quote = `${prefix}-quote`, revision = `${prefix}-revision`, quoteAttachment = `${prefix}-quote-attachment`, position = `${prefix}-position`;
    await db.run('INSERT INTO supplier_quotes(id,estimate_id,supplier_code,supplier_name) VALUES(?,?,?,?)', quote, estimate, 'TEST', 'Test Supplier');
    await db.run('INSERT INTO supplier_quote_revisions(id,supplier_quote_id,estimate_id,revision_sequence,supplier_quotation_number,full_quotation_reference,currency,vat_status,lifecycle_status) VALUES(?,?,?,?,?,?,?,?,?)', revision, quote, estimate, 1, prefix, prefix, 'GBP', 'unknown', 'active');
    await db.run('INSERT INTO supplier_quote_attachments(id,estimate_id,revision_id,role,original_file_name,media_type,size_bytes,sha256,storage_key,parser_eligible) VALUES(?,?,?,?,?,?,?,?,?,?)', quoteAttachment, estimate, revision, 'original_quote', `${prefix}.docx`, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 4, 'b'.repeat(64), `supplier-quotes/${prefix}.docx`, 1);
    await db.run('INSERT INTO supplier_quote_positions(id,estimate_id,revision_id,display_reference,quantity) VALUES(?,?,?,?,?)', position, estimate, revision, prefix.toUpperCase(), 1);
    await db.run('INSERT INTO supplier_specification_items(id,supplier_position_id,ordinal,original_text) VALUES(?,?,?,?)', `${prefix}-spec`, position, 0, 'Safe specification');
    await db.run('INSERT INTO project_calculator_lab_scenarios(id,estimate_id,origin,name,currency,package_code,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)', `${prefix}-scenario`, estimate, 'manual', prefix, 'GBP', 'supply_only', now, now);
    const visualToken = prefix === 'dispose' ? '1'.repeat(40) : '2'.repeat(40);
    await db.run('INSERT INTO project_calculator_estimate_product_rows(id,scenario_id,source_position_id,source_attachment_id,source_revision_id,source_snapshot_json,display_reference,product_class,quantity,width_mm,height_mm,currency,area_square_metres,frame_perimeter_metres,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', `${prefix}-product`, `${prefix}-scenario`, position, quoteAttachment, revision, JSON.stringify({ sourceVisual: { quotationPngUrl: `/api/manufacturer-position-visuals/${visualToken}/quotation.png` } }), prefix.toUpperCase(), 'Window', 1, 1000, 1200, 'GBP', '1.2', '4.4', now, now);
    for (const relative of [`supplier-import-lab/${prefix}.docx`, `supplier-quotes/${prefix}.docx`, `manufacturer-position-visuals/${visualToken}/quotation.png`]) { const target = path.join(attachments, relative); await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, prefix); }
  }

  const result = await purgeClientOwnedGraph(db, 'dispose-client', { attachmentRoot: attachments });
  assert.deepEqual(result, { success: true, removedEstimateCount: 1, fileCleanupFailures: [] });
  for (const table of ['clients', 'estimates', 'supplier_import_lab_sessions', 'supplier_quote_positions', 'project_calculator_lab_scenarios']) assert.equal((await db.get(`SELECT count(*) count FROM ${table} WHERE id LIKE 'dispose%'`)).count, 0, table);
  assert.equal((await db.get("SELECT count(*) count FROM clients WHERE id='keep-client'")).count, 1);
  await assert.rejects(readFile(path.join(attachments, 'supplier-import-lab/dispose.docx')));
  assert.equal(await readFile(path.join(attachments, 'supplier-import-lab/keep.docx'), 'utf8'), 'keep');
  await assert.rejects(readFile(path.join(attachments, 'manufacturer-position-visuals', '1'.repeat(40), 'quotation.png')));
  assert.equal(await readFile(path.join(attachments, 'manufacturer-position-visuals', '2'.repeat(40), 'quotation.png'), 'utf8'), 'keep');
});
