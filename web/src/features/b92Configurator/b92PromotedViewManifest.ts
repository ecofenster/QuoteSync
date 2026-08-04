import {
  B92_PROFILE_SECTION_PROOF_GEOMETRY,
  type B92ProfileSectionProofView,
} from "../admin/windowTypes/b92ProfileSectionProofGeometry";
import {
  B92_PROFILE_SECTION_PROOF_FAMILIES,
  type B92ProfileSectionProofFamily,
} from "../admin/windowTypes/b92ProfileSectionProofRegistry";
import type {
  B92ConfiguratorFinishMaskStrategy,
  B92ConfiguratorPromotedViewManifestEntry,
  B92ConfiguratorSemanticGlassStrategy,
  B92ConfiguratorViewStatus,
} from "./b92Configurator.types";

export const B92_PRODUCTION_PROMOTED_VIEW_TARGET_COUNT = 28;

export const B92_PROMOTED_VIEW_COUNT_BLOCKER =
  "The production B92 configurator set is the current approved Admin catalogue: 14 proof families and 28 internal/external generated views.";

const TRUSTED_COORDINATE_FAMILIES = new Set([
  "b92-1-field-fixed",
  "b92-1-field-tilt-turn",
  "b92-2-field-fixed-fixed",
  "b92-2-field-fixed-tilt-turn-left",
  "b92-2-field-turn-tilt-turn",
]);

function familyById(familyId: string) {
  return B92_PROFILE_SECTION_PROOF_FAMILIES.find((family) => family.id === familyId) ?? null;
}

function viewId(familyId: string, view: B92ProfileSectionProofView) {
  return `${familyId}-${view}`;
}

function inferredDxfPath(svgPath: string, explicitDxfPath: string | null) {
  if (explicitDxfPath) return explicitDxfPath;
  return svgPath.toLowerCase().endsWith(".svg") ? svgPath.replace(/\.svg$/i, ".dxf") : null;
}

function statusForFamily(family: B92ProfileSectionProofFamily): B92ConfiguratorViewStatus {
  if (family.status === "accepted-reference-only") return "accepted-reference";
  return "promoted";
}

function semanticGlassStrategyForFamily(family: B92ProfileSectionProofFamily): B92ConfiguratorSemanticGlassStrategy {
  if (family.status === "accepted-reference-only") return "accepted-reference-equal-field-datum";
  if (TRUSTED_COORDINATE_FAMILIES.has(family.id)) return "trusted-coordinate-bounds";
  return "derived-glazing-bead-bounds";
}

function finishMaskStrategyForView(view: B92ProfileSectionProofView): B92ConfiguratorFinishMaskStrategy[] {
  if (view === "internal") {
    return ["native-frame-fill", "glass-safe-timber-profile-mask"];
  }
  return ["native-frame-fill", "external-reveal-zones", "external-cladding-zones"];
}

function notesForEntry(family: B92ProfileSectionProofFamily, status: B92ConfiguratorViewStatus) {
  if (status === "accepted-reference") {
    return `${family.notes} Included in the production B92 configurator set as accepted-reference proof geometry.`;
  }
  return `${family.notes} Promoted as part of the production B92 configurator set.`;
}

export const B92_PROMOTED_VIEW_MANIFEST = B92_PROFILE_SECTION_PROOF_GEOMETRY.flatMap((geometryFamily) => {
  const family = familyById(geometryFamily.id);
  if (!family) return [];

  return (["internal", "external"] as const).map((view): B92ConfiguratorPromotedViewManifestEntry => {
    const geometry = geometryFamily.views[view];
    const status = statusForFamily(family);
    return {
      viewId: viewId(family.id, view),
      familyId: family.id,
      view,
      status,
      sourceProof: {
        svgPath: geometry.sourceFile,
        dxfPath: inferredDxfPath(geometry.sourceFile, geometry.sourceDxfFile),
      },
      generatedGeometrySourceId: `${geometryFamily.id}.${view}`,
      semanticGlassStrategy: semanticGlassStrategyForFamily(family),
      finishMaskStrategy: finishMaskStrategyForView(view),
      mappedDesignIds: family.mappedDesignIds,
      notes: notesForEntry(family, status),
    };
  });
}) satisfies B92ConfiguratorPromotedViewManifestEntry[];

export const B92_PROMOTED_CONFIGURATOR_VIEW_IDS = B92_PROMOTED_VIEW_MANIFEST
  .filter((entry) => entry.status === "promoted")
  .map((entry) => entry.viewId);

export const B92_PRODUCTION_CONFIGURATOR_VIEW_IDS = B92_PROMOTED_VIEW_MANIFEST
  .filter((entry) => entry.status === "promoted" || entry.status === "accepted-reference")
  .map((entry) => entry.viewId);

export const B92_ADMIN_AVAILABLE_CONFIGURATOR_VIEW_IDS = B92_PROMOTED_VIEW_MANIFEST
  .filter((entry) => entry.status !== "parked")
  .map((entry) => entry.viewId);
