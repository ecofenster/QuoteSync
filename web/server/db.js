import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { fileURLToPath } from 'url';
import { initializeSupplierCommercialSchema } from './schema/supplierCommercialSchema.js';
import { initializeWorkflowSchema } from './features/workflow/workflowSchema.js';
import { initializeCommercialIdentitySchema } from './features/commercialIdentity/commercialIdentitySchema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../quotesync.db');

const CURRENT_SYSTEM_USER = {
  id: 'user-1',
  name: 'User',
  role: 'estimator',
};

async function ensureColumn(db, tableName, columnName, definitionSql) {
  const tableExists = await db.get(
    `
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
        AND name = ?
      LIMIT 1
    `,
    [tableName]
  );
  if (!tableExists) return;

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

async function tableExists(db, tableName) {
  const row = await db.get(
    `
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
        AND name = ?
      LIMIT 1
    `,
    [tableName]
  );
  return !!row;
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

async function openDatabaseWithRecovery(filename) {
  const attemptOpen = async () => {
    const db = await open({
      filename,
      driver: sqlite3.Database,
    });
    await db.get(`SELECT name FROM sqlite_master LIMIT 1`);
    return db;
  };

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  try {
    return await attemptOpen();
  } catch (error) {
    const code = String(error?.code || '');
    const journalPath = `${filename}-journal`;
    if (code !== 'SQLITE_IOERR' || !fs.existsSync(journalPath)) {
      throw error;
    }

    console.warn(`SQLite I/O error opening ${filename}; retrying recovery against ${journalPath}.`);

    let lastError = error;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        if (fs.existsSync(journalPath)) {
          try {
            fs.unlinkSync(journalPath);
          } catch (unlinkError) {
            lastError = unlinkError;
          }
        }
        return await attemptOpen();
      } catch (retryError) {
        lastError = retryError;
        await sleep(500);
      }
    }

    throw lastError;
  }
}

async function countRows(db, tableName) {
  if (!(await tableExists(db, tableName))) return 0;
  const row = await db.get(`SELECT COUNT(*) AS count FROM ${tableName}`);
  return Number(row?.count || 0);
}

async function seedConfiguratorSectionProfiles(db) {
  const existingCount = await countRows(db, 'configurator_section_profiles');
  if (existingCount > 0) return;

  const profiles = [
    {
      id: 'profile-frame-fixed',
      category: 'outer_frame',
      family: 'window',
      code: 'FRAME-FIXED',
      name: 'Fixed outer frame',
      description: 'Default fixed-window perimeter frame profile.',
      orientation_applicability_json: JSON.stringify(['head', 'jamb_left', 'jamb_right', 'bottom']),
      inside_outside_applicability: 'both',
      operation_applicability_json: JSON.stringify(['fixed']),
      visible_face_width_mm: 70,
      depth_mm: 70,
      inset_mm: 10,
      overlap_mm: 0,
      drawing_reference_ids_json: JSON.stringify([]),
      notes: 'Seeded fallback fixed profile for native renderer.',
    },
    {
      id: 'profile-frame-tt',
      category: 'outer_frame',
      family: 'window',
      code: 'FRAME-TT',
      name: 'Tilt & turn outer frame',
      description: 'Default inward tilt-and-turn perimeter frame profile.',
      orientation_applicability_json: JSON.stringify(['head', 'jamb_left', 'jamb_right', 'bottom']),
      inside_outside_applicability: 'both',
      operation_applicability_json: JSON.stringify(['tilt_turn']),
      visible_face_width_mm: 76,
      depth_mm: 78,
      inset_mm: 12,
      overlap_mm: 0,
      drawing_reference_ids_json: JSON.stringify([]),
      notes: 'Seeded fallback inward T&T frame profile.',
    },
    {
      id: 'profile-sash-tt',
      category: 'sash',
      family: 'window',
      code: 'SASH-TT',
      name: 'Tilt & turn sash',
      description: 'Default inward tilt-and-turn sash profile.',
      orientation_applicability_json: JSON.stringify(['head', 'jamb_left', 'jamb_right', 'bottom']),
      inside_outside_applicability: 'inside',
      operation_applicability_json: JSON.stringify(['tilt_turn']),
      visible_face_width_mm: 58,
      depth_mm: 68,
      inset_mm: 8,
      overlap_mm: 6,
      drawing_reference_ids_json: JSON.stringify([]),
      notes: 'Seeded fallback inward T&T sash profile.',
    },
    {
      id: 'profile-mullion-static',
      category: 'mullion',
      family: 'window',
      code: 'MULL-STATIC',
      name: 'Static mullion',
      description: 'Default static mullion profile.',
      orientation_applicability_json: JSON.stringify(['mullion']),
      inside_outside_applicability: 'both',
      operation_applicability_json: JSON.stringify(['fixed', 'tilt_turn']),
      visible_face_width_mm: 76,
      depth_mm: 76,
      inset_mm: 0,
      overlap_mm: 0,
      drawing_reference_ids_json: JSON.stringify([]),
      notes: 'Seeded fallback static mullion profile.',
    },
    {
      id: 'profile-mullion-flying',
      category: 'flying_mullion',
      family: 'window',
      code: 'MULL-FLYING',
      name: 'Flying mullion',
      description: 'Default flying mullion profile.',
      orientation_applicability_json: JSON.stringify(['mullion']),
      inside_outside_applicability: 'both',
      operation_applicability_json: JSON.stringify(['tilt_turn']),
      visible_face_width_mm: 62,
      depth_mm: 72,
      inset_mm: 0,
      overlap_mm: 0,
      drawing_reference_ids_json: JSON.stringify([]),
      notes: 'Seeded fallback flying mullion profile.',
    },
    {
      id: 'profile-transom-static',
      category: 'transom',
      family: 'window',
      code: 'TRANSOM-STATIC',
      name: 'Static transom',
      description: 'Default static transom profile.',
      orientation_applicability_json: JSON.stringify(['transom']),
      inside_outside_applicability: 'both',
      operation_applicability_json: JSON.stringify(['fixed', 'tilt_turn']),
      visible_face_width_mm: 76,
      depth_mm: 76,
      inset_mm: 0,
      overlap_mm: 0,
      drawing_reference_ids_json: JSON.stringify([]),
      notes: 'Seeded fallback static transom profile.',
    },
    {
      id: 'profile-cill-standard',
      category: 'cill',
      family: 'window',
      code: 'CILL-STANDARD',
      name: 'Standard cill / bottom profile',
      description: 'Default cill profile used where a bottom profile is mapped.',
      orientation_applicability_json: JSON.stringify(['bottom']),
      inside_outside_applicability: 'outside',
      operation_applicability_json: JSON.stringify(['fixed', 'tilt_turn']),
      visible_face_width_mm: 32,
      depth_mm: 110,
      inset_mm: 0,
      overlap_mm: 0,
      drawing_reference_ids_json: JSON.stringify([]),
      notes: 'Seeded fallback cill profile.',
    },
  ];

  for (const profile of profiles) {
    await db.run(
      `
        INSERT INTO configurator_section_profiles (
          id,
          category,
          family,
          code,
          name,
          description,
          orientation_applicability_json,
          inside_outside_applicability,
          operation_applicability_json,
          visible_face_width_mm,
          depth_mm,
          inset_mm,
          overlap_mm,
          drawing_reference_ids_json,
          notes,
          is_active,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
      `,
      [
        profile.id,
        profile.category,
        profile.family,
        profile.code,
        profile.name,
        profile.description,
        profile.orientation_applicability_json,
        profile.inside_outside_applicability,
        profile.operation_applicability_json,
        profile.visible_face_width_mm,
        profile.depth_mm,
        profile.inset_mm,
        profile.overlap_mm,
        profile.drawing_reference_ids_json,
        profile.notes,
      ]
    );
  }
}

