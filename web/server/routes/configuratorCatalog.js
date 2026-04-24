import express from 'express';
import { randomUUID } from 'crypto';
import { dbPromise } from '../db.js';

const router = express.Router();

const ENTITY_CONFIG = {
  manufacturers: {
    table: 'configurator_manufacturers',
    columns: ['id', 'name', 'code', 'notes', 'is_active', 'created_at', 'updated_at'],
    mutableColumns: ['name', 'code', 'notes', 'is_active'],
    orderBy: 'updated_at DESC, name ASC',
  },
  products: {
    table: 'configurator_products',
    columns: ['id', 'manufacturer_id', 'name', 'code', 'product_family', 'notes', 'is_active', 'created_at', 'updated_at'],
    mutableColumns: ['manufacturer_id', 'name', 'code', 'product_family', 'notes', 'is_active'],
    orderBy: 'updated_at DESC, name ASC',
  },
  windowTypes: {
    table: 'configurator_window_types',
    columns: ['id', 'product_id', 'name', 'code', 'opening_direction', 'operation_type', 'sliding_direction', 'view_logic', 'notes', 'is_active', 'created_at', 'updated_at'],
    mutableColumns: ['product_id', 'name', 'code', 'opening_direction', 'operation_type', 'sliding_direction', 'view_logic', 'notes', 'is_active'],
    orderBy: 'updated_at DESC, name ASC',
  },
  sectionProfiles: {
    table: 'configurator_section_profiles',
    columns: ['id', 'category', 'family', 'code', 'name', 'description', 'orientation_applicability_json', 'inside_outside_applicability', 'operation_applicability_json', 'visible_face_width_mm', 'depth_mm', 'inset_mm', 'overlap_mm', 'drawing_reference_ids_json', 'notes', 'is_active', 'created_at', 'updated_at'],
    mutableColumns: ['category', 'family', 'code', 'name', 'description', 'orientation_applicability_json', 'inside_outside_applicability', 'operation_applicability_json', 'visible_face_width_mm', 'depth_mm', 'inset_mm', 'overlap_mm', 'drawing_reference_ids_json', 'notes', 'is_active'],
    orderBy: 'updated_at DESC, name ASC',
  },
  profileMappings: {
    table: 'configurator_window_type_profile_mappings',
    columns: ['id', 'manufacturer_id', 'product_id', 'window_type_id', 'profile_id', 'mapping_key', 'operation_type', 'notes', 'is_active', 'created_at', 'updated_at'],
    mutableColumns: ['manufacturer_id', 'product_id', 'window_type_id', 'profile_id', 'mapping_key', 'operation_type', 'notes', 'is_active'],
    orderBy: 'updated_at DESC, mapping_key ASC',
  },
  renderProfiles: {
    table: 'configurator_render_profiles',
    columns: ['id', 'manufacturer_id', 'product_id', 'window_type_id', 'name', 'code', 'operation_type', 'view_logic', 'frame_top_visible_mm', 'frame_left_visible_mm', 'frame_right_visible_mm', 'frame_bottom_visible_mm', 'sash_top_visible_mm', 'sash_left_visible_mm', 'sash_right_visible_mm', 'sash_bottom_visible_mm', 'bead_top_visible_mm', 'bead_left_visible_mm', 'bead_right_visible_mm', 'bead_bottom_visible_mm', 'preview_width_mm', 'preview_height_mm', 'handle_axis_offset_mm', 'handle_height_mm', 'hinge_pivot_offset_mm', 'trickle_vent_enabled', 'trickle_vent_ea_value', 'trickle_vent_head_visible_mm', 'trickle_vent_slot_top_offset_mm', 'trickle_vent_slot_height_mm', 'trickle_vent_slot_bottom_offset_mm', 'trickle_vent_slot_widths_json', 'trickle_vent_slot_gaps_json', 'external_cladding_inset_mm', 'external_frame_cladding_colour', 'external_sash_cladding_colour', 'notes', 'is_active', 'created_at', 'updated_at'],
    mutableColumns: ['manufacturer_id', 'product_id', 'window_type_id', 'name', 'code', 'operation_type', 'view_logic', 'frame_top_visible_mm', 'frame_left_visible_mm', 'frame_right_visible_mm', 'frame_bottom_visible_mm', 'sash_top_visible_mm', 'sash_left_visible_mm', 'sash_right_visible_mm', 'sash_bottom_visible_mm', 'bead_top_visible_mm', 'bead_left_visible_mm', 'bead_right_visible_mm', 'bead_bottom_visible_mm', 'preview_width_mm', 'preview_height_mm', 'handle_axis_offset_mm', 'handle_height_mm', 'hinge_pivot_offset_mm', 'trickle_vent_enabled', 'trickle_vent_ea_value', 'trickle_vent_head_visible_mm', 'trickle_vent_slot_top_offset_mm', 'trickle_vent_slot_height_mm', 'trickle_vent_slot_bottom_offset_mm', 'trickle_vent_slot_widths_json', 'trickle_vent_slot_gaps_json', 'external_cladding_inset_mm', 'external_frame_cladding_colour', 'external_sash_cladding_colour', 'notes', 'is_active'],
    orderBy: 'updated_at DESC, name ASC',
  },
  sectionDrawings: {
    table: 'configurator_section_drawings',
    columns: ['id', 'manufacturer_id', 'product_id', 'window_type_id', 'title', 'code', 'represents', 'orientation', 'inside_outside_applicability', 'section_ref_id', 'profile_ref_id', 'drawing_purpose', 'source_dxf_path', 'source_svg_path', 'geometry_rules_json', 'render_behaviour_json', 'notes', 'is_active', 'created_at', 'updated_at'],
    mutableColumns: ['manufacturer_id', 'product_id', 'window_type_id', 'title', 'code', 'represents', 'orientation', 'inside_outside_applicability', 'section_ref_id', 'profile_ref_id', 'drawing_purpose', 'source_dxf_path', 'source_svg_path', 'geometry_rules_json', 'render_behaviour_json', 'notes', 'is_active'],
    orderBy: 'updated_at DESC, title ASC',
  },
  materials: {
    table: 'configurator_materials',
    columns: ['id', 'manufacturer_id', 'product_id', 'name', 'code', 'material_type', 'metadata_json', 'notes', 'is_active', 'created_at', 'updated_at'],
    mutableColumns: ['manufacturer_id', 'product_id', 'name', 'code', 'material_type', 'metadata_json', 'notes', 'is_active'],
    orderBy: 'updated_at DESC, name ASC',
  },
  colours: {
    table: 'configurator_colours',
    columns: ['id', 'manufacturer_id', 'product_id', 'name', 'code', 'finish', 'metadata_json', 'notes', 'is_active', 'created_at', 'updated_at'],
    mutableColumns: ['manufacturer_id', 'product_id', 'name', 'code', 'finish', 'metadata_json', 'notes', 'is_active'],
    orderBy: 'updated_at DESC, name ASC',
  },
  hardware: {
    table: 'configurator_hardware',
    columns: ['id', 'manufacturer_id', 'product_id', 'window_type_id', 'name', 'code', 'hardware_type', 'metadata_json', 'notes', 'is_active', 'created_at', 'updated_at'],
    mutableColumns: ['manufacturer_id', 'product_id', 'window_type_id', 'name', 'code', 'hardware_type', 'metadata_json', 'notes', 'is_active'],
    orderBy: 'updated_at DESC, name ASC',
  },
  glass: {
    table: 'configurator_glass_presets',
    columns: ['id', 'manufacturer_id', 'product_id', 'name', 'code', 'specification', 'metadata_json', 'notes', 'is_active', 'created_at', 'updated_at'],
    mutableColumns: ['manufacturer_id', 'product_id', 'name', 'code', 'specification', 'metadata_json', 'notes', 'is_active'],
    orderBy: 'updated_at DESC, name ASC',
  },
};

