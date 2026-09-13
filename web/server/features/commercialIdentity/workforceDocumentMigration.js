// Add a real installer ownership relationship without inventing a Client/Supplier.
// SQLite cannot alter an existing CHECK constraint; preserve the full original table.
export async function migrateWorkforceDocumentOwnership(db){
  const table=await db.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='canonical_documents'");
  if(!table||table.sql.includes('installer_id IS NOT NULL'))return;
  const oldCheck='CHECK(enquiry_id IS NOT NULL OR client_id IS NOT NULL OR project_id IS NOT NULL OR estimate_id IS NOT NULL OR order_id IS NOT NULL OR supplier_id IS NOT NULL OR supplier_quotation_id IS NOT NULL)';
  if(!table.sql.includes(oldCheck))throw Error('Canonical document ownership schema requires reviewed migration. No data was changed.');
  const columns=await db.all('PRAGMA table_info(canonical_documents)'),names=columns.map(item=>`"${item.name.replaceAll('"','""')}"`).join(','),foreignKeys=(await db.get('PRAGMA foreign_keys')).foreign_keys;
  const objects=await db.all("SELECT sql FROM sqlite_master WHERE tbl_name='canonical_documents' AND type IN('index','trigger') AND sql IS NOT NULL");
  const sql=table.sql.replace(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?["`]?canonical_documents["`]?/i,'CREATE TABLE canonical_documents_workforce_upgrade').replace(oldCheck,'installer_id TEXT REFERENCES installation_installers(id) ON DELETE RESTRICT, '+oldCheck.replace(')', ' OR installer_id IS NOT NULL)'));
  await db.exec('PRAGMA foreign_keys=OFF');
  try{
    await db.exec('BEGIN IMMEDIATE');
    await db.exec(sql);await db.exec(`INSERT INTO canonical_documents_workforce_upgrade(${names}) SELECT ${names} FROM canonical_documents`);
    const before=await db.get('SELECT COUNT(*) count FROM canonical_documents'),after=await db.get('SELECT COUNT(*) count FROM canonical_documents_workforce_upgrade');if(before.count!==after.count)throw Error('Canonical document migration row count mismatch');
    await db.exec('DROP TABLE canonical_documents;ALTER TABLE canonical_documents_workforce_upgrade RENAME TO canonical_documents');
    for(const object of objects)await db.exec(object.sql);
    if((await db.all('PRAGMA foreign_key_check')).length)throw Error('Canonical document migration found unresolved foreign-key evidence; transaction rolled back');
    await db.exec('COMMIT');
  }catch(error){await db.exec('ROLLBACK').catch(()=>{});throw error}
  finally{await db.exec(`PRAGMA foreign_keys=${foreignKeys?1:0}`)}
}
