import type {
  B92ProjectedDrawableRegion,
  B92ProjectedDrawableRegionCategory,
  B92ProjectionBoundsMm,
  B92ProjectionResolutionStatus,
  B92ProjectionUnresolvedItem,
} from "./b92DatumProjection.types";
import type { B92ProjectionEngineResult } from "./b92ProjectionEngine";
import type { B92SectionAuthorityProjectionDiagnostic } from "./b92ProjectionDebug";

export type B92RendererLikeDiagnosticLayer = "frame" | "sash" | "glass" | "section_stack";

export type B92RendererLikeDiagnosticRegion = {
  id: string;
  layer: B92RendererLikeDiagnosticLayer;
  category: B92ProjectedDrawableRegionCategory;
  fieldId?: string;
  fieldType?: string;
  edge?: B92ProjectedDrawableRegion["edge"];
  boundsMm: B92ProjectionBoundsMm;
  status: Extract<B92ProjectionResolutionStatus, "resolved">;
  comparisonOnly: true;
  joinGeometry?: {
    cornerJoin: "45_degree_mitre";
    squareEndedRectangle: false;
    note: string;
  };
  note?: string;
};

export type B92RendererLikeSectionStackRecord = {
  profileId: B92SectionAuthorityProjectionDiagnostic["profileId"];
  role: B92SectionAuthorityProjectionDiagnostic["role"];
  stackStatus: B92SectionAuthorityProjectionDiagnostic["stackStatus"];
  projectionStatus: B92SectionAuthorityProjectionDiagnostic["projectionStatus"];
  renderable: false;
  stackMm: B92SectionAuthorityProjectionDiagnostic["stackMm"];
  registeredTotalMm: number | null;
  computedTotalMm: number | null;
  totalMatches: boolean | null;
  unresolvedRequirements: string[];
  note?: string;
};

export type B92RendererLikeDiagnosticField = {
  fieldId: string;
  fieldType: string;
  includedRegionIds: string[];
  unresolved: B92ProjectionUnresolvedItem[];
};

export type B92RendererLikeDiagnosticModel = {
  diagnosticOnly: true;
  rendererIntegration: false;
  visualGeometryChanged: false;
  source: "b92_datum_projection_diagnostics";
  note: string;
  layers: {
    frame: B92RendererLikeDiagnosticRegion[];
    sash: B92RendererLikeDiagnosticRegion[];
    glass: B92RendererLikeDiagnosticRegion[];
    sectionStacks: B92RendererLikeSectionStackRecord[];
  };
  geometrySemantics: {
    structuralFrame: string;
    exposedFrame: string;
    sashOverlap: string;
    glazingBeadMitres: string;
  };
  fields: B92RendererLikeDiagnosticField[];
  unresolved: B92ProjectionUnresolvedItem[];
  summary: {
    frameRegions: number;
    sashRegions: number;
    glassRegions: number;
    sectionStacks: number;
    unresolved: number;
  };
};

export type B92RendererLikeDiagnosticFieldInput = {
  fieldId: string;
  fieldType: string;
  projection: B92ProjectionEngineResult;
};

export type B92RendererLikeDiagnosticModelInput = {
  fields: B92RendererLikeDiagnosticFieldInput[];
  sectionAuthorityProjection: B92SectionAuthorityProjectionDiagnostic[];
};

const SASH_RENDERER_LIKE_EDGES = new Set(["top", "left", "right"]);

function cloneBounds(bounds: B92ProjectionBoundsMm): B92ProjectionBoundsMm {
  return {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
  };
}

function isSashField(fieldType: string): boolean {
  return fieldType === "fixed_sash" || fieldType === "tilt_turn" || fieldType === "turn_only" || fieldType === "tilt_only";
}

function isFixedRendererLikeRegion(region: B92ProjectedDrawableRegion): boolean {
  return (
    region.status === "resolved" &&
    !!region.boundsMm &&
    (region.category === "structural_frame_datum" ||
      region.category === "visible_frame_face" ||
      region.category === "daylight_opening" ||
      region.category === "glass_order")
  );
}

function isSashRendererLikeRegion(region: B92ProjectedDrawableRegion): boolean {
  return (
    region.status === "resolved" &&
    !!region.boundsMm &&
    !!region.edge &&
    SASH_RENDERER_LIKE_EDGES.has(region.edge) &&
    (region.category === "structural_frame_datum" ||
      region.category === "visible_frame_face" ||
      region.category === "hidden_frame_rebate" ||
      region.category === "visible_sash_body" ||
      region.category === "bead")
  );
}

function layerForRegion(category: B92ProjectedDrawableRegionCategory): B92RendererLikeDiagnosticLayer {
  if (category === "daylight_opening" || category === "glass_order") return "glass";
  if (category === "visible_sash_body" || category === "bead") return "sash";
  return "frame";
}

function rendererLikeRegion(input: {
  region: B92ProjectedDrawableRegion;
  fieldType: string;
}): B92RendererLikeDiagnosticRegion | null {
  if (!input.region.boundsMm || input.region.status !== "resolved") return null;
  return {
    id: input.region.id,
    layer: layerForRegion(input.region.category),
    category: input.region.category,
    fieldId: input.region.fieldId,
    fieldType: input.fieldType,
    edge: input.region.edge,
    boundsMm: cloneBounds(input.region.boundsMm),
    status: "resolved",
    comparisonOnly: true,
    joinGeometry:
      input.region.category === "bead"
        ? {
            cornerJoin: "45_degree_mitre",
            squareEndedRectangle: false,
            note:
              "B92 glazing bead diagnostics treat top, bottom, left, and right bead segments as mitred at corners.",
          }
        : undefined,
    note: input.region.note,
  };
}

