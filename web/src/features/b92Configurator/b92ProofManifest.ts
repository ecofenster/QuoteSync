import type { ConfiguredPositionProofStatus } from "../configurator/configuredPositionContract.types";
import type { B92ConfiguratorPromotedViewManifestEntry } from "./b92Configurator.types";
import { B92_PRODUCTION_CONFIGURATOR_VIEW_IDS, B92_PROMOTED_VIEW_MANIFEST } from "./b92PromotedViewManifest";

export type B92ProofManifestStatus =
  | "approved_locked"
  | "accepted_reference"
  | "unsupported"
  | "admin_only"
  | "generated_preview";

export type B92ProofManifestEntry = {
  familyId: string;
  status: B92ProofManifestStatus;
  productionSafe: boolean;
  profileRefs: string[];
  unsupportedReason?: string;
};

const B92_PROOF_PROFILE_REFS: Record<string, string[]> = {
  "b92-1-field-fixed": ["B92-1", "B92-2", "B92-3"],
  "b92-1-field-tilt-turn": ["B92-7", "B92-8", "B92-9", "B92-10"],
  "b92-2-field-fixed-fixed": ["B92-1", "B92-2", "B92-3", "B92-11"],
  "b92-2-field-fixed-tilt-turn-left": ["B92-4", "B92-5", "B92-6", "B92-7", "B92-8", "B92-10", "B92-12"],
  "b92-2-field-fixed-tilt-turn-right": ["B92-4", "B92-5", "B92-6", "B92-7", "B92-8", "B92-9", "B92-13"],
  "b92-2-field-tilt-turn-left-right": ["B92-7", "B92-8", "B92-10", "B92-15"],
  "b92-2-field-tilt-turn-right-left": ["B92-7", "B92-8", "B92-16"],
  "b92-2-field-turn-tilt-turn": ["B92-7", "B92-8", "B92-10", "B92-18"],
  "b92-2-field-fixed-bottom-fixed-top": ["B92-1", "B92-2", "B92-3", "B92-19"],
  "b92-2-field-tilt-turn-bottom-fixed-top": ["B92-4", "B92-6", "B92-8", "B92-9", "B92-10", "B92-21"],
  "b92-2-field-fixed-bottom-tilt-turn-top": ["B92-5", "B92-6", "B92-7", "B92-9", "B92-10", "B92-20"],
  "b92-3-field-fixed-fixed-fixed": ["B92-1", "B92-2", "B92-3", "B92-11"],
  "b92-3-field-tilt-turn-left-fixed-tilt-turn-right": ["B92-4", "B92-5", "B92-7", "B92-8", "B92-10", "B92-12"],
  "b92-3-field-tilt-turn-right-fixed-tilt-turn-left-equal-field-reference": ["B92-13"],
};

function manifestStatusForPromotedEntry(entry: B92ConfiguratorPromotedViewManifestEntry): B92ProofManifestStatus {
  if (entry.status === "promoted") return "approved_locked";
  if (entry.status === "accepted-reference") return "accepted_reference";
  if (entry.status === "admin-only") return "admin_only";
  if (entry.status === "parked") return "unsupported";
  return "generated_preview";
}
export const B92_PROOF_MANIFEST: B92ProofManifestEntry[] = Object.entries(B92_PROOF_PROFILE_REFS).map(
  ([familyId, profileRefs]) => {
    const productionEntries = B92_PROMOTED_VIEW_MANIFEST.filter(
      (entry) => entry.familyId === familyId && B92_PRODUCTION_CONFIGURATOR_VIEW_IDS.includes(entry.viewId)
    );
    const status = productionEntries.some((entry) => entry.status === "promoted")
      ? "approved_locked"
      : productionEntries.some((entry) => entry.status === "accepted-reference")
        ? "accepted_reference"
        : "unsupported";
    return {
      familyId,
      status,
      productionSafe: status === "approved_locked" || status === "accepted_reference",
      profileRefs,
      unsupportedReason: status === "unsupported" ? "No production-safe promoted or accepted B92 proof view is registered." : undefined,
    };
  }
);

export function getB92ProofManifestEntry(familyId: string | null | undefined): B92ProofManifestEntry | null {
  if (!familyId) return null;
  return B92_PROOF_MANIFEST.find((entry) => entry.familyId === familyId) ?? null;
}

export function getB92ContractProofStatus(
  entry: B92ConfiguratorPromotedViewManifestEntry,
  manifestEntry: B92ProofManifestEntry
): ConfiguredPositionProofStatus {
  const promotedStatus = manifestStatusForPromotedEntry(entry);
  if (promotedStatus === "approved_locked" && manifestEntry.status === "approved_locked") return "approved_locked";
  if (promotedStatus === "accepted_reference" && manifestEntry.status === "accepted_reference") return "accepted_reference";
  if (promotedStatus === "generated_preview") return "generated_preview";
  if (promotedStatus === "unsupported" || promotedStatus === "admin_only") return "unproved";
  return "unproved";
}

export function isB92ProductionProofEntrySupported(
  entry: B92ConfiguratorPromotedViewManifestEntry | null,
  manifestEntry: B92ProofManifestEntry | null
): boolean {
  if (!entry || !manifestEntry) return false;
  const contractStatus = getB92ContractProofStatus(entry, manifestEntry);
  return manifestEntry.productionSafe && (contractStatus === "approved_locked" || contractStatus === "accepted_reference");
}
