export type GlassKind = "float" | "toughened" | "laminated";

export type PaneBuild = {
  kind: GlassKind;
  // for float/toughened use thicknessMm, for laminated use lamCode + effectiveMm
  thicknessMm?: number;
  lamCode?: string;       // e.g. "33.2"
  effectiveMm?: number;  // e.g. 6.76
};

export type Shape =
  | "rect"
  | "circle"
  | "triangle"
  | "trapezoid"
  | "raked"
  | "gable"
  | "hip";

export type Dimensions = {
  widthMm?: number;
  heightMm?: number;
  // optional extras for shapes
  topMm?: number;
  bottomMm?: number;
  leftMm?: number;
  rightMm?: number;
  radiusMm?: number;
};

export type Position = {
  id: string;
  glazing: "single" | "double" | "triple" | "quad";
  panes: PaneBuild[];
  shape: Shape;
  dims: Dimensions;
  areaM2: number;
  unitKg: number;
  avgPaneKg: number;
};