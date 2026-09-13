import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import path from 'node:path';
import sqlite3 from 'sqlite3';
import {open} from 'sqlite';
export async function verifyOrderInstallationDocuments({tab,click,waitFor,databasePath,output,inspectPdf,fixture,appUrl}){
  await click(tab,'Accept Estimate');await waitFor(()=>tab.evaluate("document.querySelectorAll('.portal-external__position-check input').length>0"),'Customer acceptance did not open');
  await tab.evaluate("(()=>{for(const input of document.querySelectorAll('.portal-external__position-check input'))if(!input.checked)input.click();const overall=document.querySelector('.portal-external__overall-check input');if(!overall.checked)overall.click()})()");
  await click(tab,'Submit Estimate acceptance');await waitFor(()=>tab.evaluate("document.body.innerText.includes('Estimate accepted')"),'Customer acceptance was not recorded');
  const db=await open({filename:databasePath,driver:sqlite3.Database,mode:sqlite3.OPEN_READONLY});let order;try{order=await db.get('SELECT * FROM orders WHERE source_estimate_id=?',fixture.estimateId)}finally{await db.close()}assert.ok(order);
  await tab.send('Page.navigate',{url:appUrl});await waitFor(()=>tab.evaluate("document.body.innerText.includes('Client Portal')"),'Staff app did not open');await click(tab,'Orders');
  await waitFor(()=>tab.evaluate("document.querySelector('.accepted-orders-workspace')?.textContent.includes('Open Order journey')"),'Accepted Order did not appear in Orders');
  assert.equal(await tab.evaluate(`document.querySelector('.accepted-orders-workspace').textContent.includes(${JSON.stringify(order.order_ref)})`),true);
  await click(tab,'Estimates marked as Order');await waitFor(()=>tab.evaluate("document.querySelector('.accepted-orders-workspace')?.textContent.includes('Status-driven view')"),'Legacy Order outcome view was lost');await click(tab,'Accepted Orders');
  await tab.send('Network.setBlockedURLs',{urls:['*lifecycle/orders/*']});await click(tab,'Open Order journey');
  await waitFor(()=>tab.evaluate("document.body.innerText.includes('Retry loading Order')"),'Order load failure did not expose recovery');await tab.send('Network.setBlockedURLs',{urls:[]});await click(tab,'Retry loading Order');
  await waitFor(()=>tab.evaluate("document.body.innerText.includes('Prepare / review installation documents')"),'Order installation documents were not offered');await click(tab,'Prepare / review installation documents');
  await waitFor(()=>tab.evaluate("document.querySelectorAll('.installation-documents select').length===3"),'Order source choices did not load');
  assert.deepEqual(await tab.evaluate("(()=>{const select=document.querySelectorAll('.installation-documents select')[1];return {value:select.value,disabled:select.disabled}})()"),{value:order.id,disabled:true});
  await tab.evaluate("(()=>{const select=document.querySelector('.installation-documents select');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(select,'client');select.dispatchEvent(new Event('change',{bubbles:true}))})()");await click(tab,'Prepare draft PDF');
  await waitFor(()=>tab.evaluate("document.querySelector('.installation-documents [role=status]')?.textContent.includes('Not sent')"),'Order schedule did not prepare');
  const href=await tab.evaluate("[...document.querySelectorAll('.installation-documents a')].find(item=>item.textContent==='Open prepared PDF').href"),response=await fetch(href);assert.equal(response.status,200);const file=path.join(output,'accepted-order-price-free-draft.pdf');await writeFile(file,Buffer.from(await response.arrayBuffer()));const pdf=await inspectPdf(file,[order.order_ref,'Schedule without prices','1 Test Journey Street'],['Food allowance','Accommodation','Gross profit']);
  const verify=await open({filename:databasePath,driver:sqlite3.Database,mode:sqlite3.OPEN_READONLY});try{const row=await verify.get('SELECT * FROM installation_prepared_documents');assert.equal(row.order_id,order.id);assert.equal(row.source_revision,order.source_estimate_revision);assert.equal(row.sha256,pdf.sha256);const binding=JSON.parse(row.source_binding_json),accepted=await verify.all('SELECT estimate_position_id FROM portal_position_acceptances WHERE accepted=1');assert.deepEqual(binding.source.positions.map(item=>item.id).sort(),accepted.map(item=>item.estimate_position_id).sort());assert.ok(binding.source.sourceReleaseId);assert.equal((await verify.get('SELECT COUNT(*) count FROM orders')).count,1);assert.equal((await verify.get('SELECT COUNT(*) count FROM factory_order_requests')).count,0)}finally{await verify.close()}
  console.log(JSON.stringify({scope:'Normal customer acceptance → staff Order journey → locked accepted revision → client price-free draft PDF',orderId:order.id,sourceRevision:order.source_estimate_revision,liveDelivery:false,pdf}));
}