async function seedConfiguratorProfileMappings(db) {
  const existingCount = await countRows(db, 'configurator_window_type_profile_mappings');
  if (existingCount > 0) return;

  const mappings = [
    ['mapping-fixed-frame-head', 'frame_head', 'profile-frame-fixed', 'fixed'],
    ['mapping-fixed-frame-jamb-left', 'frame_jamb_left', 'profile-frame-fixed', 'fixed'],
    ['mapping-fixed-frame-jamb-right', 'frame_jamb_right', 'profile-frame-fixed', 'fixed'],
    ['mapping-fixed-frame-bottom', 'frame_bottom', 'profile-frame-fixed', 'fixed'],
    ['mapping-fixed-mullion', 'mullion', 'profile-mullion-static', 'fixed'],
    ['mapping-fixed-transom', 'transom', 'profile-transom-static', 'fixed'],
    ['mapping-fixed-cill', 'cill', 'profile-cill-standard', 'fixed'],
    ['mapping-tt-frame-head', 'frame_head', 'profile-frame-tt', 'tilt_turn'],
    ['mapping-tt-frame-jamb-left', 'frame_jamb_left', 'profile-frame-tt', 'tilt_turn'],
    ['mapping-tt-frame-jamb-right', 'frame_jamb_right', 'profile-frame-tt', 'tilt_turn'],
    ['mapping-tt-frame-bottom', 'frame_bottom', 'profile-frame-tt', 'tilt_turn'],
    ['mapping-tt-sash-head', 'sash_head', 'profile-sash-tt', 'tilt_turn'],
    ['mapping-tt-sash-jamb-left', 'sash_jamb_left', 'profile-sash-tt', 'tilt_turn'],
    ['mapping-tt-sash-jamb-right', 'sash_jamb_right', 'profile-sash-tt', 'tilt_turn'],
    ['mapping-tt-sash-bottom', 'sash_bottom', 'profile-sash-tt', 'tilt_turn'],
    ['mapping-tt-mullion', 'mullion', 'profile-mullion-static', 'tilt_turn'],
    ['mapping-tt-flying-mullion', 'flying_mullion', 'profile-mullion-flying', 'tilt_turn'],
    ['mapping-tt-transom', 'transom', 'profile-transom-static', 'tilt_turn'],
    ['mapping-tt-cill', 'cill', 'profile-cill-standard', 'tilt_turn'],
  ];

  for (const [id, mappingKey, profileId, operationType] of mappings) {
    await db.run(
      `
        INSERT INTO configurator_window_type_profile_mappings (
          id,
          mapping_key,
          profile_id,
          operation_type,
          notes,
          is_active,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
      `,
      [id, mappingKey, profileId, operationType, 'Seeded fallback mapping for the native renderer.']
    );
  }
}

async function seedConfiguratorRenderProfiles(db) {
  const existingCount = await countRows(db, 'configurator_render_profiles');
  if (existingCount > 0) return;

  const profiles = [
    {
      id: 'render-profile-fixed-inside',
      name: 'Fixed window inside render profile',
      code: 'FIXED-INSIDE',
      operation_type: 'fixed',
      view_logic: 'inside',
      frame_top_visible_mm: 63,
      frame_left_visible_mm: 63,
      frame_right_visible_mm: 63,
      frame_bottom_visible_mm: 63,
      sash_top_visible_mm: null,
      sash_left_visible_mm: null,
      sash_right_visible_mm: null,
      sash_bottom_visible_mm: null,
      bead_top_visible_mm: 21,
      bead_left_visible_mm: 21,
      bead_right_visible_mm: 21,
      bead_bottom_visible_mm: 21,
      preview_width_mm: 1000,
      preview_height_mm: 1200,
      handle_axis_offset_mm: null,
      handle_height_mm: null,
      hinge_pivot_offset_mm: null,
      external_frame_cladding_colour: '',
      external_sash_cladding_colour: '',
      notes: 'Seeded inside-view fixed render profile for manual dimension editing.',
    },
    {
      id: 'render-profile-tilt-turn-inside',
      name: 'Tilt & turn inside render profile',
      code: 'TT-INSIDE',
      operation_type: 'tilt_turn',
      view_logic: 'inside',
      frame_top_visible_mm: 37.5,
      frame_left_visible_mm: 37.5,
      frame_right_visible_mm: 37.5,
      frame_bottom_visible_mm: 37.5,
      sash_top_visible_mm: 57,
      sash_left_visible_mm: 57,
      sash_right_visible_mm: 57,
      sash_bottom_visible_mm: 57,
      bead_top_visible_mm: 21,
      bead_left_visible_mm: 21,
      bead_right_visible_mm: 21,
      bead_bottom_visible_mm: 21,
      preview_width_mm: 1000,
      preview_height_mm: 1200,
      handle_axis_offset_mm: 22,
      handle_height_mm: 1050,
      hinge_pivot_offset_mm: 0,
      external_frame_cladding_colour: '',
      external_sash_cladding_colour: '',
      notes: 'Seeded inside-view tilt & turn render profile for manual dimension editing.',
    },
  ];

  for (const profile of profiles) {
    await db.run(
      `
        INSERT INTO configurator_render_profiles (
          id,
          name,
          code,
          operation_type,
          view_logic,
          frame_top_visible_mm,
          frame_left_visible_mm,
          frame_right_visible_mm,
          frame_bottom_visible_mm,
          sash_top_visible_mm,
          sash_left_visible_mm,
          sash_right_visible_mm,
          sash_bottom_visible_mm,
          bead_top_visible_mm,
          bead_left_visible_mm,
          bead_right_visible_mm,
          bead_bottom_visible_mm,
          preview_width_mm,
          preview_height_mm,
          handle_axis_offset_mm,
          handle_height_mm,
          hinge_pivot_offset_mm,
          external_frame_cladding_colour,
          external_sash_cladding_colour,
          notes,
          is_active,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
      `,
      [
        profile.id,
        profile.name,
        profile.code,
        profile.operation_type,
        profile.view_logic,
        profile.frame_top_visible_mm,
        profile.frame_left_visible_mm,
        profile.frame_right_visible_mm,
        profile.frame_bottom_visible_mm,
        profile.sash_top_visible_mm,
        profile.sash_left_visible_mm,
        profile.sash_right_visible_mm,
        profile.sash_bottom_visible_mm,
        profile.bead_top_visible_mm,
        profile.bead_left_visible_mm,
        profile.bead_right_visible_mm,
        profile.bead_bottom_visible_mm,
        profile.preview_width_mm,
        profile.preview_height_mm,
        profile.handle_axis_offset_mm,
        profile.handle_height_mm,
        profile.hinge_pivot_offset_mm,
        profile.external_frame_cladding_colour,
        profile.external_sash_cladding_colour,
        profile.notes,
      ]
    );
  }
}

