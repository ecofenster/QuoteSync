export type ConfiguredPositionContractSchemaVersion = 1;

export type ConfiguredPositionContractSystem = "B92";

export type ConfiguredPositionProofStatus =
  | "approved_locked"
  | "accepted_reference"
  | "generated_preview"
  | "unproved"
  | "not_applicable";

export type ConfiguredPositionFieldOperation =
  | "fixed"
  | "fixed_sash"
  | "tilt_turn_left"
  | "tilt_turn_right"
  | "turn_left"
  | "turn_right"
  | "tilt";

export type ConfiguredPositionContractField = {
  id: string;
  row: number;
  column: number;
  operation: ConfiguredPositionFieldOperation;
  openingDirection: "inward" | "outward" | "neutral";
  handing?: "left" | "right" | "center" | null;
};
export type ConfiguredPositionContractJunction = {
  id: string;
  axis: "vertical" | "horizontal";
  index: number;
  type: "static" | "flying";
  ownerFieldId?: string | null;
};

export type ConfiguredPositionContract = {
  schemaVersion: ConfiguredPositionContractSchemaVersion;
  source: "b92_configurator";
  identity: {
    positionId: string;
    positionRef: string;
    estimateId: string;
    clientId: string;
    createdAt?: string;
    updatedAt?: string;
  };
  estimateContext: {
    quantity: number;
    roomName: string;
    positionType: "Window" | "Door";
    useEstimateDefaults: boolean;
  };
  product: {
    manufacturerId: string | null;
    productId: string | null;
    windowTypeId: string | null;
    systemCode: ConfiguredPositionContractSystem;
    productFamily: "Europa 92 Alu Clad";
    sourceModelId: string | null;
    sourceModelVersion: string | null;
  };
  dimensions: {
    widthMm: number;
    heightMm: number;
    colWidthsMm: number[];
    rowHeightsMm: number[];
    splitMode: "equal" | "manual";
    divisionBasis: "frame" | "glass";
  };
  layout: {
    rows: number;
    columns: number;
    mode: "single" | "linear_horizontal" | "linear_vertical" | "grid";
    presetKey: string;
    fields: ConfiguredPositionContractField[];
    junctions: ConfiguredPositionContractJunction[];
  };
  profileProof: {
    sourceModel: "b92_configurator_manifest";
    sourceModelProvenanceId: string;
    proofStatus: ConfiguredPositionProofStatus;
    approvedProofIds: string[];
    acceptedReferenceIds: string[];
    generatedPreviewIds: string[];
    profileRefs: string[];
    unresolvedProfileRefs: string[];
    sourceProof: {
      svgPath: string;
      dxfPath: string | null;
    };
    constraints: Array<{
      sourceId: string;
      severity: "info" | "warning" | "blocking";
      note?: string;
    }>;
  };
  glass: {
    optionId?: string | null;
    label?: string | null;
    spec?: string | null;
    calculatedBy: "b92_proof_geometry" | "estimate_override" | "manual";
  };
  hardware: {
    handleType?: string | null;
    handleHeightMm?: number | null;
    hingeType?: string | null;
  };
  finish: {
    mode: "single" | "dual";
    internalMode: "native" | "lacquer" | "ral";
    internalRal: string;
    internalLacquerId: string | null;
    externalRevealMode: "native" | "lacquer" | "ral";
    externalRevealRal: string;
    externalRevealLacquerId: string | null;
    externalCladdingMode: "native" | "ral";
    externalCladdingRal: string;
  };
  pricing: {
    pricingMode: "pending" | "manual" | "calculated";
    itemPrice?: number | null;
    inputs?: Record<string, unknown>;
  };
  render: {
    orientationView: "inside" | "outside";
    renderSource: "b92_proof_preview";
    proofViewId: string;
    proofFamilyId: string;
    openingSymbolMode: "din" | "uk";
  };
  compatibilityProjection: {
    widthMm: number;
    heightMm: number;
    fieldsX: number;
    fieldsY: number;
    insertion: string;
    cellInsertions: Record<string, string>;
    colWidthsMm: number[];
    rowHeightsMm: number[];
  };
};

export type PositionWithConfiguredContract = {
  configuredContract?: ConfiguredPositionContract | null;
};
