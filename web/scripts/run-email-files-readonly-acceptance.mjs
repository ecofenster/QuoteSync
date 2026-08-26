import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { createPhase6ProfileDirectory } from "./e2e-chrome-profile.mjs";
import { createBrowserRunController, countBrowserRunProfiles } from "./browser-run-lifecycle.mjs";
import { terminateOwnedProcessTrees } from "./e2e-owned-process.mjs";

const APP_URL="http://127.0.0.1:4181",API_URL="http://127.0.0.1:3011",DEBUG_PORT=9291;
const evidenceDirectory=resolve("test-output",`email-files-readonly-${new Date().toISOString().replace(/[:.]/g,"-")}`);
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
  const userDataDir=await createPhase6ProfileDirectory(),before=await countBrowserRunProfiles(userDataDir,{platformName:process.platform});
  controller.setRun({label:"email-files-readonly",userDataDir,debugPort:DEBUG_PORT,startedAt:new Date().toISOString(),profileProcessCountBefore:before});
  const child=spawn("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",["--headless=new",`--remote-debugging-port=${DEBUG_PORT}`,`--user-data-dir=${userDataDir}`,"--no-first-run","--disable-gpu","--disable-extensions","about:blank"],{stdio:"ignore",windowsHide:true});
  controller.setRun({child});
  await waitFor(()=>reachable(`http://127.0.0.1:${DEBUG_PORT}/json/version`),"Owned Chrome did not start",15000);
  controller.setRun({profileProcessCountDuring:await countBrowserRunProfiles(userDataDir,{platformName:process.platform})});
  return {child,userDataDir};
}

