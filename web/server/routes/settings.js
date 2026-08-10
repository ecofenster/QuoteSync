import express from 'express';
import { dbPromise } from '../db.js';
import { isIntegrationSecretKey } from '../features/integrations/integrationService.js';

const router = express.Router();

function parseSettingRow(row) {
  let parsedValue = row?.value;
  try {
    parsedValue = JSON.parse(String(row?.value ?? 'null'));
  } catch {
    parsedValue = row?.value ?? null;
  }

  return {
    key: String(row?.key || ''),
    value: parsedValue,
    group_name: row?.group_name == null ? null : String(row.group_name),
    updated_at: row?.updated_at ?? null,
  };
}

router.get('/', async (_req, res) => {
  try {
    const db = await dbPromise;
    const rows = await db.all(
      `
        SELECT key, value, group_name, updated_at
        FROM settings
        ORDER BY group_name ASC, key ASC
      `
    );

    return res.json(rows.filter((row) => !isIntegrationSecretKey(row.key)).map(parseSettingRow));
  } catch (error) {
    console.error('Failed to load settings', error);
    return res.status(500).json({ error: 'Failed to load settings' });
  }
});

router.get('/:group', async (req, res) => {
  try {
    const db = await dbPromise;
    const groupName = String(req.params.group || '').trim();

    const rows = await db.all(
      `
        SELECT key, value, group_name, updated_at
        FROM settings
        WHERE group_name = ?
        ORDER BY key ASC
      `,
      [groupName]
    );

    return res.json(rows.filter((row) => !isIntegrationSecretKey(row.key)).map(parseSettingRow));
  } catch (error) {
    console.error('Failed to load settings group', error);
    return res.status(500).json({ error: 'Failed to load settings group' });
  }
});

router.post('/', async (req, res) => {
  try {
    const db = await dbPromise;
    const key = String(req.body?.key || '').trim();
    const groupName = req.body?.group_name == null ? null : String(req.body.group_name).trim();
    const value = req.body?.value;

    if (!key) {
      return res.status(400).json({ error: 'key is required' });
    }
    if (isIntegrationSecretKey(key)) {
      return res.status(403).json({ error: 'Integration credentials are managed in Administration → Integrations' });
    }

    await db.run(
      `
        INSERT INTO settings (key, value, group_name, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET
          value = excluded.value,
          group_name = excluded.group_name,
          updated_at = CURRENT_TIMESTAMP
      `,
      [key, JSON.stringify(value ?? null), groupName]
    );

    const saved = await db.get(
      `
        SELECT key, value, group_name, updated_at
        FROM settings
        WHERE key = ?
        LIMIT 1
      `,
      [key]
    );

    return res.json(parseSettingRow(saved));
  } catch (error) {
    console.error('Failed to save setting', error);
    return res.status(500).json({ error: 'Failed to save setting' });
  }
});

router.put('/:key', async (req, res) => {
  try {
    const db = await dbPromise;
    const key = String(req.params.key || '').trim();
    const groupName = req.body?.group_name == null ? null : String(req.body.group_name).trim();
    const value = req.body?.value;

    if (!key) {
      return res.status(400).json({ error: 'key is required' });
    }
    if (isIntegrationSecretKey(key)) {
      return res.status(403).json({ error: 'Integration credentials are managed in Administration → Integrations' });
    }

    const existing = await db.get(
      `
        SELECT key, group_name
        FROM settings
        WHERE key = ?
        LIMIT 1
      `,
      [key]
    );

    if (!existing) {
      return res.status(404).json({ error: 'Setting not found' });
    }

    await db.run(
      `
        UPDATE settings
        SET value = ?,
            group_name = COALESCE(?, group_name),
            updated_at = CURRENT_TIMESTAMP
        WHERE key = ?
      `,
      [JSON.stringify(value ?? null), groupName, key]
    );

    const saved = await db.get(
      `
        SELECT key, value, group_name, updated_at
        FROM settings
        WHERE key = ?
        LIMIT 1
      `,
      [key]
    );

    return res.json(parseSettingRow(saved));
  } catch (error) {
    console.error('Failed to update setting', error);
    return res.status(500).json({ error: 'Failed to update setting' });
  }
});

export default router;