async function seedB92FixedInternalCatalogSourceData(db) {
  const glassOrderRules = JSON.stringify({
    glass_order_bite_mm: 13,
    glass_order_width_delta_mm: 26,
    glass_order_height_delta_mm: 26,
    glass_order_formula: 'visible_glass_plus_2x_bite',
  });

  const existingManufacturer = await db.get(
    `
      SELECT id
      FROM configurator_manufacturers
      WHERE code = ?
        AND is_active = 1
      ORDER BY is_active DESC, updated_at DESC
      LIMIT 1
    `,
    ['B92']
  );
  const manufacturerId = existingManufacturer?.id || 'manufacturer-b92';
  if (!existingManufacturer) {
    await db.run(
      `
        INSERT INTO configurator_manufacturers (
          id,
          name,
          code,
          notes,
          is_active,
          updated_at
        )
        VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
      `,
      [
        manufacturerId,
        'B92',
        'B92',
        'Additive catalog authority seed dependency for B92 fixed internal source data.',
      ]
    );
  }

  const existingProduct = await db.get(
    `
      SELECT id
      FROM configurator_products
      WHERE code = ?
        AND is_active = 1
      ORDER BY is_active DESC, updated_at DESC
      LIMIT 1
    `,
    ['B92']
  );
  const productId = existingProduct?.id || 'product-b92';
  if (!existingProduct) {
    await db.run(
      `
        INSERT INTO configurator_products (
          id,
          manufacturer_id,
          name,
          code,
          product_family,
          notes,
          is_active,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
      `,
      [
        productId,
        manufacturerId,
        'B92',
        'B92',
        'windows',
        'Additive catalog authority seed for B92 source-model data.',
      ]
    );
  }

  const existingWindowType = await db.get(
    `
      SELECT id
      FROM configurator_window_types
      WHERE product_id = ?
        AND code = ?
        AND operation_type = ?
        AND view_logic = ?
        AND layout_columns = ?
        AND layout_rows = ?
        AND is_active = 1
      LIMIT 1
    `,
    [productId, 'B92-FIXED-INTERNAL-1X1', 'fixed', 'inside', 1, 1]
  );
  const windowTypeId = existingWindowType?.id || 'window-type-b92-fixed-internal-1x1';
  if (!existingWindowType) {
    await db.run(
      `
        INSERT INTO configurator_window_types (
          id,
          product_id,
          name,
          code,
          opening_direction,
          operation_type,
          sliding_direction,
          view_logic,
          layout_columns,
          layout_rows,
          notes,
          is_active,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
      `,
      [
        windowTypeId,
        productId,
        'B92 fixed internal 1x1',
        'B92-FIXED-INTERNAL-1X1',
        'fixed',
        'fixed',
        'none',
        'inside',
        1,
        1,
        'Additive catalog authority seed for B92 fixed internal 1x1.',
      ]
    );
  }

  const profileSeeds = [
    {
      id: 'profile-b92-1',
      code: 'B92-1',
      name: 'B92-1 head/top',
      category: 'outer_frame',
      orientation: ['head'],
      notes: 'Authoritative B92 fixed internal top/head section profile reference.',
    },
    {
      id: 'profile-b92-2',
      code: 'B92-2',
      name: 'B92-2 jamb',
      category: 'outer_frame',
      orientation: ['jamb_left', 'jamb_right'],
      notes: 'Authoritative B92 fixed internal left/right jamb section profile reference.',
    },
    {
      id: 'profile-b92-3',
      code: 'B92-3',
      name: 'B92-3 sill/bottom',
      category: 'outer_frame',
      orientation: ['bottom'],
      notes: 'Authoritative B92 fixed internal sill/bottom section profile reference.',
    },
    {
      id: 'profile-b92-6',
      code: 'B92-6',
      name: 'B92-6 fixed internal interface',
      category: 'coupling',
      orientation: ['coupling'],
      notes: 'Authoritative B92 fixed internal interface section profile reference.',
    },
  ];

  for (const profile of profileSeeds) {
    const existingProfile = await db.get(
      `
        SELECT id
        FROM configurator_section_profiles
        WHERE code = ?
          AND is_active = 1
        LIMIT 1
      `,
      [profile.code]
    );
    if (existingProfile) continue;

    await db.run(
      `
        INSERT INTO configurator_section_profiles (
          id,
          category,
          family,
          code,
          name,
          description,
          orientation_applicability_json,
          inside_outside_applicability,
          operation_applicability_json,
          visible_face_width_mm,
          depth_mm,
          inset_mm,
          overlap_mm,
          drawing_reference_ids_json,
          notes,
          is_active,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
      `,
      [
        profile.id,
        profile.category,
        'window',
        profile.code,
        profile.name,
        profile.notes,
        JSON.stringify(profile.orientation),
        'inside',
        JSON.stringify(['fixed']),
        0,
        0,
        0,
        0,
        JSON.stringify([]),
        profile.notes,
      ]
    );
  }

  const profileByCode = new Map(
    (await db.all(
      `
        SELECT id, code
        FROM configurator_section_profiles
        WHERE code IN (?, ?, ?, ?)
      `,
      ['B92-1', 'B92-2', 'B92-3', 'B92-6']
    )).map((profile) => [profile.code, profile.id])
  );

  const mappingSeeds = [
    ['mapping-b92-fixed-internal-frame-head', 'frame_head', 'B92-1'],
    ['mapping-b92-fixed-internal-jamb-left', 'frame_jamb_left', 'B92-2'],
    ['mapping-b92-fixed-internal-jamb-right', 'frame_jamb_right', 'B92-2'],
    ['mapping-b92-fixed-internal-frame-bottom', 'frame_bottom', 'B92-3'],
    ['mapping-b92-fixed-internal-interface', 'fixed_internal_interface', 'B92-6'],
  ];

  for (const [id, mappingKey, profileCode] of mappingSeeds) {
    const profileId = profileByCode.get(profileCode);
    if (!profileId) continue;

    const existingMapping = await db.get(
      `
        SELECT id
        FROM configurator_window_type_profile_mappings
        WHERE window_type_id = ?
          AND mapping_key = ?
          AND operation_type = ?
          AND profile_id = ?
          AND is_active = 1
        LIMIT 1
      `,
      [windowTypeId, mappingKey, 'fixed', profileId]
    );
    if (existingMapping) continue;

    await db.run(
      `
        INSERT INTO configurator_window_type_profile_mappings (
          id,
          product_id,
          window_type_id,
          profile_id,
          mapping_key,
          operation_type,
          notes,
          is_active,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
      `,
      [
        id,
        productId,
        windowTypeId,
        profileId,
        mappingKey,
        'fixed',
        'Additive catalog authority seed for B92 fixed internal 1x1.',
      ]
    );
  }

  const existingRenderProfile = await db.get(
    `
      SELECT id
      FROM configurator_render_profiles
      WHERE product_id = ?
        AND window_type_id = ?
        AND code = ?
        AND operation_type = ?
        AND view_logic = ?
        AND frame_top_visible_mm = ?
        AND frame_left_visible_mm = ?
        AND frame_right_visible_mm = ?
        AND frame_bottom_visible_mm = ?
        AND is_active = 1
      LIMIT 1
    `,
    [productId, windowTypeId, 'B92-FIXED-INTERNAL', 'fixed', 'inside', 78, 78, 78, 93]
  );
  if (!existingRenderProfile) {
    await db.run(
      `
        INSERT INTO configurator_render_profiles (
          id,
          product_id,
          window_type_id,
          name,
          code,
          operation_type,
          view_logic,
          frame_top_visible_mm,
          frame_left_visible_mm,
          frame_right_visible_mm,
          frame_bottom_visible_mm,
          sash_top_visible_mm,
          sash_left_visible_mm,
          sash_right_visible_mm,
          sash_bottom_visible_mm,
          bead_top_visible_mm,
          bead_left_visible_mm,
          bead_right_visible_mm,
          bead_bottom_visible_mm,
          preview_width_mm,
          preview_height_mm,
          notes,
          is_active,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, ?, ?, ?, 1, CURRENT_TIMESTAMP)
      `,
      [
        'render-profile-b92-fixed-internal',
        productId,
        windowTypeId,
        'B92 fixed internal render profile',
        'B92-FIXED-INTERNAL',
        'fixed',
        'inside',
        78,
        78,
        78,
        93,
        1000,
        1000,
        'Additive catalog authority seed for B92 fixed internal visible frame rules.',
      ]
    );
  }

  const existingGlassOrderDrawing = await db.get(
    `
      SELECT id
      FROM configurator_section_drawings
      WHERE product_id = ?
        AND window_type_id = ?
        AND code = ?
        AND geometry_rules_json = ?
        AND is_active = 1
      LIMIT 1
    `,
    [productId, windowTypeId, 'B92-FIXED-INTERNAL-GLASS-ORDER', glassOrderRules]
  );
  if (!existingGlassOrderDrawing) {
    await db.run(
      `
        INSERT INTO configurator_section_drawings (
          id,
          product_id,
          window_type_id,
          title,
          code,
          represents,
          orientation,
          inside_outside_applicability,
          section_ref_id,
          profile_ref_id,
          drawing_purpose,
          source_dxf_path,
          source_svg_path,
          geometry_rules_json,
          render_behaviour_json,
          notes,
          is_active,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
      `,
      [
        'section-drawing-b92-fixed-internal-glass-order',
        productId,
        windowTypeId,
        'B92 fixed internal glass order rule',
        'B92-FIXED-INTERNAL-GLASS-ORDER',
        'glass_order_rule',
        'inside',
        'inside',
        '',
        '',
        'glass_order_rule',
        '',
        '',
        glassOrderRules,
        JSON.stringify({}),
        'Additive catalog authority seed for B92 fixed internal glass order rule.',
      ]
    );
  }
}

