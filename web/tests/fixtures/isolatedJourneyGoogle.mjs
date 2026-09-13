import path from 'node:path';
import {readFile,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {createDisposableGoogleTransport} from './disposableGoogleTransport.mjs';
import {isolatedJourneyMode} from './isolatedJourneyGuard.mjs';

const {root,delivery,factoryDelivery}=isolatedJourneyMode();
const source=await readFile(path.join(root,'provider-source.pdf'));
const message={id:'disposable-supplier-pdf',threadId:'disposable-supplier-thread',labelIds:['INBOX'],snippet:'Attached is the original manufacturer quotation for staff review.',internalDate:String(Date.parse('2026-09-12T09:00:00Z')),payload:{mimeType:'multipart/mixed',headers:[{name:'From',value:process.env.QUOTESUITE_TEST_FACTORY_EMAIL},{name:'Subject',value:'Disposable supplier PDF response'},{name:'To',value:process.env.QUOTESUITE_TEST_CUSTOMER_EMAIL}],parts:[{mimeType:'text/plain',body:{data:Buffer.from('This exact message contains the manufacturer PDF for reviewed filing.').toString('base64url')}},{partId:'1',filename:'web-26-1133450.pdf',mimeType:'application/pdf',body:{attachmentId:'disposable-pdf-part',size:source.length}}]}};
const messages=[message],attachments=new Map([['disposable-supplier-pdf:disposable-pdf-part',source]]);
if(existsSync(path.join(root,'provider-second-source.docx'))){
 const bytes=await readFile(path.join(root,'provider-second-source.docx'));
 messages.push({...message,id:'disposable-zyle-docx',threadId:'disposable-zyle-thread',payload:{...message.payload,headers:message.payload.headers.map(header=>header.name==='Subject'?{...header,value:'Disposable Zyle DOCX response'}:header),parts:[{mimeType:'text/plain',body:{data:Buffer.from('This exact Zyle response contains the retained DOCX price offer for staff review.').toString('base64url')}},{partId:'1',filename:'343117-3_EF-EST-2026-004 - Luke.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',body:{attachmentId:'disposable-docx-part',size:bytes.length}}]}});
 attachments.set('disposable-zyle-docx:disposable-docx-part',bytes);
}
const receiptFile=path.join(root,'disposable-provider-receipts.json');
const receiptState=delivery&&existsSync(receiptFile)?JSON.parse(await readFile(receiptFile,'utf8')):null;
const transport=createDisposableGoogleTransport({messages,attachments,receiptState,files:[{id:'disposable-root',name:'Disposable Estimates',mimeType:'application/vnd.google-apps.folder',parents:[],trashed:false}],delivery:delivery?{allowedRecipients:['customer.journey@example.test',...(factoryDelivery?['factory.journey@example.test']:[])],failFirst:!['supplier-followup','supplier-reconcile','followup-reconcile'].includes(process.env.QUOTESUITE_DISPOSABLE_PROVIDER_DELIVERY),loseFactoryResponse:['factory-reconcile','supplier-reconcile'].includes(process.env.QUOTESUITE_DISPOSABLE_PROVIDER_DELIVERY),loseResponseAt:process.env.QUOTESUITE_DISPOSABLE_PROVIDER_DELIVERY==='followup-reconcile'?2:null}:null});
const originalFetch=globalThis.fetch;
globalThis.fetch=async(url,options)=>{
 const parsed=new URL(String(url));
 if(['127.0.0.1','localhost','[::1]'].includes(parsed.hostname))return originalFetch(url,options);
 const response=await transport.fetchImpl(url,options);
 if(delivery&&parsed.hostname==='gmail.googleapis.com'&&parsed.pathname.endsWith('/messages/send')){await writeFile(receiptFile,JSON.stringify(transport.snapshotReceipts()));await writeFile(path.join(root,'disposable-delivery-evidence.json'),JSON.stringify(transport.deliveryEvidence));}
 return response;
};
