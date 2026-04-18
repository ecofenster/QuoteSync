import express from 'express';
import { dbPromise } from '../db.js';

const router = express.Router();

const ALLOWED_CATEGORIES = new Set([
  'general',
  'follow_up',
  'service',
  'installer',
  'client_request',
]);

function normalizeText(value) {
  return String(value ?? '').replace(/\r\n/g, '\n').trim();
}

function normalizeNullableText(value) {
  const normalized = String(value ?? '').trim();
  return normalized ? normalized : null;
}

function normalizeCategory(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return ALLOWED_CATEGORIES.has(normalized) ? normalized : 'general';
}

function mapRow(row) {
  return {
    id: String(row.id || ''),
    client_id: String(row.client_id || ''),
    estimate_id: row.estimate_id ? String(row.estimate_id) : null,
    followup_id: row.followup_id ? String(row.followup_id) : null,
    category: String(row.category || 'general'),
    note_text: String(row.note_text || ''),
    created_by: String(row.created_by || 'User'),
    created_at: row.created_at ? String(row.created_at) : null,
    updated_at: row.updated_at ? String(row.updated_at) : null,
  };
}

router.get('/', async (req, res) => {
  try {
    const db = await dbPromise;
    const clientId = String(req.query.client_id || '').trim();
    const estimateId = String(req.query.estimate_id || '').trim();
    const followupId = String(req.query.followup_id || '').trim();
    const category = String(req.query.category || '').trim().toLowerCase();
    const limitValue = Number(req.query.limit);
    const limit = Number.isFinite(limitValue) && limitValue > 0 ? Math.min(Math.floor(limitValue), 200) : 100;

    if (!clientId) {
      return res.status(400).json({ error: 'client_id is required' });
    }

    const activeClient = await db.get(
      `
        SELECT id
        FROM clients
        WHERE id = ?
          AND deleted_at IS NULL
        LIMIT 1
      `,
      [clientId]
    );

    if (!activeClient) {
      return res.status(404).json({ error: 'Active client not found' });
    }

    const where = ['n.client_id = ?'];
    const params = [clientId];

    if (estimateId) {
      where.push('n.estimate_id = ?');
      params.push(estimateId);
    }

    if (followupId) {
      where.push('n.followup_id = ?');
      params.push(followupId);
    }

    if (category) {
      where.push('n.category = ?');
      params.push(normalizeCategory(category));
    }

    params.push(limit);

    const sql = `
      SELECT
        n.id,
        n.client_id,
        n.estimate_id,
        n.followup_id,
        n.category,
        n.note_text,
        n.created_by,
        n.created_at,
        n.updated_at
      FROM notes n
      WHERE ${where.join(' AND ')}
      ORDER BY
        COALESCE(n.updated_at, n.created_at) DESC,
        n.rowid DESC
      LIMIT ?
    `;

    const rows = await db.all(sql, params);

    res.json(rows.map((row) => mapRow(row)));
  } catch (error) {
    console.error('GET /api/notes failed', error);
    res.status(500).json({ error: 'Failed to load notes' });
  }
});

router.post('/', async (req, res) => {
  try {
    const db = await dbPromise;
    const id = String(req.body?.id || '').trim();
    const clientId = String(req.body?.client_id || '').trim();
    const estimateId = normalizeNullableText(req.body?.estimate_id);
    const followupId = normalizeNullableText(req.body?.followup_id);
    const category = normalizeCategory(req.body?.category);
    const noteText = normalizeText(req.body?.note_text);
    const createdBy = normalizeText(req.body?.created_by) || 'User';

    if (!id) {
      return res.status(400).json({ error: 'id is required' });
    }

    if (!clientId) {
      return res.status(400).json({ error: 'client_id is required' });
    }

    if (!noteText) {
      return res.status(400).json({ error: 'note_text is required' });
    }

    const activeClient = await db.get(
      `
        SELECT id
        FROM clients
        WHERE id = ?
          AND deleted_at IS NULL
        LIMIT 1
      `,
      [clientId]
    );

    if (!activeClient) {
      return res.status(404).json({ error: 'Active client not found' });
    }

    if (estimateId) {
      const activeEstimate = await db.get(
        `
          SELECT e.id
          FROM estimates e
          INNER JOIN clients c ON c.id = e.client_id
          WHERE e.id = ?
            AND e.client_id = ?
            AND e.deleted_at IS NULL
            AND c.deleted_at IS NULL
          LIMIT 1
        `,
        [estimateId, clientId]
      );

      if (!activeEstimate) {
        return res.status(404).json({ error: 'Active estimate not found for note' });
      }
    }

    if (followupId) {
      const activeFollowup = await db.get(
        `
          SELECT id, estimate_id
          FROM followups
          WHERE id = ?
            AND client_id = ?
          LIMIT 1
        `,
        [followupId, clientId]
      );

      if (!activeFollowup) {
        return res.status(404).json({ error: 'Follow-up not found for note' });
      }

      if (estimateId && activeFollowup.estimate_id && String(activeFollowup.estimate_id) !== estimateId) {
        return res.status(409).json({ error: 'Follow-up estimate does not match note estimate' });
      }
    }

    const now = new Date().toISOString();

    await db.run(
      `
        INSERT INTO notes (
          id,
          client_id,
          estimate_id,
          followup_id,
          category,
          note_text,
          created_by,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [id, clientId, estimateId, followupId, category, noteText, createdBy, now, now]
    );

    const created = await db.get(
      `
        SELECT
          id,
          client_id,
          estimate_id,
          followup_id,
          category,
          note_text,
          created_by,
          created_at,
          updated_at
        FROM notes
        WHERE id = ?
        LIMIT 1
      `,
      [id]
    );

    res.json(mapRow(created));
  } catch (error) {
    console.error('POST /api/notes failed', error);
    res.status(500).json({ error: 'Failed to create note' });
  }
});

export default router;