async function seedB92FixedSashInternalCatalogSourceData(db) {
  const glassOrderRules = JSON.stringify({
    glass_order_bite_mm: 13,
    glass_order_width_delta_mm: 26,
    glass_order_height_delta_mm: 26,
    glass_order_formula: 'visible_glass_plus_2x_bite',
  });

  const existingProduct = await db.get(
    `
      SELECT id
      FROM configurator_products
      WHERE code = ?
        AND is_active = 1
      ORDER BY is_active DESC, updated_at DESC
      LIMIT 1
    `,
    ['B92']
  );
  if (!existingProduct) return;
  const productId = existingProduct.id;

  const existingWindowType = await db.get(
    `
      SELECT id
      FROM configurator_window_types
      WHERE product_id = ?
        AND code = ?
        AND operation_type = ?
        AND view_logic = ?
        AND layout_columns = ?
        AND layout_rows = ?
        AND is_active = 1
      LIMIT 1
    `,
    [productId, 'B92-FIXED-SASH-INTERNAL-1X1', 'fixed_sash', 'inside', 1, 1]
  );
  const windowTypeId = existingWindowType?.id || 'window-type-b92-fixed-sash-internal-1x1';
  if (!existingWindowType) {
    await db.run(
      `
        INSERT INTO configurator_window_types (
          id,
          product_id,
          name,
          code,
          opening_direction,
          operation_type,
          sliding_direction,
          view_logic,
          layout_columns,
          layout_rows,
          notes,
          is_active,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
      `,
      [
        windowTypeId,
        productId,
        'B92 fixed sash internal 1x1',
        'B92-FIXED-SASH-INTERNAL-1X1',
        'fixed',
        'fixed_sash',
        'none',
        'inside',
        1,
        1,
        'Additive catalog authority seed for B92 fixed sash internal 1x1.',
      ]
    );
  }

  const profileSeeds = [
    {
      id: 'profile-b92-1',
      code: 'B92-1',
      name: 'B92-1 head/top',
      category: 'outer_frame',
      orientation: ['head'],
      operation: ['fixed_sash'],
      notes: 'Authoritative B92 fixed sash internal top/head section profile reference.',
    },
    {
      id: 'profile-b92-2',
      code: 'B92-2',
      name: 'B92-2 jamb',
      category: 'outer_frame',
      orientation: ['jamb_left', 'jamb_right'],
      operation: ['fixed_sash'],
      notes: 'Authoritative B92 fixed sash internal left/right jamb section profile reference.',
    },
    {
      id: 'profile-b92-3',
      code: 'B92-3',
      name: 'B92-3 sill/bottom',
      category: 'outer_frame',
      orientation: ['bottom'],
      operation: ['fixed_sash'],
      notes: 'Authoritative B92 fixed sash internal sill/bottom section profile reference.',
    },
    {
      id: 'profile-b92-7',
      code: 'B92-7',
      name: 'B92-7 fixed sash head/top',
      category: 'sash',
      orientation: ['sash_head'],
      operation: ['fixed_sash'],
      notes: 'Authoritative B92 fixed sash internal sash head/top section profile reference.',
    },
    {
      id: 'profile-b92-8',
      code: 'B92-8',
      name: 'B92-8 fixed sash bottom',
      category: 'sash',
      orientation: ['sash_bottom'],
      operation: ['fixed_sash'],
      notes: 'Authoritative B92 fixed sash internal sash bottom section profile reference.',
    },
    {
      id: 'profile-b92-9',
      code: 'B92-9',
      name: 'B92-9 fixed sash left jamb',
      category: 'sash',
      orientation: ['sash_left_jamb'],
      operation: ['fixed_sash'],
      notes: 'Authoritative B92 fixed sash internal sash left jamb section profile reference.',
    },
    {
      id: 'profile-b92-10',
      code: 'B92-10',
      name: 'B92-10 fixed sash right jamb',
      category: 'sash',
      orientation: ['sash_right_jamb'],
      operation: ['fixed_sash'],
      notes: 'Authoritative B92 fixed sash internal sash right jamb section profile reference.',
    },
  ];

  for (const profile of profileSeeds) {
    const existingProfile = await db.get(
      `
        SELECT id
        FROM configurator_section_profiles
        WHERE code = ?
          AND is_active = 1
        LIMIT 1
      `,
      [profile.code]
    );
    if (existingProfile) continue;

    await db.run(
      `
        INSERT INTO configurator_section_profiles (
          id,
          category,
          family,
          code,
          name,
          description,
          orientation_applicability_json,
          inside_outside_applicability,
          operation_applicability_json,
          visible_face_width_mm,
          depth_mm,
          inset_mm,
          overlap_mm,
          drawing_reference_ids_json,
          notes,
          is_active,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
      `,
      [
        profile.id,
        profile.category,
        'window',
        profile.code,
        profile.name,
        profile.notes,
        JSON.stringify(profile.orientation),
        'inside',
        JSON.stringify(profile.operation),
        0,
        0,
        0,
        0,
        JSON.stringify([]),
        profile.notes,
      ]
    );
  }

  const profileByCode = new Map(
    (await db.all(
      `
        SELECT id, code
        FROM configurator_section_profiles
        WHERE code IN (?, ?, ?, ?, ?, ?, ?)
      `,
      ['B92-1', 'B92-2', 'B92-3', 'B92-7', 'B92-8', 'B92-9', 'B92-10']
    )).map((profile) => [profile.code, profile.id])
  );

  const mappingSeeds = [
    ['mapping-b92-fixed-sash-internal-frame-head', 'frame_head', 'B92-1'],
    ['mapping-b92-fixed-sash-internal-jamb-left', 'frame_jamb_left', 'B92-2'],
    ['mapping-b92-fixed-sash-internal-jamb-right', 'frame_jamb_right', 'B92-2'],
    ['mapping-b92-fixed-sash-internal-frame-bottom', 'frame_bottom', 'B92-3'],
    ['mapping-b92-fixed-sash-internal-sash-head', 'sash_head', 'B92-7'],
    ['mapping-b92-fixed-sash-internal-sash-left', 'sash_jamb_left', 'B92-9'],
    ['mapping-b92-fixed-sash-internal-sash-right', 'sash_jamb_right', 'B92-10'],
    ['mapping-b92-fixed-sash-internal-sash-bottom', 'sash_bottom', 'B92-8'],
  ];

  for (const [id, mappingKey, profileCode] of mappingSeeds) {
    const profileId = profileByCode.get(profileCode);
    if (!profileId) continue;

    const existingMapping = await db.get(
      `
        SELECT id
        FROM configurator_window_type_profile_mappings
        WHERE window_type_id = ?
          AND mapping_key = ?
          AND operation_type = ?
          AND profile_id = ?
          AND is_active = 1
        LIMIT 1
      `,
      [windowTypeId, mappingKey, 'fixed_sash', profileId]
    );
    if (existingMapping) continue;

    await db.run(
      `
        INSERT INTO configurator_window_type_profile_mappings (
          id,
          product_id,
          window_type_id,
          profile_id,
          mapping_key,
          operation_type,
          notes,
          is_active,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
      `,
      [
        id,
        productId,
        windowTypeId,
        profileId,
        mappingKey,
        'fixed_sash',
        'Additive catalog authority seed for B92 fixed sash internal 1x1.',
      ]
    );
  }

  const existingRenderProfile = await db.get(
    `
      SELECT id
      FROM configurator_render_profiles
      WHERE product_id = ?
        AND window_type_id = ?
        AND code = ?
        AND operation_type = ?
        AND view_logic = ?
        AND frame_top_visible_mm = ?
        AND frame_left_visible_mm = ?
        AND frame_right_visible_mm = ?
        AND frame_bottom_visible_mm = ?
        AND sash_top_visible_mm = ?
        AND sash_left_visible_mm = ?
        AND sash_right_visible_mm = ?
        AND sash_bottom_visible_mm = ?
        AND bead_top_visible_mm = ?
        AND bead_left_visible_mm = ?
        AND bead_right_visible_mm = ?
        AND bead_bottom_visible_mm = ?
        AND is_active = 1
      LIMIT 1
    `,
    [
      productId,
      windowTypeId,
      'B92-FIXED-SASH-INTERNAL',
      'fixed_sash',
      'inside',
      37.5,
      37.5,
      37.5,
      52.5,
      57,
      57,
      57,
      57,
      21,
      21,
      21,
      21,
    ]
  );
  if (!existingRenderProfile) {
    await db.run(
      `
        INSERT INTO configurator_render_profiles (
          id,
          product_id,
          window_type_id,
          name,
          code,
          operation_type,
          view_logic,
          frame_top_visible_mm,
          frame_left_visible_mm,
          frame_right_visible_mm,
          frame_bottom_visible_mm,
          sash_top_visible_mm,
          sash_left_visible_mm,
          sash_right_visible_mm,
          sash_bottom_visible_mm,
          bead_top_visible_mm,
          bead_left_visible_mm,
          bead_right_visible_mm,
          bead_bottom_visible_mm,
          preview_width_mm,
          preview_height_mm,
          notes,
          is_active,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
      `,
      [
        'render-profile-b92-fixed-sash-internal',
        productId,
        windowTypeId,
        'B92 fixed sash internal render profile',
        'B92-FIXED-SASH-INTERNAL',
        'fixed_sash',
        'inside',
        37.5,
        37.5,
        37.5,
        52.5,
        57,
        57,
        57,
        57,
        21,
        21,
        21,
        21,
        1000,
        1000,
        'Additive catalog authority seed for B92 fixed sash internal frame, sash, and bead rules.',
      ]
    );
  }

  const existingGlassOrderDrawing = await db.get(
    `
      SELECT id
      FROM configurator_section_drawings
      WHERE product_id = ?
        AND window_type_id = ?
        AND code = ?
        AND geometry_rules_json = ?
        AND is_active = 1
      LIMIT 1
    `,
    [productId, windowTypeId, 'B92-FIXED-SASH-INTERNAL-GLASS-ORDER', glassOrderRules]
  );
  if (!existingGlassOrderDrawing) {
    await db.run(
      `
        INSERT INTO configurator_section_drawings (
          id,
          product_id,
          window_type_id,
          title,
          code,
          represents,
          orientation,
          inside_outside_applicability,
          section_ref_id,
          profile_ref_id,
          drawing_purpose,
          source_dxf_path,
          source_svg_path,
          geometry_rules_json,
          render_behaviour_json,
          notes,
          is_active,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
      `,
      [
        'section-drawing-b92-fixed-sash-internal-glass-order',
        productId,
        windowTypeId,
        'B92 fixed sash internal glass order rule',
        'B92-FIXED-SASH-INTERNAL-GLASS-ORDER',
        'glass_order_rule',
        'inside',
        'inside',
        '',
        '',
        'glass_order_rule',
        '',
        '',
        glassOrderRules,
        JSON.stringify({}),
        'Additive catalog authority seed for B92 fixed sash internal glass order rule.',
      ]
    );
  }
}

