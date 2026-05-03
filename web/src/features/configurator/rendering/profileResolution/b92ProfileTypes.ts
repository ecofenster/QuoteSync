export type B92ProfileId =
  | "B92-1"
  | "B92-1/78V"
  | "B92-2"
  | "B92-3"
  | "B92-4/100V"
  | "B92-6"
  | "B92-7"
  | "B92-7/100"
  | "B92-7/120"
  | "B92-7/100V"
  | "B92-8"
  | "B92-8A"
  | "B92-8B"
  | "B92-8C"
  | "B92-8D"
  | "B92-8E"
  | "B92-8F"
  | "B92-8G"
  | "B92-9"
  | "B92-10"
  | "B92-11"
  | "B92-12"
  | "B92-13"
  | "B92-14"
  | "B92-15"
  | "B92-16"
  | "B92-17"
  | "B92-18"
  | "B92-19"
  | "B92-20"
  | "B92-21"
  | "B92-22"
  | "B92-23"
  | "B92-24";

export type B92ProfileRole =
  | "fixed_head"
  | "fixed_jamb"
  | "fixed_sill"
  | "fixed_internal_interface"
  | "tilt_turn_head"
  | "tilt_turn_head_extension"
  | "tilt_turn_sill"
  | "tilt_turn_jamb"
  | "trickle_vent_head"
  | "vertical_mullion"
  | "horizontal_transom";

export type B92FieldType = "fixed" | "fixed_sash" | "tilt_turn" | "turn_only" | "door" | "unknown";

export type B92Orientation =
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "vertical"
  | "horizontal"
  | "left_handed"
  | "right_handed"
  | "external_view";

export type B92JoinCondition =
  | "fixed_to_fixed"
  | "fixed_to_tilt_turn"
  | "tilt_turn_to_fixed"
  | "tilt_turn_to_tilt_turn"
  | "flying_mullion"
  | "straight_coupling"
  | "pending_confirmation";

export type B92CouplingSystem = "C01" | "C02" | "C03" | "C04" | "C05" | "C06";

export type B92CornerSystem = "C07" | "C08" | "C09" | "C10" | "C11" | "C12" | "C13" | "C14" | "C15" | "C16" | "C17";

export type B92ThresholdSystem = "B92-25" | "B92-26";

export type B92ResolverConstraint =
  | "none"
  | "tilt_conflict"
  | "sash_opening_conflict"
  | "glass_site_glazing_required"
  | "temporary_glazing_bead_required"
  | "unresolved_profile_choice"
  | "pending_confirmation";

export type B92Side = "top" | "bottom" | "left" | "right";

export type B92ProfileReference = {
  profileId: B92ProfileId;
  role: B92ProfileRole;
  source: "locked_map" | "explicit_option" | "default_map";
  note?: string;
};

export type B92ResolvedPerimeterSide = {
  fieldId: string;
  side: B92Side;
  reference: B92ProfileReference | null;
  candidateProfileIds?: B92ProfileId[];
  note?: string;
};

export type B92ResolverFieldInput = {
  id: string;
  row: number;
  column: number;
  type: B92FieldType;
  openingType?: "fixed" | "tilt_turn" | "turn_only" | "door" | null;
  handing?: "left" | "right" | null;
  hingeSide?: "left" | "right" | null;
  handleSide?: "left" | "right" | null;
  hasTrickleVent?: boolean;
  headExtension?: "B92-7/100" | "B92-7/120" | null;
  sillVariant?: "B92-8A" | "B92-8B" | "B92-8C" | "B92-8D" | "B92-8E" | "B92-8F" | "B92-8G" | null;
  thresholdSystem?: B92ThresholdSystem | null;
};

export type B92ResolverVerticalJoinInput = {
  id: string;
  leftFieldId: string;
  rightFieldId: string;
  condition: B92JoinCondition;
  ownerFieldId?: string | null;
  preferredProfileId?: B92ProfileId | null;
};

export type B92ResolverHorizontalJoinInput = {
  id: string;
  topFieldId: string;
  bottomFieldId: string;
  condition: B92JoinCondition;
  preferredProfileId?: B92ProfileId | null;
};

export type B92ResolverCouplingInput = {
  id: string;
  condition: Exclude<B92JoinCondition, "flying_mullion" | "pending_confirmation">;
  preferredSystem?: B92CouplingSystem | null;
};

export type B92ResolverCornerInput = {
  id: string;
  system: B92CornerSystem;
  angleDegrees?: number | null;
  involvedFieldIds: string[];
};

export type B92ResolverView = "external" | "external_refs_internal_validation";

export type B92ResolverInput = {
  view: B92ResolverView;
  fields: B92ResolverFieldInput[];
  verticalJoins?: B92ResolverVerticalJoinInput[];
  horizontalJoins?: B92ResolverHorizontalJoinInput[];
  couplings?: B92ResolverCouplingInput[];
  corners?: B92ResolverCornerInput[];
};

export type B92ResolvedJunction = {
  id: string;
  condition: B92JoinCondition;
  reference: B92ProfileReference | null;
  candidateProfileIds?: B92ProfileId[];
  ownerFieldId?: string | null;
  note?: string;
};

export type B92ResolvedCoupling = {
  id: string;
  system: B92CouplingSystem | null;
  condition: B92JoinCondition;
  candidateSystems?: B92CouplingSystem[];
  note?: string;
};

export type B92ResolvedCorner = {
  id: string;
  system: B92CornerSystem;
  angleDegrees?: number | null;
  constraints: B92ResolverConstraint[];
  note?: string;
};

export type B92ResolvedThreshold = {
  fieldId: string;
  system: B92ThresholdSystem;
  note: string;
};

export type B92ResolvedConstraint = {
  sourceId: string;
  constraint: B92ResolverConstraint;
  note?: string;
};

export type B92ResolverOutput = {
  view: B92ResolverInput["view"];
  referenceView: "external";
  designRule: string;
  perimeter: {
    top: B92ResolvedPerimeterSide[];
    bottom: B92ResolvedPerimeterSide[];
    left: B92ResolvedPerimeterSide[];
    right: B92ResolvedPerimeterSide[];
  };
  verticalJunctions: B92ResolvedJunction[];
  horizontalJunctions: B92ResolvedJunction[];
  couplings: B92ResolvedCoupling[];
  corners: B92ResolvedCorner[];
  thresholds: B92ResolvedThreshold[];
  constraints: B92ResolvedConstraint[];
};

export type B92ProfileStack = {
  profileId: B92MullionTransomProfileId;
  role: Extract<B92ProfileRole, "vertical_mullion" | "horizontal_transom">;
  stackMm: number[];
  totalMm: number;
  note?: string;
};

export type B92MullionTransomProfileId =
  | "B92-11"
  | "B92-12"
  | "B92-13"
  | "B92-14"
  | "B92-15"
  | "B92-16"
  | "B92-17"
  | "B92-18"
  | "B92-19"
  | "B92-20"
  | "B92-21"
  | "B92-22"
  | "B92-23"
  | "B92-24";
