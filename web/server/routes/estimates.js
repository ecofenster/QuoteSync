import express from 'express';
import { dbPromise } from '../db.js';

const router = express.Router();

const DEFAULT_ESTIMATE_REF_PREFIX = 'EF-EST';

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

function parseFlag(value) {
  if (value === undefined || value === null) return false;
  const normalized = String(value).trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

function parseEstimateTrailingNumber(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return 0;

  const trailingNumber = trimmed.match(/-(\d+)$/);
  if (trailingNumber) {
    const n = Number(trailingNumber[1]);
    return Number.isFinite(n) ? n : 0;
  }

  const fallbackDigits = trimmed.match(/\d+/g);
  const fallback = fallbackDigits ? Number(fallbackDigits[fallbackDigits.length - 1]) : 0;
  return Number.isFinite(fallback) ? fallback : 0;
}

function pad3(n) {
  const s = String(Math.max(0, Number(n) || 0));
  return s.length >= 3 ? s : '0'.repeat(3 - s.length) + s;
}

async function nextEstimateRefs(db, year, prefix = DEFAULT_ESTIMATE_REF_PREFIX) {
  const rows = await db.all(
    `
      SELECT estimate_ref
      FROM estimates
      WHERE estimate_ref LIKE ?
    `,
    [`${prefix}-${year}-%`]
  );

  let maxNumber = 0;
  for (const row of rows) {
    const n = parseEstimateTrailingNumber(row?.estimate_ref);
    if (n > maxNumber) maxNumber = n;
  }

  const nextNumber = maxNumber + 1;
  const baseEstimateRef = `${prefix}-${year}-${pad3(nextNumber)}`;
  return {
    baseEstimateRef,
    estimateRef: baseEstimateRef,
    revisionNo: 0,
  };
}

function mapEstimateRow(row) {
  return {
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
    deleted_at: row.deleted_at ? String(row.deleted_at) : null,
  };
}

router.get('/', async (req, res) => {
  try {
    const db = await dbPromise;
    const clientId = String(req.query.client_id || '').trim();
    const includeDeleted = parseFlag(req.query.include_deleted);
    const onlyDeleted = parseFlag(req.query.only_deleted);

    if (!clientId) {
      return res.status(400).json({ error: 'client_id is required' });
    }

    let deletedFilterSql = 'AND e.deleted_at IS NULL';
    if (onlyDeleted) {
      deletedFilterSql = 'AND e.deleted_at IS NOT NULL';
    } else if (includeDeleted) {
      deletedFilterSql = '';
    }

    const estimates = await db.all(
      `
        SELECT
          e.id,
          e.client_id,
          e.estimate_ref,
          e.base_estimate_ref,
          e.revision_no,
          e.status,
          e.estimated_order_month,
          e.estimated_order_year,
          e.defaults_json,
          e.positions_json,
          e.order_meta_json,
          e.outcome,
          e.project_address,
          e.project_address_json,
          e.postcode,
          e.what3words,
          e.latitude,
          e.longitude,
          e.created_at,
          e.updated_at,
          e.deleted_at
        FROM estimates e
        INNER JOIN clients c ON c.id = e.client_id
        WHERE e.client_id = ?
          AND c.deleted_at IS NULL
          ${deletedFilterSql}
        ORDER BY
          CASE WHEN e.deleted_at IS NULL THEN 0 ELSE 1 END,
          COALESCE(e.deleted_at, e.created_at) DESC,
          e.rowid DESC
      `,
      [clientId]
    );

    res.json(estimates.map((row) => mapEstimateRow(row)));
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

    const normalizedClientId = String(client_id ?? '').trim();

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
      return res.status(404).json({ error: 'Active client not found for estimate' });
    }

    const year =
      Number.isFinite(Number(estimated_order_year)) && Number(estimated_order_year) > 0
        ? Number(estimated_order_year)
        : new Date().getFullYear();

    const refs = await nextEstimateRefs(db, year, DEFAULT_ESTIMATE_REF_PREFIX);

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
          updated_at,
          deleted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
      `,
      [
        id ?? '',
        normalizedClientId,
        refs.estimateRef,
        refs.baseEstimateRef,
        Number.isFinite(Number(revision_no)) ? Number(revision_no) : refs.revisionNo,
        status ?? 'Draft',
        estimated_order_month ?? '',
        year,
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

    const created = await db.get(
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
          updated_at,
          deleted_at
        FROM estimates
        WHERE id = ?
        LIMIT 1
      `,
      [id ?? '']
    );

    if (!created) {
      return res.status(500).json({ error: 'Estimate was created but could not be reloaded' });
    }

    res.json(mapEstimateRow(created));
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

    const current = await db.get(
      `
        SELECT
          id,
          client_id,
          estimate_ref,
          base_estimate_ref,
          revision_no,
          deleted_at
        FROM estimates
        WHERE id = ?
        LIMIT 1
      `,
      [req.params.id]
    );

    if (!current) {
      return res.status(404).json({ error: 'Estimate not found' });
    }

    const normalizedClientId = String(client_id ?? current.client_id ?? '').trim();
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
      return res.status(404).json({ error: 'Active client not found for estimate' });
    }

    const normalizedEstimateRef = String(
      estimate_ref ?? current.estimate_ref ?? ''
    ).trim();

    if (!normalizedEstimateRef) {
      return res.status(500).json({ error: 'Estimate reference missing on existing estimate' });
    }

    const normalizedBaseEstimateRef = String(
      base_estimate_ref ?? current.base_estimate_ref ?? normalizedEstimateRef
    ).trim() || normalizedEstimateRef;

    const normalizedRevisionNo = Number.isFinite(Number(revision_no))
      ? Number(revision_no)
      : (Number.isFinite(Number(current.revision_no)) ? Number(current.revision_no) : 0);

    const existing = await db.get(
      `
        SELECT id
        FROM estimates
        WHERE estimate_ref = ?
          AND id != ?
          AND deleted_at IS NULL
        ORDER BY created_at DESC, rowid DESC
        LIMIT 1
      `,
      [normalizedEstimateRef, req.params.id]
    );

    if (existing) {
      return res.status(409).json({ error: 'Another estimate with this reference already exists' });
    }

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
        normalizedClientId,
        normalizedEstimateRef,
        normalizedBaseEstimateRef,
        normalizedRevisionNo,
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

router.delete('/:id', async (req, res) => {
  try {
    const db = await dbPromise;
    const deletedAt = new Date().toISOString();

    const result = await db.run(
      `
        UPDATE estimates
        SET deleted_at = COALESCE(deleted_at, ?)
        WHERE id = ?
      `,
      [deletedAt, req.params.id]
    );

    if (!result.changes) {
      return res.status(404).json({ error: 'Estimate not found' });
    }

    res.json({ success: true, deleted_at: deletedAt });
  } catch (error) {
    console.error('DELETE /api/estimates/:id failed', error);
    res.status(500).json({ error: 'Failed to delete estimate' });
  }
});

router.post('/:id/restore', async (req, res) => {
  try {
    const db = await dbPromise;

    const current = await db.get(
      `
        SELECT id, client_id, estimate_ref
        FROM estimates
        WHERE id = ?
        LIMIT 1
      `,
      [req.params.id]
    );

    if (!current) {
      return res.status(404).json({ error: 'Estimate not found' });
    }

    const activeClient = await db.get(
      `
        SELECT id
        FROM clients
        WHERE id = ?
          AND deleted_at IS NULL
        LIMIT 1
      `,
      [current.client_id]
    );

    if (!activeClient) {
      return res.status(409).json({ error: 'Cannot restore estimate while its client is deleted' });
    }

    const conflictingActiveEstimate = await db.get(
      `
        SELECT id
        FROM estimates
        WHERE estimate_ref = ?
          AND id != ?
          AND deleted_at IS NULL
        LIMIT 1
      `,
      [String(current.estimate_ref || ''), req.params.id]
    );

    if (conflictingActiveEstimate) {
      return res.status(409).json({ error: 'Cannot restore estimate because its reference is already in use by an active estimate' });
    }

    await db.run(
      `
        UPDATE estimates
        SET deleted_at = NULL
        WHERE id = ?
      `,
      [req.params.id]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('POST /api/estimates/:id/restore failed', error);
    res.status(500).json({ error: 'Failed to restore estimate' });
  }
});

router.delete('/:id/purge', async (req, res) => {
  try {
    const db = await dbPromise;

    const result = await db.run(
      `
        DELETE FROM estimates
        WHERE id = ?
      `,
      [req.params.id]
    );

    if (!result.changes) {
      return res.status(404).json({ error: 'Estimate not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/estimates/:id/purge failed', error);
    res.status(500).json({ error: 'Failed to purge estimate' });
  }
});

export default router;

