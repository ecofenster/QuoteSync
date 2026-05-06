export type B92ProfileRuleStatus = "confirmed" | "candidate" | "blocked";

export type B92RuleView = "inside" | "outside" | "external_reference";

export type B92RuleFieldOperation =
  | "fixed"
  | "fixed_sash"
  | "tilt_turn"
  | "turn_only"
  | "tilt_only"
  | "door"
  | "sliding"
  | "unknown";

export type B92RuleEdge = "top" | "bottom" | "left" | "right";

export type B92RuleProfileKind =
  | "outer_frame"
  | "sash_frame"
  | "sill"
  | "threshold"
  | "vertical_mullion"
  | "horizontal_transom"
  | "flying_mullion"
  | "coupling"
  | "corner"
  | "glass_corner"
  | "glazing_bar"
  | "sash_bar";

export type B92RuleProfileId =
  | "B92-1"
  | "B92-1/78V"
  | "B92-2"
  | "B92-3"
  | "B92-3a"
  | "B92-3b"
  | "B92-3c"
  | "B92-3d"
  | "B92-3e"
  | "B92-3f"
  | "B92-3g"
  | "B92-4"
  | "B92-5"
  | "B92-6"
  | "B92-7"
  | "B92-7/100"
  | "B92-7/120"
  | "B92-7/100V"
  | "B92-7/120V"
  | "B92-8"
  | "B92-8a"
  | "B92-8b"
  | "B92-8c"
  | "B92-8d"
  | "B92-8e"
  | "B92-8f"
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
  | "B92-24"
  | "B92-25"
  | "B92-26"
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
  | "B92-C17"
  | "played_glazing_bar"
  | "ovolo_glazing_bar"
  | "solid_sash_bars";

export type B92ProfileDimensions = {
  widthMm?: number;
  depthMm?: number;
  visibleFaceMm?: Partial<Record<B92RuleEdge, number>>;
  notes?: string[];
};

export type B92ProfileDefinition = {
  id: B92RuleProfileId;
  label: string;
  kinds: B92RuleProfileKind[];
  orientations?: Array<B92RuleEdge | "vertical" | "horizontal" | "coupling" | "corner">;
  dimensions?: B92ProfileDimensions;
  status: B92ProfileRuleStatus;
  notes?: string[];
};

export type B92OuterEdgeRule = {
  id: string;
  edge: B92RuleEdge;
  fieldOperations: B92RuleFieldOperation[];
  profileId: B92RuleProfileId;
  status: B92ProfileRuleStatus;
  notes?: string[];
};

export type B92SillRule = {
  id: string;
  bottomFieldOperations: B92RuleFieldOperation[];
  profileId: B92RuleProfileId;
  status: B92ProfileRuleStatus;
  notes?: string[];
};

export type B92VerticalMullionRule = {
  id: string;
  leftOperation: B92RuleFieldOperation;
  rightOperation: B92RuleFieldOperation;
  profileId: B92RuleProfileId;
  overrideCondition?: "flying_mullion" | "hinges_at_meeting" | "same_handing" | "hinge_accommodation";
  status: B92ProfileRuleStatus;
  notes?: string[];
};

export type B92HorizontalTransomRule = {
  id: string;
  upperOperation: B92RuleFieldOperation;
  lowerOperation: B92RuleFieldOperation;
  profileId: B92RuleProfileId;
  context?: "standard" | "row_composition" | "special_mixed_case";
  status: B92ProfileRuleStatus;
  notes?: string[];
};

export type B92CouplingRule = {
  id: string;
  profileId: B92RuleProfileId;
  role: "straight_coupling" | "corner_post" | "angled_bay" | "glass_corner";
  angleRangeDegrees?: [number, number];
  status: B92ProfileRuleStatus;
  notes?: string[];
};

export type B92ThresholdRule = {
  id: string;
  fieldOperations: B92RuleFieldOperation[];
  profileId: B92RuleProfileId;
  replacesBottomSill: true;
  status: B92ProfileRuleStatus;
  notes?: string[];
};

export type B92ProfileRuleRegister = {
  profiles: Record<B92RuleProfileId, B92ProfileDefinition>;
  outerEdgeRules: B92OuterEdgeRule[];
  sillRules: B92SillRule[];
  verticalMullionRules: B92VerticalMullionRule[];
  horizontalTransomRules: B92HorizontalTransomRule[];
  couplingRules: B92CouplingRule[];
  thresholdRules: B92ThresholdRule[];
};
