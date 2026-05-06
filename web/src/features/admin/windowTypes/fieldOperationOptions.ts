import type { WindowTypeSourceModelFieldOperation } from "./windowTypeSourceModel.types";

export type FieldOperationMenuOption = {
  operation: WindowTypeSourceModelFieldOperation;
  label: string;
  disabled?: boolean;
};

export type FieldOperationMenuGroup = {
  id: string;
  label: string;
  disabled?: boolean;
  options: FieldOperationMenuOption[];
};

export const FIELD_OPERATION_MENU_GROUPS: FieldOperationMenuGroup[] = [
  {
    id: "primary",
    label: "Primary",
    options: [
      { operation: "fixed", label: "Fixed" },
      { operation: "fixed_sash", label: "Fixed Sash" },
      { operation: "tt_left", label: "Tilt & Turn Left" },
      { operation: "tt_right", label: "Tilt & Turn Right" },
      { operation: "turn_left", label: "Turn Left" },
      { operation: "turn_right", label: "Turn Right" },
      { operation: "tilt_only", label: "Tilt Only" },
    ],
  },
  {
    id: "outward-opening",
    label: "Outward opening",
    disabled: true,
    options: [
      { operation: "turn_left", label: "Turn Left", disabled: true },
      { operation: "turn_right", label: "Turn Right", disabled: true },
      { operation: "top_hung", label: "Top Hung", disabled: true },
      { operation: "reversible", label: "Reversible", disabled: true },
      { operation: "pivot", label: "Pivot", disabled: true },
    ],
  },
  {
    id: "doors",
    label: "Doors",
    disabled: true,
    options: [
      { operation: "inward_opening_left", label: "Inward Opening Left", disabled: true },
      { operation: "inward_opening_right", label: "Inward Opening Right", disabled: true },
      { operation: "outward_opening_left", label: "Outward Opening Left", disabled: true },
      { operation: "outward_opening_right", label: "Outward Opening Right", disabled: true },
    ],
  },
  {
    id: "sliding-lift-slide",
    label: "Sliding / Lift & Slide",
    disabled: true,
    options: [
      { operation: "fixed", label: "Fixed", disabled: true },
      { operation: "slide_left", label: "Slide Left", disabled: true },
      { operation: "slide_right", label: "Slide Right", disabled: true },
      { operation: "lift_slide_left", label: "Lift & Slide Left", disabled: true },
      { operation: "lift_slide_right", label: "Lift & Slide Right", disabled: true },
    ],
  },
];
