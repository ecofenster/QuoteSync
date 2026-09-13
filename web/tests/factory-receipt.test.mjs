import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {createGmailProvider} from '../server/features/communications/gmailProvider.js';
import {factoryManifest,verifyFactoryReceipt} from '../server/features/communications/factoryReceipt.js';
import {createDisposableGoogleTransport} from './fixtures/disposableGoogleTransport.mjs';

for(const kind of ['Factory','Supplier'])test(`lost ${kind} response is verified from bounded SENT search and exact MIME attachment bytes`,async()=>{
 const bytes=Buffer.from('retained document bytes'),saved={to:['factory.journey@example.test'],subject:'Reviewed factory request',bodyHtml:'<p>Exact reviewed contents</p>',attachments:[{fileName:'schedule.pdf',mediaType:'application/pdf',sha256:createHash('sha256').update(bytes).digest('hex')}]};
 const attempt={receipt_message_id:`<quotesuite-${kind.toLowerCase()}-abcdef@delivery.quotesuite.invalid>`,receipt_manifest_sha256:factoryManifest(saved)};
 const transport=createDisposableGoogleTransport({delivery:{allowedRecipients:saved.to,loseFactoryResponse:true}}),provider=createGmailProvider({googleFetch:transport.fetchImpl});
 await assert.rejects(()=>provider.send({...saved,attachments:[{...saved.attachments[0],bytes}],factoryReceipt:{kind,messageId:attempt.receipt_message_id,manifestSha256:attempt.receipt_manifest_sha256}}),/response lost/);
 const raw=await provider.findFactoryReceipt(attempt.receipt_message_id),verify=(value=raw,retained=saved,readAttachment=provider.attachment)=>verifyFactoryReceipt({raw:value,attempt,saved:retained,readAttachment,kind});
 assert.equal((await verify()).providerMessageId,'disposable-sent-1');assert.equal(transport.deliveryEvidence.sent.length,1);
 for(const alter of [value=>value.labelIds=[],value=>value.internalDate='invalid',value=>value.payload.headers.find(h=>h.name==='Message-ID').value='wrong',value=>value.payload.headers.find(h=>h.name==='To').value='other@example.test',value=>value.payload.parts[0].body.data=Buffer.from('changed').toString('base64url'),value=>value.payload.parts.pop()]){const changed=structuredClone(raw);alter(changed);assert.equal(await verify(changed),null)}
 assert.equal(await verify(raw,{...saved,subject:'Changed locally'}),null);
 assert.equal(await verify(raw,saved,async()=>Buffer.from('wrong bytes')),null);
 assert.equal(await provider.findFactoryReceipt('<quotesuite-factory-dead@delivery.quotesuite.invalid>'),null);
 assert.equal(await provider.findFactoryReceipt('unsafe search'),null);
 const ambiguous=createGmailProvider({googleFetch:async()=>new Response(JSON.stringify({messages:[{id:'one'},{id:'two'}]}))});assert.equal(await ambiguous.findFactoryReceipt(attempt.receipt_message_id),null);
});
