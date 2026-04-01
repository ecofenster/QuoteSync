import express from 'express';
import { dbPromise } from '../db.js';

const router = express.Router();

function normalizeJsonValue(value, fallback) {
  if (value == null) return JSON.stringify(fallback);
  if (typeof value === 'string') {
    try {
      JSON.parse(value);
      return value;
    } catch {
      return JSON.stringify(fallback);
    }
  }
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify(fallback);
  }
}

function normalizeCoordinate(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

router.get('/', async (req, res) => {
  try {
    const db = await dbPromise;
    const clientId = String(req.query.client_id || '').trim();

    if (!clientId) {
      return res.status(400).json({ error: 'client_id is required' });
    }

    const estimates = await db.all(
      `
        SELECT
          id,
          client_id,
          estimate_ref,
          base_estimate_ref,
          revision_no,
          status,
          estimated_order_month,
          estimated_order_year,
          defaults_json,
          positions_json,
          order_meta_json,
          outcome,
          project_address,
          project_address_json,
          postcode,
          what3words,
          latitude,
          longitude,
          created_at,
          updated_at
        FROM estimates
        WHERE client_id = ?
        ORDER BY created_at DESC, rowid DESC
      `,
      [clientId]
    );

    res.json(
      estimates.map((row) => ({
        ...row,
        defaults_json: (() => {
          try { return JSON.parse(row.defaults_json || '{}'); } catch { return {}; }
        })(),
        positions_json: (() => {
          try { return JSON.parse(row.positions_json || '[]'); } catch { return []; }
        })(),
        order_meta_json: (() => {
          try { return JSON.parse(row.order_meta_json || '{}'); } catch { return {}; }
        })(),
        project_address_json: (() => {
          try { return JSON.parse(row.project_address_json || '{}'); } catch { return {}; }
        })(),
        postcode: String(row.postcode || ''),
        what3words: String(row.what3words || ''),
        latitude: normalizeCoordinate(row.latitude),
        longitude: normalizeCoordinate(row.longitude),
      }))
    );
  } catch (error) {
    console.error('GET /api/estimates failed', error);
    res.status(500).json({ error: 'Failed to load estimates' });
  }
});

router.post('/', async (req, res) => {
  try {
    const db = await dbPromise;
    const {
      id,
      client_id,
      estimate_ref,
      base_estimate_ref,
      revision_no,
      status,
      estimated_order_month,
      estimated_order_year,
      defaults_json,
      positions_json,
      order_meta_json,
      outcome,
      project_address,
      project_address_json,
      postcode,
      what3words,
      latitude,
      longitude,
      created_at,
      updated_at,
    } = req.body ?? {};

    await db.run(
      `
        INSERT INTO estimates (
          id,
          client_id,
          estimate_ref,
          base_estimate_ref,
          revision_no,
          status,
          estimated_order_month,
          estimated_order_year,
          defaults_json,
          positions_json,
          order_meta_json,
          outcome,
          project_address,
          project_address_json,
          postcode,
          what3words,
          latitude,
          longitude,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id ?? '',
        client_id ?? '',
        estimate_ref ?? '',
        base_estimate_ref ?? '',
        Number.isFinite(Number(revision_no)) ? Number(revision_no) : 0,
        status ?? 'Draft',
        estimated_order_month ?? '',
        estimated_order_year == null ? null : Number(estimated_order_year),
        normalizeJsonValue(defaults_json, {}),
        normalizeJsonValue(positions_json, []),
        normalizeJsonValue(order_meta_json, {}),
        outcome ?? 'Open',
        project_address ?? '',
        normalizeJsonValue(project_address_json, {}),
        postcode ?? '',
        what3words ?? '',
        normalizeCoordinate(latitude),
        normalizeCoordinate(longitude),
        created_at ?? new Date().toISOString(),
        updated_at ?? new Date().toISOString(),
      ]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('POST /api/estimates failed', error);
    res.status(500).json({ error: 'Failed to save estimate' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const db = await dbPromise;
    const {
      client_id,
      estimate_ref,
      base_estimate_ref,
      revision_no,
      status,
      estimated_order_month,
      estimated_order_year,
      defaults_json,
      positions_json,
      order_meta_json,
      outcome,
      project_address,
      project_address_json,
      postcode,
      what3words,
      latitude,
      longitude,
      updated_at,
    } = req.body ?? {};

    await db.run(
      `
        UPDATE estimates
        SET
          client_id = ?,
          estimate_ref = ?,
          base_estimate_ref = ?,
          revision_no = ?,
          status = ?,
          estimated_order_month = ?,
          estimated_order_year = ?,
          defaults_json = ?,
          positions_json = ?,
          order_meta_json = ?,
          outcome = ?,
          project_address = ?,
          project_address_json = ?,
          postcode = ?,
          what3words = ?,
          latitude = ?,
          longitude = ?,
          updated_at = ?
        WHERE id = ?
      `,
      [
        client_id ?? '',
        estimate_ref ?? '',
        base_estimate_ref ?? '',
        Number.isFinite(Number(revision_no)) ? Number(revision_no) : 0,
        status ?? 'Draft',
        estimated_order_month ?? '',
        estimated_order_year == null ? null : Number(estimated_order_year),
        normalizeJsonValue(defaults_json, {}),
        normalizeJsonValue(positions_json, []),
        normalizeJsonValue(order_meta_json, {}),
        outcome ?? 'Open',
        project_address ?? '',
        normalizeJsonValue(project_address_json, {}),
        postcode ?? '',
        what3words ?? '',
        normalizeCoordinate(latitude),
        normalizeCoordinate(longitude),
        updated_at ?? new Date().toISOString(),
        req.params.id,
      ]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('PUT /api/estimates/:id failed', error);
    res.status(500).json({ error: 'Failed to update estimate' });
  }
});

export default router;
