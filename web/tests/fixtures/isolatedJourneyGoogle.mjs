import path from 'node:path';
import {readFile} from 'node:fs/promises';
import {createDisposableGoogleTransport} from './disposableGoogleTransport.mjs';

const database=path.resolve(process.env.QUOTESUITE_DB_PATH||''),root=path.dirname(database);
if(process.env.NODE_ENV!=='development'||process.env.QUOTESUITE_TEST_JOURNEY!=='1'||process.env.QUOTESUITE_TEST_DELIVERY_ENABLED!=='0'||!path.basename(root).startsWith('quotesuite-complete-journey-'))throw new Error('Disposable Google transport requires the owned delivery-disabled journey workspace.');
const source=await readFile(path.join(root,'provider-source.pdf'));
const message={id:'disposable-supplier-pdf',threadId:'disposable-supplier-thread',labelIds:['INBOX'],snippet:'Attached is the original manufacturer quotation for staff review.',internalDate:String(Date.parse('2026-09-12T09:00:00Z')),payload:{mimeType:'multipart/mixed',headers:[{name:'From',value:process.env.QUOTESUITE_TEST_FACTORY_EMAIL},{name:'Subject',value:'Disposable supplier PDF response'},{name:'To',value:process.env.QUOTESUITE_TEST_CUSTOMER_EMAIL}],parts:[{mimeType:'text/plain',body:{data:Buffer.from('This exact message contains the manufacturer PDF for reviewed filing.').toString('base64url')}},{partId:'1',filename:'web-26-1133450.pdf',mimeType:'application/pdf',body:{attachmentId:'disposable-pdf-part',size:source.length}}]}};
const transport=createDisposableGoogleTransport({messages:[message],attachments:new Map([['disposable-supplier-pdf:disposable-pdf-part',source]]),files:[{id:'disposable-root',name:'Disposable Estimates',mimeType:'application/vnd.google-apps.folder',parents:[],trashed:false}]});
const originalFetch=globalThis.fetch;
globalThis.fetch=(url,options)=>{
 const parsed=new URL(String(url));
 if(['127.0.0.1','localhost','[::1]'].includes(parsed.hostname))return originalFetch(url,options);
 return transport.fetchImpl(url,options);
};
