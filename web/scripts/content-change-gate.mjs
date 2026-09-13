import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';

// Filesystem notifications are hints. Only changed bytes (or deletion/restoration) are restart evidence.
export function createContentChangeGate({read=readFile}={}){
  const snapshots=new Map(),pending=new Map();
  const fingerprint=async file=>{try{return createHash('sha256').update(await read(file)).digest('hex');}catch(error){if(error.code==='ENOENT')return null;throw error;}};
  const serial=(file,operation)=>{const key=path.resolve(file),previous=pending.get(key)||Promise.resolve();const result=previous.catch(()=>{}).then(()=>operation(key));pending.set(key,result);void result.finally(()=>{if(pending.get(key)===result)pending.delete(key);}).catch(()=>{});return result;};
  return {
    track:file=>serial(file,async key=>{if(!snapshots.has(key))snapshots.set(key,await fingerprint(key));}),
    inspect:file=>serial(file,async key=>{
      if(!snapshots.has(key))return {tracked:false,changed:false};
      const next=await fingerprint(key),previous=snapshots.get(key);
      if(next===previous)return {tracked:true,changed:false};
      snapshots.set(key,next);return {tracked:true,changed:true,deleted:next===null,restored:previous===null};
    }),
    has:file=>snapshots.has(path.resolve(file)),
    clear:()=>snapshots.clear(),
  };
}
