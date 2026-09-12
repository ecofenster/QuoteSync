import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp,rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { initializeIsolatedJourneyDatabase } from '../scripts/isolated-journey-database.mjs';

test('normal-application journey starts with fresh schema, no business records or provider connections',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'qs-journey-schema-'));
  const options={databasePath:path.join(root,'journey.db'),attachmentRoot:path.join(root,'attachments')};
  try{
    const proof=await initializeIsolatedJourneyDatabase(options);
    assert.equal(proof.copiedLiveDatabase,false);assert.equal(proof.startedApi,false);
    assert.equal(proof.integrity,'ok');assert.ok(Object.values(proof.counts).every(count=>count===0));
    await assert.rejects(()=>initializeIsolatedJourneyDatabase(options),/already exists/);
  }finally{await rm(root,{recursive:true,force:true});}
});
