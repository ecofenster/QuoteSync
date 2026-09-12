import {randomUUID} from 'node:crypto';
const failure=(message,code='supplier_delivery_unconfirmed')=>Object.assign(new Error(message),{status:409,code});

export async function initializeSupplierDeliverySchema(db){
  await db.exec(`CREATE TABLE IF NOT EXISTS supplier_delivery_attempts (
    id TEXT PRIMARY KEY,supplier_enquiry_id TEXT NOT NULL,communication_message_id TEXT NOT NULL,
    state TEXT NOT NULL CHECK(state IN ('sending','sent','not_sent','uncertain')),
    provider_message_id TEXT,sent_at TEXT,error_message TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,
    FOREIGN KEY(supplier_enquiry_id) REFERENCES supplier_enquiry_drafts(id) ON DELETE RESTRICT);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_supplier_delivery_active ON supplier_delivery_attempts(supplier_enquiry_id) WHERE state IN ('sending','sent','uncertain');
    CREATE TRIGGER IF NOT EXISTS trg_supplier_delivery_delete BEFORE DELETE ON supplier_delivery_attempts BEGIN SELECT RAISE(ABORT,'Supplier delivery evidence cannot be deleted'); END;`);
  await db.exec(`CREATE TRIGGER IF NOT EXISTS trg_supplier_delivery_draft_overwrite BEFORE UPDATE ON communication_messages
    WHEN NEW.status='draft' AND EXISTS(SELECT 1 FROM supplier_delivery_attempts WHERE communication_message_id=OLD.id AND state IN ('sending','sent','uncertain'))
    BEGIN SELECT RAISE(ABORT,'Supplier delivery is retained; a late draft save cannot overwrite it'); END;`);
}

export async function sendSupplierOnce(db,{requestId,message,send,now=()=>new Date().toISOString()}){
  const active=await db.get("SELECT * FROM supplier_delivery_attempts WHERE supplier_enquiry_id=? AND state IN ('sending','sent','uncertain')",requestId);
  if(active?.state==='sent'&&active.communication_message_id===message.id)return active;
  if(active)throw failure('Supplier delivery is in progress or awaiting confirmation. Do not send another copy; reopen the saved request and check its delivery evidence.');
  const earlier=await db.get('SELECT id FROM supplier_delivery_attempts WHERE supplier_enquiry_id=? LIMIT 1',requestId);
  if(!earlier&&['sending','failed'].includes(message.status))throw failure('This older supplier message has an unconfirmed delivery outcome. Do not resend; check its mailbox evidence first.');
  const id=randomUUID(),at=now();let claim;
  try{claim=await db.run(`INSERT INTO supplier_delivery_attempts(id,supplier_enquiry_id,communication_message_id,state,created_at,updated_at)
    SELECT ?,id,communication_message_id,'sending',?,? FROM supplier_enquiry_drafts WHERE id=? AND communication_message_id=? AND status='draft'`,id,at,at,requestId,message.id)}
  catch(error){if(error.code?.startsWith('SQLITE_CONSTRAINT'))throw failure('Another supplier delivery attempt already started. Reopen the request to see its outcome.');throw error}
  if(!claim.changes)throw failure('The prepared supplier request changed. Reopen it before sending.','supplier_draft_changed');
  let confirmed;
  try{
    // Recover previously confirmed local evidence without another provider call.
    confirmed=message.status==='sent'&&message.providerMessageId?message:await send({attemptId:id});
    if(!confirmed?.providerMessageId)throw failure('The provider did not confirm a supplier message identity. Do not send another copy.');
    await db.run("UPDATE supplier_delivery_attempts SET state='sent',provider_message_id=?,sent_at=?,updated_at=? WHERE id=?",confirmed.providerMessageId,confirmed.sentAt||now(),now(),id);
  }catch(error){
    const providerId=confirmed?.providerMessageId||(error.deliveryOutcome==='sent'&&error.providerMessageId),state=providerId?'sent':error.deliveryOutcome==='not_sent'?'not_sent':'uncertain';
    await db.run('UPDATE supplier_delivery_attempts SET state=?,provider_message_id=?,sent_at=?,error_message=?,updated_at=? WHERE id=?',state,providerId||null,providerId?confirmed?.sentAt||now():null,error.message,now(),id);
    if(!providerId)throw failure(state==='not_sent'?`Nothing was sent. ${error.message} Correct the issue and retry the same reviewed request.`:'Supplier delivery could not be confirmed. Do not resend; check the connected mailbox and retain this request for delivery review.',state==='not_sent'?'supplier_delivery_not_sent':'supplier_delivery_unconfirmed');
  }
  return db.get('SELECT * FROM supplier_delivery_attempts WHERE id=?',id);
}
