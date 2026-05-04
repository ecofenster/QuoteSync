import React, { useMemo } from "react";
import QuoteSyncDrawingSvg from "../../configurator/rendering/QuoteSyncDrawingSvg";
import { buildB92FixedInternalDrawingModelFromContract } from "../../configurator/rendering/profileResolution/b92ContractDrawingAdapter";
import { b92FixedInternalWindowTypeSourceSeed } from "../../configurator/rendering/profileResolution/b92FixedInternalWindowTypeSource.seed";
import { buildWindowTypeRenderModelFromSource } from "../../configurator/rendering/profileResolution/adminWindowTypeSourceAdapter";
import type { WindowTypeSourceModel } from "./windowTypeSourceModel.types";
import type { WindowTypeDesignListItem } from "./WindowTypeDesignList";
import DivisionJunctionPanel from "./DivisionJunctionPanel";
import FieldDefinitionPanel from "./FieldDefinitionPanel";
import SectionMappingPanel from "./SectionMappingPanel";

type Props = {
  categoryLabel: string;
  fieldCountLabel: string;
  selectedDesign: WindowTypeDesignListItem | null;
};

function resolveWindowTypeSourceModelForPreview(
  selectedDesign: WindowTypeDesignListItem | null
): WindowTypeSourceModel | null {
  if (selectedDesign?.id === "windows-1-fixed") {
    return b92FixedInternalWindowTypeSourceSeed;
  }
  return null;
}

function WindowTypeTechnicalPreview(props: { selectedDesign: WindowTypeDesignListItem | null }) {
  const { selectedDesign } = props;
  const sourceModel = resolveWindowTypeSourceModelForPreview(selectedDesign);
  const previewResult = useMemo(() => {
    if (!sourceModel) {
      return {
        model: null,
        error: "",
      };
    }
    try {
      const contract = buildWindowTypeRenderModelFromSource(sourceModel, {
        widthMm: 1000,
        heightMm: 1000,
      });
      return {
        model: buildB92FixedInternalDrawingModelFromContract(contract),
        error: "",
      };
    } catch (error) {
      return {
        model: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }, [sourceModel]);

  return (
    <div className="admin-card ui-card" style={{ padding: 14, display: "grid", gap: 10 }}>
      <div>
        <div className="admin-group-title">
          {sourceModel ? "Technical Preview — B92 Fixed Internal 1000 x 1000" : "Technical Preview"}
        </div>
        {sourceModel ? (
          <div className="admin-body-copy">
            Dev-only source-model chain: B92, inside view, 1x1, fixed, no sash, no multi-field.
          </div>
        ) : null}
      </div>
      {!sourceModel ? (
        <div className="admin-placeholder-box" style={{ margin: 0 }}>
          Preview not available for this design yet.
        </div>
      ) : previewResult.error ? (
        <div className="admin-placeholder-box" style={{ margin: 0 }}>
          Preview unavailable: {previewResult.error}
        </div>
      ) : previewResult.model ? (
        <div
          style={{
            border: "1px solid #e4e4e7",
            background: "#fff",
            minHeight: 260,
            aspectRatio: "1 / 1",
            display: "grid",
            alignItems: "stretch",
          }}
        >
          <QuoteSyncDrawingSvg model={previewResult.model} />
        </div>
      ) : null}
    </div>
  );
}

export default function WindowTypeEditor(props: Props) {
  const { categoryLabel, fieldCountLabel, selectedDesign } = props;

  return (
    <div style={{ display: "grid", gap: 12, alignContent: "start", minWidth: 0 }}>
      <div className="admin-card ui-card" style={{ padding: 14, display: "grid", gap: 8 }}>
        <div className="admin-group-title">Window Type editor</div>
        <div className="admin-body-copy">
          {categoryLabel} → {fieldCountLabel}
          {selectedDesign ? ` → ${selectedDesign.label}` : ""}
        </div>
        <div className="admin-placeholder-box" style={{ margin: 0 }}>
          Scaffold only. Source-model panels are mounted here, but no Window Type persistence or migration is wired in this pass.
        </div>
      </div>
      <WindowTypeTechnicalPreview selectedDesign={selectedDesign} />
      <FieldDefinitionPanel selectedDesign={selectedDesign} />
      <DivisionJunctionPanel selectedDesign={selectedDesign} />
      <SectionMappingPanel selectedDesign={selectedDesign} />
    </div>
  );
}