async function connect(){
  await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/new?${encodeURIComponent(APP_URL)}`,{method:"PUT"});
  const targets=await(await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json(),target=targets.find(item=>item.type==="page"&&item.url.startsWith(APP_URL));
  assert(target,"Application browser target was not created");
  const socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{socket.addEventListener("open",resolve,{once:true});socket.addEventListener("error",reject,{once:true})});
  let id=0;const pending=new Map(),diagnostics=[],requests=[];
  socket.addEventListener("message",event=>{const message=JSON.parse(String(event.data));if(message.method==="Runtime.exceptionThrown")diagnostics.push(message.params?.exceptionDetails?.text||"Runtime exception");if(message.method==="Network.requestWillBeSent")requests.push({url:message.params.request.url,method:message.params.request.method});if(message.id&&pending.has(message.id)){const task=pending.get(message.id);pending.delete(message.id);message.error?task.reject(new Error(message.error.message)):task.resolve(message.result)}});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const call=++id;pending.set(call,{resolve,reject});socket.send(JSON.stringify({id:call,method,params}))});
  const evaluate=async expression=>{const result=await send("Runtime.evaluate",{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text);return result.result?.value};
  await send("Runtime.enable");await send("Page.enable");await send("Network.enable");await send("Page.navigate",{url:APP_URL});
  return {send,evaluate,diagnostics,requests,close:()=>socket.close()};
}

const clickText=(tab,text,selector="button")=>waitFor(()=>tab.evaluate(`(()=>{const node=[...document.querySelectorAll(${JSON.stringify(selector)})].find(item=>item.textContent.trim()===${JSON.stringify(text)});if(!node)return false;node.click();return true})()`),`Control unavailable: ${text}`);
const capture=async(tab,name)=>{const shot=await tab.send("Page.captureScreenshot",{format:"png",captureBeyondViewport:false});assert(shot.data.length>1000,`Screenshot capture failed: ${name}`);const target=resolve(evidenceDirectory,`${name}.png`);await writeFile(target,Buffer.from(shot.data,"base64"));return target};
async function openMailbox(tab,label){await waitFor(()=>tab.evaluate(`(()=>{const button=[...document.querySelectorAll('.email-mailnav button')].find(node=>[...node.querySelectorAll('span')].some(span=>span.textContent.trim()===${JSON.stringify(label)}));if(!button)return false;button.click();return true})()`),`Mailbox unavailable: ${label}`);await waitFor(()=>tab.evaluate(`document.querySelector('.email-list-toolbar__range')?.textContent.trim()===${JSON.stringify(label)}&&!document.querySelector('[aria-label="Refresh mailbox"]')?.disabled`),`Mailbox did not finish loading: ${label}`);const error=await tab.evaluate("document.querySelector('.email-workspace__error')?.textContent.trim()||''");assert(!error,`${label} mailbox failed: ${error}`);return tab.evaluate("document.querySelectorAll('.email-message-row').length")}
async function forceState(tab,selector,states){assert(Array.isArray(states)&&states.length>0,"Forced pseudo-classes must be a non-empty array");await tab.send("DOM.enable");await tab.send("CSS.enable");const root=await tab.send("DOM.getDocument"),node=await tab.send("DOM.querySelector",{nodeId:root.root.nodeId,selector});assert(node.nodeId,`State target unavailable: ${selector}`);await tab.send("CSS.forcePseudoState",{nodeId:node.nodeId,forcedPseudoClasses:states})}

async function run(){
  await mkdir(evidenceDirectory,{recursive:true});
  launchServices();
  await waitFor(()=>reachable(`${API_URL}/api/clients`),"Owned API unavailable");
  await waitFor(()=>reachable(APP_URL),"Owned Vite unavailable");
  const status=await(await fetch(`${API_URL}/api/communications/status`)).json();
  assert(status.configured&&status.encryptionConfigured&&status.connected&&status.capabilities?.gmail?.available&&status.capabilities?.drive?.available,"Owned API did not load the persisted connected Google state");
  const browser=await launchChrome();let tab,cleanup;
  try{
    tab=await connect();
    await tab.send("Emulation.setDeviceMetricsOverride",{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
    await waitFor(()=>tab.evaluate("Boolean(document.querySelector('.theme-selector'))"),"Application shell unavailable");
    if(await tab.evaluate("document.documentElement.dataset.qsTheme!=='dark'"))await tab.evaluate("document.querySelector('.theme-selector')?.click()");
    await waitFor(()=>tab.evaluate("document.documentElement.dataset.qsTheme==='dark'"),"Dark theme did not activate");
    await clickText(tab,"Email",".app-sidebar-item");
    await waitFor(()=>tab.evaluate("Boolean(document.querySelector('.email-workspace'))"),"Email workspace unavailable");
    assert(!await tab.evaluate("Boolean(document.querySelector('.email-workspace--disconnected'))"),"Email rendered disconnected");
    await waitFor(()=>tab.evaluate("document.querySelectorAll('.email-message-row').length>0"),"Inbox returned no visible conversations");
    const screenshots=[];screenshots.push(await capture(tab,"01-email-inbox-dark"));
    const navigation=await tab.evaluate(`(()=>({buttons:[...document.querySelectorAll('.email-mailnav button')].map(node=>node.textContent.replace(/\\s+/g,' ').trim()),inboxUnread:[...document.querySelectorAll('.email-mailnav button')].find(node=>[...node.querySelectorAll('span')].some(span=>span.textContent.trim()==='Inbox'))?.querySelector('strong')?.textContent.trim()||'0',categories:document.querySelectorAll('.email-mailnav__group--categories button').length,userLabels:[...document.querySelectorAll('.email-mailnav__group')].find(group=>group.querySelector('small')?.textContent.trim()==='Labels')?.querySelectorAll('button').length||0,nestedLabels:[...document.querySelectorAll('.email-mailnav .email-label-indent')].filter(node=>Number(getComputedStyle(node).getPropertyValue('--label-depth'))>0).length}))()`);
    for(const name of ["Inbox","Starred","Sent","Drafts"])assert(navigation.buttons.some(value=>value.includes(name)),`${name} navigation is missing`);
    await clickText(tab,"⌄ More",".email-mailnav__more");
    await waitFor(()=>tab.evaluate("document.querySelector('.email-mailnav__more')?.textContent.includes('Less')"),"More/Less navigation did not expand");
    Object.assign(navigation,await tab.evaluate(`(()=>({buttons:[...document.querySelectorAll('.email-mailnav button')].map(node=>node.textContent.replace(/\\s+/g,' ').trim()),userLabels:[...document.querySelectorAll('.email-mailnav__group')].find(group=>group.querySelector('small')?.textContent.trim()==='Labels')?.querySelectorAll('button').length||0,nestedLabels:[...document.querySelectorAll('.email-mailnav .email-label-indent')].filter(node=>Number(getComputedStyle(node).getPropertyValue('--label-depth'))>0).length}))()`));
    screenshots.push(await capture(tab,"02-mailbox-more-labels-dark"));
    const mailboxLoads={};
    let nestedLabelOpened=false;if(navigation.nestedLabels){nestedLabelOpened=await tab.evaluate("(()=>{const label=[...document.querySelectorAll('.email-mailnav .email-label-indent')].find(node=>Number(getComputedStyle(node).getPropertyValue('--label-depth'))>0);if(!label)return false;label.closest('button')?.click();return true})()");await waitFor(()=>tab.evaluate("!document.querySelector('[aria-label=\"Refresh mailbox\"]')?.disabled"),"Nested-label mailbox did not load");assert(!await tab.evaluate("Boolean(document.querySelector('.email-workspace__error'))"),"Nested-label mailbox failed")}
    await openMailbox(tab,"Inbox");
    const listState=await tab.evaluate(`(()=>{const rows=[...document.querySelectorAll('.email-message-row')],first=rows[0],unread=rows.find(row=>row.classList.contains('is-unread')),time=first.querySelector('time'),style=getComputedStyle(first);return{rows:rows.length,minHeight:parseFloat(style.minHeight),divider:style.borderBottomStyle,dateTime:time?.textContent||'',unreadCount:rows.filter(row=>row.classList.contains('is-unread')).length,unreadWeight:unread?getComputedStyle(unread.querySelector('.email-message-row__sender')).fontWeight:null,threadIndicators:rows.filter(row=>Boolean(row.querySelector('.email-message-row__meta span[title$="messages"]'))).length,attachmentIndicators:rows.filter(row=>Boolean(row.querySelector('.email-message-row__meta span[title*="attachment"]'))).length}})()`);
    assert(listState.minHeight<=70&&listState.divider!=="none"&&/\d{2}\s\w{3}\s\d{4}\s·\s\d{2}:\d{2}/.test(listState.dateTime),`Compact row/date/divider validation failed: ${JSON.stringify(listState)}`);
    assert(listState.unreadCount===0||Number(listState.unreadWeight)>=700,"Unread rows are not bold");
    await tab.evaluate("(document.querySelector('.email-message-row.is-unread')||document.querySelector('.email-message-row'))?.querySelector('input[type=checkbox]')?.click()");
    await waitFor(()=>tab.evaluate("Boolean(document.querySelector('.email-message-row.is-selected'))"),"Selected row highlight unavailable");
    const selection=await tab.evaluate("(()=>{const row=document.querySelector('.email-message-row.is-selected'),s=getComputedStyle(row);return{fullRow:row?.classList.contains('is-selected'),unread:row?.classList.contains('is-unread'),background:s.backgroundColor,senderWeight:getComputedStyle(row.querySelector('.email-message-row__sender')).fontWeight,subjectWeight:getComputedStyle(row.querySelector('.email-message-row__content strong')).fontWeight}})()");assert(selection.fullRow&&selection.background,"Selected full-row state unavailable");assert(!selection.unread||Number(selection.senderWeight)>=700&&Number(selection.subjectWeight)>=700,"Selected unread state lost bold emphasis");
    await forceState(tab,".email-message-row",["hover"]);const hover=await tab.evaluate("(()=>{const row=document.querySelector('.email-message-row');return{background:getComputedStyle(row).backgroundColor}})()");
    await forceState(tab,".email-message-row",["focus","focus-visible"]);const focus=await tab.evaluate("(()=>{const row=document.querySelector('.email-message-row');const s=getComputedStyle(row);return{outline:s.outlineStyle,width:s.outlineWidth}})()");
    assert(hover.background&&focus.outline!=="none","Row hover/focus presentation unavailable");screenshots.push(await capture(tab,"04-email-selected-hover-focus-dark"));
    await tab.evaluate("document.querySelector('.email-message-row')?.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:420,clientY:300}))");
    await waitFor(()=>tab.evaluate("Boolean(document.querySelector('[role=menu][aria-label=\"Message actions\"]'))"),"Right-click menu did not open");
    assert(await tab.evaluate("[...document.querySelectorAll('[role=menu] button')].some(node=>node.textContent.includes('Move to'))"),"Move action unavailable in context menu");
    const contextMenu=await tab.evaluate("(()=>{const rect=document.querySelector('[role=menu][aria-label=\"Message actions\"]')?.getBoundingClientRect();return{x:rect?.x,y:rect?.y,right:rect?.right,bottom:rect?.bottom,withinViewport:Boolean(rect&&rect.x>=0&&rect.y>=0&&rect.right<=innerWidth&&rect.bottom<=innerHeight)}})()");assert(contextMenu.withinViewport,"Right-click menu overflowed the viewport");screenshots.push(await capture(tab,"02-email-context-menu-dark"));
    await tab.evaluate("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))");
    const openedAttachment=await tab.evaluate(`(()=>{const row=[...document.querySelectorAll('.email-message-row')].find(item=>item.querySelector('.email-message-row__meta span[title*="attachment"]'))||document.querySelector('.email-message-row');if(!row)return false;row.click();return true})()`);assert(openedAttachment,"No conversation row could be opened");
    await waitFor(()=>tab.evaluate("Boolean(document.querySelector('.email-reader iframe'))"),"Conversation reader unavailable");
    const reader=await tab.evaluate(`(()=>{const frame=document.querySelector('.email-reader iframe'),src=frame?.getAttribute('srcdoc')||'',dates=[...document.querySelectorAll('.email-reader__message summary time')].map(node=>Date.parse(node.dateTime)).filter(Number.isFinite),buttons=[...document.querySelectorAll('.email-reader button')].map(node=>node.textContent.trim());return{messages:document.querySelectorAll('.email-reader__message').length,chronological:dates.every((value,index)=>index===0||value>=dates[index-1]),sandbox:frame?.getAttribute('sandbox'),csp:src.includes('Content-Security-Policy')&&src.includes("default-src 'none'"),html:src.includes('<!doctype html>'),cid:src.includes('/api/communications/messages/'),attachments:document.querySelectorAll('.email-attachment').length,context:Boolean(document.querySelector('.email-context-panel')),reply:buttons.some(value=>value.includes('Reply')),replyAll:buttons.some(value=>value.includes('Reply all')),forward:buttons.some(value=>value.includes('Forward'))}})()`);
    assert(reader.messages>0&&reader.chronological&&reader.sandbox===""&&reader.csp&&reader.html&&reader.context&&reader.reply&&reader.replyAll&&reader.forward,`Conversation/sanitized HTML validation failed: ${JSON.stringify(reader)}`);screenshots.push(await capture(tab,"03-email-conversation-reader-dark"));
    await clickText(tab,"Client Database",".app-sidebar-item");await waitFor(()=>tab.evaluate("Boolean(document.querySelector('[data-testid=\"client-database-row\"]'))"),"Client Database unavailable");
    await tab.evaluate("document.querySelector('[data-testid=\"client-database-row\"] .ui-button--primary')?.click()");await waitFor(()=>tab.evaluate("Boolean(document.querySelector('.ep-tab-list'))"),"Client workspace unavailable");
    await clickText(tab,"Files",".ep-tab-list button");await waitFor(()=>tab.evaluate("Boolean(document.querySelector('.canonical-documents'))"),"Client Files unavailable");
    const clientFiles=await tab.evaluate("(()=>{const panel=document.querySelector('.canonical-documents'),button=panel.querySelector('.ui-button'),s=getComputedStyle(panel),bs=getComputedStyle(button);return{theme:s.color,background:getComputedStyle(panel.querySelector('.canonical-documents__filters')).backgroundColor,canonicalButton:button?.classList.contains('ui-button'),buttonRadius:parseFloat(bs.borderRadius),heading:panel.querySelector('h3')?.textContent,overflow:panel.scrollWidth>panel.clientWidth+1,compactRows:document.querySelectorAll('.canonical-documents__row').length}})()");assert(clientFiles.canonicalButton&&clientFiles.heading==="Client Files"&&!clientFiles.overflow&&clientFiles.buttonRadius<100,"Client Files canonical styling unavailable");screenshots.push(await capture(tab,"04-client-files-dark"));
    await clickText(tab,"Estimates",".app-sidebar-item");await waitFor(()=>tab.evaluate("Boolean(document.querySelector('.estimate-index-actions .ui-button--primary'))"),"Estimate index unavailable");
    await tab.evaluate("document.querySelector('.estimate-index-actions .ui-button--primary')?.click()");await waitFor(()=>tab.evaluate("Boolean(document.querySelector('.estimate-commercial'))"),"Estimate workspace unavailable");
    await clickText(tab,"Files / Documents");await waitFor(()=>tab.evaluate("Boolean(document.querySelector('[aria-label=\"Estimate Files and Documents\"] .canonical-documents'))"),"Estimate Files/Documents unavailable");
    const estimateFiles=await tab.evaluate("(()=>{const panel=document.querySelector('[aria-label=\"Estimate Files and Documents\"] .canonical-documents'),button=panel.querySelector('.ui-button');return{heading:panel.querySelector('h3')?.textContent,canonicalButton:button?.classList.contains('ui-button'),buttonRadius:parseFloat(getComputedStyle(button).borderRadius),background:getComputedStyle(panel.querySelector('.canonical-documents__filters')).backgroundColor,dark:document.documentElement.dataset.qsTheme,overflow:panel.scrollWidth>panel.clientWidth+1,compactRows:document.querySelectorAll('.canonical-documents__row').length}})()");assert(estimateFiles.heading==="Estimate Files / Documents"&&estimateFiles.canonicalButton&&estimateFiles.buttonRadius<100&&!estimateFiles.overflow&&estimateFiles.dark==="dark","Estimate Files canonical dark styling unavailable");assert(clientFiles.background===estimateFiles.background,"Client and Estimate Files do not share the same surface language");screenshots.push(await capture(tab,"05-estimate-files-dark"));
    await tab.evaluate("document.querySelector('.theme-selector')?.click()");await waitFor(()=>tab.evaluate("document.documentElement.dataset.qsTheme==='light'"),"Light theme did not activate");const lightFiles=await tab.evaluate("(()=>{const panel=document.querySelector('[aria-label=\"Estimate Files and Documents\"] .canonical-documents'),filters=panel.querySelector('.canonical-documents__filters');return{theme:document.documentElement.dataset.qsTheme,color:getComputedStyle(panel).color,background:getComputedStyle(filters).backgroundColor,overflow:panel.scrollWidth>panel.clientWidth+1}})()");assert(lightFiles.theme==="light"&&!lightFiles.overflow,"Estimate Files light-theme presentation failed");screenshots.push(await capture(tab,"06-estimate-files-light"));await tab.evaluate("document.querySelector('.theme-selector')?.click()");await waitFor(()=>tab.evaluate("document.documentElement.dataset.qsTheme==='dark'"),"Dark theme was not restored");
    const forbidden=tab.requests.filter(request=>/\/api\/(?:communications|drive|documents)/.test(request.url)&&!["GET","HEAD","OPTIONS"].includes(request.method));assert(forbidden.length===0,`Live acceptance attempted mutating Email/Drive/Files requests: ${JSON.stringify(forbidden)}`);
    assert(tab.diagnostics.length===0,`Browser diagnostics: ${tab.diagnostics.join("; ")}`);
    console.log(JSON.stringify({googleStatus:{configured:status.configured,encryptionConfigured:status.encryptionConfigured,connected:status.connected,gmailAvailable:status.capabilities.gmail.available,driveAvailable:status.capabilities.drive.available},navigation:{primary:true,moreLess:true,inboxUnread:navigation.inboxUnread,categories:navigation.categories,userLabels:navigation.userLabels,nestedLabels:navigation.nestedLabels,nestedLabelOpened,mailboxLoads},list:listState,selection,hover,focus,contextMenu,reader,clientFiles,estimateFiles,lightFiles,darkRestored:await tab.evaluate("document.documentElement.dataset.qsTheme==='dark'"),screenshots,readOnlyApiMutations:forbidden.length},null,2));
  }finally{
    tab?.close();cleanup=await controller.stop("final");console.log(`Email/Files browser cleanup summary: ${JSON.stringify(cleanup)}`);await terminateOwnedProcessTrees(services,{platformName:process.platform});
  }
}

run().catch(error=>{console.error(error);process.exitCode=1}).finally(async()=>{const extra=await controller.stop("top-level");if(!extra.skipped)console.log(`Browser top-level cleanup: ${JSON.stringify(extra)}`);await terminateOwnedProcessTrees(services,{platformName:process.platform})});
