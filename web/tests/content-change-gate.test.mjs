import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,utimes,unlink,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createContentChangeGate} from '../scripts/content-change-gate.mjs';

test('metadata events and identical rewrites do not restart; changed bytes, deletion and restoration do',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'qs-content-watch-')),file=path.join(root,'source.mjs'),gate=createContentChangeGate();
  try{
    await writeFile(file,'export const value=1;');await gate.track(file);
    await utimes(file,new Date(),new Date(0));assert.equal((await gate.inspect(file)).changed,false);
    await writeFile(file,'export const value=1;');assert.equal((await gate.inspect(file)).changed,false);
    await writeFile(file,'export const value=2;');const notifications=await Promise.all([gate.inspect(file),gate.inspect(file),gate.inspect(file)]);assert.equal(notifications.filter(item=>item.changed).length,1);
    await unlink(file);assert.equal((await gate.inspect(file)).deleted,true);assert.equal((await gate.inspect(file)).changed,false);
    await writeFile(file,'export const value=2;');assert.equal((await gate.inspect(file)).restored,true);
    assert.deepEqual(await gate.inspect(path.join(root,'untracked.mjs')),{tracked:false,changed:false});
  }finally{gate.clear();await rm(root,{recursive:true,force:true});}
});

test('a failed read preserves the last successful content evidence and is recoverable',async()=>{
  let content='initial',denied=false;const gate=createContentChangeGate({read:async()=>{if(denied)throw Object.assign(new Error('Denied'),{code:'EACCES'});return content;}});
  await gate.track('source');content='changed';denied=true;await assert.rejects(()=>gate.inspect('source'),/Denied/);denied=false;assert.equal((await gate.inspect('source')).changed,true);assert.equal((await gate.inspect('source')).changed,false);
});
