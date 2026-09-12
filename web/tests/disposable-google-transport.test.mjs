import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createDisposableGoogleTransport} from './fixtures/disposableGoogleTransport.mjs';
import {createGoogleDriveProvider} from '../server/features/documents/googleDriveProvider.js';

test('disposable Google transport retains exact real PDF through production Drive adapter and refuses delivery',async()=>{
 const bytes=await readFile('docs/Supplier_Quotes/John_Wingfield/web-26-1133450.pdf');
 const transport=createDisposableGoogleTransport({messages:[{id:'new',threadId:'same'},{id:'old',threadId:'same'}],attachments:new Map([['old:pdf',bytes]]),pageSize:1});
 const drive=createGoogleDriveProvider({googleFetch:transport.fetchImpl});
 const folder=await drive.createFolder({parentId:'root',name:'Suppliers',estimateId:'test-estimate',logicalKey:'supplier_documents'});
 assert.equal((await drive.findFolder({parentId:'root',estimateId:'test-estimate',logicalKey:'supplier_documents'})).id,folder.id);
 assert.equal(await drive.findFolder({parentId:'root',estimateId:'other-estimate',logicalKey:'supplier_documents'}),null);
 const file=await drive.uploadFile({parentId:folder.id,fileName:'source.pdf',mediaType:'application/pdf',bytes,appProperties:{quotesuiteCommunicationAttachmentId:'old:pdf'}});
 assert.deepEqual(transport.binaries.get(file.id),bytes);
 assert.equal((await drive.listChildren({parentId:folder.id}))[0].id,file.id);
 const first=await (await transport.fetchImpl('https://gmail.googleapis.com/gmail/v1/users/me/messages')).json();assert.equal(first.messages[0].id,'new');assert.equal(first.nextPageToken,'1');
 const second=await (await transport.fetchImpl('https://gmail.googleapis.com/gmail/v1/users/me/messages?pageToken=1')).json();assert.equal(second.messages[0].id,'old');assert.equal(second.nextPageToken,undefined);
 const attachment=await (await transport.fetchImpl('https://gmail.googleapis.com/gmail/v1/users/me/messages/old/attachments/pdf')).json();assert.deepEqual(Buffer.from(attachment.data,'base64url'),bytes);
 await assert.rejects(()=>transport.fetchImpl('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',{method:'POST'}),/refuses Gmail writes/);
 await assert.rejects(()=>transport.fetchImpl('https://example.com'),/Unsupported disposable/);
});
