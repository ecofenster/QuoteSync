import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { mkdtemp,readFile,rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { initializeIsolatedJourneyDatabase } from '../scripts/isolated-journey-database.mjs';
import { createSupplierQuotesService } from '../server/features/supplierQuotes/supplierQuotesService.js';
import express from 'express';
import { createServer } from 'node:http';
import { createCommunicationsRouter } from '../server/routes/communications.js';

test('genuine filed PDF reuse checks current bytes and supplier before returning earlier evidence',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'qs-filed-source-reuse-')),databasePath=path.join(root,'test.db'),attachmentRoot=path.join(root,'attachments');let db,http;
  try{
    await initializeIsolatedJourneyDatabase({databasePath,attachmentRoot});db=await open({filename:databasePath,driver:sqlite3.Database});
    const now=new Date().toISOString();
    await db.run("INSERT INTO clients(id,name,client_ref,created_at,updated_at) VALUES('test-client','Disposable source review','TEST-CL-SOURCE',?,?)",now,now);
    await db.run("INSERT INTO estimates(id,client_id,estimate_ref,status,created_at,updated_at) VALUES('test-estimate','test-client','TEST-EST-SOURCE','Draft',?,?)",now,now);
    for(const [code,name] of [['EKO','EKO-OKNA'],['OTHER','Other supplier']])await db.run("INSERT INTO supplier_commercial_defaults(supplier_code,supplier_name,policy_json,pricing_display_policy_json,updated_at) VALUES(?,?,?,'{}',?) ON CONFLICT(supplier_code) DO NOTHING",code,name,JSON.stringify({pricingMethod:'factory_price',pricingBasis:'factory_price',paidInQuotedCurrency:true,settlementCurrency:'EUR'}),now);
    const bytes=await readFile(path.resolve('docs/Supplier_Quotes/John_Wingfield/web-26-1133450.pdf'));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),'d1f34d3fd36ef40e4fb1b3ccbddc96b96837fdfd86f598af9c2b189f674f1899');
    const service=createSupplierQuotesService(db,{attachmentRoot,fileSupplierAttachments:false});
    const input={canonicalDocumentId:'retained-source',estimateId:'test-estimate',supplierCode:'EKO',fileName:'web-26-1133450.pdf',mediaType:'application/pdf',bytes};
    await db.run("INSERT INTO canonical_documents(id,provider,provider_account_id,provider_file_id,client_id,estimate_id,supplier_id,document_type,file_name,mime_type,size_bytes,discovered_at,last_seen_at,updated_at) VALUES('retained-source','google_workspace','disposable','disposable-source','test-client','test-estimate','EKO','supplier_quotation','web-26-1133450.pdf','application/pdf',?,?,?,?)",bytes.length,now,now,now);
    let providerBytes=bytes;
    const app=express();app.use(express.json());app.use('/api/communications',createCommunicationsRouter({databasePromise:Promise.resolve(db),serviceOptions:{attachmentRoot,workspace:{status:async()=>({connected:true,capabilities:{drive:{available:true}}}),googleFetch:async()=>new Response(providerBytes,{status:200})}}}));
    http=createServer(app);await new Promise(resolve=>http.listen(0,'127.0.0.1',resolve));
    const endpoint=`http://127.0.0.1:${http.address().port}/api/communications/documents/retained-source/manufacturer-import-review`;
    const first=await service.stageCanonicalDocumentForReview(input),replay=await service.stageCanonicalDocumentForReview(input);
    assert.equal(replay.duplicate,true);assert.equal(replay.documents[0].attachmentId,first.documents[0].attachmentId);
    const before=await db.get('SELECT id,sha256,storage_key FROM supplier_quote_attachments WHERE id=?',first.documents[0].attachmentId);
    await assert.rejects(()=>service.stageCanonicalDocumentForReview({...input,bytes:Buffer.concat([bytes,Buffer.from('\n% changed provider revision\n')])}),error=>error.code==='canonical_document_content_changed'&&error.status===409);
    await assert.rejects(()=>service.stageCanonicalDocumentForReview({...input,supplierCode:'OTHER'}),error=>error.code==='canonical_document_supplier_conflict');
    providerBytes=Buffer.concat([bytes,Buffer.from('\n% revised provider response\n')]);
    const conflict=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({estimateId:'test-estimate'})});
    assert.equal(conflict.status,409);const outcome=await conflict.json();assert.equal(outcome.code,'canonical_document_content_changed');assert.match(outcome.error,/earlier source is preserved.*separate document revision/);
    providerBytes=bytes;
    const unchanged=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({estimateId:'test-estimate'})});
    assert.equal(unchanged.status,200);assert.equal((await unchanged.json()).documents[0].attachmentId,before.id);
    assert.deepEqual(await db.get('SELECT id,sha256,storage_key FROM supplier_quote_attachments WHERE id=?',before.id),before);
    assert.deepEqual(await readFile(path.join(attachmentRoot,before.storage_key)),bytes);
    assert.equal((await db.get('SELECT COUNT(*) count FROM supplier_quotes')).count,1);
    assert.equal((await db.get('SELECT COUNT(*) count FROM supplier_quote_positions')).count,0);
    assert.equal((await db.get('SELECT COUNT(*) count FROM project_calculator_estimate_product_rows')).count,0);
  }finally{if(http)await new Promise(resolve=>http.close(resolve));if(db)await db.close();await rm(root,{recursive:true,force:true});}
});
