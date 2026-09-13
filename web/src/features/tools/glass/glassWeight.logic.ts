import type { PaneBuild, Shape, Dimensions } from "./glassWeight.types";
import {calculatePaneWeights} from '../../../../shared/glassWeightArithmetic.js';

export function panesForGlazing(glazing: "single"|"double"|"triple"|"quad"): number {
  if (glazing === "single") return 1;
  if (glazing === "double") return 2;
  if (glazing === "triple") return 3;
  return 4;
}

export function effectiveThicknessMm(p: PaneBuild): number {
  if (p.kind === "laminated") return p.effectiveMm ?? 0;
  return p.thicknessMm ?? 0;
}

export function areaFromShape(shape: Shape, d: Dimensions): number {
  const w = (d.widthMm ?? 0) / 1000;
  const h = (d.heightMm ?? 0) / 1000;

  switch (shape) {
    case "rect":
      return w * h;
    case "circle": {
      const r = (d.radiusMm ?? d.widthMm ?? 0) / 2000; // diameter fallback
      return Math.PI * r * r;
    }
    case "triangle":
      return 0.5 * w * h;
    case "trapezoid": {
      const a = (d.topMm ?? 0) / 1000;
      const b = (d.bottomMm ?? 0) / 1000;
      return ((a + b) / 2) * h;
    }
    case "raked":
    case "gable":
    case "hip":
      // simplified: treat as rectangle for now (as per current PHP baseline behaviour)
      return w * h;
    default:
      return w * h;
  }
}

export function weightForPanes(areaM2: number, panes: PaneBuild[]) {
  return calculatePaneWeights(areaM2,panes.map(effectiveThicknessMm));
}
