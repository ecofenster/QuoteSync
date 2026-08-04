import { B92_PROFILE_SECTION_PROOF_GEOMETRY } from "../admin/windowTypes/b92ProfileSectionProofGeometry";
import { B92_PROFILE_SECTION_PROOF_FAMILIES } from "../admin/windowTypes/b92ProfileSectionProofRegistry";
import {
  B92_PRODUCTION_PROMOTED_VIEW_TARGET_COUNT,
  B92_PROMOTED_VIEW_COUNT_BLOCKER,
  B92_PROMOTED_VIEW_MANIFEST,
} from "./b92PromotedViewManifest";
import type { B92ConfiguratorPromotedViewManifestEntry } from "./b92Configurator.types";

export type B92ConfiguratorManifestValidationResult = {
  passed: boolean;
  errors: string[];
  warnings: string[];
  counts: {
    manifestEntries: number;
    promotedEntries: number;
    productionEntries: number;
    approvedEntries: number;
    acceptedReferenceEntries: number;
    adminOnlyEntries: number;
    parkedEntries: number;
    registryFamilies: number;
    geometryFamilies: number;
    generatedViews: number;
    promotedTargetCount: number;
  };
};

function geometryByFamilyId(familyId: string) {
  return B92_PROFILE_SECTION_PROOF_GEOMETRY.find((family) => family.id === familyId) ?? null;
}

function hasGeometry(entry: B92ConfiguratorPromotedViewManifestEntry) {
  return Boolean(geometryByFamilyId(entry.familyId)?.views[entry.view]);
}

export function validateB92ConfiguratorManifest(
  manifest: readonly B92ConfiguratorPromotedViewManifestEntry[] = B92_PROMOTED_VIEW_MANIFEST
): B92ConfiguratorManifestValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const registryIds = new Set<string>(B92_PROFILE_SECTION_PROOF_FAMILIES.map((family) => family.id));
  const geometryIds = new Set<string>(B92_PROFILE_SECTION_PROOF_GEOMETRY.map((family) => family.id));
  const viewIds = new Set<string>();

  for (const entry of manifest) {
    if (viewIds.has(entry.viewId)) {
      errors.push(`Duplicate manifest viewId: ${entry.viewId}`);
    }
    viewIds.add(entry.viewId);

    if (!registryIds.has(entry.familyId)) {
      errors.push(`Manifest entry ${entry.viewId} references missing registry family ${entry.familyId}.`);
      continue;
    }

    if (!geometryIds.has(entry.familyId)) {
      errors.push(`Manifest entry ${entry.viewId} references missing generated geometry family ${entry.familyId}.`);
      continue;
    }

    if (!hasGeometry(entry)) {
      errors.push(`Manifest entry ${entry.viewId} references missing generated ${entry.view} geometry.`);
    }

    if (entry.status === "promoted" && !hasGeometry(entry)) {
      errors.push(`Promoted manifest entry ${entry.viewId} points to missing proof geometry.`);
    }

    if ((entry.status === "admin-only" || entry.status === "parked") && entry.notes.trim().length === 0) {
      errors.push(`Manifest entry ${entry.viewId} is ${entry.status} but has no explanatory notes.`);
    }

    if (entry.status === "promoted" && entry.sourceProof.svgPath.trim().length === 0) {
      errors.push(`Promoted manifest entry ${entry.viewId} has no source proof SVG reference.`);
    }
  }

  const promotedEntries = manifest.filter((entry) => entry.status === "promoted").length;
  const approvedEntries = manifest.filter((entry) => entry.status === "approved").length;
  const acceptedReferenceEntries = manifest.filter((entry) => entry.status === "accepted-reference").length;
  const productionEntries = promotedEntries + acceptedReferenceEntries;
  const adminOnlyEntries = manifest.filter((entry) => entry.status === "admin-only").length;
  const parkedEntries = manifest.filter((entry) => entry.status === "parked").length;
  const generatedViews = B92_PROFILE_SECTION_PROOF_GEOMETRY.reduce(
    (count, family) => count + Number(Boolean(family.views.internal)) + Number(Boolean(family.views.external)),
    0
  );

  if (productionEntries !== B92_PRODUCTION_PROMOTED_VIEW_TARGET_COUNT) {
    warnings.push(B92_PROMOTED_VIEW_COUNT_BLOCKER);
    warnings.push(
      `Production manifest count is ${productionEntries}; expected approved catalogue target is ${B92_PRODUCTION_PROMOTED_VIEW_TARGET_COUNT}.`
    );
  }

  return {
    passed: errors.length === 0,
    errors,
    warnings,
    counts: {
      manifestEntries: manifest.length,
      promotedEntries,
      productionEntries,
      approvedEntries,
      acceptedReferenceEntries,
      adminOnlyEntries,
      parkedEntries,
      registryFamilies: B92_PROFILE_SECTION_PROOF_FAMILIES.length,
      geometryFamilies: B92_PROFILE_SECTION_PROOF_GEOMETRY.length,
      generatedViews,
      promotedTargetCount: B92_PRODUCTION_PROMOTED_VIEW_TARGET_COUNT,
    },
  };
}
