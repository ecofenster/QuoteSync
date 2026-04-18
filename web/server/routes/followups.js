import express from 'express';
import { dbPromise } from '../db.js';

const router = express.Router();

function normalizeText(value) {
  return String(value ?? '').replace(/\r\n/g, '\n');
}

function normalizeNullableText(value) {
  const normalized = String(value ?? '').trim();
  return normalized ? normalized : null;
}

function normalizeStatus(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'done') return 'done';
  return 'pending';
}

function mapRow(row) {
  return {
    id: String(row.id || ''),
    client_id: String(row.client_id || ''),
    estimate_id: row.estimate_id ? String(row.estimate_id) : null,
    title: normalizeText(row.title),
    notes: normalizeText(row.notes),
    due_at: row.due_at ? String(row.due_at) : null,
    status: normalizeStatus(row.status),
    created_at: row.created_at ? String(row.created_at) : null,
    updated_at: row.updated_at ? String(row.updated_at) : null,
  };
}

router.get('/', async (req, res) => {
  try {
    const db = await dbPromise;
    const clientId = String(req.query.client_id || '').trim();
    const estimateId = String(req.query.estimate_id || '').trim();

    if (!clientId && !estimateId) {
      return res.status(400).json({ error: 'client_id or estimate_id is required' });
    }

    let rows = [];

    if (estimateId) {
      const activeEstimate = await db.get(
        `
          SELECT e.id, e.client_id
          FROM estimates e
          INNER JOIN clients c ON c.id = e.client_id
          WHERE e.id = ?
            AND e.deleted_at IS NULL
            AND c.deleted_at IS NULL
          LIMIT 1
        `,
        [estimateId]
      );

      if (!activeEstimate) {
        return res.status(404).json({ error: 'Active estimate not found' });
      }

      rows = await db.all(
        `
          SELECT
            id,
            client_id,
            estimate_id,
            title,
            notes,
            due_at,
            status,
            created_at,
            updated_at
          FROM followups
          WHERE client_id = ?
            AND (estimate_id = ? OR estimate_id IS NULL OR estimate_id = '')
          ORDER BY
            CASE WHEN due_at IS NULL OR due_at = '' THEN 1 ELSE 0 END,
            due_at ASC,
            created_at DESC,
            rowid DESC
        `,
        [activeEstimate.client_id, estimateId]
      );
    } else {
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

      rows = await db.all(
        `
          SELECT
            id,
            client_id,
            estimate_id,
            title,
            notes,
            due_at,
            status,
            created_at,
            updated_at
          FROM followups
          WHERE client_id = ?
          ORDER BY
            CASE WHEN due_at IS NULL OR due_at = '' THEN 1 ELSE 0 END,
            due_at ASC,
            created_at DESC,
            rowid DESC
        `,
        [clientId]
      );
    }

    res.json(rows.map((row) => mapRow(row)));
  } catch (error) {
    console.error('GET /api/followups failed', error);
    res.status(500).json({ error: 'Failed to load follow-ups' });
  }
});

router.post('/', async (req, res) => {
  try {
    const db = await dbPromise;
    const id = String(req.body?.id || '').trim();
    const clientId = String(req.body?.client_id || '').trim();
    const estimateId = normalizeNullableText(req.body?.estimate_id);
    const title = normalizeText(req.body?.title);
    const notes = normalizeText(req.body?.notes);
    const dueAt = normalizeNullableText(req.body?.due_at);
    const status = normalizeStatus(req.body?.status);

    if (!id) {
      return res.status(400).json({ error: 'id is required' });
    }

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
        return res.status(404).json({ error: 'Active estimate not found for follow-up' });
      }
    }

    const now = new Date().toISOString();

    await db.run(
      `
        INSERT INTO followups (
          id,
          client_id,
          estimate_id,
          title,
          notes,
          due_at,
          status,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [id, clientId, estimateId, title, notes, dueAt, status, now, now]
    );

    const created = await db.get(
      `
        SELECT
          id,
          client_id,
          estimate_id,
          title,
          notes,
          due_at,
          status,
          created_at,
          updated_at
        FROM followups
        WHERE id = ?
        LIMIT 1
      `,
      [id]
    );

    res.json(mapRow(created));
  } catch (error) {
    console.error('POST /api/followups failed', error);
    res.status(500).json({ error: 'Failed to create follow-up' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const db = await dbPromise;
    const id = String(req.params.id || '').trim();
    const clientId = String(req.body?.client_id || '').trim();
    const estimateId = normalizeNullableText(req.body?.estimate_id);
    const title = normalizeText(req.body?.title);
    const notes = normalizeText(req.body?.notes);
    const dueAt = normalizeNullableText(req.body?.due_at);
    const status = normalizeStatus(req.body?.status);

    if (!id) {
      return res.status(400).json({ error: 'id is required' });
    }

    const current = await db.get(
      `
        SELECT id, client_id, estimate_id
        FROM followups
        WHERE id = ?
        LIMIT 1
      `,
      [id]
    );

    if (!current) {
      return res.status(404).json({ error: 'Follow-up not found' });
    }

    const normalizedClientId = clientId || String(current.client_id || '').trim();
    if (!normalizedClientId) {
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
      [normalizedClientId]
    );

    if (!activeClient) {
      return res.status(404).json({ error: 'Active client not found' });
    }

    const normalizedEstimateId =
      estimateId !== null
        ? estimateId
        : normalizeNullableText(current.estimate_id);

    if (normalizedEstimateId) {
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
        [normalizedEstimateId, normalizedClientId]
      );

      if (!activeEstimate) {
        return res.status(404).json({ error: 'Active estimate not found for follow-up' });
      }
    }

    await db.run(
      `
        UPDATE followups
        SET
          client_id = ?,
          estimate_id = ?,
          title = ?,
          notes = ?,
          due_at = ?,
          status = ?,
          updated_at = ?
        WHERE id = ?
      `,
      [normalizedClientId, normalizedEstimateId, title, notes, dueAt, status, new Date().toISOString(), id]
    );

    const saved = await db.get(
      `
        SELECT
          id,
          client_id,
          estimate_id,
          title,
          notes,
          due_at,
          status,
          created_at,
          updated_at
        FROM followups
        WHERE id = ?
        LIMIT 1
      `,
      [id]
    );

    res.json(mapRow(saved));
  } catch (error) {
    console.error('PUT /api/followups/:id failed', error);
    res.status(500).json({ error: 'Failed to update follow-up' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const db = await dbPromise;
    const id = String(req.params.id || '').trim();

    if (!id) {
      return res.status(400).json({ error: 'id is required' });
    }

    const result = await db.run(
      `
        DELETE FROM followups
        WHERE id = ?
      `,
      [id]
    );

    if (!result.changes) {
      return res.status(404).json({ error: 'Follow-up not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/followups/:id failed', error);
    res.status(500).json({ error: 'Failed to delete follow-up' });
  }
});

export default router;
