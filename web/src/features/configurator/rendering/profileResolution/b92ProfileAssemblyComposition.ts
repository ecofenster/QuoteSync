export type B92AssemblyLayer = "layer_1_structural" | "layer_2_infill";

export type B92AssemblyComponentKind = "bead" | "structural_core" | "sash" | "gap";

export type B92AssemblyComponent = {
  key: string;
  kind: B92AssemblyComponentKind;
  widthMm: number;
  layer: B92AssemblyLayer;
};

export type B92AssemblyDatum = {
  kind: "component_centreline";
  componentKey: string;
  offsetFromAssemblyStartMm: number;
  note: string;
};

export type B92ProfileAssemblyComposition = {
  profileRef: string;
  context: string;
  axis: "vertical" | "horizontal";
  assemblyKind: "fixed_fixed_static_core" | "static_sash_post" | "flying_sash_meeting";
  status: "renderable" | "blocked";
  hasLayer1StructuralPost: boolean;
  renderAsStaticJunction: boolean;
  totalMm: number;
  components: B92AssemblyComponent[];
  datum: B92AssemblyDatum;
  internalConfirmed: boolean;
  externalConfirmed: boolean;
  note: string;
};

export const B92_SIMPLE_FIXED_FIXED_VERTICAL_ASSEMBLY_CONTEXT = "simple_fixed_fixed_vertical" as const;
export const B92_STATIC_SASH_POST_VERTICAL_ASSEMBLY_CONTEXT = "static_sash_post_vertical" as const;
export const B92_INTERNAL_FLYING_VERTICAL_ASSEMBLY_CONTEXT = "internal_flying_vertical" as const;

export const B92_PROFILE_ASSEMBLY_COMPOSITIONS = {
  "B92-11:simple_fixed_fixed_vertical": {
    profileRef: "B92-11",
    context: B92_SIMPLE_FIXED_FIXED_VERTICAL_ASSEMBLY_CONTEXT,
    axis: "vertical",
    assemblyKind: "fixed_fixed_static_core",
    status: "renderable",
    hasLayer1StructuralPost: true,
    renderAsStaticJunction: true,
    totalMm: 78,
    components: [
      { key: "left_bead", kind: "bead", widthMm: 21, layer: "layer_2_infill" },
      { key: "structural_core", kind: "structural_core", widthMm: 36, layer: "layer_1_structural" },
      { key: "right_bead", kind: "bead", widthMm: 21, layer: "layer_2_infill" },
    ],
    datum: {
      kind: "component_centreline",
      componentKey: "structural_core",
      offsetFromAssemblyStartMm: 39,
      note: "Centreline of the 36mm structural core: 21mm bead + 18mm half core.",
    },
    internalConfirmed: true,
    externalConfirmed: true,
    note:
      "Simple 2-field fixed/fixed B92-11 assembly. Render only the 36mm core in layer 1; adjacent fixed beads own the 21mm zones in layer 2.",
  },
  "B92-17:static_sash_post_vertical": {
    profileRef: "B92-17",
    context: B92_STATIC_SASH_POST_VERTICAL_ASSEMBLY_CONTEXT,
    axis: "vertical",
    assemblyKind: "static_sash_post",
    status: "blocked",
    hasLayer1StructuralPost: true,
    renderAsStaticJunction: true,
    totalMm: 100,
    components: [
      { key: "static_post", kind: "structural_core", widthMm: 100, layer: "layer_1_structural" },
    ],
    datum: {
      kind: "component_centreline",
      componentKey: "static_post",
      offsetFromAssemblyStartMm: 50,
      note: "Centreline of the 100mm static sash/sash post. Only 19mm is visible internally after sash overlap.",
    },
    internalConfirmed: true,
    externalConfirmed: false,
    note:
      "B92-17 is a static sash/sash post, not a flying mullion. Layer 1 post is 100mm; 19mm is the internal visible reveal after layer 2 sash overlap. Rendering is blocked until sash overlap/termination authority is explicit.",
  },
  "B92-18:internal_flying_vertical": {
    profileRef: "B92-18",
    context: B92_INTERNAL_FLYING_VERTICAL_ASSEMBLY_CONTEXT,
    axis: "vertical",
    assemblyKind: "flying_sash_meeting",
    status: "renderable",
    hasLayer1StructuralPost: false,
    renderAsStaticJunction: false,
    totalMm: 131,
    components: [
      { key: "passive_side_bead", kind: "bead", widthMm: 21, layer: "layer_2_infill" },
      { key: "slave_sash", kind: "sash", widthMm: 27, layer: "layer_2_infill" },
      { key: "meeting_gap", kind: "gap", widthMm: 5, layer: "layer_2_infill" },
      { key: "master_sash", kind: "sash", widthMm: 57, layer: "layer_2_infill" },
      { key: "master_side_bead", kind: "bead", widthMm: 21, layer: "layer_2_infill" },
    ],
    datum: {
      kind: "component_centreline",
      componentKey: "meeting_gap",
      offsetFromAssemblyStartMm: 50.5,
      note: "Centreline of the 5mm flying meeting gap: 21mm bead + 27mm slave sash + 2.5mm half gap.",
    },
    internalConfirmed: true,
    externalConfirmed: false,
    note:
      "Internal B92-18 flying sash-meeting assembly has no layer 1 static post. Render only when owner/master side is explicit; external flying remains unresolved.",
  },
} as const satisfies Record<string, B92ProfileAssemblyComposition>;

