import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { createBrowserRunController, countBrowserRunProfiles } from "./browser-run-lifecycle.mjs";
import { terminateOwnedProcessTrees } from "./e2e-owned-process.mjs";

const APP_URL="http://127.0.0.1:4181",API_URL="http://127.0.0.1:3011",DEBUG_PORT=9291;
const evidenceDirectory=resolve("test-output",`email-reader-readonly-${new Date().toISOString().replace(/[:.]/g,"-")}`);
const assert=(value,message)=>{if(!value)throw new Error(message)};
const reachable=async url=>{try{return(await fetch(url)).ok}catch{return false}};
const waitFor=async(fn,message,timeout=60000)=>{const started=Date.now();while(Date.now()-started<timeout){const value=await fn().catch(()=>false);if(value)return value;await delay(200)}throw new Error(message)};
const controller=createBrowserRunController({throwOnLeak:true,processOptions:{platformName:process.platform}});
controller.installInterruptHandlers();
const services=[];

function launchServices(){
  services.push(spawn(process.execPath,["server/index.js"],{cwd:process.cwd(),env:{...process.env,PORT:"3011"},stdio:"ignore",windowsHide:true}));
  services.push(spawn(process.execPath,["node_modules/vite/bin/vite.js","--host","127.0.0.1","--port","4181"],{cwd:process.cwd(),env:{...process.env,VITE_API_BASE_URL:API_URL},stdio:"ignore",windowsHide:true}));
}

async function launchChrome(){
  const userDataDir=await controller.createProfile({label:"email-reader-readonly",debugPort:DEBUG_PORT});
  const before=await countBrowserRunProfiles(userDataDir,{platformName:process.platform});
  const child=spawn("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",["--headless=new",`--remote-debugging-port=${DEBUG_PORT}`,`--user-data-dir=${userDataDir}`,"--no-first-run","--disable-gpu","--disable-extensions","about:blank"],{stdio:"ignore",windowsHide:true});
  controller.setRun({child});
  await waitFor(()=>reachable(`http://127.0.0.1:${DEBUG_PORT}/json/version`),"Owned Chrome did not start",15000);
  controller.setRun({profileProcessCountDuring:await countBrowserRunProfiles(userDataDir,{platformName:process.platform})});
}

