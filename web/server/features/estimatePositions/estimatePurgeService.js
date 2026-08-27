import path from 'node:path';
import { rm } from 'node:fs/promises';
import { resolveAttachmentRoot, resolveManagedPath } from '../supplierQuotes/managedAttachmentStorage.js';

const visualTokenPattern=/manufacturer-position-visuals\/([a-f0-9]{40})\//g;

export class EstimatePurgeBlockedError extends Error{
  constructor(message,dependencies,code="estimate_purge_blocked"){super(message);this.name="EstimatePurgeBlockedError";this.status=409;this.code=code;this.dependencies=dependencies;}
}

async function countRows(db,sql,estimateId){return Number((await db.get(sql,estimateId))?.count||0)}

export async function inspectEstimatePurgeDependencies(db,estimateId){
  const checks=[
    ["order","Orders",()=>countRows(db,"SELECT count(*) count FROM orders WHERE source_estimate_id=?",estimateId)],
    ["issued_quotation","Issued quotations",()=>countRows(db,"SELECT count(*) count FROM issued_quotations WHERE estimate_id=?",estimateId)],
    ["customer_quotation_document","Customer quotation documents",()=>countRows(db,"SELECT count(*) count FROM customer_quotation_documents WHERE estimate_id=?",estimateId)],
    ["canonical_document","Canonical documents",()=>countRows(db,"SELECT count(*) count FROM canonical_documents WHERE estimate_id=?",estimateId)],
    ["communication","Linked communications",()=>countRows(db,`SELECT count(DISTINCT m.id) count FROM communication_messages m,json_each(CASE WHEN json_valid(m.links_json) THEN m.links_json ELSE '[]' END) link WHERE json_extract(link.value,'$.kind')='estimate' AND json_extract(link.value,'$.id')=?`,estimateId)],
  ];
  const dependencies=[];
  for(const[kind,label,read]of checks){const count=await read().catch(()=>0);if(count>0)dependencies.push({kind,label,count});}
  return dependencies;
}

async function collectEvidenceFiles(db,estimateId,attachmentRoot){
  const supplier=await db.all('SELECT storage_key FROM supplier_quote_attachments WHERE estimate_id=?',estimateId);
  const lab=await db.all('SELECT a.storage_key FROM supplier_import_lab_attachments a JOIN supplier_import_lab_sessions s ON s.id=a.session_id WHERE s.estimate_id=?',estimateId);
  const snapshots=await Promise.all([
    db.all('SELECT p.source_snapshot_json value FROM project_calculator_estimate_product_rows p JOIN project_calculator_lab_scenarios s ON s.id=p.scenario_id WHERE s.estimate_id=?',estimateId),
    db.all('SELECT r.original_extracted_snapshot_json value FROM supplier_import_lab_extracted_rows r JOIN supplier_import_lab_sessions s ON s.id=r.session_id WHERE s.estimate_id=?',estimateId),
  ]);
  const tokens=new Set();
  for(const row of snapshots.flat())for(const match of String(row.value||'').matchAll(visualTokenPattern))tokens.add(match[1]);
  return {files:[...supplier,...lab].map(row=>resolveManagedPath(row.storage_key,attachmentRoot)),visualDirectories:[...tokens].map(token=>resolveManagedPath(`manufacturer-position-visuals/${token}`,attachmentRoot))};
}

