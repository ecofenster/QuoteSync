import {watch} from 'node:fs';
import {mkdtemp,rm,stat} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {initializeIsolatedJourneyDatabase} from './isolated-journey-database.mjs';

// Read-only repository observation; the only writes are a uniquely owned fresh temporary database.
const root=await mkdtemp(path.join(os.tmpdir(),'qs-watch-diagnostic-')),events=new Map();let observer;
const health=()=>fetch('http://127.0.0.1:3001/api/health').then(response=>response.json());
try{
  const before=await health();
  observer=watch(process.cwd(),{recursive:true},(kind,file)=>{if(file&&/\.(?:[cm]?js|json|node|ts|tsx)$/.test(String(file)))events.set(String(file),{kind,observedAt:new Date().toISOString()});});
  // Observation can run alongside the existing owned browser runner; do not introduce a second browser launcher.
  if(process.argv.includes('--observe'))await delay(30000);
  else await initializeIsolatedJourneyDatabase({databasePath:path.join(root,'test.db'),attachmentRoot:path.join(root,'attachments')});
  await delay(1500);const after=await health();
  const changed=[];for(const [file,event] of events){const metadata=await stat(path.resolve(file)).catch(()=>null);changed.push({file,...event,modifiedAt:metadata?.mtime.toISOString()||null});}
  console.log(JSON.stringify({beforeInstance:before.instanceId,afterInstance:after.instanceId,apiRestarted:before.instanceId!==after.instanceId,events:changed},null,2));
}finally{observer?.close();await rm(root,{recursive:true,force:true});}
