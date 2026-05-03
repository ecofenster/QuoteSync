import type {
  B92CornerSystem,
  B92CouplingSystem,
  B92JoinCondition,
  B92MullionTransomProfileId,
  B92ProfileId,
  B92ProfileReference,
  B92ProfileStack,
  B92ResolverConstraint,
  B92ThresholdSystem,
} from "./b92ProfileTypes";

export const B92_RENDER_ENGINE_DESIGN_RULE =
  "Window Type render engine becomes the source of truth; admin configurator and front-end estimate configurator consume resolved Window Type render data. Existing pilot flags are temporary validation only and will be replaced later by resolver-driven window type rendering.";

export const B92_FIXED_PERIMETER_MAP = {
  head: { profileId: "B92-1", role: "fixed_head", source: "locked_map" },
  jamb: { profileId: "B92-2", role: "fixed_jamb", source: "locked_map" },
  sill: { profileId: "B92-3", role: "fixed_sill", source: "locked_map" },
  internalInterface: { profileId: "B92-6", role: "fixed_internal_interface", source: "locked_map" },
  ventHead: { profileId: "B92-1/78V", role: "trickle_vent_head", source: "locked_map" },
  mixedFixedVentHead: { profileId: "B92-4/100V", role: "trickle_vent_head", source: "locked_map" },
} as const satisfies Record<string, B92ProfileReference>;

export const B92_TILT_TURN_PERIMETER_MAP = {
  head: { profileId: "B92-7", role: "tilt_turn_head", source: "locked_map" },
  headExtension100: { profileId: "B92-7/100", role: "tilt_turn_head_extension", source: "locked_map" },
  headExtension120: { profileId: "B92-7/120", role: "tilt_turn_head_extension", source: "locked_map" },
  ventHead: { profileId: "B92-7/100V", role: "trickle_vent_head", source: "locked_map" },
  sill: { profileId: "B92-8", role: "tilt_turn_sill", source: "locked_map" },
  jambHandleSide: { profileId: "B92-9", role: "tilt_turn_jamb", source: "locked_map" },
  jambHingeSide: { profileId: "B92-10", role: "tilt_turn_jamb", source: "locked_map" },
} as const satisfies Record<string, B92ProfileReference>;

export const B92_TILT_TURN_SILL_VARIANTS = [
  "B92-8A",
  "B92-8B",
  "B92-8C",
  "B92-8D",
  "B92-8E",
  "B92-8F",
  "B92-8G",
] as const satisfies B92ProfileId[];

export const B92_TRICKLE_VENT_VARIANTS = {
  fixedHead: "B92-1/78V",
  mixedFixed: "B92-4/100V",
  tiltTurnHead: "B92-7/100V",
} as const satisfies Record<string, B92ProfileId>;

export const B92_MULLION_TRANSOM_STACKS: Record<B92MullionTransomProfileId, B92ProfileStack> = {
  "B92-11": { profileId: "B92-11", role: "vertical_mullion", stackMm: [21, 36, 21], totalMm: 78 },
  "B92-12": { profileId: "B92-12", role: "vertical_mullion", stackMm: [21, 57, 21], totalMm: 100, note: "Nominal 100." },
  "B92-13": { profileId: "B92-13", role: "vertical_mullion", stackMm: [21, 22, 14, 21], totalMm: 78 },
  "B92-14": { profileId: "B92-14", role: "vertical_mullion", stackMm: [21, 38.5, 57, 21], totalMm: 137.5 },
  "B92-15": { profileId: "B92-15", role: "vertical_mullion", stackMm: [21, 57, 19, 57, 21], totalMm: 175 },
  "B92-16": { profileId: "B92-16", role: "vertical_mullion", stackMm: [21, 57, 49, 57, 21], totalMm: 205 },
  "B92-17": { profileId: "B92-17", role: "vertical_mullion", stackMm: [21, 57, 19, 78], totalMm: 175 },
  "B92-18": {
    profileId: "B92-18",
    role: "vertical_mullion",
    stackMm: [21, 27, 5, 57, 21],
    totalMm: 131,
    note: "Flying mullion, owner-driven, centre gap 5.",
  },
  "B92-19": { profileId: "B92-19", role: "horizontal_transom", stackMm: [21, 57, 31.5, 21], totalMm: 130.5 },
  "B92-20": { profileId: "B92-20", role: "horizontal_transom", stackMm: [21, 36, 21], totalMm: 78 },
  "B92-21": { profileId: "B92-21", role: "horizontal_transom", stackMm: [21, 16.5, 57, 21], totalMm: 115.5 },
  "B92-22": { profileId: "B92-22", role: "horizontal_transom", stackMm: [21, 57, 30, 57, 21], totalMm: 186 },
  "B92-23": { profileId: "B92-23", role: "horizontal_transom", stackMm: [21, 51, 37, 21], totalMm: 130 },
  "B92-24": { profileId: "B92-24", role: "horizontal_transom", stackMm: [21, 22, 14, 21], totalMm: 78 },
};

export const B92_VERTICAL_JOIN_CANDIDATES: Partial<Record<B92JoinCondition, B92ProfileId[]>> = {
  fixed_to_fixed: ["B92-11", "B92-14"],
  fixed_to_tilt_turn: ["B92-12", "B92-13"],
  tilt_turn_to_fixed: ["B92-12", "B92-13"],
  tilt_turn_to_tilt_turn: ["B92-15", "B92-16", "B92-17"],
  flying_mullion: ["B92-18"],
};

