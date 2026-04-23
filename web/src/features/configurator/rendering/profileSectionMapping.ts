import type {
  ConfiguratorCatalogBootstrap,
  ConfiguratorProfileMappingKey,
  ConfiguratorProfileMappingRecord,
  ConfiguratorRenderProfileRecord,
  ConfiguratorSectionDrawingRecord,
  ConfiguratorSectionGeometryRuleSet,
  ConfiguratorSectionProfileRecord,
} from "../../admin/configuratorCatalog.types";
import type { WindowFieldDefinition } from "../../estimateWorkflow/workflow.types";

export type ResolvedDrawingProfile = {
  id: string | null;
  code: string;
  name: string;
  visibleFaceWidthMm: number;
  depthMm: number;
  insetMm: number;
  overlapMm: number;
  visibleInternalFaceMm: number | null;
  glassInsetMm: number | null;
  beadOffsetMm: number | null;
  beadVisibleFaceMm: number | null;
  handleAxisOffsetMm: number | null;
  hingePivotOffsetMm: number | null;
  meetingGapMm: number | null;
  drawingReferenceIds: string[];
  referenceInputs: Array<{
    drawingId: string;
    title: string;
    purpose: string;
    sourceDxfPath: string | null;
    sourceSvgPath: string | null;
  }>;
  notes: string;
};

export type ResolvedSectionProfileSet = {
  operationType: "fixed" | "tilt_turn" | "mixed";
  manufacturerId: string | null;
  productId: string | null;
  windowTypeId: string | null;
  frame: {
    head: ResolvedDrawingProfile;
    jambLeft: ResolvedDrawingProfile;
    jambRight: ResolvedDrawingProfile;
    bottom: ResolvedDrawingProfile;
  };
  sash: {
    head: ResolvedDrawingProfile | null;
    jambLeft: ResolvedDrawingProfile | null;
    jambRight: ResolvedDrawingProfile | null;
    bottom: ResolvedDrawingProfile | null;
  };
  mullion: ResolvedDrawingProfile;
  flyingMullion: ResolvedDrawingProfile;
  transom: ResolvedDrawingProfile;
  cill: ResolvedDrawingProfile | null;
  sectionReferenceIds: string[];
  referenceInputs: Array<{
    drawingId: string;
    title: string;
    purpose: string;
    sourceDxfPath: string | null;
    sourceSvgPath: string | null;
  }>;
};

type ResolveInput = {
  bootstrap: ConfiguratorCatalogBootstrap | null | undefined;
  productName?: string | null;
  productTypeName?: string | null;
  view?: "inside" | "outside";
  fields?: WindowFieldDefinition[] | null | undefined;
  exactRenderProfile?: ConfiguratorRenderProfileRecord | null;
};

export type RenderDefinitionViewLogic = "inside" | "outside";

const DEFAULT_PROFILE = (name: string, width: number, extra?: Partial<ResolvedDrawingProfile>): ResolvedDrawingProfile => ({
  id: null,
  code: "",
  name,
  visibleFaceWidthMm: width,
  depthMm: width,
  insetMm: 0,
  overlapMm: 0,
  visibleInternalFaceMm: null,
  glassInsetMm: null,
  beadOffsetMm: null,
  beadVisibleFaceMm: null,
  handleAxisOffsetMm: null,
  hingePivotOffsetMm: null,
  meetingGapMm: null,
  drawingReferenceIds: [],
  referenceInputs: [],
  notes: "",
  ...extra,
});

const DEFAULT_RESOLVED_SECTION_PROFILE_SET: ResolvedSectionProfileSet = {
  operationType: "fixed",
  manufacturerId: null,
  productId: null,
  windowTypeId: null,
  frame: {
    head: DEFAULT_PROFILE("Default frame head", 70, { insetMm: 10 }),
    jambLeft: DEFAULT_PROFILE("Default frame jamb left", 70, { insetMm: 10 }),
    jambRight: DEFAULT_PROFILE("Default frame jamb right", 70, { insetMm: 10 }),
    bottom: DEFAULT_PROFILE("Default frame bottom", 70, { insetMm: 10 }),
  },
  sash: {
    head: null,
    jambLeft: null,
    jambRight: null,
    bottom: null,
  },
  mullion: DEFAULT_PROFILE("Default mullion", 76),
  flyingMullion: DEFAULT_PROFILE("Default flying mullion", 62),
  transom: DEFAULT_PROFILE("Default transom", 76),
  cill: DEFAULT_PROFILE("Default cill", 32, { depthMm: 110 }),
  sectionReferenceIds: [],
  referenceInputs: [],
};

