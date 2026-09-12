import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import path from 'node:path';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { terminateOwnedProcessTree } from './e2e-owned-process.mjs';

// Build the application's schema in a new, explicitly owned test database.
// Never copy business data or provider connections from the running workspace.
export async function initializeIsolatedJourneyDatabase({databasePath,attachmentRoot,timeoutMs=60000}){
  const target=path.resolve(databasePath);
  try{await access(target);throw new Error('The isolated journey database already exists. Refusing to overwrite or reuse it.')}catch(error){if(error.code!=='ENOENT')throw error;}
  let child,timer,output='';
  try{
    child=spawn(process.execPath,['--input-type=module','--eval',"const { dbPromise } = await import('./server/db.js'); const db = await dbPromise; await db.close();"],{
      cwd:process.cwd(),env:{...process.env,NODE_ENV:'development',QUOTESUITE_DB_PATH:target,QUOTESYNC_ATTACHMENT_ROOT:path.resolve(attachmentRoot),QUOTESUITE_TEST_JOURNEY:'1',QUOTESUITE_TEST_DELIVERY_ENABLED:'0'},stdio:['ignore','pipe','pipe'],windowsHide:true});
    for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{output=(output+String(chunk)).slice(-8000)});
    await Promise.race([new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',(code,signal)=>code===0?resolve():reject(new Error(`Isolated schema initialization failed (${signal||code}): ${output}`)))}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Isolated schema initialization timed out.')),timeoutMs)})]);
  }finally{
    clearTimeout(timer);
    if(child?.pid&&child.exitCode===null&&child.signalCode===null){
      const cleanup=await terminateOwnedProcessTree(child,{platformName:process.platform});
      if(!cleanup.exited)throw new Error('The owned schema initialization process did not stop.');
    }
  }
  const db=await open({filename:target,driver:sqlite3.Database,mode:sqlite3.OPEN_READONLY});
  try{
    const counts={};
    for(const table of ['clients','projects','enquiries','estimates','orders','communication_messages','canonical_documents','integration_provider_config','integration_oauth_connections','integration_oauth_states','drive_project_folders','drive_discovered_documents','portal_contacts','portal_identities','portal_project_grants','portal_invitations','portal_sessions','estimate_revision_releases','portal_resource_releases','portal_commands','portal_review_submissions','portal_audit_events']){
      const exists=await db.get("SELECT name FROM sqlite_master WHERE type='table' AND name=?",table);
      counts[table]=exists?Number((await db.get(`SELECT COUNT(*) count FROM "${table}"`)).count):0;
      if(counts[table]!==0)throw new Error(`Fresh journey database unexpectedly contains ${counts[table]} ${table} record(s). No application test was started.`);
    }
    const integrity=await db.get('PRAGMA integrity_check');if(integrity.integrity_check!=='ok')throw new Error('Fresh journey database failed its integrity check.');
    return {databasePath:target,counts,integrity:'ok',copiedLiveDatabase:false,startedApi:false};
  }finally{await db.close();}
}