async function purgeEstimateRecords(db,estimateId){
  await db.run('DELETE FROM project_calculator_lab_scenarios WHERE estimate_id=?',estimateId);
  await db.run('DELETE FROM project_calculators WHERE estimate_id=?',estimateId);
  const sessions=await db.all('SELECT id FROM supplier_import_lab_sessions WHERE estimate_id=?',estimateId);
  for(const {id} of sessions){await db.run('DELETE FROM supplier_import_lab_extraction_runs WHERE session_id=?',id);await db.run('DELETE FROM supplier_import_lab_attachments WHERE session_id=?',id);}
  await db.run('DELETE FROM supplier_import_lab_sessions WHERE estimate_id=?',estimateId);
  await db.run('DELETE FROM supplier_quote_review_decisions WHERE estimate_id=?',estimateId);
  await db.run('DELETE FROM supplier_position_match_proposals WHERE estimate_id=?',estimateId);
  await db.run('DELETE FROM supplier_position_applications WHERE estimate_id=?',estimateId);
  await db.run('DELETE FROM supplier_specification_items WHERE supplier_position_id IN (SELECT id FROM supplier_quote_positions WHERE estimate_id=?)',estimateId);
  await db.run('DELETE FROM supplier_quote_import_run_attachments WHERE import_run_id IN (SELECT id FROM supplier_quote_import_runs WHERE estimate_id=?)',estimateId);
  await db.run('DELETE FROM supplier_quote_extras WHERE estimate_id=?',estimateId);
  await db.run('DELETE FROM supplier_quote_positions WHERE estimate_id=?',estimateId);
  await db.run('DELETE FROM supplier_quote_import_runs WHERE estimate_id=?',estimateId);
  await db.run('DELETE FROM supplier_quote_attachments WHERE estimate_id=?',estimateId);
  await db.run('DELETE FROM supplier_quote_revisions WHERE estimate_id=?',estimateId);
  await db.run('DELETE FROM supplier_quotes WHERE estimate_id=?',estimateId);
  return (await db.run('DELETE FROM estimates WHERE id=?',estimateId)).changes;
}

async function removeEvidenceFiles(evidence){
  const failures=[];
  for(const target of [...evidence.files,...evidence.visualDirectories])try{await rm(target,{recursive:true,force:true});}catch(error){failures.push({target,message:error instanceof Error?error.message:String(error)});}
  return failures;
}

export async function purgeEstimateOwnedGraph(db,estimateId,{attachmentRoot=resolveAttachmentRoot()}={}){
  const estimate=await db.get('SELECT id,deleted_at FROM estimates WHERE id=?',estimateId);if(!estimate)return null;
  if(!estimate.deleted_at)throw new EstimatePurgeBlockedError("Only an Estimate already in the Recycle Bin can be permanently deleted.",[],"estimate_not_deleted");
  const dependencies=await inspectEstimatePurgeDependencies(db,estimateId);
  if(dependencies.length)throw new EstimatePurgeBlockedError(`This Estimate cannot be permanently deleted because retained canonical evidence exists: ${dependencies.map(item=>`${item.label} (${item.count})`).join(", ")}.`,dependencies);
  const evidence=await collectEvidenceFiles(db,estimateId,path.resolve(attachmentRoot));
  await db.exec('BEGIN IMMEDIATE');
  try{await purgeEstimateRecords(db,estimateId);await db.exec('COMMIT');}catch(error){await db.exec('ROLLBACK');throw error;}
  return {success:true,removedEstimateCount:1,fileCleanupFailures:await removeEvidenceFiles(evidence)};
}

export async function purgeClientOwnedGraph(db,clientId,{attachmentRoot=resolveAttachmentRoot()}={}){
  const client=await db.get('SELECT id FROM clients WHERE id=?',clientId);if(!client)return null;
  const estimates=await db.all('SELECT id FROM estimates WHERE client_id=?',clientId),evidence=[];
  for(const {id} of estimates)evidence.push(await collectEvidenceFiles(db,id,path.resolve(attachmentRoot)));
  await db.exec('BEGIN IMMEDIATE');
  try{for(const {id} of estimates)await purgeEstimateRecords(db,id);await db.run('DELETE FROM clients WHERE id=?',clientId);await db.exec('COMMIT');}catch(error){await db.exec('ROLLBACK');throw error;}
  const fileCleanupFailures=[];for(const item of evidence)fileCleanupFailures.push(...await removeEvidenceFiles(item));
  return {success:true,removedEstimateCount:estimates.length,fileCleanupFailures};
}
