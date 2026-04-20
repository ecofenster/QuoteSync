import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

const CURRENT_SYSTEM_USER = {
  id: 'user-1',
  name: 'User',
  role: 'estimator',
};

async function ensureColumn(db, tableName, columnName, definitionSql) {
  const columns = await db.all(`PRAGMA table_info(${tableName})`);
  const exists = columns.some(
    (column) => String(column.name || '').toLowerCase() === columnName.toLowerCase()
  );
  if (exists) return;
  await db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definitionSql}`);
}

async function ensureTable(db, createSql) {
  await db.exec(createSql);
}

async function ensureIndex(db, indexName, createSql) {
  const existing = await db.get(
    `
      SELECT name
      FROM sqlite_master
      WHERE type = 'index'
        AND name = ?
      LIMIT 1
    `,
    [indexName]
  );
  if (existing) return;
  await db.exec(createSql);
}

async function seedSetting(db, key, value, groupName) {
  const existing = await db.get(
    `
      SELECT key
      FROM settings
      WHERE key = ?
      LIMIT 1
    `,
    [key]
  );
  if (existing) return;

  await db.run(
    `
      INSERT INTO settings (key, value, group_name, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `,
    [key, JSON.stringify(value), groupName]
  );
}

export const dbPromise = open({
  filename: '../quotesync.db',
  driver: sqlite3.Database
}).then(async (db) => {
  await db.exec('PRAGMA foreign_keys = ON');

  await ensureColumn(db, 'clients', 'deleted_at', 'TEXT');
  await ensureColumn(db, 'estimates', 'deleted_at', 'TEXT');
  await ensureColumn(db, 'estimates', 'created_by_user_id', 'TEXT');
  await ensureColumn(db, 'estimates', 'created_by_name', 'TEXT');
  await ensureColumn(db, 'estimates', 'created_by_role', 'TEXT');

  await db.run(
    `
      UPDATE estimates
      SET
        created_by_user_id = COALESCE(NULLIF(TRIM(created_by_user_id), ''), ?),
        created_by_name = COALESCE(NULLIF(TRIM(created_by_name), ''), ?),
        created_by_role = COALESCE(NULLIF(TRIM(created_by_role), ''), ?)
      WHERE
        created_by_user_id IS NULL OR TRIM(created_by_user_id) = ''
        OR created_by_name IS NULL OR TRIM(created_by_name) = ''
        OR created_by_role IS NULL OR TRIM(created_by_role) = ''
    `,
    [CURRENT_SYSTEM_USER.id, CURRENT_SYSTEM_USER.name, CURRENT_SYSTEM_USER.role]
  );

  await ensureTable(
    db,
    `
      CREATE TABLE IF NOT EXISTS client_notes (
        id TEXT PRIMARY KEY,
        client_id TEXT NOT NULL UNIQUE,
        note_text TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
      )
    `
  );

  await ensureTable(
    db,
    `
      CREATE TABLE IF NOT EXISTS estimate_notes (
        id TEXT PRIMARY KEY,
        estimate_id TEXT NOT NULL UNIQUE,
        note_text TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (estimate_id) REFERENCES estimates(id) ON DELETE CASCADE
      )
    `
  );

  await ensureTable(
    db,
    `
      CREATE TABLE IF NOT EXISTS followups (
        id TEXT PRIMARY KEY,
        client_id TEXT NOT NULL,
        estimate_id TEXT,
        title TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        due_at TEXT,
        status TEXT NOT NULL DEFAULT 'Open',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
        FOREIGN KEY (estimate_id) REFERENCES estimates(id) ON DELETE CASCADE
      )
    `
  );

  await ensureTable(
    db,
    `
      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        client_id TEXT NOT NULL,
        estimate_id TEXT,
        followup_id TEXT,
        category TEXT NOT NULL DEFAULT 'general',
        note_text TEXT NOT NULL DEFAULT '',
        created_by TEXT NOT NULL DEFAULT 'User',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
        FOREIGN KEY (estimate_id) REFERENCES estimates(id) ON DELETE CASCADE,
        FOREIGN KEY (followup_id) REFERENCES followups(id) ON DELETE CASCADE
      )
    `
  );

  await ensureTable(
    db,
    `
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        group_name TEXT,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `
  );

  await ensureIndex(
    db,
    'idx_client_notes_client_id',
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_client_notes_client_id ON client_notes(client_id)'
  );

  await ensureIndex(
    db,
    'idx_estimate_notes_estimate_id',
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_estimate_notes_estimate_id ON estimate_notes(estimate_id)'
  );

  await ensureIndex(
    db,
    'idx_followups_client_id',
    'CREATE INDEX IF NOT EXISTS idx_followups_client_id ON followups(client_id)'
  );

  await ensureIndex(
    db,
    'idx_followups_estimate_id',
    'CREATE INDEX IF NOT EXISTS idx_followups_estimate_id ON followups(estimate_id)'
  );

  await ensureIndex(
    db,
    'idx_followups_status',
    'CREATE INDEX IF NOT EXISTS idx_followups_status ON followups(status)'
  );

  await ensureIndex(
    db,
    'idx_notes_client_id',
    'CREATE INDEX IF NOT EXISTS idx_notes_client_id ON notes(client_id)'
  );

  await ensureIndex(
    db,
    'idx_notes_estimate_id',
    'CREATE INDEX IF NOT EXISTS idx_notes_estimate_id ON notes(estimate_id)'
  );

  await ensureIndex(
    db,
    'idx_notes_followup_id',
    'CREATE INDEX IF NOT EXISTS idx_notes_followup_id ON notes(followup_id)'
  );

  await ensureIndex(
    db,
    'idx_notes_category',
    'CREATE INDEX IF NOT EXISTS idx_notes_category ON notes(category)'
  );

  await ensureIndex(
    db,
    'idx_notes_created_at',
    'CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at DESC)'
  );

  await ensureIndex(
    db,
    'idx_settings_group_name',
    'CREATE INDEX IF NOT EXISTS idx_settings_group_name ON settings(group_name)'
  );

  await seedSetting(db, 'feature.configurator.enabled', { enabled: true }, 'featureFlags');
  await seedSetting(db, 'feature.clientPortal.enabled', { enabled: false }, 'featureFlags');
  await seedSetting(db, 'feature.projectCalculator.enabled', { enabled: false }, 'featureFlags');
  await seedSetting(db, 'system.loadDefaults', { enabled: true }, 'system');
  await seedSetting(db, 'system.loadDemoClients', { enabled: false }, 'system');
  await seedSetting(db, 'system.loadDemoEstimates', { enabled: false }, 'system');
  await seedSetting(db, 'system.loadDemoForecast', { enabled: false }, 'system');
  await seedSetting(db, 'references.estimatePrefix', { value: 'EF-EST' }, 'references');
  await seedSetting(db, 'references.clientPrefix', { value: 'EF-CL' }, 'references');
  await seedSetting(db, 'configurator.defaultDimensions', { width: 1000, height: 1200 }, 'configurator');
  await seedSetting(db, 'configurator.showDimensions', { enabled: true }, 'configurator');
  await seedSetting(db, 'integrations.googleMaps.enabled', { enabled: true }, 'integrations');
  await seedSetting(db, 'integrations.what3words.enabled', { enabled: true }, 'integrations');

  return db;
});
