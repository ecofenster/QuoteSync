import React, { useEffect, useMemo, useState } from "react";
import { getConfiguratorCatalogBootstrap } from "../configuratorCatalogService";
import type {
  ConfiguratorSectionMappingRuleRecord,
  ConfiguratorSectionDrawingRecord,
  ConfiguratorSectionOperationContext,
  ConfiguratorSectionMappingRole,
  ConfiguratorSectionProfileRecord,
  ConfiguratorSectionVariantCondition,
} from "../configuratorCatalog.types";
import type { WindowTypeDesignListItem } from "./WindowTypeDesignList";
import SectionReferencePicker, { type SectionReferenceOption } from "./SectionReferencePicker";

type Props = {
  selectedDesign: WindowTypeDesignListItem | null;
};

const MAPPING_ROLES: ConfiguratorSectionMappingRole[] = [
  "left_jamb",
  "right_jamb",
  "head",
  "bottom",
  "cill",
  "static_mullion",
  "flying_mullion",
  "threshold",
];

type LocalSectionMappingRow = Pick<
  ConfiguratorSectionMappingRuleRecord,
  "profile_role" | "variant_condition" | "operation_context" | "section_reference_id"
>;

const DEFAULT_MAPPING_ROWS: LocalSectionMappingRow[] = [
  { profile_role: "left_jamb", variant_condition: "standard", operation_context: "fixed", section_reference_id: null },
  { profile_role: "right_jamb", variant_condition: "standard", operation_context: "fixed", section_reference_id: null },
  { profile_role: "head", variant_condition: "standard", operation_context: "fixed", section_reference_id: null },
  { profile_role: "bottom", variant_condition: "standard", operation_context: "fixed", section_reference_id: null },
  { profile_role: "cill", variant_condition: "frame_only", operation_context: "fixed", section_reference_id: null },
  { profile_role: "static_mullion", variant_condition: "standard", operation_context: "fixed", section_reference_id: null },
  { profile_role: "flying_mullion", variant_condition: "frame_with_sash", operation_context: "tilt_turn", section_reference_id: null },
  { profile_role: "threshold", variant_condition: "standard", operation_context: "door", section_reference_id: null },
];

function buildSectionOptions(
  sectionProfiles: ConfiguratorSectionProfileRecord[],
  sectionDrawings: ConfiguratorSectionDrawingRecord[]
): SectionReferenceOption[] {
  const drawingOptions = sectionDrawings
    .filter((row) => row.is_active)
    .map((row) => ({
      id: row.id,
      referenceLabel: row.code || row.title || row.section_ref_id || "(untitled section)",
      description: row.title || row.represents || null,
    }));

  const profileOptions = sectionProfiles
    .filter((row) => row.is_active)
    .map((row) => ({
      id: row.id,
      referenceLabel: row.code || row.name || "(unnamed profile)",
      description: row.name || row.description || null,
    }));

  const merged = [...drawingOptions, ...profileOptions];
  const seen = new Set<string>();
  return merged.filter((option) => {
    if (!option.id || seen.has(option.id)) return false;
    seen.add(option.id);
    return true;
  });
}

export default function SectionMappingPanel(props: Props) {
  const { selectedDesign } = props;
  const [mappingRows, setMappingRows] = useState<LocalSectionMappingRow[]>(DEFAULT_MAPPING_ROWS);
  const [sectionProfiles, setSectionProfiles] = useState<ConfiguratorSectionProfileRecord[]>([]);
  const [sectionDrawings, setSectionDrawings] = useState<ConfiguratorSectionDrawingRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadCatalog() {
      setIsLoading(true);
      setLoadError("");
      try {
        const bootstrap = await getConfiguratorCatalogBootstrap();
        if (cancelled) return;
        setSectionProfiles(bootstrap.sectionProfiles ?? []);
        setSectionDrawings(bootstrap.sectionDrawings ?? []);
      } catch (error) {
        if (cancelled) return;
        console.error("Failed to load section mapping catalog data", error);
        setLoadError("Failed to load Section Library references.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void loadCatalog();
    return () => {
      cancelled = true;
    };
  }, []);

  const sectionOptions = useMemo(
    () => buildSectionOptions(sectionProfiles, sectionDrawings),
    [sectionProfiles, sectionDrawings]
  );

  function updateRow(
    role: ConfiguratorSectionMappingRole,
    variantCondition: ConfiguratorSectionVariantCondition,
    operationContext: ConfiguratorSectionOperationContext,
    nextId: string | null
  ) {
    setMappingRows((current) =>
      current.map((row) =>
        row.profile_role === role &&
        row.variant_condition === variantCondition &&
        row.operation_context === operationContext
          ? { ...row, section_reference_id: nextId }
          : row
      )
    );
  }

  return (
    <div className="admin-card ui-card qs-migrated-114">
      <div className="admin-group-title">Section Mapping</div>
      <div className="admin-body-copy">
        Local section-mapping rules for:
        {selectedDesign ? ` ${selectedDesign.label}.` : " the selected design."}
      </div>
      <div className="admin-placeholder-box">
        Mapping rule shape:
        <br />
        profileRole + variantCondition + operationContext → sectionReferenceId
        <br />
        Internal and external preview will use the same section references.
      </div>
      {loadError ? <div className="admin-placeholder-box">{loadError}</div> : null}
      <div className="qs-migrated-41">
        {mappingRows.map((row) => (
          <SectionReferencePicker
            key={`${row.profile_role}-${row.variant_condition}-${row.operation_context}`}
            roleLabel={row.profile_role}
            conditionLabel={row.variant_condition}
            contextLabel={row.operation_context}
            options={sectionOptions}
            selectedId={row.section_reference_id}
            onSelect={(id) =>
              updateRow(
                row.profile_role as ConfiguratorSectionMappingRole,
                row.variant_condition as ConfiguratorSectionVariantCondition,
                row.operation_context as ConfiguratorSectionOperationContext,
                id
              )
            }
          />
        ))}
      </div>
      <div className="admin-body-copy qs-migrated-194">
        {isLoading
          ? "Loading Section Library references…"
          : `${sectionOptions.length} section references available in the current catalog.`}
      </div>
    </div>
  );
}
