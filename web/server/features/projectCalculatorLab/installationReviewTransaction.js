import sqlite3 from 'sqlite3';
import {open} from 'sqlite';

// Travel review owns its connection: concurrent retries cannot interleave with
// profile updates or append duplicate costing revisions after a lost response.
export async function withInstallationReviewTransaction(source,operation){
  const main=(await source.all('PRAGMA database_list')).find(row=>row.name==='main');
  if(!main?.file)throw Object.assign(new Error('Travel review requires the saved workspace database. No travel changes were applied.'),{code:'invalid_options'});
  const db=await open({filename:main.file,driver:sqlite3.Database,mode:sqlite3.OPEN_READWRITE});let transaction=false;
  try{
    await db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=10000; BEGIN IMMEDIATE');transaction=true;
    const result=await operation(db);await db.exec('COMMIT');transaction=false;return result;
  }catch(error){if(transaction)await db.exec('ROLLBACK');throw error;}finally{await db.close();}
}
