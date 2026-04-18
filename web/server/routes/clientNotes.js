import express from 'express';
import { dbPromise } from '../db.js';

const router = express.Router();

function normalizeText(value) {
  return String(value ?? '').replace(/\r\n/g, '\n');
}

function mapRow(row) {
  return {
    id: String(row.id || ''),
    client_id: String(row.client_id || ''),
    note_text: normalizeText(row.note_text),
    created_at: row.created_at ? String(row.created_at) : null,
    updated_at: row.updated_at ? String(row.updated_at) : null,
  };
}

router.get('/', async (req, res) => {
  try {
    const db = await dbPromise;
    const clientId = String(req.query.client_id || '').trim();

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

    const row = await db.get(
      `
        SELECT id, client_id, note_text, created_at, updated_at
        FROM client_notes
        WHERE client_id = ?
        LIMIT 1
      `,
      [clientId]
    );

    if (!row) {
      return res.json({
        id: '',
        client_id: clientId,
        note_text: '',
        created_at: null,
        updated_at: null,
      });
    }

    res.json(mapRow(row));
  } catch (error) {
    console.error('GET /api/client-notes failed', error);
    res.status(500).json({ error: 'Failed to load client notes' });
  }
});

router.put('/:clientId', async (req, res) => {
  try {
    const db = await dbPromise;
    const clientId = String(req.params.clientId || '').trim();
    const id = String(req.body?.id || `client-note-${clientId}`).trim();
    const noteText = normalizeText(req.body?.note_text);

    if (!clientId) {
      return res.status(400).json({ error: 'clientId is required' });
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

    const existing = await db.get(
      `
        SELECT id
        FROM client_notes
        WHERE client_id = ?
        LIMIT 1
      `,
      [clientId]
    );

    if (existing) {
      await db.run(
        `
          UPDATE client_notes
          SET note_text = ?,
              updated_at = ?
          WHERE client_id = ?
        `,
        [noteText, new Date().toISOString(), clientId]
      );
    } else {
      const now = new Date().toISOString();
      await db.run(
        `
          INSERT INTO client_notes (id, client_id, note_text, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?)
        `,
        [id, clientId, noteText, now, now]
      );
    }

    const saved = await db.get(
      `
        SELECT id, client_id, note_text, created_at, updated_at
        FROM client_notes
        WHERE client_id = ?
        LIMIT 1
      `,
      [clientId]
    );

    res.json(mapRow(saved));
  } catch (error) {
    console.error('PUT /api/client-notes/:clientId failed', error);
    res.status(500).json({ error: 'Failed to save client notes' });
  }
});

router.delete('/:clientId', async (req, res) => {
  try {
    const db = await dbPromise;
    const clientId = String(req.params.clientId || '').trim();

    if (!clientId) {
      return res.status(400).json({ error: 'clientId is required' });
    }

    await db.run(
      `
        DELETE FROM client_notes
        WHERE client_id = ?
      `,
      [clientId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/client-notes/:clientId failed', error);
    res.status(500).json({ error: 'Failed to delete client notes' });
  }
});

export default router;
