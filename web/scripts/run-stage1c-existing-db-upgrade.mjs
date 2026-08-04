import { createReadStream } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { initializeSupplierCommercialSchema, supplierCommercialTableNames } from '../server/schema/supplierCommercialSchema.js';

const sourcePath = path.resolve('quotesync.db');
const backupDirectory = path.join(os.tmpdir(), `quotesync-stage1c-upgrade-${Date.now()}`);
const backupPath = path.join(backupDirectory, 'quotesync-upgrade-copy.db');
await mkdir(backupDirectory, { recursive: true });

await new Promise((resolve, reject) => {
  const source = new sqlite3.Database(sourcePath, sqlite3.OPEN_READONLY, (openError) => {
    if (openError) { reject(openError); return; }
    const backup = source.backup(backupPath);
    backup.step(-1, (stepError) => {
      if (stepError) { reject(stepError); return; }
      backup.finish((finishError) => source.close((closeError) => finishError || closeError ? reject(finishError || closeError) : resolve()));
    });
  });
});

async function sha256(filename) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filename)) hash.update(chunk);
  return hash.digest('hex');
}

const db = await open({ filename: backupPath, driver: sqlite3.Database });
await db.exec('PRAGMA foreign_keys=ON');
const backupBeforeUpgrade = { sizeBytes: (await stat(backupPath)).size, sha256: await sha256(backupPath) };
const before = await db.get(`SELECT
  (SELECT COUNT(*) FROM clients) AS clients,
  (SELECT COUNT(*) FROM estimates) AS estimates,
  (SELECT COALESCE(hex(group_concat(id || ':' || positions_json, '|')), '') FROM (SELECT id, positions_json FROM estimates ORDER BY id)) AS positions_fingerprint`);
await initializeSupplierCommercialSchema(db);
await initializeSupplierCommercialSchema(db);
const after = await db.get(`SELECT
  (SELECT COUNT(*) FROM clients) AS clients,
  (SELECT COUNT(*) FROM estimates) AS estimates,
  (SELECT COALESCE(hex(group_concat(id || ':' || positions_json, '|')), '') FROM (SELECT id, positions_json FROM estimates ORDER BY id)) AS positions_fingerprint`);
const integrity = await db.get('PRAGMA integrity_check');
const tables = await db.all("SELECT name FROM sqlite_master WHERE type='table'");
await db.close();
if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('Existing client, estimate, or positions_json data changed in the upgrade copy.');
for (const table of supplierCommercialTableNames) if (!tables.some((row) => row.name === table)) throw new Error(`Missing upgraded table: ${table}`);
if (Object.values(integrity)[0] !== 'ok') throw new Error('Upgrade-copy integrity check failed.');
const metadata = await stat(backupPath);
console.log(JSON.stringify({ sourcePath, backupPath, backupBeforeUpgrade, backupAfterUpgrade: { sizeBytes: metadata.size, sha256: await sha256(backupPath) }, protectedBefore: before, protectedAfter: after, integrity: 'ok', initializedTables: supplierCommercialTableNames.length }, null, 2));
