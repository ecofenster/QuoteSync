import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { decodeCommunicationAttachment } from '../server/features/communications/communicationsService.js';

const original=Buffer.from('Reviewed disposable drawing version 1'), changed=Buffer.from('Revised disposable drawing version 2');
const digest=(bytes,algorithm='sha256')=>createHash(algorithm).update(bytes).digest('hex');

test('retained checksum guards inline, base64, managed and provider-backed email attachments',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'quotesuite-attachment-integrity-'));
  try {
    await writeFile(path.join(root,'drawing.pdf'),original);
    let providerBytes=original;
    const workspace={googleFetch:async()=>new Response(providerBytes)};
    for(const location of [{bytes:original},{contentBase64:original.toString('base64')},{storageKey:'drawing.pdf'},{driveFileId:'disposable-drawing'}]) {
      const input={fileName:'Reviewed drawing.pdf',sha256:digest(original),...location};
      const result=await decodeCommunicationAttachment(input,root,workspace);assert.deepEqual(result.bytes,original);assert.equal(result.sha256,digest(original));assert.equal(result.sizeBytes,original.length);
      await assert.rejects(()=>decodeCommunicationAttachment({...input,sha256:digest(changed)},root,workspace),error=>error.code==='communication_attachment_changed'&&error.status===409);
    }
    providerBytes=changed;
    await assert.rejects(()=>decodeCommunicationAttachment({driveFileId:'disposable-drawing',sha256:digest(original)},root,workspace),error=>error.code==='communication_attachment_changed');
    const legacy=await decodeCommunicationAttachment({bytes:original,sha256:digest(original,'md5')},root,workspace);assert.equal(legacy.sha256,digest(original));
    await assert.rejects(()=>decodeCommunicationAttachment({bytes:changed,sha256:digest(original,'md5')},root,workspace),error=>error.code==='communication_attachment_changed');
    await assert.rejects(()=>decodeCommunicationAttachment({bytes:original,sha256:'invalid-digest'},root,workspace),error=>error.code==='communication_attachment_changed');
    assert.equal((await decodeCommunicationAttachment({bytes:original},root,workspace)).sha256,digest(original));
  } finally { await rm(root,{recursive:true,force:true}); }
});
