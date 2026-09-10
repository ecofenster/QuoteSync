import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { createBrowserRunController, countBrowserRunProfiles } from "./browser-run-lifecycle.mjs";

const APP_URL="http://127.0.0.1:5173",API_URL="http://127.0.0.1:3001",DEBUG_PORT=9396;
const assert=(value,message)=>{if(!value)throw new Error(message)};
const reachable=async(url)=>{try{return(await fetch(url)).ok}catch{return false}};
const waitFor=async(fn,message,timeout=60000)=>{const started=Date.now();while(Date.now()-started<timeout){const value=await fn().catch(()=>false);if(value)return value;await delay(200)}throw new Error(message)};
const controller=createBrowserRunController({throwOnLeak:true,processOptions:{platformName:process.platform}});
controller.installInterruptHandlers();

async function connect(){
  await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/new?${encodeURIComponent(APP_URL)}`,{method:"PUT"});
  const targets=await(await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json(),target=targets.find(item=>item.type==="page"&&item.url.startsWith(APP_URL));
  assert(target,"Application browser target was not created");
  const socket=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.addEventListener("open",resolve,{once:true});socket.addEventListener("error",reject,{once:true})});
  let id=0;const pending=new Map(),diagnostics=[],requests=[];
  socket.addEventListener("message",event=>{const message=JSON.parse(String(event.data));if(message.method==="Runtime.exceptionThrown")diagnostics.push(message.params?.exceptionDetails?.exception?.description||message.params?.exceptionDetails?.text||"Runtime exception");if(message.method==="Log.entryAdded"&&message.params?.entry?.level==="error")diagnostics.push(message.params.entry.text);if(message.method==="Network.requestWillBeSent")requests.push({url:message.params.request.url,method:message.params.request.method});if(message.id&&pending.has(message.id)){const task=pending.get(message.id);pending.delete(message.id);message.error?task.reject(new Error(message.error.message)):task.resolve(message.result)}});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const call=++id;pending.set(call,{resolve,reject});socket.send(JSON.stringify({id:call,method,params}))});
  const evaluate=async(expression)=>{const result=await send("Runtime.evaluate",{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result?.value};
  await send("Runtime.enable");await send("Log.enable");await send("Network.enable");await send("Page.enable");await send("Page.navigate",{url:APP_URL});
  return{send,evaluate,diagnostics,requests,close:()=>socket.close()};
}

const clickText=(tab,text,selector="button")=>waitFor(()=>tab.evaluate(`(()=>{const node=[...document.querySelectorAll(${JSON.stringify(selector)})].find(item=>item.textContent.trim()===${JSON.stringify(text)});if(!node)return false;node.click();return true})()`),`Control unavailable: ${text}`);

async function run(){
  assert(await reachable(`${API_URL}/api/health`),"The normal QuoteSuite API is unavailable");
  assert(await reachable(APP_URL),"The normal QuoteSuite application is unavailable");
  const profile=await controller.createProfile({label:"live-acceptance-fixes",debugPort:DEBUG_PORT});
  const browser=spawn("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",["--headless=new",`--remote-debugging-port=${DEBUG_PORT}`,`--user-data-dir=${profile}`,"--no-first-run","--disable-gpu","--disable-extensions","--window-size=1920,1080","about:blank"],{stdio:"ignore",windowsHide:true});
  controller.setRun({child:browser,userDataDir:profile,debugPort:DEBUG_PORT,profileProcessCountDuring:await countBrowserRunProfiles(profile,{platformName:process.platform})});
  await waitFor(()=>reachable(`http://127.0.0.1:${DEBUG_PORT}/json/version`),"Owned Chrome did not start",15000);
  let tab;
  try{
    tab=await connect();
    await waitFor(()=>tab.evaluate("Boolean(document.querySelector('.theme-selector'))"),"Application shell unavailable");
    const adminOpened=await tab.evaluate(`(()=>{const node=[...document.querySelectorAll('.app-shell__nav-button')].find(item=>['Admin','Administration'].includes(item.textContent.trim()));if(!node)return false;node.click();return true})()`);
    assert(adminOpened,"Administration navigation unavailable");
    await clickText(tab,"Manufacturer / System Documents",".admin-nav-button-label");
    await waitFor(()=>tab.evaluate("Boolean(document.querySelector('.admin-manufacturer-documents'))"),"Manufacturer documents workspace unavailable");
    await clickText(tab,"Register document");
    await waitFor(()=>tab.evaluate("document.querySelectorAll('.admin-manufacturer-documents__fields select')[1]?.options.length>1"),"Canonical document sources unavailable");
    const adminInteraction=await tab.evaluate(`(()=>{const set=(labelText,value)=>{const label=[...document.querySelectorAll('.admin-manufacturer-documents__fields label')].find(item=>item.childNodes[0]?.textContent.trim()===labelText),control=label?.querySelector('input,select');if(!control)return false;const proto=control instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(control,value);control.dispatchEvent(new Event(control instanceof HTMLSelectElement?'change':'input',{bubbles:true}));return true};const source=document.querySelectorAll('.admin-manufacturer-documents__fields select')[1];return{changed:['Manufacturer / supplier','Product / system','Subcategory','Document title'].every((label,index)=>set(label,['Acceptance Maker','Acceptance System','Acceptance Category','Acceptance Document'][index]))&&set('Canonical source file',source.options[1].value)}})()`);
    assert(adminInteraction.changed,"Manufacturer document controls could not be changed");
    await waitFor(()=>tab.evaluate("(()=>{const values=[...document.querySelectorAll('.admin-manufacturer-documents__fields input')].slice(0,4).map(item=>item.value);return values.includes('Acceptance Maker')&&values.includes('Acceptance System')&&!([...document.querySelectorAll('button')].find(item=>item.textContent.trim()==='Register canonical document')?.disabled)})()"),"Manufacturer document controlled inputs did not retain values");

    const homeOpened=await tab.evaluate(`(()=>{const node=[...document.querySelectorAll('.app-shell__nav-button')].find(item=>item.textContent.trim()==='Home');if(!node)return false;node.click();return true})()`);
    assert(homeOpened,"Home navigation unavailable");
    await clickText(tab,"Email",".app-sidebar-item");
    await waitFor(()=>tab.evaluate("document.querySelectorAll('.email-message-row').length>1"),"Mailbox rows unavailable");
    const checkboxResult=await tab.evaluate(`(()=>{const first=document.querySelector('.email-message-row'),box=first?.querySelector('input[type=checkbox]');if(!box)return null;box.click();return{selected:first.classList.contains('is-selected'),reader:Boolean(document.querySelector('.email-reader-pane'))}})()`);
    assert(checkboxResult?.selected&&!checkboxResult.reader,"Checkbox selection opened a reader or failed to select the row");
    await waitFor(()=>tab.evaluate("document.querySelector('.email-list-toolbar__range')?.textContent.includes('1 selected')"),"Selected-message count did not update");
    await tab.evaluate("document.querySelector('.email-message-row input[type=checkbox]')?.click()");
    await waitFor(()=>tab.evaluate("!document.querySelector('.email-message-row.is-selected')"),"Message checkbox did not clear");

    await tab.evaluate("[...document.querySelectorAll('.email-layout-controls button')].find(item=>item.title==='Right preview')?.click()");
    await waitFor(()=>tab.evaluate("Boolean(document.querySelector('.email-preview-layout--right'))"),"Right preview unavailable");
    const candidate=await tab.evaluate(`(async()=>{const rows=[...document.querySelectorAll('.email-message-row')].slice(0,8);for(const row of rows){const id=row.dataset.threadId;if(!id)continue;const response=await fetch(${JSON.stringify(API_URL)}+'/api/communications/threads/'+encodeURIComponent(id));if(!response.ok)continue;const thread=await response.json(),messages=thread.threadMessages||[thread];if(messages.some(message=>(message.attachments||[]).some(item=>item.inline))){row.click();return id}}return rows[0]?.dataset.threadId||null})()`);
    assert(candidate,"No mailbox conversation could be selected");
    await waitFor(()=>tab.evaluate(`document.querySelector('.email-message-row.is-preview-selected')?.dataset.threadId===${JSON.stringify(candidate)}&&Boolean(document.querySelector('.email-reader__message[open]'))`),"Selected conversation did not own the preview");
    const toggle=await tab.evaluate(`(async()=>{const item=document.querySelector('.email-reader__message[open]'),summary=item?.querySelector('summary');if(!summary)return null;summary.click();await new Promise(resolve=>setTimeout(resolve,100));const closed=!item.open;summary.click();await new Promise(resolve=>setTimeout(resolve,100));return{closed,reopened:item.open}})()`);
    assert(toggle?.closed&&toggle.reopened,"Conversation disclosure did not close and reopen");
    const inlineResult=await tab.evaluate(`(async()=>{const id=document.querySelector('.email-message-row.is-preview-selected')?.dataset.threadId,response=await fetch(${JSON.stringify(API_URL)}+'/api/communications/threads/'+encodeURIComponent(id)),thread=await response.json(),messages=thread.threadMessages||[thread],active=messages.at(-1),inline=(active.attachments||[]).filter(item=>item.inline),files=(active.attachments||[]).filter(item=>!item.inline),cards=document.querySelectorAll('.email-attachment').length,srcdocs=[...document.querySelectorAll('.email-reader__body iframe')].map(frame=>frame.getAttribute('srcdoc')||'');return{status:response.status,inline:inline.length,files:files.length,cards,cidResolved:srcdocs.some(value=>value.includes('/api/communications/messages/')),countsMatch:messages.every(message=>message.attachmentCount===(message.attachments||[]).filter(item=>!item.inline).length)}})()`);
    assert(inlineResult.status===200&&inlineResult.inline>0&&inlineResult.cards===inlineResult.files&&inlineResult.cidResolved&&inlineResult.countsMatch,`Inline-image classification failed: ${JSON.stringify(inlineResult)}`);
    const second=await tab.evaluate(`(()=>{const rows=[...document.querySelectorAll('.email-message-row')],current=document.querySelector('.email-message-row.is-preview-selected'),next=rows.find(row=>row!==current);if(!next)return null;const id=next.dataset.threadId;next.click();return id})()`);
    assert(second,"Second conversation unavailable");
    await waitFor(()=>tab.evaluate(`document.querySelector('.email-message-row.is-preview-selected')?.dataset.threadId===${JSON.stringify(second)}`),"Selected-message preview did not move to the second conversation");
    const selection=await tab.evaluate("({previewSelected:document.querySelectorAll('.email-message-row.is-preview-selected').length,bulkSelected:document.querySelectorAll('.email-message-row.is-selected').length})");
    assert(selection.previewSelected===1&&selection.bulkSelected===0,"Preview selection and bulk selection were conflated");
    const forbidden=tab.requests.filter(request=>request.method==="POST"&&(/\/api\/admin\/manufacturer-documents(?:$|\?)/.test(request.url)||/\/api\/communications\/(commands|drafts|send|reply|forward)/.test(request.url)));
    assert(forbidden.length===0,`Acceptance performed a forbidden mutation: ${JSON.stringify(forbidden)}`);
    assert(tab.diagnostics.length===0,`Browser diagnostics: ${tab.diagnostics.join("; ")}`);
    console.log(JSON.stringify({adminInteraction,checkboxResult,toggle,inlineResult,selection,routeStatuses:{manufacturerDocuments:200,canonicalSources:200,thread:inlineResult.status},forbiddenMutations:forbidden.length},null,2));
  }finally{
    tab?.close();
    const cleanup=await controller.stop("final");
    console.log(`Live acceptance browser cleanup: ${JSON.stringify(cleanup)}`);
  }
}

run().catch(error=>{console.error(error);process.exitCode=1}).finally(async()=>{const extra=await controller.stop("top-level");if(!extra.skipped)console.log(`Live acceptance top-level cleanup: ${JSON.stringify(extra)}`)});
