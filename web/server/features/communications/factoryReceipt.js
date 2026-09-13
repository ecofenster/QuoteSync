import {createHash} from 'node:crypto';
import {mapGmailMessage} from './gmailProvider.js';
export const factoryManifest=input=>createHash('sha256').update(JSON.stringify({to:input.to,cc:input.cc||[],bcc:input.bcc||[],subject:input.subject,bodyHtml:input.bodyHtml,attachments:(input.attachments||[]).map(file=>({name:file.fileName,type:file.mediaType,checksum:file.sha256}))})).digest('hex');
const header=(message,name)=>message.payload?.headers?.find(item=>item.name.toLowerCase()===name.toLowerCase())?.value||'';
const address=value=>String(value).trim().toLowerCase().replace(/^.*<([^>]+)>$/,'$1');

export async function verifyFactoryReceipt({raw,attempt,saved,readAttachment,kind='Factory'}){
  if(!raw?.id||!raw.labelIds?.includes('SENT')||header(raw,'Message-ID')!==attempt.receipt_message_id||header(raw,`X-QuoteSuite-${kind}-Manifest`)!==attempt.receipt_manifest_sha256||factoryManifest(saved)!==attempt.receipt_manifest_sha256)return null;
  if(!raw.internalDate||!Number.isFinite(new Date(Number(raw.internalDate)).getTime()))return null;
  const message=mapGmailMessage(raw);
  if(message.subject!==saved.subject||message.bodyHtml.replaceAll('\r\n','\n')!==String(saved.bodyHtml).replaceAll('\r\n','\n')||['to','cc','bcc'].some(key=>JSON.stringify(message[key].map(address).sort())!==JSON.stringify((saved[key]||[]).map(address).sort())))return null;
  if(message.attachments.length!==(saved.attachments||[]).length||message.attachments.length>21)return null;
  const actual=[];
  for(const file of message.attachments){const bytes=await readAttachment(raw.id,file.providerAttachmentId);actual.push({name:file.fileName,type:file.mediaType,sha256:createHash('sha256').update(bytes).digest('hex'),md5:createHash('md5').update(bytes).digest('hex')})}
  for(const file of saved.attachments||[]){const checksum=String(file.sha256||'').toLowerCase(),index=actual.findIndex(item=>item.name===file.fileName&&item.type===file.mediaType&&(item.sha256===checksum||item.md5===checksum));if(index<0)return null;actual.splice(index,1)}
  return {providerMessageId:raw.id,threadId:raw.threadId||null,sentAt:message.sentAt};
}
