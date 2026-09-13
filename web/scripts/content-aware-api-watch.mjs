import {spawn} from 'node:child_process';
import {watch} from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createContentChangeGate} from './content-change-gate.mjs';
import {terminateOwnedProcessTree} from './e2e-owned-process.mjs';

export async function startContentAwareApiWatcher({entry,cwd=process.cwd(),environment=process.env,onChild=()=>{},onError=console.error,debounceMs=200}={}){
  entry=path.resolve(entry);const gate=createContentChangeGate(),directories=new Map(),tracked=new Set(),notifications=new Set();let child,timer,stopped=false,restarting=false,requested=false;
  const inspectSettled=async()=>{const files=[...notifications];notifications.clear();const changes=await Promise.all(files.map(file=>gate.inspect(file)));if(!stopped&&changes.some(item=>item.changed))await restart();};
  const track=async file=>{file=path.resolve(file);if(stopped||tracked.has(file))return;await gate.track(file);if(stopped)return;tracked.add(file);const dir=path.dirname(file);if(directories.has(dir))return;
    const observer=watch(dir,(_kind,name)=>{const files=name?[path.resolve(dir,String(name))]:[...tracked].filter(item=>path.dirname(item)===dir);for(const changed of files)if(gate.has(changed))notifications.add(changed);if(!notifications.size||stopped)return;clearTimeout(timer);timer=setTimeout(()=>void inspectSettled().catch(onError),debounceMs);});observer.on('error',onError);directories.set(dir,observer);
  };
  const stopChild=async()=>{if(child?.pid&&child.exitCode===null&&child.signalCode===null){const result=await terminateOwnedProcessTree(child,{platformName:process.platform});if(!result.exited)throw new Error('The owned watched API did not stop; refusing to start another listener.');}};
  const launch=()=>{
    child=spawn(process.execPath,[entry],{cwd,env:{...environment,WATCH_REPORT_DEPENDENCIES:'1'},stdio:['ignore','pipe','pipe','ipc'],windowsHide:true});
    child.on('error',onError);child.on('message',message=>{for(const file of message?.['watch:require']||[])void track(file).catch(onError);for(const url of message?.['watch:import']||[])if(String(url).startsWith('file:'))void track(fileURLToPath(url)).catch(onError);});onChild(child);
  };
  const restart=async()=>{requested=true;if(restarting||stopped)return;restarting=true;try{while(requested&&!stopped){requested=false;await stopChild();if(!stopped)launch();}}finally{restarting=false;}};
  await track(entry);launch();
  return {async stop(){stopped=true;clearTimeout(timer);for(const observer of directories.values())observer.close();directories.clear();await stopChild();},pid:()=>child?.pid,trackedFiles:()=>[...tracked]};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  let controller,stopping=false;
  const shutdown=async code=>{if(stopping)return;stopping=true;try{await controller?.stop();process.exitCode=code;}catch(error){console.error(error);process.exitCode=1;}};
  controller=await startContentAwareApiWatcher({entry:process.argv[2]||'server/index.js',onChild:child=>{child.stdout.pipe(process.stdout);child.stderr.pipe(process.stderr);},onError:error=>{console.error(error);void shutdown(1);}});
  for(const signal of ['SIGINT','SIGTERM','SIGBREAK'])process.once(signal,()=>void shutdown(0));
}