const ENTITY_ALIASES = {
  renderprofiles: 'renderProfiles',
  render_profiles: 'renderProfiles',
  'render-profiles': 'renderProfiles',
  windowtypes: 'windowTypes',
  window_types: 'windowTypes',
  'window-types': 'windowTypes',
  sectionprofiles: 'sectionProfiles',
  section_profiles: 'sectionProfiles',
  'section-profiles': 'sectionProfiles',
  profilemappings: 'profileMappings',
  profile_mappings: 'profileMappings',
  'profile-mappings': 'profileMappings',
  sectiondrawings: 'sectionDrawings',
  section_drawings: 'sectionDrawings',
  'section-drawings': 'sectionDrawings',
};

function getEntityConfig(entityKey) {
  const raw = String(entityKey || '').trim();
  const canonicalKey = ENTITY_CONFIG[raw] ? raw : ENTITY_ALIASES[raw] ?? null;
  return canonicalKey ? ENTITY_CONFIG[canonicalKey] ?? null : null;
}

function getCanonicalEntityKey(entityKey) {
  const raw = String(entityKey || '').trim();
  return ENTITY_CONFIG[raw] ? raw : ENTITY_ALIASES[raw] ?? raw;
}

function normalizeBoolean(value) {
  return value ? 1 : 0;
}

