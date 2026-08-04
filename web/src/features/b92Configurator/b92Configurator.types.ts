import type { B92ProfileSectionProofView } from "../admin/windowTypes/b92ProfileSectionProofGeometry";

export type B92ConfiguratorViewStatus =
  | "promoted"
  | "approved"
  | "accepted-reference"
  | "admin-only"
  | "parked";

export type B92ConfiguratorSemanticGlassStrategy =
  | "trusted-coordinate-bounds"
  | "derived-glazing-bead-bounds"
  | "accepted-reference-equal-field-datum";

export type B92ConfiguratorFinishMaskStrategy =
  | "native-frame-fill"
  | "glass-safe-timber-profile-mask"
  | "external-reveal-zones"
  | "external-cladding-zones";

export type B92ConfiguratorProofSourceReference = {
  svgPath: string;
  dxfPath: string | null;
};

export type B92ConfiguratorPromotedViewManifestEntry = {
  viewId: string;
  familyId: string;
  view: B92ProfileSectionProofView;
  status: B92ConfiguratorViewStatus;
  sourceProof: B92ConfiguratorProofSourceReference;
  generatedGeometrySourceId: string;
  semanticGlassStrategy: B92ConfiguratorSemanticGlassStrategy;
  finishMaskStrategy: B92ConfiguratorFinishMaskStrategy[];
  mappedDesignIds: string[];
  notes: string;
};

export type B92ConfiguratorFinishMode = "native" | "lacquer" | "ral";
export type B92ConfiguratorCladdingFinishMode = "native" | "ral";

export type B92ConfiguratorFinishState = {
  internalMode: B92ConfiguratorFinishMode;
  internalRal: string;
  internalLacquerId: string | null;
  externalRevealMode: B92ConfiguratorFinishMode;
  externalRevealRal: string;
  externalRevealLacquerId: string | null;
  externalCladdingMode: B92ConfiguratorCladdingFinishMode;
  externalCladdingRal: string;
};

export type B92ConfiguratorDimensionState = {
  widthMm: number;
  heightMm: number;
  splitMode: "equal" | "manual";
  columnWidthsMm: number[];
  rowHeightsMm: number[];
};

export type B92ConfiguratorLayoutPreset =
  | "1-field"
  | "2-field-horizontal"
  | "2-field-vertical"
  | "3-field-horizontal"
  | "3-field-vertical"
  | "4-field-horizontal"
  | "4-field-vertical"
  | "5-field-horizontal"
  | "5-field-vertical"
  | "6-field-horizontal"
  | "6-field-vertical"
  | "1x2-grid"
  | "2x1-grid"
  | "2x2-grid"
  | "2x3-grid"
  | "3x2-grid"
  | "3x3-grid"
  | "3x4-grid"
  | "4x3-grid"
  | "4x4-grid"
  | "5x4-grid"
  | "4x5-grid"
  | "5x5-grid"
  | "5x6-grid"
  | "6x5-grid"
  | "6x6-grid";

export type B92ConfiguratorLayoutOrientation = "horizontal" | "vertical" | "grid";
export type B92ConfiguratorStructureMode = "fields" | "coupled";

export type B92ConfiguratorSplitMode = "equal" | "manual";

export type B92ConfiguratorFieldOperation =
  | "fixed"
  | "fixed-sash"
  | "tilt-turn-left"
  | "tilt-turn-right"
  | "turn-left"
  | "turn-right"
  | "tilt";

export type B92ConfiguratorFieldState = {
  id: string;
  index: number;
  row: number;
  column: number;
  operation: B92ConfiguratorFieldOperation;
};

export type B92ConfiguratorCoupledItemState = {
  id: string;
  targetType: "field" | "frame-edge" | "junction" | "component";
  targetId: string;
  notes?: string;
};

export type B92ConfiguratorStructureState = {
  structureMode: B92ConfiguratorStructureMode;
  layoutPreset: B92ConfiguratorLayoutPreset;
  fieldOrientation: B92ConfiguratorLayoutOrientation;
  fieldCount: number;
  orientation: B92ConfiguratorLayoutOrientation;
  gridRows: number;
  gridColumns: number;
  rows: number;
  columns: number;
  splitMode: B92ConfiguratorSplitMode;
  fields: B92ConfiguratorFieldState[];
  selectedFieldId: string | null;
  selectedJunctionId: string | null;
  selectedFrameEdge: string | null;
  coupledItems: B92ConfiguratorCoupledItemState[];
  selectedCouplingTarget: string | null;
};

export type B92ConfiguratorContextTarget =
  | { type: "field"; fieldId: string }
  | { type: "junction"; junctionId: string }
  | { type: "frame-edge"; frameEdgeId: string }
  | { type: "hardware"; hardwareId: string; fieldId: string | null };

export type B92ConfiguratorContextMenuState = {
  open: boolean;
  x: number;
  y: number;
  target: B92ConfiguratorContextTarget | null;
};

export type B92ConfiguratorState = {
  selectedViewId: string | null;
  selectedFamilyId: string | null;
  selectedView: B92ProfileSectionProofView;
  structure: B92ConfiguratorStructureState;
  activeContextTarget: B92ConfiguratorContextTarget | null;
  contextMenu: B92ConfiguratorContextMenuState;
  contextStatusMessage: string | null;
  dimensions: B92ConfiguratorDimensionState;
  finishes: B92ConfiguratorFinishState;
  sourceModelDesignId: string | null;
};
