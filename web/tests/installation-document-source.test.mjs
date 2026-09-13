import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sqlite3 from 'sqlite3';
import {open} from 'sqlite';
import {initializeIsolatedJourneyDatabase} from '../scripts/isolated-journey-database.mjs';
import {loadInstallationDocumentRevision} from '../server/features/installationSafety/installationDocumentSource.js';

test('Order source uses retained accepted Positions instead of the amended working schedule (selection unit check)',async()=>{
  const estimate={id:'estimate-a',client_id:'client-a',project_id:'project-a',revision_no:3,positions_json:JSON.stringify([{id:'new-working-position'}])};
  const order={id:'order-a',order_ref:'TEST-ORDER',client_id:'client-a',project_id:'project-a',source_estimate_id:'estimate-a',source_estimate_revision:2,accepted_estimate_id:'estimate-a',estimate_revision:2,release_client_id:'client-a',release_project_id:'project-a',overall_accepted:1,release_id:'release-a',acceptance_id:'acceptance-a',customer_projection_json:JSON.stringify({clientName:'Retained client',projectName:'Retained site',positions:[{id:'accepted-position',widthMm:1200},{id:'not-accepted',widthMm:1400}]})};
  const db={get:async sql=>sql.includes('FROM estimates')?estimate:order,all:async(sql,id)=>{assert.match(sql,/AND accepted=1/);assert.equal(id,'acceptance-a');return[{estimate_position_id:'accepted-position'}]}};
  const source=await loadInstallationDocumentRevision(db,{estimateId:'estimate-a',revision:2,orderId:'order-a'});
  assert.deepEqual(source.positions,[{id:'accepted-position',widthMm:1200}]);assert.equal(source.clientName,'Retained client');assert.equal(source.sourceReleaseId,'release-a');assert.equal(source.siteAddress,'','Do not silently take an amended site address for a retained release');
  order.release_client_id='another-client';await assert.rejects(()=>loadInstallationDocumentRevision(db,{estimateId:'estimate-a',revision:2,orderId:'order-a'}),/relationships/);
});

test('actual isolated schema resolves exact working revision read-only and refuses stale selection',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'qs-installation-source-')),databasePath=path.join(root,'test.db');let db;
  try{
    await initializeIsolatedJourneyDatabase({databasePath,attachmentRoot:path.join(root,'attachments')});
    db=await open({filename:databasePath,driver:sqlite3.Database});
    const at=new Date().toISOString();
    await db.run("INSERT INTO clients(id,name,email,client_ref,created_at,updated_at) VALUES('test-client','Disposable client','disposable@example.test','TEST-CL',?,?)",at,at);
    await db.run("INSERT INTO estimates(id,client_id,estimate_ref,base_estimate_ref,revision_no,status,positions_json,created_at,updated_at) VALUES('test-estimate','test-client','TEST-EST-2','TEST-EST',2,'Draft',?,?,?)",JSON.stringify([{id:'position-a',reference:'W01',quantity:1,widthMm:1200,heightMm:1400}]),at,at);
    await db.exec('PRAGMA query_only=ON');
    const source=await loadInstallationDocumentRevision(db,{estimateId:'test-estimate',revision:2});
    assert.equal(source.positions[0].id,'position-a');assert.equal(source.sourceReleaseId,null);assert.equal(source.clientName,'Disposable client');
    await assert.rejects(()=>loadInstallationDocumentRevision(db,{estimateId:'test-estimate',revision:1}),/revision has changed/);
    await assert.rejects(()=>loadInstallationDocumentRevision(db,{estimateId:'test-estimate',revision:2,orderId:'other-order'}),/does not belong/);
    assert.equal((await db.get('SELECT COUNT(*) count FROM estimates')).count,1);
  }finally{await db?.close();await rm(root,{recursive:true,force:true});}
});