function safeString(value) {
  return String(value ?? '').trim();
}

function safeNullableString(value) {
  const next = safeString(value);
  return next || null;
}

function safeJsonText(value) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '{}';
    try {
      JSON.parse(trimmed);
      return trimmed;
    } catch {
      return JSON.stringify({ raw: trimmed });
    }
  }
  try {
    return JSON.stringify(value ?? {});
  } catch {
    return '{}';
  }
}

function parseJsonValue(raw) {
  if (!raw) return {};
  try {
    return JSON.parse(String(raw));
  } catch {
    return {};
  }
}

function parseJsonArray(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(String(raw));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normaliseRow(entityKey, row) {
  if (!row) return null;
  const next = { ...row, is_active: !!row.is_active };
  if (entityKey === 'sectionProfiles') {
    next.orientation_applicability = parseJsonArray(row.orientation_applicability_json);
    next.operation_applicability = parseJsonArray(row.operation_applicability_json);
    next.drawing_reference_ids = parseJsonArray(row.drawing_reference_ids_json);
  }
  if (entityKey === 'sectionDrawings') {
    next.geometry_rules = parseJsonValue(row.geometry_rules_json);
    next.render_behaviour = parseJsonValue(row.render_behaviour_json);
  }

  if (entityKey === 'renderProfiles') {
    next.trickle_vent_enabled = !!row.trickle_vent_enabled;
    next.trickle_vent_slot_widths_mm = parseJsonArray(row.trickle_vent_slot_widths_json).map((value) => Number(value)).filter((value) => Number.isFinite(value));
    next.trickle_vent_slot_gaps_mm = parseJsonArray(row.trickle_vent_slot_gaps_json).map((value) => Number(value)).filter((value) => Number.isFinite(value));
    return next;
  }
  if (['materials', 'colours', 'hardware', 'glass'].includes(entityKey)) {
    next.metadata = parseJsonValue(row.metadata_json);
  }
  return next;
}

function buildValues(entityKey, body, isCreate) {
  if (entityKey === 'manufacturers') {
    return {
      id: isCreate ? safeString(body.id) || randomUUID() : undefined,
      name: safeString(body.name),
      code: safeString(body.code),
      notes: safeString(body.notes),
      is_active: normalizeBoolean(body.is_active ?? true),
    };
  }

  if (entityKey === 'products') {
    return {
      id: isCreate ? safeString(body.id) || randomUUID() : undefined,
      manufacturer_id: safeString(body.manufacturer_id),
      name: safeString(body.name),
      code: safeString(body.code),
      product_family: safeString(body.product_family),
      notes: safeString(body.notes),
      is_active: normalizeBoolean(body.is_active ?? true),
    };
  }

  if (entityKey === 'windowTypes') {
    return {
      id: isCreate ? safeString(body.id) || randomUUID() : undefined,
      product_id: safeString(body.product_id),
      name: safeString(body.name),
      code: safeString(body.code),
      opening_direction: safeString(body.opening_direction) || 'inward',
      operation_type: safeString(body.operation_type) || 'fixed',
      sliding_direction: safeString(body.sliding_direction) || 'none',
      view_logic: safeString(body.view_logic) || 'both',
      notes: safeString(body.notes),
      is_active: normalizeBoolean(body.is_active ?? true),
    };
  }

  if (entityKey === 'sectionProfiles') {
    return {
      id: isCreate ? safeString(body.id) || randomUUID() : undefined,
      category: safeString(body.category) || 'outer_frame',
      family: safeString(body.family) || 'window',
      code: safeString(body.code),
      name: safeString(body.name),
      description: safeString(body.description),
      orientation_applicability_json: safeJsonText(body.orientation_applicability ?? body.orientation_applicability_json ?? []),
      inside_outside_applicability: safeString(body.inside_outside_applicability) || 'both',
      operation_applicability_json: safeJsonText(body.operation_applicability ?? body.operation_applicability_json ?? []),
      visible_face_width_mm: Number(body.visible_face_width_mm ?? 70) || 70,
      depth_mm: Number(body.depth_mm ?? 70) || 70,
      inset_mm: Number(body.inset_mm ?? 0) || 0,
      overlap_mm: Number(body.overlap_mm ?? 0) || 0,
      drawing_reference_ids_json: safeJsonText(body.drawing_reference_ids ?? body.drawing_reference_ids_json ?? []),
      notes: safeString(body.notes),
      is_active: normalizeBoolean(body.is_active ?? true),
    };
  }

  if (entityKey === 'profileMappings') {
    return {
      id: isCreate ? safeString(body.id) || randomUUID() : undefined,
      manufacturer_id: safeNullableString(body.manufacturer_id),
      product_id: safeNullableString(body.product_id),
      window_type_id: safeNullableString(body.window_type_id),
      profile_id: safeString(body.profile_id),
      mapping_key: safeString(body.mapping_key),
      operation_type: safeString(body.operation_type),
      notes: safeString(body.notes),
      is_active: normalizeBoolean(body.is_active ?? true),
    };
  }

  if (entityKey === 'renderProfiles') {
    return {
      id: isCreate ? safeString(body.id) || randomUUID() : undefined,
      manufacturer_id: safeNullableString(body.manufacturer_id),
      product_id: safeNullableString(body.product_id),
      window_type_id: safeNullableString(body.window_type_id),
      name: safeString(body.name),
      code: safeString(body.code),
      operation_type: safeString(body.operation_type) || 'fixed',
      view_logic: safeString(body.view_logic) || 'inside',
      frame_top_visible_mm: Number(body.frame_top_visible_mm ?? 63) || 63,
      frame_left_visible_mm: Number(body.frame_left_visible_mm ?? 63) || 63,
      frame_right_visible_mm: Number(body.frame_right_visible_mm ?? 63) || 63,
      frame_bottom_visible_mm: Number(body.frame_bottom_visible_mm ?? 63) || 63,
      sash_top_visible_mm: body.sash_top_visible_mm === "" || body.sash_top_visible_mm == null ? null : Number(body.sash_top_visible_mm),
      sash_left_visible_mm: body.sash_left_visible_mm === "" || body.sash_left_visible_mm == null ? null : Number(body.sash_left_visible_mm),
      sash_right_visible_mm: body.sash_right_visible_mm === "" || body.sash_right_visible_mm == null ? null : Number(body.sash_right_visible_mm),
      sash_bottom_visible_mm: body.sash_bottom_visible_mm === "" || body.sash_bottom_visible_mm == null ? null : Number(body.sash_bottom_visible_mm),
      bead_top_visible_mm: body.bead_top_visible_mm === "" || body.bead_top_visible_mm == null ? null : Number(body.bead_top_visible_mm),
      bead_left_visible_mm: body.bead_left_visible_mm === "" || body.bead_left_visible_mm == null ? null : Number(body.bead_left_visible_mm),
      bead_right_visible_mm: body.bead_right_visible_mm === "" || body.bead_right_visible_mm == null ? null : Number(body.bead_right_visible_mm),
      bead_bottom_visible_mm: body.bead_bottom_visible_mm === "" || body.bead_bottom_visible_mm == null ? null : Number(body.bead_bottom_visible_mm),
      preview_width_mm: Number(body.preview_width_mm ?? 1000) || 1000,
      preview_height_mm: Number(body.preview_height_mm ?? 1200) || 1200,
      handle_axis_offset_mm: body.handle_axis_offset_mm === "" || body.handle_axis_offset_mm == null ? null : Number(body.handle_axis_offset_mm),
      handle_height_mm: body.handle_height_mm === "" || body.handle_height_mm == null ? null : Number(body.handle_height_mm),
      hinge_pivot_offset_mm: body.hinge_pivot_offset_mm === "" || body.hinge_pivot_offset_mm == null ? null : Number(body.hinge_pivot_offset_mm),
      trickle_vent_enabled: normalizeBoolean(body.trickle_vent_enabled ?? false),
      trickle_vent_ea_value: safeString(body.trickle_vent_ea_value),
      trickle_vent_head_visible_mm: body.trickle_vent_head_visible_mm === "" || body.trickle_vent_head_visible_mm == null ? null : Number(body.trickle_vent_head_visible_mm),
      trickle_vent_slot_top_offset_mm: body.trickle_vent_slot_top_offset_mm === "" || body.trickle_vent_slot_top_offset_mm == null ? null : Number(body.trickle_vent_slot_top_offset_mm),
      trickle_vent_slot_height_mm: body.trickle_vent_slot_height_mm === "" || body.trickle_vent_slot_height_mm == null ? null : Number(body.trickle_vent_slot_height_mm),
      trickle_vent_slot_bottom_offset_mm: body.trickle_vent_slot_bottom_offset_mm === "" || body.trickle_vent_slot_bottom_offset_mm == null ? null : Number(body.trickle_vent_slot_bottom_offset_mm),
      trickle_vent_slot_widths_json: safeJsonText(body.trickle_vent_slot_widths_mm ?? body.trickle_vent_slot_widths_json ?? []),
      trickle_vent_slot_gaps_json: safeJsonText(body.trickle_vent_slot_gaps_mm ?? body.trickle_vent_slot_gaps_json ?? []),
      external_cladding_inset_mm: body.external_cladding_inset_mm === "" || body.external_cladding_inset_mm == null ? null : Number(body.external_cladding_inset_mm),
      external_frame_cladding_colour: safeString(body.external_frame_cladding_colour),
      external_sash_cladding_colour: safeString(body.external_sash_cladding_colour),
      notes: safeString(body.notes),
      is_active: normalizeBoolean(body.is_active ?? true),
    };
  }

  if (entityKey === 'sectionDrawings') {
    return {
      id: isCreate ? safeString(body.id) || randomUUID() : undefined,
      manufacturer_id: safeNullableString(body.manufacturer_id),
      product_id: safeNullableString(body.product_id),
      window_type_id: safeNullableString(body.window_type_id),
      title: safeString(body.title),
      code: safeString(body.code),
      represents: safeString(body.represents),
      orientation: safeString(body.orientation) || 'head',
      inside_outside_applicability: safeString(body.inside_outside_applicability) || 'both',
      section_ref_id: safeString(body.section_ref_id),
      profile_ref_id: safeString(body.profile_ref_id),
      drawing_purpose: safeString(body.drawing_purpose) || 'elevation_reference',
      source_dxf_path: safeString(body.source_dxf_path),
      source_svg_path: safeString(body.source_svg_path),
      geometry_rules_json: safeJsonText(body.geometry_rules ?? body.geometry_rules_json),
      render_behaviour_json: safeJsonText(body.render_behaviour ?? body.render_behaviour_json),
      notes: safeString(body.notes),
      is_active: normalizeBoolean(body.is_active ?? true),
    };
  }

  if (entityKey === 'materials') {
    return {
      id: isCreate ? safeString(body.id) || randomUUID() : undefined,
      manufacturer_id: safeNullableString(body.manufacturer_id),
      product_id: safeNullableString(body.product_id),
      name: safeString(body.name),
      code: safeString(body.code),
      material_type: safeString(body.material_type),
      metadata_json: safeJsonText(body.metadata ?? body.metadata_json),
      notes: safeString(body.notes),
      is_active: normalizeBoolean(body.is_active ?? true),
    };
  }

  if (entityKey === 'colours') {
    return {
      id: isCreate ? safeString(body.id) || randomUUID() : undefined,
      manufacturer_id: safeNullableString(body.manufacturer_id),
      product_id: safeNullableString(body.product_id),
      name: safeString(body.name),
      code: safeString(body.code),
      finish: safeString(body.finish),
      metadata_json: safeJsonText(body.metadata ?? body.metadata_json),
      notes: safeString(body.notes),
      is_active: normalizeBoolean(body.is_active ?? true),
    };
  }

  if (entityKey === 'hardware') {
    return {
      id: isCreate ? safeString(body.id) || randomUUID() : undefined,
      manufacturer_id: safeNullableString(body.manufacturer_id),
      product_id: safeNullableString(body.product_id),
      window_type_id: safeNullableString(body.window_type_id),
      name: safeString(body.name),
      code: safeString(body.code),
      hardware_type: safeString(body.hardware_type),
      metadata_json: safeJsonText(body.metadata ?? body.metadata_json),
      notes: safeString(body.notes),
      is_active: normalizeBoolean(body.is_active ?? true),
    };
  }

  return {
    id: isCreate ? safeString(body.id) || randomUUID() : undefined,
    manufacturer_id: safeNullableString(body.manufacturer_id),
    product_id: safeNullableString(body.product_id),
    name: safeString(body.name),
    code: safeString(body.code),
    specification: safeString(body.specification),
    metadata_json: safeJsonText(body.metadata ?? body.metadata_json),
    notes: safeString(body.notes),
    is_active: normalizeBoolean(body.is_active ?? true),
  };
}

async function ensureNullableForeignKey(db, entityKey, values, column, parentTable) {
  const value = values?.[column] ?? null;
  if (!value) {
    values[column] = null;
    return;
  }
  const exists = await db.get(`SELECT id FROM ${parentTable} WHERE id = ? LIMIT 1`, [value]);
  if (!exists) {
    const error = new Error(`Invalid ${column} for ${entityKey}`);
    error.statusCode = 400;
    error.publicMessage = `${column} does not reference an existing ${parentTable} row`;
    throw error;
  }
}

async function validateEntityForeignKeys(db, entityKey, values) {
  if (entityKey === 'renderProfiles') {
    await ensureNullableForeignKey(db, entityKey, values, 'manufacturer_id', 'configurator_manufacturers');
    await ensureNullableForeignKey(db, entityKey, values, 'product_id', 'configurator_products');
    await ensureNullableForeignKey(db, entityKey, values, 'window_type_id', 'configurator_window_types');
  }
}

async function listEntity(entityKey) {
  const canonicalEntityKey = getCanonicalEntityKey(entityKey);
  const config = getEntityConfig(canonicalEntityKey);
  if (!config) return [];
  const db = await dbPromise;
  const rows = await db.all(
    `SELECT ${config.columns.join(', ')} FROM ${config.table} ORDER BY ${config.orderBy || 'updated_at DESC'}`
  );
  return rows.map((row) => normaliseRow(canonicalEntityKey, row));
}

router.get('/', async (_req, res) => {
  try {
    const bootstrap = {};
    for (const entityKey of Object.keys(ENTITY_CONFIG)) {
      bootstrap[entityKey] = await listEntity(entityKey);
    }
    return res.json(bootstrap);
  } catch (error) {
    console.error('Failed to load configurator catalog bootstrap', error);
    return res.status(500).json({ error: 'Failed to load configurator catalog' });
  }
});

router.get('/:entity', async (req, res) => {
  try {
    const entityKey = getCanonicalEntityKey(req.params.entity);
    const config = getEntityConfig(entityKey);
    if (!config) return res.status(404).json({ error: 'Unknown configurator catalog entity' });
    return res.json(await listEntity(entityKey));
  } catch (error) {
    console.error('Failed to load configurator catalog entity', error);
    return res.status(500).json({ error: 'Failed to load configurator catalog entity' });
  }
});

router.post('/:entity', async (req, res) => {
  try {
    const entityKey = getCanonicalEntityKey(req.params.entity);
    const config = getEntityConfig(entityKey);
    if (!config) return res.status(404).json({ error: 'Unknown configurator catalog entity' });

    const values = buildValues(entityKey, req.body ?? {}, true);
    const columns = config.mutableColumns;
    const insertColumns = ['id', ...columns];
    const placeholders = insertColumns.map(() => '?').join(', ');
    const db = await dbPromise;
    await validateEntityForeignKeys(db, entityKey, values);
    const params = insertColumns.map((column) => values[column]);

    await db.run(
      `INSERT INTO ${config.table} (${insertColumns.join(', ')}, created_at, updated_at) VALUES (${placeholders}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      params
    );

    const saved = await db.get(`SELECT ${config.columns.join(', ')} FROM ${config.table} WHERE id = ? LIMIT 1`, [values.id]);
    return res.json(normaliseRow(entityKey, saved));
  } catch (error) {
    console.error('Failed to create configurator catalog record', error);
    return res.status(error?.statusCode || 500).json({ error: error?.publicMessage || 'Failed to create configurator catalog record' });
  }
});

router.put('/:entity/:id', async (req, res) => {
  try {
    const entityKey = getCanonicalEntityKey(req.params.entity);
    const config = getEntityConfig(entityKey);
    if (!config) return res.status(404).json({ error: 'Unknown configurator catalog entity' });

    const values = buildValues(entityKey, req.body ?? {}, false);
    const assignments = config.mutableColumns.map((column) => `${column} = ?`).join(', ');
    const db = await dbPromise;
    await validateEntityForeignKeys(db, entityKey, values);
    const params = config.mutableColumns.map((column) => values[column]);
    params.push(String(req.params.id || '').trim());

    const result = await db.run(
      `UPDATE ${config.table} SET ${assignments}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      params
    );
    if (!result.changes) return res.status(404).json({ error: 'Configurator catalog record not found' });

    const saved = await db.get(`SELECT ${config.columns.join(', ')} FROM ${config.table} WHERE id = ? LIMIT 1`, [String(req.params.id || '').trim()]);
    return res.json(normaliseRow(entityKey, saved));
  } catch (error) {
    console.error('Failed to update configurator catalog record', error);
    return res.status(error?.statusCode || 500).json({ error: error?.publicMessage || 'Failed to update configurator catalog record' });
  }
});

router.delete('/:entity/:id', async (req, res) => {
  try {
    const entityKey = getCanonicalEntityKey(req.params.entity);
    const config = getEntityConfig(entityKey);
    if (!config) return res.status(404).json({ error: 'Unknown configurator catalog entity' });
    const db = await dbPromise;
    const result = await db.run(`DELETE FROM ${config.table} WHERE id = ?`, [String(req.params.id || '').trim()]);
    if (!result.changes) return res.status(404).json({ error: 'Configurator catalog record not found' });
    return res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete configurator catalog record', error);
    return res.status(500).json({ error: 'Failed to delete configurator catalog record' });
  }
});

export default router;