async function connect(){
  await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/new?${encodeURIComponent(APP_URL)}`,{method:"PUT"});
  const targets=await(await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json();
  const target=targets.find(item=>item.type==="page"&&item.url.startsWith(APP_URL));
  assert(target,"Application browser target was not created");
  const socket=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.addEventListener("open",resolve,{once:true});socket.addEventListener("error",reject,{once:true})});
  let id=0;
  const pending=new Map(),diagnostics=[],requests=[];
  socket.addEventListener("message",event=>{const message=JSON.parse(String(event.data));if(message.method==="Runtime.exceptionThrown")diagnostics.push(message.params?.exceptionDetails?.text||"Runtime exception");if(message.method==="Network.requestWillBeSent")requests.push({url:message.params.request.url,method:message.params.request.method});if(message.id&&pending.has(message.id)){const task=pending.get(message.id);pending.delete(message.id);message.error?task.reject(new Error(message.error.message)):task.resolve(message.result)}});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const call=++id;pending.set(call,{resolve,reject});socket.send(JSON.stringify({id:call,method,params}))});
  const evaluate=async expression=>{const result=await send("Runtime.evaluate",{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text);return result.result?.value};
  await send("Runtime.enable");await send("Page.enable");await send("Network.enable");await send("Page.navigate",{url:APP_URL});
  return {send,evaluate,diagnostics,requests,close:()=>socket.close()};
}

const clickText=(tab,text,selector="button")=>waitFor(()=>tab.evaluate(`(()=>{const node=[...document.querySelectorAll(${JSON.stringify(selector)})].find(item=>item.textContent.trim()===${JSON.stringify(text)});if(!node)return false;node.click();return true})()`),`Control unavailable: ${text}`);
const settle=tab=>tab.evaluate("new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(resolve,250))))");
const capture=async(tab,name)=>{await settle(tab);const shot=await tab.send("Page.captureScreenshot",{format:"png",captureBeyondViewport:false});assert(shot.data.length>1000,`Screenshot capture failed: ${name}`);const target=resolve(evidenceDirectory,`${name}.png`);await writeFile(target,Buffer.from(shot.data,"base64"));return target};

async function run(){
  await mkdir(evidenceDirectory,{recursive:true});
  launchServices();
  await waitFor(()=>reachable(`${API_URL}/api/clients`),"Owned API unavailable");
  await waitFor(()=>reachable(APP_URL),"Owned Vite unavailable");
  const status=await(await fetch(`${API_URL}/api/communications/status`)).json();
  assert(status.configured&&status.encryptionConfigured&&status.connected&&status.capabilities?.gmail?.available&&status.capabilities?.drive?.available,"Persisted Google state unavailable");
  await launchChrome();
  let tab,cleanup;
  try{
    tab=await connect();
    await tab.send("Emulation.setDeviceMetricsOverride",{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
    await waitFor(()=>tab.evaluate("Boolean(document.querySelector('.theme-selector'))"),"Application shell unavailable");
    if(await tab.evaluate("document.documentElement.dataset.qsTheme!=='dark'"))await tab.evaluate("document.querySelector('.theme-selector')?.click()");
    await waitFor(()=>tab.evaluate("document.documentElement.dataset.qsTheme==='dark'"),"Dark theme did not activate");
    await clickText(tab,"Email",".app-sidebar-item");
    await waitFor(()=>tab.evaluate("document.querySelectorAll('.email-message-row').length>0"),"Inbox returned no conversations");
    const opened=await tab.evaluate(`(()=>{const row=[...document.querySelectorAll('.email-message-row')].find(item=>item.querySelector('.email-message-row__meta span[title*="attachment"]'))||document.querySelector('.email-message-row');if(!row)return false;row.click();return true})()`);
    assert(opened,"No suitable conversation could be opened");
    await waitFor(()=>tab.evaluate("Boolean(document.querySelector('.email-reader__message[open] .email-reader__body iframe'))"),"Expanded HTML reader unavailable");
    await waitFor(()=>tab.evaluate("(()=>{const details=[...document.querySelectorAll('.email-reader__message')],open=document.querySelector('.email-reader__message[open]'),frame=open?.querySelector('iframe');return details.length>0&&details.every(item=>item.querySelector('summary').getBoundingClientRect().height>=60)&&open.getBoundingClientRect().height>500&&frame.getBoundingClientRect().height>=448})()"),"Reader geometry did not become usable");
    const screenshots=[];
    await tab.evaluate("document.querySelector('.email-reader')?.scrollTo({top:0})");
    screenshots.push(await capture(tab,"01-reader-collapsed-dark"));
    await tab.evaluate("document.querySelector('.email-reader__message[open]')?.scrollIntoView({block:'start'})");
    screenshots.push(await capture(tab,"02-reader-expanded-html-dark"));
    const dark=await tab.evaluate(`(()=>{const reader=document.querySelector('.email-reader'),details=[...reader.querySelectorAll('.email-reader__message')],open=reader.querySelector('.email-reader__message[open]'),collapsed=details.find(item=>!item.open),summary=collapsed?.querySelector('summary'),addresses=summary?.querySelector('.email-reader__message-addresses'),time=summary?.querySelector('time'),frame=open?.querySelector('iframe'),src=frame?.getAttribute('srcdoc')||'',plain=open?.querySelector('.email-reader__plain'),attachments=open?.querySelector('.email-attachments'),reply=[...open.querySelectorAll('.email-reader__reply-actions button')];return{theme:document.documentElement.dataset.qsTheme,messages:details.length,collapsedHeight:summary?.getBoundingClientRect().height||0,collapsedSenderVisible:Boolean(addresses?.querySelector('strong')?.textContent.trim()&&addresses.getBoundingClientRect().height>0),collapsedRecipientVisible:Boolean(addresses?.querySelector('small')?.textContent.trim()),collapsedTimeVisible:Boolean(time?.textContent.trim()),expanderVisible:Boolean(summary?.querySelector('.email-reader__expander')?.textContent.trim()),expandedHeight:open?.getBoundingClientRect().height||0,bodyHeight:(frame||plain)?.getBoundingClientRect().height||0,html:Boolean(frame&&src.includes('<!doctype html>')),sandbox:frame?.getAttribute('sandbox'),csp:src.includes("default-src 'none'"),cid:src.includes('/api/communications/messages/'),attachmentsVisible:Boolean(attachments&&attachments.getBoundingClientRect().height>0),visibleAttachmentCards:open?.querySelectorAll('.email-attachment').length||0,attachmentTotal:attachments?.querySelector('h4')?.textContent||'',replyVisible:reply.length===3&&reply.every(button=>button.getBoundingClientRect().height>0),replyLabels:reply.map(button=>button.textContent.trim()),horizontalOverflow:reader.scrollWidth>reader.clientWidth+1||details.some(item=>item.scrollWidth>item.clientWidth+1)}})()`);
    assert(dark.theme==="dark"&&dark.collapsedHeight>=60&&dark.collapsedSenderVisible&&dark.collapsedRecipientVisible&&dark.collapsedTimeVisible&&dark.expanderVisible,"Collapsed reader headers are not usable");
    assert(dark.expandedHeight>500&&dark.bodyHeight>=448&&dark.html&&dark.sandbox===""&&dark.csp,"Expanded sanitized HTML reader is not usable");
    assert(dark.attachmentsVisible&&dark.visibleAttachmentCards>0&&dark.visibleAttachmentCards<=8,"Compact attachment presentation unavailable");
    assert(dark.replyVisible&&dark.replyLabels.some(value=>value.includes("Reply all"))&&dark.replyLabels.some(value=>value.includes("Forward")),"Reply controls unavailable");
    assert(!dark.horizontalOverflow,"Reader overflowed horizontally");
    await tab.evaluate("document.querySelector('.email-reader__message[open] .email-attachments')?.scrollIntoView({block:'center'})");
    screenshots.push(await capture(tab,"03-reader-attachments-dark"));
    await tab.evaluate("document.querySelector('.email-reader__message[open] .email-reader__reply-actions')?.scrollIntoView({block:'center'})");
    screenshots.push(await capture(tab,"04-reader-reply-actions-dark"));
    await tab.evaluate("document.querySelector('.theme-selector')?.click()");
    await waitFor(()=>tab.evaluate("document.documentElement.dataset.qsTheme==='light'"),"Light theme did not activate");
    await tab.evaluate("document.querySelector('.email-reader__message[open]')?.scrollIntoView({block:'start'})");
    const light=await tab.evaluate("(()=>{const reader=document.querySelector('.email-reader'),open=reader.querySelector('.email-reader__message[open]'),summary=reader.querySelector('.email-reader__message:not([open]) summary'),frame=open?.querySelector('iframe');return{theme:document.documentElement.dataset.qsTheme,collapsedHeight:summary?.getBoundingClientRect().height||0,bodyHeight:frame?.getBoundingClientRect().height||0,horizontalOverflow:reader.scrollWidth>reader.clientWidth+1||open.scrollWidth>open.clientWidth+1}})()");
    assert(light.theme==="light"&&light.collapsedHeight>=60&&light.bodyHeight>=448&&!light.horizontalOverflow,"Light reader geometry failed");
    screenshots.push(await capture(tab,"05-reader-expanded-light"));
    await tab.evaluate("document.querySelector('.theme-selector')?.click()");
    await waitFor(()=>tab.evaluate("document.documentElement.dataset.qsTheme==='dark'"),"Dark theme was not restored");
    const forbidden=tab.requests.filter(request=>/\/api\/(?:communications|drive|documents)/.test(request.url)&&!["GET","HEAD","OPTIONS"].includes(request.method));
    assert(forbidden.length===0,`Live reader acceptance attempted a mutating request: ${JSON.stringify(forbidden)}`);
    assert(tab.diagnostics.length===0,`Browser diagnostics: ${tab.diagnostics.join("; ")}`);
    console.log(JSON.stringify({googleStatus:{configured:status.configured,encryptionConfigured:status.encryptionConfigured,connected:status.connected,gmailAvailable:status.capabilities.gmail.available,driveAvailable:status.capabilities.drive.available},dark,light,darkRestored:await tab.evaluate("document.documentElement.dataset.qsTheme==='dark'"),screenshots,readOnlyApiMutations:forbidden.length},null,2));
  }finally{
    tab?.close();
    cleanup=await controller.stop("final");
    console.log(`Email reader browser cleanup summary: ${JSON.stringify(cleanup)}`);
    await terminateOwnedProcessTrees(services,{platformName:process.platform});
  }
}

run().catch(error=>{console.error(error);process.exitCode=1}).finally(async()=>{const extra=await controller.stop("top-level");if(!extra.skipped)console.log(`Browser top-level cleanup: ${JSON.stringify(extra)}`);await terminateOwnedProcessTrees(services,{platformName:process.platform})});
