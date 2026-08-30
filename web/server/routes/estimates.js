import express from 'express';
import { dbPromise } from '../db.js';
import { APP_USER_ROLES, CURRENT_APP_USER } from '../currentUser.js';
import { addConfiguredEstimatePosition, resolveCanonicalAlternativeRelationships, saveConfiguredEstimatePosition, syncEstimatePositionProjections } from '../features/estimatePositions/canonicalEstimatePositions.js';
import { randomUUID } from 'node:crypto';
import { purgeEstimateOwnedGraph } from '../features/estimatePositions/estimatePurgeService.js';
import { createDriveIntegrationService } from '../features/documents/driveIntegrationService.js';
import { allocateCanonicalReference } from '../features/commercialIdentity/referenceAllocator.js';

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

function parseFlag(value) {
  if (value === undefined || value === null) return false;
  const normalized = String(value).trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

function normalizeCreatorRole(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return APP_USER_ROLES.includes(normalized) ? normalized : CURRENT_APP_USER.role;
}

function normalizeCreatorField(value, fallback) {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
}

function mapEstimateRow(row) {
  return {
    ...row,
    project_id: row.project_id || null,
    project_name: row.project_name || null,
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
    created_by_user_id: normalizeCreatorField(row.created_by_user_id, CURRENT_APP_USER.id),
    created_by_name: normalizeCreatorField(row.created_by_name, CURRENT_APP_USER.name),
    created_by_role: normalizeCreatorRole(row.created_by_role),
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
          e.project_id,
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
          e.created_by_user_id,
          e.created_by_name,
          e.created_by_role,
          e.created_at,
          e.updated_at,
          e.deleted_at
          ,p.name project_name
        FROM estimates e
        INNER JOIN clients c ON c.id = e.client_id
        LEFT JOIN projects p ON p.id=e.project_id
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

router.get('/:id/position-bridge',async(req,res)=>{try{const db=await dbPromise,row=await db.get('SELECT id,client_id,positions_json FROM estimates WHERE id=? AND deleted_at IS NULL',req.params.id);if(!row)return res.status(404).json({error:'Estimate not found'});const positions=resolveCanonicalAlternativeRelationships(JSON.parse(row.positions_json||'[]'));res.json({estimateId:row.id,clientId:row.client_id,positions,reviewRequired:positions.filter(position=>position.matchStatus==='review_required').map(position=>({position,candidates:positions.filter(candidate=>candidate.id!==position.id&&candidate.matchStatus!=='review_required')}))});}catch(error){console.error('GET position bridge failed',error);res.status(500).json({error:'Position bridge could not be loaded'})}});
router.post('/:id/positions',async(req,res)=>{try{const value=await addConfiguredEstimatePosition(await dbPromise,{estimateId:req.params.id,position:req.body?.position});return value?res.status(201).json(value):res.status(404).json({error:'Estimate not found'});}catch(error){console.error('POST configured position failed',error);res.status(500).json({error:'Position could not be saved'})}});
router.put('/:id/positions',async(req,res)=>{const db=await dbPromise;try{const estimate=await db.get('SELECT id FROM estimates WHERE id=? AND deleted_at IS NULL',req.params.id);if(!estimate)return res.status(404).json({error:'Estimate not found'});if(!Array.isArray(req.body?.positions))return res.status(400).json({error:'Canonical positions are required'});const positions=resolveCanonicalAlternativeRelationships(req.body.positions.map((position,index)=>({...position,sourceSequence:index}))),ids=new Set();if(positions.some(position=>!position.id||ids.has(position.id)||(ids.add(position.id),false)))return res.status(400).json({error:'Position identifiers must be unique'});if(positions.some(position=>position.alternativeToPositionId&&!ids.has(position.alternativeToPositionId)))return res.status(400).json({error:'Alternative target must be a position in this Estimate'});await db.exec('BEGIN IMMEDIATE');try{const now=new Date().toISOString();await db.run('UPDATE estimates SET positions_json=?,updated_at=? WHERE id=?',JSON.stringify(positions),now,req.params.id);for(const scenario of await db.all('SELECT id FROM project_calculator_lab_scenarios WHERE estimate_id=?',req.params.id)){if(positions.length)await db.run(`DELETE FROM project_calculator_estimate_product_rows WHERE scenario_id=? AND estimate_position_id IS NOT NULL AND estimate_position_id NOT IN (${positions.map(()=>'?').join(',')})`,scenario.id,...positions.map(position=>position.id));else await db.run('DELETE FROM project_calculator_estimate_product_rows WHERE scenario_id=? AND estimate_position_id IS NOT NULL',scenario.id);for(const position of positions)await db.run('UPDATE project_calculator_estimate_product_rows SET display_reference=?,quantity=?,width_mm=?,height_mm=?,classification=?,included_in_current_estimate=?,alternative_to_reference=?,alternative_to_estimate_position_id=?,updated_at=? WHERE scenario_id=? AND estimate_position_id=?',position.positionRef,position.qty,position.widthMm,position.heightMm,position.classification,position.classification==='standard'?1:0,position.alternativeTo,position.alternativeToPositionId,now,scenario.id,position.id);await syncEstimatePositionProjections(db,scenario.id);}await db.exec('COMMIT');res.json({positions});}catch(error){await db.exec('ROLLBACK');throw error;}}catch(error){console.error('PUT canonical positions failed',error);res.status(500).json({error:'Positions could not be saved'})}});
router.put('/:id/positions/:positionId/configuration',async(req,res)=>{try{const value=await saveConfiguredEstimatePosition(await dbPromise,{estimateId:req.params.id,positionId:req.params.positionId,configuredContract:req.body?.configuredContract,projection:req.body?.projection||{}});return value?res.json(value):res.status(404).json({error:'Estimate position not found'});}catch(error){console.error('PUT position configuration failed',error);res.status(500).json({error:'Configuration could not be saved'})}});
router.post('/:id/position-match-reviews/:sourcePositionId',async(req,res)=>{const db=await dbPromise;try{const estimate=await db.get('SELECT positions_json FROM estimates WHERE id=?',req.params.id),source=await db.get(`SELECT p.*,q.id supplier_quote_id,q.supplier_code,q.supplier_name FROM supplier_quote_positions p JOIN supplier_quote_revisions r ON r.id=p.revision_id JOIN supplier_quotes q ON q.id=r.supplier_quote_id WHERE p.id=? AND p.estimate_id=?`,req.params.sourcePositionId,req.params.id);if(!estimate||!source)return res.status(404).json({error:'Match review source not found'});const positions=JSON.parse(estimate.positions_json||'[]'),sourceIndex=positions.findIndex(position=>(position.supplierEvidenceLinks||[]).some(link=>link.sourcePositionId===source.id));if(sourceIndex<0)return res.status(404).json({error:'Canonical supplier position not found'});const decision=req.body?.decision,targetId=decision==='link_existing'?String(req.body?.targetEstimatePositionId||''):positions[sourceIndex].id,targetIndex=positions.findIndex(position=>position.id===targetId);if(targetIndex<0||!['link_existing','create_new'].includes(decision))return res.status(400).json({error:'A valid match decision and target are required'});await db.exec('BEGIN IMMEDIATE');try{if(decision==='link_existing'){const links=positions[sourceIndex].supplierEvidenceLinks||[];positions[targetIndex]={...positions[targetIndex],supplierEvidenceLinks:[...(positions[targetIndex].supplierEvidenceLinks||[]).filter(link=>link.sourcePositionId!==source.id),...links],configurationState:positions[targetIndex].configuredContract?'imported_configured':'imported',matchStatus:'matched'};positions.splice(sourceIndex,1);await db.run('UPDATE project_calculator_estimate_product_rows SET estimate_position_id=? WHERE source_position_id=?',targetId,source.id);}else positions[targetIndex]={...positions[targetIndex],matchStatus:'matched'};await db.run('UPDATE supplier_position_applications SET active=0 WHERE estimate_id=? AND supplier_quote_position_id=? AND active=1',req.params.id,source.id);await db.run(`INSERT INTO supplier_position_applications(id,estimate_id,supplier_quote_id,supplier_quote_revision_id,supplier_quote_position_id,action,target_estimate_position_id,applied_at,applied_by,active,note,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,randomUUID(),req.params.id,source.supplier_quote_id,source.revision_id,source.id,decision==='link_existing'?'map_to_existing_position':'include_as_new_position',targetId,new Date().toISOString(),CURRENT_APP_USER.id,1,'Canonical Estimate Position match review',new Date().toISOString());await db.run('UPDATE estimates SET positions_json=?,updated_at=? WHERE id=?',JSON.stringify(positions),new Date().toISOString(),req.params.id);await db.exec('COMMIT');res.json({positions,targetEstimatePositionId:targetId});}catch(error){await db.exec('ROLLBACK');throw error;}}catch(error){console.error('POST position match review failed',error);res.status(500).json({error:'Match review could not be saved'})}});

router.post('/', async (req, res) => {
  try {
    const db = await dbPromise;
    const {
      id,
      client_id,
      project_id,
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
      createdByUserId,
      createdByName,
      createdByRole,
      created_at,
      updated_at,
    } = req.body ?? {};

    const normalizedClientId = String(client_id ?? '').trim();
    const normalizedProjectId = String(project_id ?? '').trim();
    const estimateId = String(id || randomUUID());

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

    if (!normalizedProjectId) return res.status(422).json({ error: 'project_id is required for a new canonical Estimate' });
    const activeProject = await db.get('SELECT id,name FROM projects WHERE id=? AND client_id=? AND deleted_at IS NULL', normalizedProjectId, normalizedClientId);
    if (!activeProject) return res.status(422).json({ error: 'Choose an active Project belonging to the selected Client' });

    const year =
      Number.isFinite(Number(estimated_order_year)) && Number(estimated_order_year) > 0
        ? Number(estimated_order_year)
        : new Date().getFullYear();

    await db.exec('BEGIN IMMEDIATE');
    let refs;
    try {
      const estimateRef = await allocateCanonicalReference(db, { kind: 'estimate', year, entityId: estimateId });
      refs = { estimateRef, baseEstimateRef: estimateRef, revisionNo: 0 };
      await db.run(
      `
        INSERT INTO estimates (
          id,
          client_id,
          project_id,
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
          created_by_user_id,
          created_by_name,
          created_by_role,
          created_at,
          updated_at,
          deleted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
      `,
      [
        estimateId,
        normalizedClientId,
        normalizedProjectId,
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
        normalizeCreatorField(createdByUserId, CURRENT_APP_USER.id),
        normalizeCreatorField(createdByName, CURRENT_APP_USER.name),
        normalizeCreatorRole(createdByRole),
        created_at ?? new Date().toISOString(),
        updated_at ?? new Date().toISOString(),
      ]
      );
      await db.exec('COMMIT');
    } catch (error) {
      await db.exec('ROLLBACK').catch(() => {});
      throw error;
    }

    const created = await db.get(
      `
        SELECT
          id,
          client_id,
          project_id,
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
          created_by_user_id,
          created_by_name,
          created_by_role,
          created_at,
          updated_at,
          deleted_at
          ,(SELECT name FROM projects WHERE id=estimates.project_id) project_name
        FROM estimates
        WHERE id = ?
        LIMIT 1
      `,
      [estimateId]
    );

    if (!created) {
      return res.status(500).json({ error: 'Estimate was created but could not be reloaded' });
    }

    try { await createDriveIntegrationService(db).provisionEstimate(created.id); }
    catch (driveError) { console.warn('Estimate created; Google Drive provisioning remains pending.', driveError instanceof Error ? driveError.message : driveError); }

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
      project_id,
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
      createdByUserId,
      createdByName,
      createdByRole,
      updated_at,
    } = req.body ?? {};

    const current = await db.get(
      `
        SELECT
          id,
          client_id,
          project_id,
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
    const normalizedProjectId = String(project_id ?? current.project_id ?? '').trim();
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
    if (normalizedProjectId) {
      const activeProject = await db.get('SELECT id FROM projects WHERE id=? AND client_id=? AND deleted_at IS NULL', normalizedProjectId, normalizedClientId);
      if (!activeProject) return res.status(422).json({ error: 'Choose an active Project belonging to the selected Client' });
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
          project_id = ?,
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
          created_by_user_id = ?,
          created_by_name = ?,
          created_by_role = ?,
          updated_at = ?
        WHERE id = ?
      `,
      [
        normalizedClientId,
        normalizedProjectId || null,
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
        normalizeCreatorField(createdByUserId, CURRENT_APP_USER.id),
        normalizeCreatorField(createdByName, CURRENT_APP_USER.name),
        normalizeCreatorRole(createdByRole),
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
    const result=await purgeEstimateOwnedGraph(db,req.params.id);
    if (!result) {
      return res.status(404).json({ error: 'Estimate not found' });
    }
    res.json(result);
  } catch (error) {
    if (Number(error?.status) === 409) return res.status(409).json({ error: error.message, code: error.code || 'estimate_purge_blocked', dependencies: Array.isArray(error.dependencies) ? error.dependencies : [] });
    console.error('DELETE /api/estimates/:id/purge failed', error);
    res.status(500).json({ error: 'Failed to purge estimate' });
  }
});

export default router;
