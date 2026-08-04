import type { B92ConfiguratorPromotedViewManifestEntry } from "./b92Configurator.types";

export function b92UserStatusLabel(entry: B92ConfiguratorPromotedViewManifestEntry | null, proofAvailable: boolean) {
  if (!proofAvailable) return "Unsupported combination";
  if (entry?.status === "accepted-reference") return "Accepted reference";
  return "Approved proof";
}

export function b92UserStatusMessage(entry: B92ConfiguratorPromotedViewManifestEntry | null, proofAvailable: boolean) {
  if (!proofAvailable) {
    return "This shape and opening combination is not approved for preview yet. The state is kept safely, the preview is paused, and no dynamic geometry is generated.";
  }
  if (entry?.status === "accepted-reference") {
    return "This configuration is mapped to an accepted B92 reference proof. Technical proof IDs are available in Diagnostics.";
  }
  return "This configuration is mapped to an approved B92 production proof. Technical proof IDs are available in Diagnostics.";
}
