import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import path from 'node:path';
import sqlite3 from 'sqlite3';
import {open} from 'sqlite';
export async function verifyInstallationDocuments({tab,click,waitFor,databasePath,output,inspectPdf}){
  await click(tab,'Files / Documents');await click(tab,'Prepare / review installation documents');
  await waitFor(()=>tab.evaluate("document.querySelectorAll('.installation-documents select').length===3"),'Installation document choices did not load');
  await waitFor(()=>tab.evaluate("[...document.querySelectorAll('.installation-documents button')].some(item=>item.textContent==='Prepare draft PDF'&&!item.disabled)"),'The saved installation calculation did not become available');
  await tab.send('Network.setBlockedURLs',{urls:['*installation-documents/estimates/*']});await click(tab,'Prepare draft PDF');
  await waitFor(()=>tab.evaluate("document.querySelector('.installation-documents [role=alert]')?.textContent.includes('retained')"),'Failure did not preserve document choices');
  await tab.send('Network.setBlockedURLs',{urls:[]});await click(tab,'Prepare draft PDF');
  await waitFor(()=>tab.evaluate("document.querySelector('.installation-documents [role=status]')?.textContent.includes('Not sent')"),'Prepared document did not show its outcome');
  const href=await tab.evaluate("[...document.querySelectorAll('.installation-documents a')].find(item=>item.textContent==='Open prepared PDF').href"),response=await fetch(href);assert.equal(response.status,200);
  const file=path.join(output,'installer-pack-draft.pdf');await writeFile(file,Buffer.from(await response.arrayBuffer()));const pdf=await inspectPdf(file,['Installer pack','DRAFT','Travel time not confirmed'],['Gross profit','Customer selling price']);
  await tab.evaluate("document.querySelector('[aria-label=\"Estimate Files and Documents\"] > header button').click()");await click(tab,'Files / Documents');await click(tab,'Prepare / review installation documents');
  await waitFor(()=>tab.evaluate("document.querySelector('.installation-documents summary')?.textContent.includes('(1)')"),'Reopen lost retained preparation');
  await tab.evaluate("document.querySelector('.installation-documents summary').click()");assert.equal(await tab.evaluate("document.querySelector('.installation-documents details a').href"),href);
  await tab.evaluate("(()=>{const select=document.querySelector('.installation-documents select');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(select,'client');select.dispatchEvent(new Event('change',{bubbles:true}));})()");
  await click(tab,'Prepare draft PDF');await waitFor(()=>tab.evaluate("document.querySelector('.installation-documents [role=status]')?.textContent.includes('Price-Free-Schedule')"),'Client schedule was not prepared');
  const clientHref=await tab.evaluate("[...document.querySelectorAll('.installation-documents a')].find(item=>item.textContent==='Open prepared PDF').href"),clientResponse=await fetch(clientHref);assert.equal(clientResponse.status,200);const clientFile=path.join(output,'client-price-free-draft.pdf');await writeFile(clientFile,Buffer.from(await clientResponse.arrayBuffer()));const clientPdf=await inspectPdf(clientFile,['Schedule without prices','DRAFT'],['Food allowance','Accommodation','Window-cill fitting','Installer operational allowances']);
  // Populate additional history through the real preparation API, only in this owned disposable database.
  const base=clientHref.split('/documents/')[0],context=await(await fetch(base)).json();
  for(let index=0;index<9;index++){const prepared=await fetch(base,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clientId:context.clientId,audience:'client',revision:context.revision,requestKey:`disposable-history-${index}`})});assert.equal(prepared.status,201);}
  await click(tab,'Prepare / review installation documents');await click(tab,'Prepare / review installation documents');
  await waitFor(()=>tab.evaluate("document.querySelector('.installation-documents summary')?.textContent.includes('(11)')"),'Document history total did not refresh');
  await tab.evaluate("(()=>{const details=document.querySelector('.installation-documents details');if(!details.open)details.querySelector('summary').click()})()");
  await tab.send('Network.setBlockedURLs',{urls:['*installation-documents/estimates/*']});await tab.evaluate("[...document.querySelectorAll('.installation-documents details button')].find(item=>item.textContent==='Next').click()");
  await waitFor(()=>tab.evaluate("document.querySelector('.installation-documents [role=alert]')?.textContent.includes('previous page')"),'History failure did not explain retained work');assert.equal(await tab.evaluate("document.querySelectorAll('.installation-documents details a').length"),10);
  await tab.send('Network.setBlockedURLs',{urls:[]});await tab.evaluate("[...document.querySelectorAll('.installation-documents details button')].find(item=>item.textContent==='Next').click()");
  await waitFor(()=>tab.evaluate("document.querySelector('.installation-documents details')?.textContent.includes('Showing 11–11 of 11')"),'History retry did not reach the final bounded page');assert.equal(await tab.evaluate("document.querySelectorAll('.installation-documents details a').length"),1);
  await tab.evaluate("[...document.querySelectorAll('.installation-documents details button')].find(item=>item.textContent==='Previous').click()");await waitFor(()=>tab.evaluate("document.querySelector('.installation-documents details')?.textContent.includes('Showing 1–10 of 11')"),'Previous document page did not restore');
  await tab.send('Emulation.setDeviceMetricsOverride',{width:960,height:600,deviceScaleFactor:1,mobile:false});
  const accessible=await tab.evaluate("(()=>{const button=[...document.querySelectorAll('.installation-documents button')].find(item=>item.textContent==='Prepare draft PDF');button.scrollIntoView({block:'center'});const bounds=button.getBoundingClientRect();return bounds.top>=0&&bounds.bottom<=innerHeight&&document.documentElement.scrollWidth<=innerWidth})()");assert.equal(accessible,true,'Document action is unreachable at 960x600');
  const screenshot=await tab.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(path.join(output,'installation-documents-prepared.png'),Buffer.from(screenshot.data,'base64'));
  const db=await open({filename:databasePath,driver:sqlite3.Database,mode:sqlite3.OPEN_READONLY});try{const rows=await db.all('SELECT id,sha256,audience FROM installation_prepared_documents');assert.equal(rows.length,11);assert.equal(rows.find(item=>item.audience==='installer').sha256,pdf.sha256);assert.equal(rows.find(item=>item.audience==='client').sha256,clientPdf.sha256)}finally{await db.close()}
  console.log(JSON.stringify({scope:'Normal Estimate Files → failed preparation → retained choices/retry → separate installer/client draft PDFs → close/reopen history → 11-document pagination failure/retry',documents:11,smallViewportReachable:true,sent:false,pdf,clientPdf}));
}
