import type { WindowTypeSourceModelFieldOperation } from "./windowTypeSourceModel.types";
import type { WindowTypeDesignListItem } from "./WindowTypeDesignList";

export type FieldOperationMenuContext =
  | "inward_window"
  | "outward_window"
  | "doors"
  | "sliding"
  | "lift_slide";

export type FieldOperationMenuOption = {
  operation: WindowTypeSourceModelFieldOperation;
  label: string;
};

const INWARD_WINDOW_OPTIONS: FieldOperationMenuOption[] = [
  { operation: "fixed", label: "Fixed" },
  { operation: "fixed_sash", label: "Fixed Sash" },
  { operation: "tt_left", label: "Tilt & Turn Left" },
  { operation: "tt_right", label: "Tilt & Turn Right" },
  { operation: "turn_left", label: "Turn Left" },
  { operation: "turn_right", label: "Turn Right" },
  { operation: "tilt_only", label: "Tilt Only" },
];

const OUTWARD_WINDOW_OPTIONS: FieldOperationMenuOption[] = [
  { operation: "fixed", label: "Fixed" },
  { operation: "fixed_sash", label: "Fixed Sash" },
  { operation: "turn_left", label: "Turn Left" },
  { operation: "turn_right", label: "Turn Right" },
  { operation: "top_hung", label: "Top Hung" },
  { operation: "reversible", label: "Reversible" },
  { operation: "pivot", label: "Pivot" },
];

const DOOR_OPTIONS: FieldOperationMenuOption[] = [
  { operation: "fixed", label: "Fixed" },
  { operation: "inward_opening_left", label: "Inward Opening Left" },
  { operation: "inward_opening_right", label: "Inward Opening Right" },
  { operation: "outward_opening_left", label: "Outward Opening Left" },
  { operation: "outward_opening_right", label: "Outward Opening Right" },
];

const SLIDING_OPTIONS: FieldOperationMenuOption[] = [
  { operation: "fixed", label: "Fixed" },
  { operation: "slide_left", label: "Slide Left" },
  { operation: "slide_right", label: "Slide Right" },
];

const LIFT_SLIDE_OPTIONS: FieldOperationMenuOption[] = [
  { operation: "fixed", label: "Fixed" },
  { operation: "lift_slide_left", label: "Lift & Slide Left" },
  { operation: "lift_slide_right", label: "Lift & Slide Right" },
];

export function resolveFieldOperationMenuContext(input: {
  categoryLabel: string;
  selectedDesign: WindowTypeDesignListItem | null;
}): FieldOperationMenuContext {
  const category = input.categoryLabel.trim().toLowerCase();
  const designId = input.selectedDesign?.id ?? "";

  if (category.includes("lift") || designId.startsWith("lift_slide-")) return "lift_slide";
  if (category.includes("sliding") || designId.startsWith("sliding-")) return "sliding";
  if (category.includes("door") || designId.includes("door")) return "doors";
  if (designId.includes("outward")) return "outward_window";
  return "inward_window";
}

export function getFieldOperationOptionsForContext(context: FieldOperationMenuContext): FieldOperationMenuOption[] {
  if (context === "outward_window") return OUTWARD_WINDOW_OPTIONS;
  if (context === "doors") return DOOR_OPTIONS;
  if (context === "sliding") return SLIDING_OPTIONS;
  if (context === "lift_slide") return LIFT_SLIDE_OPTIONS;
  return INWARD_WINDOW_OPTIONS;
}