export const B92_BLOCKED_PROFILE_ASSEMBLY_REFS = {
  "B92-12": "Mixed fixed/T&T vertical geometry needs component stack, ownership, and daylight closure evidence.",
  "B92-13": "Mixed fixed/T&T hinge-centre geometry needs component stack, ownership, and daylight closure evidence.",
  "B92-14": "Valid context-dependent fixed/fixed ref; renderable contexts must be separated from simple 2-field B92-11.",
  "B92-15": "T&T/T&T static stack is known, but structural allocation, sash termination, and daylight closure are unresolved.",
  "B92-17": "Static sash/sash post semantics are known, but production geometry is blocked by sash overlap, termination, and daylight closure rules.",
  "B92-18": "Internal flying stack is renderable only with explicit owner/master side. External flying is unresolved.",
  "B92-19": "Horizontal transom stack known; above/below ownership and datum split are unresolved.",
  "B92-20": "Horizontal transom stack known; above/below ownership and datum split are unresolved.",
  "B92-21": "Horizontal transom stack known; above/below ownership and datum split are unresolved.",
  "B92-22": "Horizontal transom stack known; above/below ownership and datum split are unresolved.",
  "B92-23": "Row-aware horizontal transom stack known; row-composition ownership and datum split are unresolved.",
  "B92-24": "Row-aware horizontal transom stack known; row-composition ownership and datum split are unresolved.",
} as const satisfies Record<string, string>;

export function getB92SimpleFixedFixedVerticalAssembly(
  profileRef: string
): B92ProfileAssemblyComposition | null {
  if (profileRef !== "B92-11") return null;
  return B92_PROFILE_ASSEMBLY_COMPOSITIONS["B92-11:simple_fixed_fixed_vertical"];
}

export function getB92AssemblyComponentWidthMm(
  composition: B92ProfileAssemblyComposition,
  componentKey: string
): number {
  const component = composition.components.find((item) => item.key === componentKey);
  if (!component) throw new Error(`Missing B92 assembly component ${componentKey} for ${composition.profileRef}.`);
  return component.widthMm;
}

export type B92FlyingAssemblyOrientation = {
  ownerFieldId: string;
  masterSide: "left" | "right";
  slaveSide: "left" | "right";
  mirroredFromCanonical: boolean;
};

export function getB92InternalFlyingVerticalAssembly(profileRef: string): B92ProfileAssemblyComposition | null {
  if (profileRef !== "B92-18") return null;
  return B92_PROFILE_ASSEMBLY_COMPOSITIONS["B92-18:internal_flying_vertical"];
}

export function resolveB92FlyingAssemblyOrientation(input: {
  ownerFieldId?: string | null;
  leftFieldId: string;
  rightFieldId: string;
}): B92FlyingAssemblyOrientation | null {
  if (!input.ownerFieldId) return null;
  if (input.ownerFieldId === input.leftFieldId) {
    return {
      ownerFieldId: input.ownerFieldId,
      masterSide: "left",
      slaveSide: "right",
      mirroredFromCanonical: true,
    };
  }
  if (input.ownerFieldId === input.rightFieldId) {
    return {
      ownerFieldId: input.ownerFieldId,
      masterSide: "right",
      slaveSide: "left",
      mirroredFromCanonical: false,
    };
  }
  return null;
}
