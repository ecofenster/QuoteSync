export type ConfiguratorCatalogEntityKey =
  | "manufacturers"
  | "products"
  | "windowTypes"
  | "sectionProfiles"
  | "profileMappings"
  | "renderProfiles"
  | "sectionDrawings"
  | "materials"
  | "colours"
  | "hardware"
  | "glass";

export type ConfiguratorManufacturerRecord = {
  id: string;
  name: string;
  code: string;
  notes: string;
  is_active: boolean;
};

export type ConfiguratorProductRecord = {
  id: string;
  manufacturer_id: string;
  name: string;
  code: string;
  product_family: string;
  notes: string;
  is_active: boolean;
};

export type ConfiguratorWindowTypeRecord = {
  id: string;
  product_id: string;
  name: string;
  code: string;
  opening_direction: string;
  operation_type: string;
  sliding_direction: string;
  view_logic: string;
  notes: string;
  is_active: boolean;
};

export type ConfiguratorSectionProfileCategory =
  | "outer_frame"
  | "sash"
  | "mullion"
  | "flying_mullion"
  | "transom"
  | "coupling"
  | "corner"
  | "cill";

export type ConfiguratorSectionProfileOrientation =
  | "head"
  | "jamb_left"
  | "jamb_right"
  | "bottom"
  | "mullion"
  | "transom"
  | "coupling"
  | "corner";

export type ConfiguratorOperationApplicability =
  | "fixed"
  | "tilt_turn"
  | "turn"
  | "outward_opening"
  | "slide";

export type ConfiguratorSectionProfileRecord = {
  id: string;
  category: ConfiguratorSectionProfileCategory | string;
  family: string;
  code: string;
  name: string;
  description: string;
  orientation_applicability: Array<ConfiguratorSectionProfileOrientation | string>;
  inside_outside_applicability: "inside" | "outside" | "both" | string;
  operation_applicability: Array<ConfiguratorOperationApplicability | string>;
  visible_face_width_mm: number;
  depth_mm: number;
  inset_mm: number;
  overlap_mm: number;
  drawing_reference_ids: string[];
  notes: string;
  is_active: boolean;
};

export type ConfiguratorProfileMappingKey =
  | "frame_head"
  | "frame_jamb_left"
  | "frame_jamb_right"
  | "frame_bottom"
  | "sash_head"
  | "sash_jamb_left"
  | "sash_jamb_right"
  | "sash_bottom"
  | "mullion"
  | "flying_mullion"
  | "transom"
  | "coupling"
  | "corner"
  | "cill";

export type ConfiguratorProfileMappingRecord = {
  id: string;
  manufacturer_id: string | null;
  product_id: string | null;
  window_type_id: string | null;
  profile_id: string;
  mapping_key: ConfiguratorProfileMappingKey | string;
  operation_type: ConfiguratorOperationApplicability | string;
  notes: string;
  is_active: boolean;
};

export type ConfiguratorSectionDrawingRecord = {
  id: string;
  manufacturer_id: string | null;
  product_id: string | null;
  window_type_id: string | null;
  title: string;
  code: string;
  represents: string;
  orientation: string;
  inside_outside_applicability: string;
  section_ref_id: string;
  profile_ref_id: string;
  drawing_purpose: string;
  source_dxf_path: string;
  source_svg_path: string;
  geometry_rules: Record<string, unknown>;
  render_behaviour: Record<string, unknown>;
  notes: string;
  is_active: boolean;
};

export type ConfiguratorSectionGeometryRuleSet = {
  visible_internal_face_mm?: number;
  glass_inset_mm?: number;
  bead_offset_mm?: number;
  bead_visible_face_mm?: number;
  sash_overlap_mm?: number;
  handle_axis_offset_mm?: number;
  hinge_pivot_offset_mm?: number;
  meeting_gap_mm?: number;
};

export type ConfiguratorRenderProfileRecord = {
  id: string;
  manufacturer_id: string | null;
  product_id: string | null;
  window_type_id: string | null;
  name: string;
  code: string;
  operation_type: string;
  view_logic: "inside" | "outside" | "both" | string;
  frame_top_visible_mm: number;
  frame_left_visible_mm: number;
  frame_right_visible_mm: number;
  frame_bottom_visible_mm: number;
  sash_top_visible_mm: number | null;
  sash_left_visible_mm: number | null;
  sash_right_visible_mm: number | null;
  sash_bottom_visible_mm: number | null;
  bead_top_visible_mm: number | null;
  bead_left_visible_mm: number | null;
  bead_right_visible_mm: number | null;
  bead_bottom_visible_mm: number | null;
  preview_width_mm: number;
  preview_height_mm: number;
  handle_axis_offset_mm: number | null;
  handle_height_mm: number | null;
  hinge_pivot_offset_mm: number | null;
  external_cladding_inset_mm?: number | null;
  external_frame_cladding_colour: string;
  external_sash_cladding_colour: string;
  notes: string;
  is_active: boolean;
};

export type ConfiguratorMaterialRecord = {
  id: string;
  manufacturer_id: string | null;
  product_id: string | null;
  name: string;
  code: string;
  material_type: string;
  metadata: Record<string, unknown>;
  notes: string;
  is_active: boolean;
};

export type ConfiguratorColourRecord = {
  id: string;
  manufacturer_id: string | null;
  product_id: string | null;
  name: string;
  code: string;
  finish: string;
  metadata: Record<string, unknown>;
  notes: string;
  is_active: boolean;
};

export type ConfiguratorHardwareRecord = {
  id: string;
  manufacturer_id: string | null;
  product_id: string | null;
  window_type_id: string | null;
  name: string;
  code: string;
  hardware_type: string;
  metadata: Record<string, unknown>;
  notes: string;
  is_active: boolean;
};

export type ConfiguratorGlassRecord = {
  id: string;
  manufacturer_id: string | null;
  product_id: string | null;
  name: string;
  code: string;
  specification: string;
  metadata: Record<string, unknown>;
  notes: string;
  is_active: boolean;
};

export type ConfiguratorCatalogBootstrap = {
  manufacturers: ConfiguratorManufacturerRecord[];
  products: ConfiguratorProductRecord[];
  windowTypes: ConfiguratorWindowTypeRecord[];
  sectionProfiles: ConfiguratorSectionProfileRecord[];
  profileMappings: ConfiguratorProfileMappingRecord[];
  renderProfiles: ConfiguratorRenderProfileRecord[];
  sectionDrawings: ConfiguratorSectionDrawingRecord[];
  materials: ConfiguratorMaterialRecord[];
  colours: ConfiguratorColourRecord[];
  hardware: ConfiguratorHardwareRecord[];
  glass: ConfiguratorGlassRecord[];
};
