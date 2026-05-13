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
  status: "renderable" | "blocked";
  totalMm: number;
  components: B92AssemblyComponent[];
  datum: B92AssemblyDatum;
  internalConfirmed: boolean;
  externalConfirmed: boolean;
  note: string;
};

export const B92_SIMPLE_FIXED_FIXED_VERTICAL_ASSEMBLY_CONTEXT = "simple_fixed_fixed_vertical" as const;

export const B92_PROFILE_ASSEMBLY_COMPOSITIONS = {
  "B92-11:simple_fixed_fixed_vertical": {
    profileRef: "B92-11",
    context: B92_SIMPLE_FIXED_FIXED_VERTICAL_ASSEMBLY_CONTEXT,
    axis: "vertical",
    status: "renderable",
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
} as const satisfies Record<string, B92ProfileAssemblyComposition>;

export const B92_BLOCKED_PROFILE_ASSEMBLY_REFS = {
  "B92-12": "Mixed fixed/T&T vertical geometry needs component stack, ownership, and daylight closure evidence.",
  "B92-13": "Mixed fixed/T&T hinge-centre geometry needs component stack, ownership, and daylight closure evidence.",
  "B92-14": "Valid context-dependent fixed/fixed ref; renderable contexts must be separated from simple 2-field B92-11.",
  "B92-15": "T&T/T&T static stack is known, but structural allocation, sash termination, and daylight closure are unresolved.",
  "B92-18": "Internal flying stack is known, but owner/passive allocation and daylight/glass rules are unresolved.",
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