function normalizeMatchValue(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ");
}

function deriveOperationType(fields: WindowFieldDefinition[] | null | undefined): "fixed" | "tilt_turn" | "mixed" {
  const next = Array.isArray(fields) ? fields : [];
  if (next.length === 0) return "fixed";
  const normalizedTypes = next.map((field) => String(field?.type || "fixed"));
  if (normalizedTypes.every((value) => value === "fixed")) return "fixed";
  if (normalizedTypes.every((value) => value !== "fixed")) return "tilt_turn";
  return "mixed";
}

function readRuleNumber(value: unknown) {
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

function getDrawingGeometryRules(drawing: ConfiguratorSectionDrawingRecord | null | undefined): ConfiguratorSectionGeometryRuleSet {
  return (drawing?.geometry_rules ?? {}) as ConfiguratorSectionGeometryRuleSet;
}

function findReferenceDrawings(
  drawings: ConfiguratorSectionDrawingRecord[],
  profile: ConfiguratorSectionProfileRecord | null | undefined
) {
  if (!profile) return [];
  const referenceIds = Array.isArray(profile.drawing_reference_ids) ? profile.drawing_reference_ids : [];
  const drawingSet = new Map<string, ConfiguratorSectionDrawingRecord>();
  for (const drawing of drawings) {
    if (!drawing?.is_active) continue;
    if (referenceIds.includes(drawing.id) || (drawing.profile_ref_id && drawing.profile_ref_id === profile.id)) {
      drawingSet.set(drawing.id, drawing);
    }
  }
  return Array.from(drawingSet.values());
}

function profileToResolvedProfile(
  drawings: ConfiguratorSectionDrawingRecord[],
  profile: ConfiguratorSectionProfileRecord | undefined | null,
  fallback: ResolvedDrawingProfile
): ResolvedDrawingProfile {
  if (!profile) return fallback;
  const referenceDrawings = findReferenceDrawings(drawings, profile);
  const geometryRuleSets = referenceDrawings.map((drawing) => getDrawingGeometryRules(drawing));
  const firstGeometryValue = (key: keyof ConfiguratorSectionGeometryRuleSet) => {
    for (const rules of geometryRuleSets) {
      const value = readRuleNumber(rules?.[key]);
      if (value !== null) return value;
    }
    return null;
  };
  return {
    id: profile.id,
    code: profile.code,
    name: profile.name,
    visibleFaceWidthMm: Number(profile.visible_face_width_mm || fallback.visibleFaceWidthMm),
    depthMm: Number(profile.depth_mm || fallback.depthMm),
    insetMm: Number(profile.inset_mm || fallback.insetMm),
    overlapMm: Number(profile.overlap_mm || fallback.overlapMm),
    visibleInternalFaceMm: firstGeometryValue("visible_internal_face_mm"),
    glassInsetMm: firstGeometryValue("glass_inset_mm"),
    beadOffsetMm: firstGeometryValue("bead_offset_mm"),
    beadVisibleFaceMm: firstGeometryValue("bead_visible_face_mm"),
    handleAxisOffsetMm: firstGeometryValue("handle_axis_offset_mm"),
    hingePivotOffsetMm: firstGeometryValue("hinge_pivot_offset_mm"),
    meetingGapMm: firstGeometryValue("meeting_gap_mm"),
    drawingReferenceIds: Array.from(
      new Set([
        ...(Array.isArray(profile.drawing_reference_ids) ? profile.drawing_reference_ids : []),
        ...referenceDrawings.map((drawing) => drawing.id),
      ])
    ),
    referenceInputs: referenceDrawings.map((drawing) => ({
      drawingId: drawing.id,
      title: drawing.title,
      purpose: drawing.drawing_purpose,
      sourceDxfPath: drawing.source_dxf_path || null,
      sourceSvgPath: drawing.source_svg_path || null,
    })),
    notes: profile.notes || "",
  };
}

function chooseBestMapping(
  mappings: ConfiguratorProfileMappingRecord[],
  mappingKey: ConfiguratorProfileMappingKey,
  scope: {
    manufacturerId: string | null;
    productId: string | null;
    windowTypeId: string | null;
    operationType: "fixed" | "tilt_turn" | "mixed";
  }
) {
  return mappings
    .filter((mapping) => mapping.mapping_key === mappingKey && mapping.is_active)
    .filter((mapping) => {
      if (mapping.operation_type && scope.operationType !== "mixed" && mapping.operation_type !== scope.operationType) {
        return false;
      }
      if (mapping.window_type_id && mapping.window_type_id !== scope.windowTypeId) return false;
      if (mapping.product_id && mapping.product_id !== scope.productId) return false;
      if (mapping.manufacturer_id && mapping.manufacturer_id !== scope.manufacturerId) return false;
      return true;
    })
    .sort((a, b) => {
      const score = (mapping: ConfiguratorProfileMappingRecord) =>
        (mapping.window_type_id ? 8 : 0) +
        (mapping.product_id ? 4 : 0) +
        (mapping.manufacturer_id ? 2 : 0) +
        (mapping.operation_type ? 1 : 0);
      return score(b) - score(a);
    })[0];
}

function chooseBestRenderProfile(
  renderProfiles: ConfiguratorRenderProfileRecord[],
  scope: {
    manufacturerId: string | null;
    productId: string | null;
    windowTypeId: string | null;
    operationType: "fixed" | "tilt_turn" | "mixed";
  },
  view: "inside" | "outside"
) {
  return renderProfiles
    .filter((profile) => profile.is_active)
    .filter((profile) => {
      if (profile.operation_type && scope.operationType !== "mixed" && profile.operation_type !== scope.operationType) {
        return false;
      }
      if (profile.view_logic && profile.view_logic !== "both" && profile.view_logic !== view) return false;
      if (profile.window_type_id && profile.window_type_id !== scope.windowTypeId) return false;
      if (profile.product_id && profile.product_id !== scope.productId) return false;
      if (profile.manufacturer_id && profile.manufacturer_id !== scope.manufacturerId) return false;
      return true;
    })
    .sort((a, b) => {
      const score = (profile: ConfiguratorRenderProfileRecord) =>
        (profile.window_type_id ? 8 : 0) +
        (profile.product_id ? 4 : 0) +
        (profile.manufacturer_id ? 2 : 0) +
        (profile.view_logic && profile.view_logic !== "both" ? 1 : 0);
      return score(b) - score(a);
    })[0];
}

function numericOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

export function normalizeRenderProfileForView(
  record: ConfiguratorRenderProfileRecord,
  viewLogic: "inside" | "outside" | "both"
): ConfiguratorRenderProfileRecord {
  if (viewLogic !== "inside") return record;
  const nextBottom =
    record.frame_bottom_visible_mm == null || Number(record.frame_bottom_visible_mm) === 37.5
      ? 52.5
      : record.frame_bottom_visible_mm;
  return {
    ...record,
    frame_bottom_visible_mm: nextBottom,
  };
}

export function buildRenderDefinitionContextKey(
  productGroup: string,
  windowTab: string,
  operationType: string,
  viewCode: string
) {
  return `${productGroup}:${windowTab}:${String(operationType || "fixed").trim().toLowerCase()}:${String(viewCode || "IV").trim().toUpperCase()}`;
}

export function matchesRenderDefinitionContext(
  row: ConfiguratorRenderProfileRecord,
  contextKey: string,
  operationType: string,
  viewLogic: RenderDefinitionViewLogic
) {
  const normalizedName = String(row.name || "").trim().toLowerCase();
  if (normalizedName === contextKey.toLowerCase()) return true;
  const legacyName = String(row.name || "").trim();
  const rowViewLogic = String(row.view_logic || "").trim().toLowerCase();
  const isLegacyProfile = !legacyName.includes(":");
  if (!isLegacyProfile) return false;
  return row.operation_type === operationType && (rowViewLogic === viewLogic || rowViewLogic === "both");
}

export function findExactRenderProfileForContext(input: {
  renderProfiles: ConfiguratorRenderProfileRecord[] | null | undefined;
  contextKey: string;
  operationType: string;
  view: RenderDefinitionViewLogic;
  manufacturerId?: string | null;
  productId?: string | null;
  windowTypeId?: string | null;
}) {
  const rows = Array.isArray(input.renderProfiles) ? input.renderProfiles : [];
  return rows
    .filter((row) => row.is_active)
    .filter((row) => matchesRenderDefinitionContext(row, input.contextKey, input.operationType, input.view))
    .filter((row) => {
      if (input.windowTypeId && row.window_type_id && row.window_type_id !== input.windowTypeId) return false;
      if (input.productId && row.product_id && row.product_id !== input.productId) return false;
      if (input.manufacturerId && row.manufacturer_id && row.manufacturer_id !== input.manufacturerId) return false;
      return true;
    })
    .sort((a, b) => {
      const score = (profile: ConfiguratorRenderProfileRecord) =>
        (profile.window_type_id ? 8 : 0) +
        (profile.product_id ? 4 : 0) +
        (profile.manufacturer_id ? 2 : 0) +
        (String(profile.name || "").includes(":") ? 1 : 0);
      return score(b) - score(a);
    })[0] ?? null;
}

export function buildResolvedSectionProfileSetFromRenderProfile(
  record: ConfiguratorRenderProfileRecord,
  view: RenderDefinitionViewLogic
): ResolvedSectionProfileSet {
  const normalizedRecord = normalizeRenderProfileForView(record, view);
  const operationType = normalizedRecord.operation_type === "fixed" ? "fixed" : "tilt_turn";
  const beadTop = view === "inside" ? numericOrNull(normalizedRecord.bead_top_visible_mm) : null;
  const beadLeft = view === "inside" ? numericOrNull(normalizedRecord.bead_left_visible_mm) : null;
  const beadRight = view === "inside" ? numericOrNull(normalizedRecord.bead_right_visible_mm) : null;
  const beadBottom = view === "inside" ? numericOrNull(normalizedRecord.bead_bottom_visible_mm) : null;
  const sashTop = numericOrNull(normalizedRecord.sash_top_visible_mm);
  const sashLeft = numericOrNull(normalizedRecord.sash_left_visible_mm);
  const sashRight = numericOrNull(normalizedRecord.sash_right_visible_mm);
  const sashBottom = numericOrNull(normalizedRecord.sash_bottom_visible_mm);
  const handleOffset = numericOrNull(normalizedRecord.handle_axis_offset_mm);
  const pivotOffset = numericOrNull(normalizedRecord.hinge_pivot_offset_mm);
  const externalCladdingInsetMm = view === "outside" ? numericOrNull(normalizedRecord.external_cladding_inset_mm) ?? 3 : 0;

  const baseProfile = (
    name: string,
    visibleFaceWidthMm: number,
    beadVisibleFaceMm: number | null,
    side: "top" | "left" | "right" | "bottom"
  ) => ({
    id: `${normalizedRecord.id || "draft"}-${name}-${view}`,
    code: normalizedRecord.code,
    name,
    visibleFaceWidthMm,
    depthMm: visibleFaceWidthMm,
    insetMm: view === "outside" ? externalCladdingInsetMm : beadVisibleFaceMm ?? 10,
    overlapMm: 0,
    visibleInternalFaceMm: view === "inside" ? visibleFaceWidthMm : null,
    glassInsetMm: view === "inside" ? beadVisibleFaceMm : null,
    beadOffsetMm: view === "inside" ? beadVisibleFaceMm : null,
    beadVisibleFaceMm: view === "inside" ? beadVisibleFaceMm : null,
    handleAxisOffsetMm: side === "left" || side === "right" ? handleOffset : null,
    hingePivotOffsetMm: side === "left" || side === "right" ? pivotOffset : null,
    meetingGapMm: null,
    drawingReferenceIds: [],
    referenceInputs: [],
    notes: normalizedRecord.notes,
  });

  const sashProfile = (
    name: string,
    visibleFaceWidthMm: number | null,
    beadVisibleFaceMm: number | null,
    side: "top" | "left" | "right" | "bottom"
  ) =>
    visibleFaceWidthMm == null
      ? null
      : {
          id: `${normalizedRecord.id || "draft"}-${name}-${view}`,
          code: normalizedRecord.code,
          name,
          visibleFaceWidthMm,
          depthMm: visibleFaceWidthMm,
          insetMm:
            view === "inside"
              ? side === "bottom"
                ? 0
                : beadVisibleFaceMm ?? 8
              : externalCladdingInsetMm,
          overlapMm: 0,
          visibleInternalFaceMm: view === "inside" ? visibleFaceWidthMm : null,
          glassInsetMm: view === "inside" ? beadVisibleFaceMm : null,
          beadOffsetMm: view === "inside" ? beadVisibleFaceMm : null,
          beadVisibleFaceMm: view === "inside" ? beadVisibleFaceMm : null,
          handleAxisOffsetMm: side === "left" || side === "right" ? handleOffset : null,
          hingePivotOffsetMm: side === "left" || side === "right" ? pivotOffset : null,
          meetingGapMm: null,
          drawingReferenceIds: [],
          referenceInputs: [],
          notes: normalizedRecord.notes,
        };

  return {
    operationType,
    manufacturerId: normalizedRecord.manufacturer_id,
    productId: normalizedRecord.product_id,
    windowTypeId: normalizedRecord.window_type_id,
    frame: {
      head: baseProfile("Frame head", Number(normalizedRecord.frame_top_visible_mm || 63), beadTop, "top"),
      jambLeft: baseProfile("Frame jamb left", Number(normalizedRecord.frame_left_visible_mm || 63), beadLeft, "left"),
      jambRight: baseProfile("Frame jamb right", Number(normalizedRecord.frame_right_visible_mm || 63), beadRight, "right"),
      bottom: baseProfile("Frame bottom", Number(normalizedRecord.frame_bottom_visible_mm || 52.5), beadBottom, "bottom"),
    },
    sash:
      operationType === "fixed"
        ? { head: null, jambLeft: null, jambRight: null, bottom: null }
        : {
            head: sashProfile("Sash head", sashTop, beadTop, "top"),
            jambLeft: sashProfile("Sash jamb left", sashLeft, beadLeft, "left"),
            jambRight: sashProfile("Sash jamb right", sashRight, beadRight, "right"),
            bottom: sashProfile("Sash bottom", sashBottom, beadBottom, "bottom"),
          },
    mullion: {
      id: `${normalizedRecord.id || "draft"}-mullion-${view}`,
      code: normalizedRecord.code,
      name: "Default mullion",
      visibleFaceWidthMm: 76,
      depthMm: 76,
      insetMm: 0,
      overlapMm: 0,
      visibleInternalFaceMm: null,
      glassInsetMm: null,
      beadOffsetMm: null,
      beadVisibleFaceMm: null,
      handleAxisOffsetMm: null,
      hingePivotOffsetMm: null,
      meetingGapMm: null,
      drawingReferenceIds: [],
      referenceInputs: [],
      notes: normalizedRecord.notes,
    },
    flyingMullion: {
      id: `${normalizedRecord.id || "draft"}-flying-${view}`,
      code: normalizedRecord.code,
      name: "Default flying mullion",
      visibleFaceWidthMm: 62,
      depthMm: 62,
      insetMm: 0,
      overlapMm: 0,
      visibleInternalFaceMm: null,
      glassInsetMm: null,
      beadOffsetMm: null,
      beadVisibleFaceMm: null,
      handleAxisOffsetMm: null,
      hingePivotOffsetMm: null,
      meetingGapMm: 5,
      drawingReferenceIds: [],
      referenceInputs: [],
      notes: normalizedRecord.notes,
    },
    transom: {
      id: `${normalizedRecord.id || "draft"}-transom-${view}`,
      code: normalizedRecord.code,
      name: "Default transom",
      visibleFaceWidthMm: 76,
      depthMm: 76,
      insetMm: 0,
      overlapMm: 0,
      visibleInternalFaceMm: null,
      glassInsetMm: null,
      beadOffsetMm: null,
      beadVisibleFaceMm: null,
      handleAxisOffsetMm: null,
      hingePivotOffsetMm: null,
      meetingGapMm: null,
      drawingReferenceIds: [],
      referenceInputs: [],
      notes: normalizedRecord.notes,
    },
    cill: null,
    sectionReferenceIds: [],
    referenceInputs: [],
  };
}

function applyRenderProfileSide(
  profile: ResolvedDrawingProfile | null,
  visibleFaceWidthMm: number | null | undefined,
  beadVisibleFaceMm: number | null | undefined,
  sideOffsets: { handleAxisOffsetMm?: number | null; hingePivotOffsetMm?: number | null },
  view: "inside" | "outside"
) {
  if (!profile) return profile;
  const nextVisibleFaceWidth = Number.isFinite(Number(visibleFaceWidthMm))
    ? Number(visibleFaceWidthMm)
    : profile.visibleFaceWidthMm;
  const nextBeadVisibleFace = Number.isFinite(Number(beadVisibleFaceMm))
    ? Number(beadVisibleFaceMm)
    : profile.beadVisibleFaceMm;
  return {
    ...profile,
    visibleFaceWidthMm: nextVisibleFaceWidth,
    visibleInternalFaceMm: view === "inside" ? nextVisibleFaceWidth : profile.visibleInternalFaceMm,
    glassInsetMm: nextBeadVisibleFace ?? profile.glassInsetMm,
    beadVisibleFaceMm: nextBeadVisibleFace,
    handleAxisOffsetMm:
      Number.isFinite(Number(sideOffsets.handleAxisOffsetMm))
        ? Number(sideOffsets.handleAxisOffsetMm)
        : profile.handleAxisOffsetMm,
    hingePivotOffsetMm:
      Number.isFinite(Number(sideOffsets.hingePivotOffsetMm))
        ? Number(sideOffsets.hingePivotOffsetMm)
        : profile.hingePivotOffsetMm,
  };
}

function resolveScope(bootstrap: ConfiguratorCatalogBootstrap, productName?: string | null, productTypeName?: string | null) {
  const normalizedProduct = normalizeMatchValue(productName);
  const normalizedWindowType = normalizeMatchValue(productTypeName);
  const product =
    bootstrap.products.find(
      (row) => normalizeMatchValue(row.name) === normalizedProduct || normalizeMatchValue(row.code) === normalizedProduct
    ) ?? null;
  const windowType =
    bootstrap.windowTypes.find((row) => {
      const productMatches = product ? row.product_id === product.id : true;
      if (!productMatches) return false;
      return (
        normalizeMatchValue(row.name) === normalizedWindowType ||
        normalizeMatchValue(row.code) === normalizedWindowType
      );
    }) ?? null;
  const manufacturerId = product
    ? product.manufacturer_id
    : windowType
      ? bootstrap.products.find((row) => row.id === windowType.product_id)?.manufacturer_id ?? null
      : null;
  return {
    manufacturerId: manufacturerId || null,
    productId: product?.id ?? windowType?.product_id ?? null,
    windowTypeId: windowType?.id ?? null,
  };
}

export function resolveSectionProfileSet(input: ResolveInput): ResolvedSectionProfileSet {
  const bootstrap = input.bootstrap;
  const operationType = deriveOperationType(input.fields);
  const view = input.view ?? "inside";
  if (input.exactRenderProfile) {
    return buildResolvedSectionProfileSetFromRenderProfile(input.exactRenderProfile, view);
  }
  if (!bootstrap) {
    return {
      ...DEFAULT_RESOLVED_SECTION_PROFILE_SET,
      operationType,
      sash:
        operationType === "fixed"
          ? DEFAULT_RESOLVED_SECTION_PROFILE_SET.sash
          : {
              head: DEFAULT_PROFILE("Default sash head", 58, { insetMm: 8, overlapMm: 6 }),
              jambLeft: DEFAULT_PROFILE("Default sash jamb left", 58, { insetMm: 8, overlapMm: 6 }),
              jambRight: DEFAULT_PROFILE("Default sash jamb right", 58, { insetMm: 8, overlapMm: 6 }),
              bottom: DEFAULT_PROFILE("Default sash bottom", 58, { insetMm: 8, overlapMm: 6 }),
            },
    };
  }

  const scope = {
    ...resolveScope(bootstrap, input.productName, input.productTypeName),
    operationType: operationType === "mixed" ? "tilt_turn" : operationType,
  };

  const profileById = new Map(
    bootstrap.sectionProfiles.filter((row) => row.is_active).map((row) => [row.id, row])
  );
  const activeSectionDrawings = bootstrap.sectionDrawings.filter((row) => row.is_active);
  const mappings = bootstrap.profileMappings;

  const resolved: ResolvedSectionProfileSet = {
    ...DEFAULT_RESOLVED_SECTION_PROFILE_SET,
    operationType,
    manufacturerId: scope.manufacturerId,
    productId: scope.productId,
    windowTypeId: scope.windowTypeId,
    sash:
      operationType === "fixed"
        ? {
            head: null,
            jambLeft: null,
            jambRight: null,
            bottom: null,
          }
        : {
            head: DEFAULT_PROFILE("Default sash head", 58, { insetMm: 8, overlapMm: 6 }),
            jambLeft: DEFAULT_PROFILE("Default sash jamb left", 58, { insetMm: 8, overlapMm: 6 }),
            jambRight: DEFAULT_PROFILE("Default sash jamb right", 58, { insetMm: 8, overlapMm: 6 }),
            bottom: DEFAULT_PROFILE("Default sash bottom", 58, { insetMm: 8, overlapMm: 6 }),
          },
    sectionReferenceIds: [],
    referenceInputs: [],
  };

  const mappingKeys: Array<ConfiguratorProfileMappingKey> = [
    "frame_head",
    "frame_jamb_left",
    "frame_jamb_right",
    "frame_bottom",
    "sash_head",
    "sash_jamb_left",
    "sash_jamb_right",
    "sash_bottom",
    "mullion",
    "flying_mullion",
    "transom",
    "cill",
  ];

  const resolvedProfiles = new Map<ConfiguratorProfileMappingKey, ResolvedDrawingProfile>();

  for (const key of mappingKeys) {
    const mapping = chooseBestMapping(mappings, key, scope);
    const profile = mapping ? profileById.get(mapping.profile_id) ?? null : null;
    const fallback =
      key === "flying_mullion"
        ? DEFAULT_RESOLVED_SECTION_PROFILE_SET.flyingMullion
        : key === "mullion"
          ? DEFAULT_RESOLVED_SECTION_PROFILE_SET.mullion
          : key === "transom"
            ? DEFAULT_RESOLVED_SECTION_PROFILE_SET.transom
            : key === "cill"
              ? DEFAULT_RESOLVED_SECTION_PROFILE_SET.cill!
              : key.startsWith("sash_")
                ? DEFAULT_PROFILE(`Default ${key.replace("_", " ")}`, 58, { insetMm: 8, overlapMm: 6 })
                : DEFAULT_PROFILE(`Default ${key.replace("_", " ")}`, 70, { insetMm: 10 });
    const resolvedProfile = profileToResolvedProfile(activeSectionDrawings, profile, fallback);
    resolvedProfiles.set(key, resolvedProfile);
    if (profile) {
      resolved.sectionReferenceIds.push(profile.id, ...resolvedProfile.drawingReferenceIds);
      resolved.referenceInputs.push(...resolvedProfile.referenceInputs);
    }
  }

  resolved.frame.head = resolvedProfiles.get("frame_head") ?? resolved.frame.head;
  resolved.frame.jambLeft = resolvedProfiles.get("frame_jamb_left") ?? resolved.frame.jambLeft;
  resolved.frame.jambRight = resolvedProfiles.get("frame_jamb_right") ?? resolved.frame.jambRight;
  resolved.frame.bottom = resolvedProfiles.get("frame_bottom") ?? resolved.frame.bottom;
  if (operationType !== "fixed") {
    resolved.sash.head = resolvedProfiles.get("sash_head") ?? resolved.sash.head;
    resolved.sash.jambLeft = resolvedProfiles.get("sash_jamb_left") ?? resolved.sash.jambLeft;
    resolved.sash.jambRight = resolvedProfiles.get("sash_jamb_right") ?? resolved.sash.jambRight;
    resolved.sash.bottom = resolvedProfiles.get("sash_bottom") ?? resolved.sash.bottom;
  }
  resolved.mullion = resolvedProfiles.get("mullion") ?? resolved.mullion;
  resolved.flyingMullion = resolvedProfiles.get("flying_mullion") ?? resolved.flyingMullion;
  resolved.transom = resolvedProfiles.get("transom") ?? resolved.transom;
  resolved.cill = resolvedProfiles.get("cill") ?? resolved.cill;

  const renderProfile = chooseBestRenderProfile(bootstrap.renderProfiles ?? [], scope, view);
  if (renderProfile) {
    resolved.frame.head = applyRenderProfileSide(
      resolved.frame.head,
      renderProfile.frame_top_visible_mm,
      renderProfile.bead_top_visible_mm,
      {},
      view
    )!;
    resolved.frame.jambLeft = applyRenderProfileSide(
      resolved.frame.jambLeft,
      renderProfile.frame_left_visible_mm,
      renderProfile.bead_left_visible_mm,
      {},
      view
    )!;
    resolved.frame.jambRight = applyRenderProfileSide(
      resolved.frame.jambRight,
      renderProfile.frame_right_visible_mm,
      renderProfile.bead_right_visible_mm,
      {},
      view
    )!;
    resolved.frame.bottom = applyRenderProfileSide(
      resolved.frame.bottom,
      renderProfile.frame_bottom_visible_mm,
      renderProfile.bead_bottom_visible_mm,
      {},
      view
    )!;
    resolved.sash.head = applyRenderProfileSide(
      resolved.sash.head,
      renderProfile.sash_top_visible_mm,
      renderProfile.bead_top_visible_mm,
      {},
      view
    );
    resolved.sash.jambLeft = applyRenderProfileSide(
      resolved.sash.jambLeft,
      renderProfile.sash_left_visible_mm,
      renderProfile.bead_left_visible_mm,
      {
        handleAxisOffsetMm: renderProfile.handle_axis_offset_mm,
        hingePivotOffsetMm: renderProfile.hinge_pivot_offset_mm,
      },
      view
    );
    resolved.sash.jambRight = applyRenderProfileSide(
      resolved.sash.jambRight,
      renderProfile.sash_right_visible_mm,
      renderProfile.bead_right_visible_mm,
      {
        handleAxisOffsetMm: renderProfile.handle_axis_offset_mm,
        hingePivotOffsetMm: renderProfile.hinge_pivot_offset_mm,
      },
      view
    );
    resolved.sash.bottom = applyRenderProfileSide(
      resolved.sash.bottom,
      renderProfile.sash_bottom_visible_mm,
      renderProfile.bead_bottom_visible_mm,
      {},
      view
    );
  }

  resolved.sectionReferenceIds = Array.from(new Set(resolved.sectionReferenceIds.filter(Boolean)));
  resolved.referenceInputs = resolved.referenceInputs.filter(
    (item, index, all) => all.findIndex((candidate) => candidate.drawingId === item.drawingId) === index
  );

  return resolved;
}
