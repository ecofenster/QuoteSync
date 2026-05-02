export type ProfileRefId =
  | "B92-1"
  | "B92-2"
  | "B92-3"
  | "B92-3B"
  | "B92-4"
  | "B92-5"
  | "B92-6"
  | "B92-7"
  | "B92-8"
  | "B92-8B"
  | "B92-9"
  | "B92-10"
  | "B92-12"
  | "B92-13"
  | "B92-14"
  | "B92-15"
  | "B92-18"
  | "B92-20"
  | "B92-21"
  | "B92-22"
  | "B92-23"
  | "B92-24"
  | "B92-C01"
  | "B92-C02"
  | "B92-C03"
  | "B92-C04"
  | "B92-C05"
  | "B92-C06"
  | "B92-C07"
  | "B92-C08"
  | "B92-C09"
  | "B92-C10"
  | "B92-C11"
  | "B92-C12"
  | "B92-C13"
  | "B92-C14"
  | "B92-C15"
  | "B92-C16"
  | "B92-C17";

export type PilotProfileSelection = ProfileRefId | "REQUIRES_CONFIRMATION";

export type ProfileEdge = "top" | "right" | "bottom" | "left";

export type PilotFieldBaseType =
  | "fixed"
  | "fixedSash"
  | "tiltTurn"
  | "turnOnly"
  | "master"
  | "slave"
  | "unknown";

export type PilotFieldHanding = "left" | "right" | null;

export type PilotConnectionAxis = "vertical" | "horizontal";

export type PilotJunctionType = "static" | "flying";

export type ProfileResolutionView = "inside" | "outside";

export type SystemConnectionKind = "straightCoupler" | "corner90" | "angledBay" | "glassToGlass";

export type ProfileRefDefinition = {
  id: ProfileRefId;
  title: string;
  summary: string;
  notes?: string[];
};

export type ExternalLayerNotes = {
  aluminiumCladding?: boolean;
  shadowGapApproxMm?: number;
  sashCladdingApproxMm?: number;
  frameDepthApproxMm?: number;
};

export type ResolverConstraintMetadata = {
  requiresOwnerField?: boolean;
  ownerFieldId?: string | null;
  singleTiltOnly?: boolean;
  factoryFittedPost?: boolean;
  glassToGlass?: boolean;
  siteGlazed?: boolean;
  noCornerPost?: boolean;
  unresolvedOptions?: string[];
  warning?: string;
};

export type ResolvedProfileEdge = {
  edge: ProfileEdge;
  profileRef: PilotProfileSelection | null;
  mirrored?: boolean;
  note?: string;
  requiresExternalMapping?: boolean;
  externalLayerNotes?: ExternalLayerNotes;
};

export type ResolvedPilotField = {
  key: string;
  row: number;
  col: number;
  insertion: string;
  type: PilotFieldBaseType;
  baseType: Exclude<PilotFieldBaseType, "master" | "slave">;
  handing: PilotFieldHanding;
  hingeSide: PilotFieldHanding;
  handleSide: PilotFieldHanding;
  trickleVentActive: boolean;
  edges: Record<ProfileEdge, ResolvedProfileEdge>;
};

export type ResolvedPilotConnection = {
  key: string;
  axis: PilotConnectionAxis;
  type: PilotJunctionType;
  startKey: string;
  endKey: string;
  row?: number;
  col?: number;
  profileRef: PilotProfileSelection | null;
  mirrored?: boolean;
  hingeAtCentre?: boolean;
  note?: string;
  requiresExternalMapping?: boolean;
  externalLayerNotes?: ExternalLayerNotes;
  metadata?: ResolverConstraintMetadata;
};

export type SystemConnectionInput = {
  key?: string;
  kind: SystemConnectionKind;
  metadata?: {
    angle?: number;
    involvedFieldIds?: string[];
    hasTiltTurn?: boolean;
  };
};

export type ResolvedSystemConnectionMetadata = ResolverConstraintMetadata & {
  angle?: number;
  angleRange?: "91-140" | "141-179";
  involvedFieldIds?: string[];
  hasTiltTurn?: boolean;
};

export type ResolvedSystemConnection = {
  key?: string;
  domain: SystemConnectionKind;
  profileRef: PilotProfileSelection;
  metadata: ResolvedSystemConnectionMetadata;
  note?: string;
};

export type ProfileResolutionInput = {
  view: ProfileResolutionView;
  fieldsX: number;
  fieldsY: number;
  insertions: Record<string, string>;
  junctions: Array<{
    key: string;
    type?: string;
    ownerFieldId?: string | null;
  }>;
  hasTrickleVent: boolean;
  systems?: SystemConnectionInput[];
};

export type ProfileResolutionResult = {
  view: ProfileResolutionView;
  fields: ResolvedPilotField[];
  verticalConnections: ResolvedPilotConnection[];
  horizontalConnections: ResolvedPilotConnection[];
  systemConnections: ResolvedSystemConnection[];
  sectionReferences: ProfileRefId[];
  placeholders: string[];
  requiresExternalMapping?: boolean;
  externalLayerNotes?: ExternalLayerNotes;
};
