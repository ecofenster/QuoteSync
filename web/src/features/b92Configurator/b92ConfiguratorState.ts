import { B92_PROMOTED_VIEW_MANIFEST } from "./b92PromotedViewManifest";
import type {
  B92ConfiguratorDimensionState,
  B92ConfiguratorFinishState,
  B92ConfiguratorState,
  B92ConfiguratorViewStatus,
} from "./b92Configurator.types";
import { buildB92StructureFromPreset } from "./b92StructurePresets";

export const B92_DEFAULT_CONFIGURATOR_DIMENSIONS: B92ConfiguratorDimensionState = {
  widthMm: 1000,
  heightMm: 1000,
  splitMode: "equal",
  columnWidthsMm: [1000],
  rowHeightsMm: [1000],
};

export const B92_DEFAULT_CONFIGURATOR_FINISHES: B92ConfiguratorFinishState = {
  internalMode: "native",
  internalRal: "7016",
  internalLacquerId: null,
  externalRevealMode: "native",
  externalRevealRal: "7016",
  externalRevealLacquerId: null,
  externalCladdingMode: "native",
  externalCladdingRal: "7016",
};

export function getB92ConfiguratorManifestEntry(viewId: string | null | undefined) {
  if (!viewId) return null;
  return B92_PROMOTED_VIEW_MANIFEST.find((entry) => entry.viewId === viewId) ?? null;
}

export function getB92ConfiguratorViewsByStatus(status: B92ConfiguratorViewStatus) {
  return B92_PROMOTED_VIEW_MANIFEST.filter((entry) => entry.status === status);
}

export function getB92InitialConfiguratorView() {
  return (
    B92_PROMOTED_VIEW_MANIFEST.find((entry) => entry.status === "promoted") ??
    B92_PROMOTED_VIEW_MANIFEST.find((entry) => entry.status === "approved") ??
    B92_PROMOTED_VIEW_MANIFEST[0] ??
    null
  );
}

export function createB92DefaultConfiguratorState(patch: Partial<B92ConfiguratorState> = {}): B92ConfiguratorState {
  const initialView = patch.selectedViewId ? getB92ConfiguratorManifestEntry(patch.selectedViewId) : getB92InitialConfiguratorView();
  return {
    selectedViewId: initialView?.viewId ?? null,
    selectedFamilyId: initialView?.familyId ?? null,
    selectedView: initialView?.view ?? "internal",
    structure: patch.structure ?? buildB92StructureFromPreset("1-field"),
    activeContextTarget: patch.activeContextTarget ?? null,
    contextMenu: patch.contextMenu ?? { open: false, x: 0, y: 0, target: null },
    contextStatusMessage: patch.contextStatusMessage ?? null,
    dimensions: {
      ...B92_DEFAULT_CONFIGURATOR_DIMENSIONS,
      ...patch.dimensions,
    },
    finishes: {
      ...B92_DEFAULT_CONFIGURATOR_FINISHES,
      ...patch.finishes,
    },
    sourceModelDesignId: initialView?.mappedDesignIds[0] ?? null,
    ...patch,
  };
}