function fieldRendererLikeRegions(input: B92RendererLikeDiagnosticFieldInput): B92RendererLikeDiagnosticRegion[] {
  const includeRegion = isSashField(input.fieldType) ? isSashRendererLikeRegion : isFixedRendererLikeRegion;
  return input.projection.projectedRegions
    .filter(includeRegion)
    .map((region) => rendererLikeRegion({ region, fieldType: input.fieldType }))
    .filter((region): region is B92RendererLikeDiagnosticRegion => !!region);
}

function sectionStackRecord(
  diagnostic: B92SectionAuthorityProjectionDiagnostic
): B92RendererLikeSectionStackRecord | null {
  if (diagnostic.role !== "meeting_profile" && diagnostic.role !== "horizontal_transom") return null;
  return {
    profileId: diagnostic.profileId,
    role: diagnostic.role,
    stackStatus: diagnostic.stackStatus,
    projectionStatus: diagnostic.projectionStatus,
    renderable: false,
    stackMm: diagnostic.stackMm.map((segment) => ({ ...segment })),
    registeredTotalMm: diagnostic.registeredTotalMm,
    computedTotalMm: diagnostic.computedTotalMm,
    totalMatches: diagnostic.totalMatches,
    unresolvedRequirements: [...diagnostic.unresolvedRequirements],
    note:
      diagnostic.note ??
      "Section stack diagnostic only; ownership, termination, and edge closure are not renderer geometry.",
  };
}

function staticRendererLikeUnresolved(): B92ProjectionUnresolvedItem[] {
  return [
    {
      id: "b92-renderer-like:segmented-sill-transitions-unresolved",
      reason: "missing_datum_authority",
      note: "Segmented sill transition datum remains unresolved and is not represented as renderer-like geometry.",
    },
    {
      id: "b92-renderer-like:external-view-unresolved",
      reason: "unsupported_view_divergence",
      note: "External-view datum projection is intentionally absent from the internal renderer-like diagnostic model.",
    },
  ];
}

export function buildB92ProjectionRendererLikeDiagnosticModel(
  input: B92RendererLikeDiagnosticModelInput
): B92RendererLikeDiagnosticModel {
  const allRegions = input.fields.flatMap(fieldRendererLikeRegions);
  const frame = allRegions.filter((region) => region.layer === "frame");
  const sash = allRegions.filter((region) => region.layer === "sash");
  const glass = allRegions.filter((region) => region.layer === "glass");
  const sectionStacks = input.sectionAuthorityProjection
    .map(sectionStackRecord)
    .filter((record): record is B92RendererLikeSectionStackRecord => !!record);
  const fieldUnresolved = input.fields.flatMap((field) => field.projection.unresolved.map((item) => ({ ...item })));
  const sectionUnresolved = sectionStacks.flatMap((stack) =>
    stack.unresolvedRequirements.map((requirement, index): B92ProjectionUnresolvedItem => ({
      id: `b92-renderer-like:${stack.profileId}:unresolved-${index}`,
      reason: stack.role === "meeting_profile" ? "unknown_meeting_geometry" : "missing_datum_authority",
      profileId: stack.profileId,
      note: requirement,
    }))
  );
  const unresolved = [...fieldUnresolved, ...sectionUnresolved, ...staticRendererLikeUnresolved()];

  return {
    diagnosticOnly: true,
    rendererIntegration: false,
    visualGeometryChanged: false,
    source: "b92_datum_projection_diagnostics",
    note:
      "Renderer-like diagnostic comparison model only. Fixed no-sash frame regions are structural/internal datum; sash-field visible frame regions are exposed results after sash overlap. This is not drawable geometry and must not replace SVG or preview rendering.",
    layers: {
      frame,
      sash,
      glass,
      sectionStacks,
    },
    geometrySemantics: {
      structuralFrame:
        "Outer structural frame datum is the source geometry. Fixed no-sash uses 57mm top/left/right and 72mm bottom; head and sill own full spans while jambs run between them.",
      exposedFrame:
        "Exposed frame is a derived sash/opening result. The 37.5mm top/side value is not a fixed-frame datum.",
      sashOverlap:
        "Sash-based B92 conditions retain the 57mm structural frame; sash overlap conceals 19.5mm at confirmed top/side positions and leaves 37.5mm exposed. Bottom exposed sash condition is 52.5mm.",
      glazingBeadMitres:
        "Glazing bead regions are diagnostics for continuous bead segments with 45 degree mitred joins, not square-ended overlapping rectangles.",
    },
    fields: input.fields.map((field) => {
      const regions = fieldRendererLikeRegions(field);
      return {
        fieldId: field.fieldId,
        fieldType: field.fieldType,
        includedRegionIds: regions.map((region) => region.id),
        unresolved: field.projection.unresolved.map((item) => ({ ...item })),
      };
    }),
    unresolved,
    summary: {
      frameRegions: frame.length,
      sashRegions: sash.length,
      glassRegions: glass.length,
      sectionStacks: sectionStacks.length,
      unresolved: unresolved.length,
    },
  };
}
