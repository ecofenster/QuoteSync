import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,utimes,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {startContentAwareApiWatcher} from '../scripts/content-aware-api-watch.mjs';

test('owned watcher ignores metadata but restarts once for a real imported dependency change',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'qs-owned-watch-')),entry=path.join(root,'entry.mjs'),dependency=path.join(root,'dependency.mjs'),children=[],lines=[],errors=[];let watcher;
  const until=async predicate=>{const deadline=Date.now()+10000;while(!predicate()){if(Date.now()>deadline)throw new Error(`Watcher timed out: ${JSON.stringify({lines,errors})}`);await delay(25);}};
  try{
    await writeFile(dependency,'export const value=1;');await writeFile(entry,"import {value} from './dependency.mjs'; console.log('READY '+value); setInterval(()=>{},1000);");
    watcher=await startContentAwareApiWatcher({entry,cwd:root,debounceMs:30,onChild:child=>{children.push(child);child.stdout.on('data',value=>lines.push(String(value)));child.stderr.on('data',value=>errors.push(String(value)));},onError:error=>errors.push(error.message)});
    await until(()=>lines.some(line=>line.includes('READY 1'))&&watcher.trackedFiles().includes(dependency));const first=watcher.pid();
    await utimes(dependency,new Date(),new Date(0));await writeFile(dependency,'export const value=1;');await delay(300);assert.equal(watcher.pid(),first);
    await writeFile(dependency,'export const value=2;');await until(()=>lines.some(line=>line.includes('READY 2')));assert.notEqual(watcher.pid(),first);await delay(150);assert.equal(children.length,2);assert.deepEqual(errors,[]);
  }finally{await watcher?.stop();for(const child of children)assert.ok(child.exitCode!==null||child.signalCode!==null,'An owned watched child survived cleanup');await rm(root,{recursive:true,force:true});}
});