export const dbPromise = openDatabaseWithRecovery(dbPath).then(async (db) => {
  console.log(`QuoteSync SQLite DB: ${dbPath}`);
  await db.exec('PRAGMA foreign_keys = ON');

  await ensureTable(
    db,
    `
      CREATE TABLE IF NOT EXISTS clients (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL DEFAULT '',
        email TEXT NOT NULL DEFAULT '',
        phone TEXT NOT NULL DEFAULT '',
        mobile TEXT NOT NULL DEFAULT '',
        home TEXT NOT NULL DEFAULT '',
        project_name TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        client_ref TEXT NOT NULL DEFAULT '',
        client_type TEXT NOT NULL DEFAULT 'Individual',
        contact_name TEXT NOT NULL DEFAULT '',
        company_name TEXT NOT NULL DEFAULT '',
        customer_address TEXT NOT NULL DEFAULT '',
        project_address TEXT NOT NULL DEFAULT '',
        invoice_address TEXT NOT NULL DEFAULT '',
        invoice_same_as_customer INTEGER NOT NULL DEFAULT 0,
        invoice_same_as_project INTEGER NOT NULL DEFAULT 0,
        customer_address_json TEXT NOT NULL DEFAULT '{}',
        project_address_json TEXT NOT NULL DEFAULT '{}',
        invoice_address_json TEXT NOT NULL DEFAULT '{}',
        what3words TEXT NOT NULL DEFAULT '',
        latitude REAL,
        longitude REAL,
        deleted_at TEXT
      )
    `
  );

  await ensureTable(
    db,
    `
      CREATE TABLE IF NOT EXISTS estimates (
        id TEXT PRIMARY KEY,
        client_id TEXT NOT NULL,
        estimate_ref TEXT NOT NULL DEFAULT '',
        base_estimate_ref TEXT NOT NULL DEFAULT '',
        revision_no INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'Estimate',
        estimated_order_month TEXT NOT NULL DEFAULT '',
        estimated_order_year TEXT NOT NULL DEFAULT '',
        defaults_json TEXT NOT NULL DEFAULT '{}',
        positions_json TEXT NOT NULL DEFAULT '[]',
        order_meta_json TEXT NOT NULL DEFAULT '{}',
        outcome TEXT NOT NULL DEFAULT 'Estimate',
        project_address TEXT NOT NULL DEFAULT '',
        project_address_json TEXT NOT NULL DEFAULT '{}',
        postcode TEXT NOT NULL DEFAULT '',
        what3words TEXT NOT NULL DEFAULT '',
        latitude REAL,
        longitude REAL,
        created_by_user_id TEXT,
        created_by_name TEXT,
        created_by_role TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deleted_at TEXT,
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
      )
    `
  );

  await ensureColumn(db, 'clients', 'deleted_at', 'TEXT');
  await ensureColumn(db, 'estimates', 'deleted_at', 'TEXT');
  await ensureColumn(db, 'estimates', 'created_by_user_id', 'TEXT');
  await ensureColumn(db, 'estimates', 'created_by_name', 'TEXT');
  await ensureColumn(db, 'estimates', 'created_by_role', 'TEXT');

  await initializeSupplierCommercialSchema(db);

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

  await initializeWorkflowSchema(db);
  await initializeCommercialIdentitySchema(db);

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

  await ensureTable(
    db,
    `
      CREATE TABLE IF NOT EXISTS configurator_manufacturers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        code TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `
  );

  await ensureTable(
    db,
    `
      CREATE TABLE IF NOT EXISTS configurator_products (
        id TEXT PRIMARY KEY,
        manufacturer_id TEXT NOT NULL,
        name TEXT NOT NULL,
        code TEXT NOT NULL DEFAULT '',
        product_family TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (manufacturer_id) REFERENCES configurator_manufacturers(id) ON DELETE CASCADE
      )
    `
  );

  await ensureTable(
    db,
    `
      CREATE TABLE IF NOT EXISTS configurator_window_types (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        name TEXT NOT NULL,
        code TEXT NOT NULL DEFAULT '',
        opening_direction TEXT NOT NULL DEFAULT 'inward',
        operation_type TEXT NOT NULL DEFAULT 'fixed',
        sliding_direction TEXT NOT NULL DEFAULT 'none',
        view_logic TEXT NOT NULL DEFAULT 'both',
        layout_columns INTEGER NOT NULL DEFAULT 1,
        layout_rows INTEGER NOT NULL DEFAULT 1,
        notes TEXT NOT NULL DEFAULT '',
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES configurator_products(id) ON DELETE CASCADE
      )
    `
  );

  await ensureTable(
    db,
    `
      CREATE TABLE IF NOT EXISTS configurator_section_profiles (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL DEFAULT 'outer_frame',
        family TEXT NOT NULL DEFAULT 'window',
        code TEXT NOT NULL DEFAULT '',
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        orientation_applicability_json TEXT NOT NULL DEFAULT '[]',
        inside_outside_applicability TEXT NOT NULL DEFAULT 'both',
        operation_applicability_json TEXT NOT NULL DEFAULT '[]',
        visible_face_width_mm REAL NOT NULL DEFAULT 70,
        depth_mm REAL NOT NULL DEFAULT 70,
        inset_mm REAL NOT NULL DEFAULT 0,
        overlap_mm REAL NOT NULL DEFAULT 0,
        drawing_reference_ids_json TEXT NOT NULL DEFAULT '[]',
        notes TEXT NOT NULL DEFAULT '',
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `
  );

  await ensureTable(
    db,
    `
      CREATE TABLE IF NOT EXISTS configurator_window_type_profile_mappings (
        id TEXT PRIMARY KEY,
        manufacturer_id TEXT,
        product_id TEXT,
        window_type_id TEXT,
        profile_id TEXT NOT NULL,
        mapping_key TEXT NOT NULL,
        operation_type TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (manufacturer_id) REFERENCES configurator_manufacturers(id) ON DELETE SET NULL,
        FOREIGN KEY (product_id) REFERENCES configurator_products(id) ON DELETE SET NULL,
        FOREIGN KEY (window_type_id) REFERENCES configurator_window_types(id) ON DELETE SET NULL,
        FOREIGN KEY (profile_id) REFERENCES configurator_section_profiles(id) ON DELETE CASCADE
      )
    `
  );

  await ensureTable(
    db,
    `
      CREATE TABLE IF NOT EXISTS configurator_render_profiles (
        id TEXT PRIMARY KEY,
        manufacturer_id TEXT,
        product_id TEXT,
        window_type_id TEXT,
        name TEXT NOT NULL,
        code TEXT NOT NULL DEFAULT '',
        operation_type TEXT NOT NULL DEFAULT 'fixed',
        view_logic TEXT NOT NULL DEFAULT 'inside',
        frame_top_visible_mm REAL NOT NULL DEFAULT 63,
        frame_left_visible_mm REAL NOT NULL DEFAULT 63,
        frame_right_visible_mm REAL NOT NULL DEFAULT 63,
        frame_bottom_visible_mm REAL NOT NULL DEFAULT 63,
        sash_top_visible_mm REAL,
        sash_left_visible_mm REAL,
        sash_right_visible_mm REAL,
        sash_bottom_visible_mm REAL,
        bead_top_visible_mm REAL,
        bead_left_visible_mm REAL,
        bead_right_visible_mm REAL,
        bead_bottom_visible_mm REAL,
        preview_width_mm REAL NOT NULL DEFAULT 1000,
        preview_height_mm REAL NOT NULL DEFAULT 1200,
        handle_axis_offset_mm REAL,
        handle_height_mm REAL,
        hinge_pivot_offset_mm REAL,
        trickle_vent_enabled INTEGER NOT NULL DEFAULT 0,
        trickle_vent_ea_value TEXT NOT NULL DEFAULT '',
        trickle_vent_head_visible_mm REAL,
        trickle_vent_slot_top_offset_mm REAL,
        trickle_vent_slot_height_mm REAL,
        trickle_vent_slot_bottom_offset_mm REAL,
        trickle_vent_slot_widths_json TEXT NOT NULL DEFAULT '[]',
        trickle_vent_slot_gaps_json TEXT NOT NULL DEFAULT '[]',
        external_cladding_inset_mm REAL,
        external_frame_cladding_colour TEXT NOT NULL DEFAULT '',
        external_sash_cladding_colour TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (manufacturer_id) REFERENCES configurator_manufacturers(id) ON DELETE SET NULL,
        FOREIGN KEY (product_id) REFERENCES configurator_products(id) ON DELETE SET NULL,
        FOREIGN KEY (window_type_id) REFERENCES configurator_window_types(id) ON DELETE SET NULL
      )
    `
  );

  await ensureTable(
    db,
    `
      CREATE TABLE IF NOT EXISTS configurator_section_drawings (
        id TEXT PRIMARY KEY,
        manufacturer_id TEXT,
        product_id TEXT,
        window_type_id TEXT,
        title TEXT NOT NULL,
        code TEXT NOT NULL DEFAULT '',
        represents TEXT NOT NULL DEFAULT '',
        orientation TEXT NOT NULL DEFAULT 'head',
        inside_outside_applicability TEXT NOT NULL DEFAULT 'both',
        section_ref_id TEXT NOT NULL DEFAULT '',
        profile_ref_id TEXT NOT NULL DEFAULT '',
        drawing_purpose TEXT NOT NULL DEFAULT 'elevation_reference',
        source_dxf_path TEXT NOT NULL DEFAULT '',
        source_svg_path TEXT NOT NULL DEFAULT '',
        geometry_rules_json TEXT NOT NULL DEFAULT '{}',
        render_behaviour_json TEXT NOT NULL DEFAULT '{}',
        notes TEXT NOT NULL DEFAULT '',
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (manufacturer_id) REFERENCES configurator_manufacturers(id) ON DELETE SET NULL,
        FOREIGN KEY (product_id) REFERENCES configurator_products(id) ON DELETE SET NULL,
        FOREIGN KEY (window_type_id) REFERENCES configurator_window_types(id) ON DELETE SET NULL
      )
    `
  );

  await ensureColumn(db, 'configurator_render_profiles', 'external_cladding_inset_mm', 'REAL');
  await ensureColumn(db, 'configurator_window_types', 'layout_columns', 'INTEGER NOT NULL DEFAULT 1');
  await ensureColumn(db, 'configurator_window_types', 'layout_rows', 'INTEGER NOT NULL DEFAULT 1');
  await ensureColumn(db, 'configurator_render_profiles', 'trickle_vent_enabled', 'INTEGER NOT NULL DEFAULT 0');
  await ensureColumn(db, 'configurator_render_profiles', 'trickle_vent_ea_value', "TEXT NOT NULL DEFAULT ''");
  await ensureColumn(db, 'configurator_render_profiles', 'trickle_vent_head_visible_mm', 'REAL');
  await ensureColumn(db, 'configurator_render_profiles', 'trickle_vent_slot_top_offset_mm', 'REAL');
  await ensureColumn(db, 'configurator_render_profiles', 'trickle_vent_slot_height_mm', 'REAL');
  await ensureColumn(db, 'configurator_render_profiles', 'trickle_vent_slot_bottom_offset_mm', 'REAL');
  await ensureColumn(db, 'configurator_render_profiles', 'trickle_vent_slot_widths_json', "TEXT NOT NULL DEFAULT '[]'");
  await ensureColumn(db, 'configurator_render_profiles', 'trickle_vent_slot_gaps_json', "TEXT NOT NULL DEFAULT '[]'");

  await ensureTable(
    db,
    `
      CREATE TABLE IF NOT EXISTS configurator_materials (
        id TEXT PRIMARY KEY,
        manufacturer_id TEXT,
        product_id TEXT,
        name TEXT NOT NULL,
        code TEXT NOT NULL DEFAULT '',
        material_type TEXT NOT NULL DEFAULT '',
        metadata_json TEXT NOT NULL DEFAULT '{}',
        notes TEXT NOT NULL DEFAULT '',
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (manufacturer_id) REFERENCES configurator_manufacturers(id) ON DELETE SET NULL,
        FOREIGN KEY (product_id) REFERENCES configurator_products(id) ON DELETE SET NULL
      )
    `
  );

  await ensureTable(
    db,
    `
      CREATE TABLE IF NOT EXISTS configurator_colours (
        id TEXT PRIMARY KEY,
        manufacturer_id TEXT,
        product_id TEXT,
        name TEXT NOT NULL,
        code TEXT NOT NULL DEFAULT '',
        finish TEXT NOT NULL DEFAULT '',
        metadata_json TEXT NOT NULL DEFAULT '{}',
        notes TEXT NOT NULL DEFAULT '',
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (manufacturer_id) REFERENCES configurator_manufacturers(id) ON DELETE SET NULL,
        FOREIGN KEY (product_id) REFERENCES configurator_products(id) ON DELETE SET NULL
      )
    `
  );

  await ensureTable(
    db,
    `
      CREATE TABLE IF NOT EXISTS configurator_hardware (
        id TEXT PRIMARY KEY,
        manufacturer_id TEXT,
        product_id TEXT,
        window_type_id TEXT,
        name TEXT NOT NULL,
        code TEXT NOT NULL DEFAULT '',
        hardware_type TEXT NOT NULL DEFAULT '',
        metadata_json TEXT NOT NULL DEFAULT '{}',
        notes TEXT NOT NULL DEFAULT '',
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (manufacturer_id) REFERENCES configurator_manufacturers(id) ON DELETE SET NULL,
        FOREIGN KEY (product_id) REFERENCES configurator_products(id) ON DELETE SET NULL,
        FOREIGN KEY (window_type_id) REFERENCES configurator_window_types(id) ON DELETE SET NULL
      )
    `
  );

  await ensureTable(
    db,
    `
      CREATE TABLE IF NOT EXISTS configurator_glass_presets (
        id TEXT PRIMARY KEY,
        manufacturer_id TEXT,
        product_id TEXT,
        name TEXT NOT NULL,
        code TEXT NOT NULL DEFAULT '',
        specification TEXT NOT NULL DEFAULT '',
        metadata_json TEXT NOT NULL DEFAULT '{}',
        notes TEXT NOT NULL DEFAULT '',
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (manufacturer_id) REFERENCES configurator_manufacturers(id) ON DELETE SET NULL,
        FOREIGN KEY (product_id) REFERENCES configurator_products(id) ON DELETE SET NULL
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

  await ensureIndex(
    db,
    'idx_configurator_products_manufacturer_id',
    'CREATE INDEX IF NOT EXISTS idx_configurator_products_manufacturer_id ON configurator_products(manufacturer_id)'
  );

  await ensureIndex(
    db,
    'idx_configurator_window_types_product_id',
    'CREATE INDEX IF NOT EXISTS idx_configurator_window_types_product_id ON configurator_window_types(product_id)'
  );

  await ensureIndex(
    db,
    'idx_configurator_section_profiles_category',
    'CREATE INDEX IF NOT EXISTS idx_configurator_section_profiles_category ON configurator_section_profiles(category)'
  );

  await ensureIndex(
    db,
    'idx_configurator_profile_mappings_window_type_id',
    'CREATE INDEX IF NOT EXISTS idx_configurator_profile_mappings_window_type_id ON configurator_window_type_profile_mappings(window_type_id)'
  );

  await ensureIndex(
    db,
    'idx_configurator_profile_mappings_profile_id',
    'CREATE INDEX IF NOT EXISTS idx_configurator_profile_mappings_profile_id ON configurator_window_type_profile_mappings(profile_id)'
  );

  await ensureIndex(
    db,
    'idx_configurator_render_profiles_window_type_id',
    'CREATE INDEX IF NOT EXISTS idx_configurator_render_profiles_window_type_id ON configurator_render_profiles(window_type_id)'
  );

  await ensureIndex(
    db,
    'idx_configurator_section_drawings_window_type_id',
    'CREATE INDEX IF NOT EXISTS idx_configurator_section_drawings_window_type_id ON configurator_section_drawings(window_type_id)'
  );

  await ensureIndex(
    db,
    'idx_configurator_materials_product_id',
    'CREATE INDEX IF NOT EXISTS idx_configurator_materials_product_id ON configurator_materials(product_id)'
  );

  await ensureIndex(
    db,
    'idx_configurator_colours_product_id',
    'CREATE INDEX IF NOT EXISTS idx_configurator_colours_product_id ON configurator_colours(product_id)'
  );

  await ensureIndex(
    db,
    'idx_configurator_hardware_window_type_id',
    'CREATE INDEX IF NOT EXISTS idx_configurator_hardware_window_type_id ON configurator_hardware(window_type_id)'
  );

  await ensureIndex(
    db,
    'idx_configurator_glass_product_id',
    'CREATE INDEX IF NOT EXISTS idx_configurator_glass_product_id ON configurator_glass_presets(product_id)'
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

  await seedConfiguratorSectionProfiles(db);
  await seedConfiguratorProfileMappings(db);
  await seedConfiguratorRenderProfiles(db);
  await seedB92FixedInternalCatalogSourceData(db);
  await seedB92FixedSashInternalCatalogSourceData(db);

  return db;
});
