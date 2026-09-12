import {randomUUID} from 'node:crypto';
const failure=(message,code)=>Object.assign(new Error(message),{status:409,code});

export async function initializeFactoryDeliverySchema(db){
  await db.exec(`CREATE TABLE IF NOT EXISTS factory_delivery_attempts (
    id TEXT PRIMARY KEY,order_id TEXT NOT NULL,communication_message_id TEXT NOT NULL,
    state TEXT NOT NULL CHECK(state IN ('sending','sent','not_sent','uncertain')),
    provider_message_id TEXT,sent_at TEXT,error_message TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,
    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE RESTRICT);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_factory_delivery_active ON factory_delivery_attempts(order_id) WHERE state IN ('sending','sent','uncertain');
    CREATE TRIGGER IF NOT EXISTS trg_factory_delivery_delete BEFORE DELETE ON factory_delivery_attempts BEGIN SELECT RAISE(ABORT,'Factory delivery evidence cannot be deleted'); END;`);
  const columns=new Set((await db.all('PRAGMA table_info(factory_delivery_attempts)')).map(row=>row.name));
  for(const column of ['receipt_message_id','receipt_manifest_sha256','provider_account_id','reconciled_by','reconciled_at'])if(!columns.has(column))await db.exec(`ALTER TABLE factory_delivery_attempts ADD COLUMN ${column} TEXT`);
}

export async function factoryDeliveryState(db,orderId){
  return db.get('SELECT * FROM factory_delivery_attempts WHERE order_id=? ORDER BY created_at DESC,rowid DESC LIMIT 1',orderId);
}

export async function sendFactoryOnce(db,{orderId,communicationId,send,now=()=>new Date().toISOString()}){
  const active=await db.get("SELECT * FROM factory_delivery_attempts WHERE order_id=? AND state IN ('sending','sent','uncertain')",orderId);
  if(active?.state==='sent'&&active.communication_message_id===communicationId)return active;
  if(active)throw failure('Factory delivery is in progress or awaiting confirmation. Do not send another copy. Review the recorded attempt and mailbox evidence first.','factory_delivery_unconfirmed');
  const id=randomUUID(),at=now();
  let claim;
  try{claim=await db.run(`INSERT INTO factory_delivery_attempts(id,order_id,communication_message_id,state,created_at,updated_at)
    SELECT ?,order_id,communication_message_id,'sending',?,? FROM factory_order_requests WHERE order_id=? AND communication_message_id=? AND status='draft'`,id,at,at,orderId,communicationId)}
  catch(error){if(error.code?.startsWith('SQLITE_CONSTRAINT'))throw failure('Another factory delivery attempt has already started. Reopen the request to see its outcome.','factory_delivery_unconfirmed');throw error}
  if(!claim.changes)throw failure('The saved factory request changed. Reopen and review it before sending.','factory_draft_changed');
  let confirmed;
  try{
    const result=await send({attemptId:id});confirmed=result;
    if(!result?.providerMessageId)throw failure('The provider did not confirm a message identity. Do not resend until its mailbox outcome has been checked.','factory_delivery_unconfirmed');
    await db.run("UPDATE factory_delivery_attempts SET state='sent',provider_message_id=?,sent_at=?,updated_at=? WHERE id=? AND state='sending'",result.providerMessageId,result.sentAt||now(),now(),id);
  }catch(error){
    const sent=(error.deliveryOutcome==='sent'&&error.providerMessageId)||confirmed?.providerMessageId;
    const state=sent?'sent':error.deliveryOutcome==='not_sent'?'not_sent':'uncertain';
    await db.run("UPDATE factory_delivery_attempts SET state=?,provider_message_id=?,sent_at=?,error_message=?,updated_at=? WHERE id=? AND state='sending'",state,sent||null,sent?now():null,error.message||'Delivery outcome could not be confirmed',now(),id);
    const retained=await db.get('SELECT * FROM factory_delivery_attempts WHERE id=?',id);
    if(retained?.state==='sent')return retained;
    if(!sent)throw failure(state==='not_sent'?`Nothing was sent. ${error.message} Correct this and retry the reviewed request.`:'Factory delivery could not be confirmed. Do not resend: check the connected mailbox and this recorded attempt first.',state==='not_sent'?'factory_delivery_not_sent':'factory_delivery_unconfirmed');
  }
  return db.get('SELECT * FROM factory_delivery_attempts WHERE id=?',id);
}
