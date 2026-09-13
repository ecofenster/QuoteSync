import {createHash,randomUUID} from 'node:crypto';

// Test-only provider transport. No network fallback; delivery is refused by
// default and can only be simulated for explicitly configured test recipients.
// Production Gmail/Drive adapters still perform their normal mapping and IO.
export function createDisposableGoogleTransport({messages=[],attachments=new Map(),files=[],pageSize=2,delivery=null,receiptState=null}={}){
 const stored=new Map(files.map(file=>[file.id,{...file}])),binaries=new Map(),calls=[];
 const deliveryEvidence={attempts:0,sent:[]};
 if(delivery&&(!delivery.allowedRecipients?.length||delivery.allowedRecipients.some(value=>!/^[-\w.+]+@example\.test$/.test(value))))throw new Error('Disposable delivery requires explicit example.test recipients.');
 if(receiptState){
  if(!delivery||receiptState.version!==1||!Array.isArray(receiptState.evidence?.sent)||receiptState.evidence.sent.some(item=>!item.recipients?.length||item.recipients.some(value=>!delivery.allowedRecipients.includes(value))))throw new Error('Retained disposable receipts require the same explicit test recipient boundary.');
  Object.assign(deliveryEvidence,structuredClone(receiptState.evidence));
  messages.push(...structuredClone(receiptState.messages));
  for(const [id,data] of receiptState.attachments)attachments.set(id,Buffer.from(data,'base64'));
 }
 const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
 const fetchImpl=async(raw,options={})=>{
  const url=new URL(String(raw)),method=String(options.method||'GET').toUpperCase();calls.push({method,path:url.pathname});
  if(url.hostname==='gmail.googleapis.com'){
   if(method==='POST'&&url.pathname==='/gmail/v1/users/me/messages/send'&&delivery){
    const payload=JSON.parse(options.body),mime=Buffer.from(payload.raw||'','base64url').toString('utf8'),headers=mime.split('\r\n\r\n')[0];
    const recipientHeaders=[...headers.matchAll(/^(To|Cc|Bcc):\s*(.*)$/gmi)];
    const recipients=recipientHeaders.flatMap(([,,value])=>value.split(',').map(address=>address.trim().replace(/\r$/,'')));
    if(!recipients.length||!recipientHeaders.some(([,,value])=>value.trim())||recipients.some(address=>!delivery.allowedRecipients.includes(address)))throw new Error('Disposable delivery recipient is not allowlisted.');
    deliveryEvidence.attempts++;
    if(delivery.failFirst&&deliveryEvidence.attempts===1)return json({error:{message:'Disposable provider interruption. Nothing was sent; retry safely.'}},503);
    const id=`disposable-sent-${deliveryEvidence.sent.length+1}`,threadId=payload.threadId||id;
    deliveryEvidence.sent.push({id,threadId,raw:payload.raw,recipients});
    const boundary=headers.match(/boundary="([^"]+)"/)?.[1];
    const parts=mime.split(`--${boundary}`).slice(1,-1).map((part,index)=>{
     const content=part.replace(/^\r\n/,'').replace(/\r\n$/,''),split=content.indexOf('\r\n\r\n'),head=content.slice(0,split),body=content.slice(split+4),mimeType=head.match(/Content-Type: ([^;\r]+)/i)?.[1],filename=head.match(/filename="([^"]+)"/i)?.[1];
     if(filename){const bytes=Buffer.from(body,'base64'),attachmentId=`receipt-part-${index}`;attachments.set(`${id}:${attachmentId}`,bytes);return {partId:String(index),filename,mimeType,body:{attachmentId,size:bytes.length}}}
     return {mimeType,body:{data:Buffer.from(body).toString('base64url')}};
    });
    messages.push({id,threadId,labelIds:['SENT'],internalDate:String(Date.now()),payload:{mimeType:'multipart/mixed',headers:headers.split('\r\n').map(line=>({name:line.slice(0,line.indexOf(':')),value:line.slice(line.indexOf(':')+1).trim()})),parts}});
    if((delivery.loseFactoryResponse&&recipients.includes('factory.journey@example.test'))||delivery.loseResponseAt===deliveryEvidence.attempts)return json({error:{message:'Disposable response lost after provider acceptance'}},503);
    return json({id,threadId});
   }
   if(method!=='GET')throw new Error('Disposable provider refuses Gmail writes and delivery.');
   if(url.pathname.endsWith('/labels'))return json({labels:[]});
   if(url.pathname.endsWith('/profile'))return json({historyId:'1'});
   if(url.pathname.endsWith('/history'))return json({historyId:'1',history:[]});
   const thread=url.pathname.match(/\/threads\/([^/]+)$/);
   if(thread){const id=decodeURIComponent(thread[1]);return json({id,messages:messages.filter(message=>message.threadId===id)});}
   if(url.pathname.endsWith('/threads')){
    const sender=url.searchParams.get('q')?.match(/from:([^\s]+)/)?.[1],label=url.searchParams.get('labelIds');
    const filtered=messages.filter(message=>(!label||message.labelIds?.includes(label))&&(!sender||message.payload?.headers?.some(header=>header.name.toLowerCase()==='from'&&header.value.includes(sender))));
    const ids=[...new Set(filtered.map(message=>message.threadId))],offset=Number(url.searchParams.get('pageToken')||0),end=offset+pageSize;
    return json({threads:ids.slice(offset,end).map(id=>({id})),...(end<ids.length?{nextPageToken:String(end)}:{})});
   }
   const attachment=url.pathname.match(/\/messages\/([^/]+)\/attachments\/([^/]+)$/);
   if(attachment){const bytes=attachments.get(`${decodeURIComponent(attachment[1])}:${decodeURIComponent(attachment[2])}`);return bytes?json({data:Buffer.from(bytes).toString('base64url'),size:bytes.length}):json({error:{message:'Disposable attachment not found'}},404);}
   const message=url.pathname.match(/\/messages\/([^/]+)$/);
   if(message){const found=messages.find(item=>item.id===decodeURIComponent(message[1]));return found?json(found):json({error:{message:'Disposable message not found'}},404);}
   if(url.pathname.endsWith('/messages')){
    const sender=url.searchParams.get('q')?.match(/from:([^\s]+)/)?.[1];
    const receipt=url.searchParams.get('q')?.match(/rfc822msgid:(\S+)/)?.[1];
    const filtered=messages.filter(message=>(!sender||message.payload?.headers?.some(header=>header.name.toLowerCase()==='from'&&header.value.includes(sender)))&&(!receipt||(message.labelIds?.includes('SENT')&&message.payload?.headers?.some(header=>header.name.toLowerCase()==='message-id'&&header.value===receipt))));
    const offset=Number(url.searchParams.get('pageToken')||0);if(!Number.isSafeInteger(offset)||offset<0)throw new Error('Invalid disposable page cursor');
    const end=offset+Math.min(pageSize,Number(url.searchParams.get('maxResults')||pageSize));
    return json({messages:filtered.slice(offset,end).map(({id,threadId})=>({id,threadId})),...(end<filtered.length?{nextPageToken:String(end)}:{}),resultSizeEstimate:filtered.length});
   }
  }
  if(url.hostname==='www.googleapis.com'&&url.pathname.startsWith('/drive/v3/files')){
   const id=decodeURIComponent(url.pathname.slice('/drive/v3/files/'.length));
   if(method==='GET'&&url.pathname==='/drive/v3/files'){
    const query=url.searchParams.get('q')||'',parent=query.match(/^'([^']+)' in parents/)?.[1],name=query.match(/\band name='([^']+)'/)?.[1],mime=query.match(/mimeType='([^']+)'/)?.[1];
    const properties=[...query.matchAll(/key='([^']+)' and value='([^']+)'/g)];
    return json({files:[...stored.values()].filter(file=>(!parent||file.parents?.includes(parent))&&(!name||file.name===name)&&(!mime||file.mimeType===mime)&&!file.trashed&&properties.every(([,key,value])=>file.appProperties?.[key]===value))});
   }
   if(method==='GET'){if(url.searchParams.get('alt')==='media')return binaries.has(id)?new Response(binaries.get(id)):json({error:{message:'No disposable binary'}},404);return stored.has(id)?json(stored.get(id)):json({error:{message:'No disposable file'}},404);}
   if(method==='POST'&&url.pathname==='/drive/v3/files'){const metadata=JSON.parse(options.body);if(metadata.mimeType!=='application/vnd.google-apps.folder')throw new Error('Only folder creation is supported here');const file={id:randomUUID(),...metadata,version:'1',trashed:false};stored.set(file.id,file);return json(file);}
  }
  if(url.hostname==='www.googleapis.com'&&url.pathname==='/upload/drive/v3/files'&&method==='POST'){
   const type=new Headers(options.headers).get('content-type')||'',boundary=type.match(/boundary=(.+)$/)?.[1];if(!boundary)throw new Error('Multipart boundary missing');
   const body=Buffer.from(options.body),headerEnd=body.indexOf('\r\n\r\n'),divider=body.indexOf(`\r\n--${boundary}`,headerEnd+4),metadata=JSON.parse(body.subarray(headerEnd+4,divider).toString());
   const binaryStart=body.indexOf('\r\n\r\n',divider+4)+4,binaryEnd=body.lastIndexOf(`\r\n--${boundary}--`),bytes=body.subarray(binaryStart,binaryEnd);
   if(headerEnd<0||divider<0||binaryStart<4||binaryEnd<binaryStart)throw new Error('Invalid disposable multipart upload');
   const mimeType=body.subarray(divider,binaryStart).toString().match(/Content-Type: ([^\r]+)/)?.[1]||'application/octet-stream';
   const file={id:randomUUID(),...metadata,mimeType,size:String(bytes.length),version:'1',md5Checksum:createHash('md5').update(bytes).digest('hex'),trashed:false};
   stored.set(file.id,file);binaries.set(file.id,Buffer.from(bytes));return json(file);
  }
  throw new Error(`Unsupported disposable provider operation: ${method} ${url.origin}${url.pathname}`);
 };
 const snapshotReceipts=()=>{const sent=messages.filter(message=>deliveryEvidence.sent.some(item=>item.id===message.id));const ids=new Set(sent.map(item=>item.id));return {version:1,evidence:structuredClone(deliveryEvidence),messages:structuredClone(sent),attachments:[...attachments].filter(([id])=>ids.has(id.split(':')[0])).map(([id,bytes])=>[id,bytes.toString('base64')])}};
 return {fetchImpl,files:stored,binaries,calls,deliveryEvidence,snapshotReceipts};
}
