import express from 'express';
import { dbPromise } from '../db.js';

const router = express.Router();

function normalizeText(value) {
  return String(value ?? '').replace(/\r\n/g, '\n');
}

function mapRow(row) {
  return {
    id: String(row.id || ''),
    estimate_id: String(row.estimate_id || ''),
    note_text: normalizeText(row.note_text),
    created_at: row.created_at ? String(row.created_at) : null,
    updated_at: row.updated_at ? String(row.updated_at) : null,
  };
}

router.get('/', async (req, res) => {
  try {
    const db = await dbPromise;
    const estimateId = String(req.query.estimate_id || '').trim();

    if (!estimateId) {
      return res.status(400).json({ error: 'estimate_id is required' });
    }

    const activeEstimate = await db.get(
      `
        SELECT e.id
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

    const row = await db.get(
      `
        SELECT id, estimate_id, note_text, created_at, updated_at
        FROM estimate_notes
        WHERE estimate_id = ?
        LIMIT 1
      `,
      [estimateId]
    );

    if (!row) {
      return res.json({
        id: '',
        estimate_id: estimateId,
        note_text: '',
        created_at: null,
        updated_at: null,
      });
    }

    res.json(mapRow(row));
  } catch (error) {
    console.error('GET /api/estimate-notes failed', error);
    res.status(500).json({ error: 'Failed to load estimate notes' });
  }
});

router.put('/:estimateId', async (req, res) => {
  try {
    const db = await dbPromise;
    const estimateId = String(req.params.estimateId || '').trim();
    const id = String(req.body?.id || `estimate-note-${estimateId}`).trim();
    const noteText = normalizeText(req.body?.note_text);

    if (!estimateId) {
      return res.status(400).json({ error: 'estimateId is required' });
    }

    const activeEstimate = await db.get(
      `
        SELECT e.id
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

    const existing = await db.get(
      `
        SELECT id
        FROM estimate_notes
        WHERE estimate_id = ?
        LIMIT 1
      `,
      [estimateId]
    );

    if (existing) {
      await db.run(
        `
          UPDATE estimate_notes
          SET note_text = ?,
              updated_at = ?
          WHERE estimate_id = ?
        `,
        [noteText, new Date().toISOString(), estimateId]
      );
    } else {
      const now = new Date().toISOString();
      await db.run(
        `
          INSERT INTO estimate_notes (id, estimate_id, note_text, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?)
        `,
        [id, estimateId, noteText, now, now]
      );
    }

    const saved = await db.get(
      `
        SELECT id, estimate_id, note_text, created_at, updated_at
        FROM estimate_notes
        WHERE estimate_id = ?
        LIMIT 1
      `,
      [estimateId]
    );

    res.json(mapRow(saved));
  } catch (error) {
    console.error('PUT /api/estimate-notes/:estimateId failed', error);
    res.status(500).json({ error: 'Failed to save estimate notes' });
  }
});

router.delete('/:estimateId', async (req, res) => {
  try {
    const db = await dbPromise;
    const estimateId = String(req.params.estimateId || '').trim();

    if (!estimateId) {
      return res.status(400).json({ error: 'estimateId is required' });
    }

    await db.run(
      `
        DELETE FROM estimate_notes
        WHERE estimate_id = ?
      `,
      [estimateId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/estimate-notes/:estimateId failed', error);
    res.status(500).json({ error: 'Failed to delete estimate notes' });
  }
});

export default router;