export const B92_HORIZONTAL_JOIN_CANDIDATES: Partial<Record<B92JoinCondition, B92ProfileId[]>> = {
  fixed_to_fixed: ["B92-23", "B92-24"],
  fixed_to_tilt_turn: ["B92-21"],
  tilt_turn_to_fixed: ["B92-20"],
  tilt_turn_to_tilt_turn: ["B92-19", "B92-22"],
};

export const B92_COUPLING_MAP: Record<Exclude<B92JoinCondition, "flying_mullion" | "pending_confirmation">, B92CouplingSystem[]> = {
  fixed_to_fixed: ["C04"],
  fixed_to_tilt_turn: ["C05"],
  tilt_turn_to_fixed: ["C06"],
  tilt_turn_to_tilt_turn: ["C01", "C02", "C03"],
  straight_coupling: ["C01", "C02", "C03", "C04", "C05", "C06"],
};

export type B92CornerSystemDefinition = {
  system: B92CornerSystem;
  category: "corner90" | "bay" | "glass";
  angleRange?: "90" | "91-140" | "141-179";
  block?: {
    blockLabel?: string;
    blockSource: "locked_map" | "pending_confirmation";
    widthMm?: number;
    depthMm?: number;
    steppedBaseMm?: [number, number];
    note?: string;
  };
  constraints: B92ResolverConstraint[];
  note: string;
};

export const B92_CORNER_SYSTEM_MAP: Record<B92CornerSystem, B92CornerSystemDefinition> = {
  C07: {
    system: "C07",
    category: "corner90",
    angleRange: "90",
    block: { blockLabel: "92x92", blockSource: "locked_map", widthMm: 92, depthMm: 92 },
    constraints: ["none"],
    note: "Fixed passive plan/top-down 90 degree corner system; 92x92 corner, 92x78 fixed jambs.",
  },
  C08: {
    system: "C08",
    category: "corner90",
    angleRange: "90",
    block: { blockLabel: "92x92", blockSource: "locked_map", widthMm: 92, depthMm: 92 },
    constraints: ["none"],
    note: "Hybrid fixed/T&T passive plan/top-down 90 degree corner system; 92x92 corner, 92x78 + 92x78.",
  },
  C09: {
    system: "C09",
    category: "corner90",
    angleRange: "90",
    block: { blockLabel: "92x92", blockSource: "locked_map", widthMm: 92, depthMm: 92 },
    constraints: ["tilt_conflict"],
    note: "T&T 90 degree corner system; 92x140 host + 92x120 side, 92x92 corner.",
  },
  C10: {
    system: "C10",
    category: "corner90",
    angleRange: "90",
    block: { blockLabel: "92x92", blockSource: "locked_map", widthMm: 92, depthMm: 92, note: "Variant/orientation of C08." },
    constraints: ["none"],
    note: "Hybrid fixed/T&T passive variant/orientation of C08.",
  },
  C11: {
    system: "C11",
    category: "corner90",
    angleRange: "90",
    block: { blockLabel: "92x92", blockSource: "locked_map", widthMm: 92, depthMm: 92 },
    constraints: ["tilt_conflict", "sash_opening_conflict"],
    note: "T&T 90 degree corner system, mixed 120/78 depth, 92x92 corner; supplied rule notes sash/opening conflict.",
  },
  C12: {
    system: "C12",
    category: "corner90",
    angleRange: "90",
    block: { blockSource: "pending_confirmation", note: "Corner block details pending confirmation." },
    constraints: ["pending_confirmation"],
    note: "T&T 90 degree corner variant pending confirmation from supplied mapping.",
  },
  C13: {
    system: "C13",
    category: "bay",
    angleRange: "91-140",
    block: { blockLabel: "124x140", blockSource: "locked_map", widthMm: 124, depthMm: 140 },
    constraints: ["none"],
    note: "Fixed bay acute, 124x140 corner block.",
  },
  C14: {
    system: "C14",
    category: "bay",
    angleRange: "141-179",
    block: { blockLabel: "124x48", blockSource: "locked_map", widthMm: 124, depthMm: 48, steppedBaseMm: [41, 41] },
    constraints: ["none"],
    note: "Fixed bay wide, 124x48 corner block, stepped base [41,41].",
  },
  C15: {
    system: "C15",
    category: "bay",
    angleRange: "91-140",
    constraints: ["tilt_conflict"],
    note: "T&T bay acute.",
  },
  C16: {
    system: "C16",
    category: "bay",
    angleRange: "141-179",
    block: { blockLabel: "124x30", blockSource: "locked_map", widthMm: 124, depthMm: 30, steppedBaseMm: [41, 41] },
    constraints: ["tilt_conflict"],
    note: "T&T bay wide, 124x30 corner block, stepped base [41,41].",
  },
  C17: {
    system: "C17",
    category: "glass",
    constraints: ["glass_site_glazing_required"],
    note: "Structural glazing / glass-to-glass, separate corner system.",
  },
};

export const B92_THRESHOLD_SYSTEMS = {
  "B92-25": { system: "B92-25", note: "Threshold system only; not a normal sill profile." },
  "B92-26": { system: "B92-26", note: "Threshold system only; not a normal sill profile." },
} as const satisfies Record<B92ThresholdSystem, { system: B92ThresholdSystem; note: string }>;
