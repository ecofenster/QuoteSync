import type { Position } from "../../models/types";
import { getB92ProofManifestEntry } from "../b92Configurator/b92ProofManifest";
import { getConfiguredPositionContract } from "./configuredPositionContract.utils";
import type { DrawingModel } from "./rendering/drawingModel";

export type ConfiguratorDocumentDrawingView = "inside" | "outside";

export type ConfiguratorDocumentDrawingResult =
  | { available: true; providerId: string; view: ConfiguratorDocumentDrawingView; model: DrawingModel }
  | { available: false; providerId: string | null; view: ConfiguratorDocumentDrawingView; reason: string };

export type ConfiguratorDocumentDrawingProvider = {
  id: string;
  supports(position: Position): boolean;
  resolve(position: Position, view: ConfiguratorDocumentDrawingView): ConfiguratorDocumentDrawingResult;
};

export function createConfiguratorDocumentDrawingRegistry(providers: ConfiguratorDocumentDrawingProvider[]) {
  return {
    resolve(position: Position, view: ConfiguratorDocumentDrawingView): ConfiguratorDocumentDrawingResult {
      const provider = providers.find((candidate) => candidate.supports(position));
      return provider
        ? provider.resolve(position, view)
        : { available: false, providerId: null, view, reason: "No Configurator document-drawing provider supports this position." };
    },
  };
}

export const b92DocumentDrawingProvider: ConfiguratorDocumentDrawingProvider = {
  id: "b92-proof",
  supports(position) {
    return getConfiguredPositionContract(position)?.product.systemCode === "B92";
  },
  resolve(position, view) {
    const contract = getConfiguredPositionContract(position);
    const proof = contract?.render ? getB92ProofManifestEntry(contract.render.proofFamilyId) : null;
    if (!contract || !proof?.productionSafe || contract.profileProof.unresolvedProfileRefs.length > 0) {
      return { available: false, providerId: "b92-proof", view, reason: "The B92 position does not have production-safe resolved proof geometry." };
    }
    return {
      available: false,
      providerId: "b92-proof",
      view,
      reason: "B92 proof is eligible, but a dimension-safe non-interactive document model has not yet been extracted from the proof preview.",
    };
  },
};

export const configuratorDocumentDrawingRegistry = createConfiguratorDocumentDrawingRegistry([b92DocumentDrawingProvider]);
