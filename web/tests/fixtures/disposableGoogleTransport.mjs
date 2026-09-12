import {createHash,randomUUID} from 'node:crypto';

// Test-only provider transport. No network fallback and no delivery operation.
// Production Gmail/Drive adapters still perform their normal mapping and IO.
export function createDisposableGoogleTransport({messages=[],attachments=new Map(),files=[],pageSize=2}={}){
 const stored=new Map(files.map(file=>[file.id,{...file}])),binaries=new Map(),calls=[];
 const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
 const fetchImpl=async(raw,options={})=>{
  const url=new URL(String(raw)),method=String(options.method||'GET').toUpperCase();calls.push({method,path:url.pathname});
  if(url.hostname==='gmail.googleapis.com'){
   if(method!=='GET')throw new Error('Disposable provider refuses Gmail writes and delivery.');
   if(url.pathname.endsWith('/labels'))return json({labels:[]});
   const attachment=url.pathname.match(/\/messages\/([^/]+)\/attachments\/([^/]+)$/);
   if(attachment){const bytes=attachments.get(`${decodeURIComponent(attachment[1])}:${decodeURIComponent(attachment[2])}`);return bytes?json({data:Buffer.from(bytes).toString('base64url'),size:bytes.length}):json({error:{message:'Disposable attachment not found'}},404);}
   const message=url.pathname.match(/\/messages\/([^/]+)$/);
   if(message){const found=messages.find(item=>item.id===decodeURIComponent(message[1]));return found?json(found):json({error:{message:'Disposable message not found'}},404);}
   if(url.pathname.endsWith('/messages')){
    const sender=url.searchParams.get('q')?.match(/from:([^\s]+)/)?.[1];
    const filtered=messages.filter(message=>!sender||message.payload?.headers?.some(header=>header.name.toLowerCase()==='from'&&header.value.includes(sender)));
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
 return {fetchImpl,files:stored,binaries,calls};
}
