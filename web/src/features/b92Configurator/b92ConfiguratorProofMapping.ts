import { getB92ProfileSectionProofById } from "../admin/windowTypes/b92ProfileSectionProofRegistry";
import type { B92ProfileSectionProofView } from "../admin/windowTypes/b92ProfileSectionProofGeometry";
import type { B92ConfiguratorPromotedViewManifestEntry, B92ConfiguratorStructureState } from "./b92Configurator.types";
import { B92_PRODUCTION_CONFIGURATOR_VIEW_IDS, B92_PROMOTED_VIEW_MANIFEST } from "./b92PromotedViewManifest";
import { findB92ApprovedProofFamilyForStructure } from "./b92StructurePresets";

export function getB92ProductionManifestEntry(viewId: string | null) {
  const entry = B92_PROMOTED_VIEW_MANIFEST.find((candidate) => candidate.viewId === viewId) ?? null;
  if (!entry || !B92_PRODUCTION_CONFIGURATOR_VIEW_IDS.includes(entry.viewId)) return null;
  return entry;
}

export function getB92InitialProductionManifestEntry() {
  return B92_PROMOTED_VIEW_MANIFEST.find((entry) => B92_PRODUCTION_CONFIGURATOR_VIEW_IDS.includes(entry.viewId)) ?? null;
}

export function mapB92ProofEntryForFamily(familyId: string, view: B92ProfileSectionProofView) {
  return (
    B92_PROMOTED_VIEW_MANIFEST.find(
      (entry) => entry.familyId === familyId && entry.view === view && B92_PRODUCTION_CONFIGURATOR_VIEW_IDS.includes(entry.viewId)
    ) ??
    B92_PROMOTED_VIEW_MANIFEST.find((entry) => entry.familyId === familyId && B92_PRODUCTION_CONFIGURATOR_VIEW_IDS.includes(entry.viewId)) ??
    null
  );
}

export function selectB92ProofFamilyView(familyId: string | null, view: B92ProfileSectionProofView) {
  if (!familyId) return null;
  return (
    B92_PROMOTED_VIEW_MANIFEST.find(
      (entry) => entry.familyId === familyId && entry.view === view && B92_PRODUCTION_CONFIGURATOR_VIEW_IDS.includes(entry.viewId)
    ) ?? null
  );
}

export function selectB92ProofFamilyViewStrict(familyId: string, view: B92ProfileSectionProofView) {
  return selectB92ProofFamilyView(familyId, view);
}

export function getB92MappedProofFamilyId(structure: B92ConfiguratorStructureState, mode: "fields" | "coupled" = "fields") {
  return mode === "fields" ? findB92ApprovedProofFamilyForStructure(structure) : null;
}

export function hasB92ProofAvailableForStructure(
  structure: B92ConfiguratorStructureState,
  selectedEntry: B92ConfiguratorPromotedViewManifestEntry | null
) {
  const mappedFamilyId = getB92MappedProofFamilyId(structure);
  return Boolean(mappedFamilyId && selectedEntry?.familyId === mappedFamilyId);
}

export function getB92PreviewEntryForStructure(
  structure: B92ConfiguratorStructureState,
  selectedEntry: B92ConfiguratorPromotedViewManifestEntry | null
) {
  return hasB92ProofAvailableForStructure(structure, selectedEntry) ? selectedEntry : null;
}

export function getB92PreviewFamilyForEntry(entry: B92ConfiguratorPromotedViewManifestEntry | null) {
  return entry ? getB92ProfileSectionProofById(entry.familyId) : null;
}
